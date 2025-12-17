import WebSocket from 'ws';
import { PublicKey } from '@solana/web3.js';
import { config, runtimeConfig } from '../config/environment';
import { ledger } from './ledger';

interface TransactionLog {
    signature: string;
    err: any;
    logs: string[];
}

interface ParsedTransaction {
    walletSource: string;
    type: 'BUY' | 'SELL' | 'TRANSFER' | 'UNKNOWN';
    tokenMint?: string;
    tokenSymbol?: string;
    amountSol: number;
    amountTokens?: number;
    destinationWallet?: string;
    timestamp: number;
}

class SolanaListener {
    private ws: WebSocket | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;
    private subscriptionId: number | null = null;
    private isRunning = false;
    private watchedWallets: Set<string> = new Set();
    private isConnected = false;

    constructor() {
        this.watchedWallets.add(config.masterWallet);
        ledger.getWallets().forEach(w => this.watchedWallets.add(w.address));
    }

    start() {
        if (this.isRunning) {
            console.log('Listener déjà actif');
            return;
        }

        console.log('🎧 Démarrage du listener WebSocket...');
        this.isRunning = true;
        this.connect();
    }

    stop() {
        this.isRunning = false;
        if (this.ws) {
            if (this.subscriptionId !== null) {
                const unsubscribeMessage = {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "logsUnsubscribe",
                    params: [this.subscriptionId]
                };
                this.ws.send(JSON.stringify(unsubscribeMessage));
                this.subscriptionId = null;
            }
            
            this.ws.close();
            this.ws = null;
            this.isConnected = false;
            console.log('🛑 Listener arrêté');
        }
    }

    private connect() {
        if (!this.isRunning) return;
        
        console.log(`📡 Tentative de connexion à ${config.quicknodeWss}...`);
        this.ws = new WebSocket(config.quicknodeWss);

        this.ws.on('open', () => {
            console.log('✅ Connecté au WebSocket de QuickNode.');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.subscribeToWallets();
        });

        this.ws.on('message', (data) => {
            const message = JSON.parse(data.toString());
            if (message.params && message.params.result) {
                this.handleLogMessage(message.params.result as TransactionLog);
            } else if (message.result) {
                this.subscriptionId = message.result;
                console.log(`✅ Abonnement aux logs réussi. ID: ${this.subscriptionId}`);
            }
        });

        this.ws.on('close', (code, reason) => {
            this.isConnected = false;
            console.log(`❌ Connexion WebSocket fermée. Code: ${code}. Raison: ${reason.toString()}`);
            if (this.isRunning) {
                this.reconnect();
            }
        });

        this.ws.on('error', (error) => {
            console.error('❌ Erreur WebSocket:', error);
            if (this.isRunning) {
                this.reconnect();
            }
        });
    }

    private reconnect() {
        if (!this.isRunning || this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('❌ Trop de tentatives de reconnexion. Arrêt.');
            this.isRunning = false;
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(2 ** this.reconnectAttempts * 1000, 30000);
        console.log(`⏳ Reconnexion dans ${delay / 1000}s... (Tentative ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => this.connect(), delay);
    }

    private subscribeToWallets() {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const addresses = Array.from(this.watchedWallets);

            if (addresses.length === 0) {
                console.log('⚠️ Aucune adresse à surveiller.');
                return;
            }
            
            const subscribeMessage = {
                jsonrpc: "2.0",
                id: 1,
                method: "logsSubscribe",
                params: [
                    {
                        "mentions": addresses
                    },
                    {
                        "commitment": "confirmed"
                    }
                ]
            };

            this.ws.send(JSON.stringify(subscribeMessage));
            console.log(`✅ Abonnement aux logs de ${addresses.length} adresses...`);
        }
    }

    private subscribeToWallet(address: string) {
        if (this.subscriptionId !== null) {
            const unsubscribeMessage = {
                jsonrpc: "2.0",
                id: 1,
                method: "logsUnsubscribe",
                params: [this.subscriptionId]
            };
            this.ws?.send(JSON.stringify(unsubscribeMessage));
            this.subscriptionId = null;
        }
        this.subscribeToWallets();
    }

    private async handleLogMessage(log: TransactionLog) {
        if (log.err) return;

        const watchedWalletsArray = Array.from(this.watchedWallets);
        const isTradeEvent = log.logs.some(logLine => logLine.includes('Program TokenkegQfeZ'));

        if (!isTradeEvent) return;

        const parsed: ParsedTransaction = this.mockParseTransaction(log, watchedWalletsArray);
        
        if (parsed.type === 'UNKNOWN') return;
        
        if (!parsed.walletSource || parsed.walletSource === 'N/A') {
            console.warn(`⚠️ Wallet source invalide dans le parsing: ${log.signature}`);
            return;
        }

        // Import dynamique pour éviter la dépendance circulaire
        const { discoveryWallet } = await import('./discoveryWallet');
        
        if (parsed.type === 'TRANSFER' && parsed.destinationWallet && !ledger.isWalletFollowed(parsed.destinationWallet)) {
            discoveryWallet.processTransfer(
                parsed.walletSource,
                parsed.destinationWallet,
                parsed.amountSol,
                log.signature
            );
        }

        const source = parsed.walletSource;
        
        if (ledger.isWalletFollowed(source) && (parsed.type === 'BUY' || parsed.type === 'SELL')) {
            if (!parsed.tokenMint) {
                console.warn(`⚠️ Trade détecté mais Token Mint manquant dans le parsing: ${log.signature}`);
                return;
            }

            console.log(`🎯 ${parsed.type} détecté de ${source.slice(0, 8)}...: ${parsed.tokenMint.slice(0, 8)}...`);

            const trade = ledger.createTrade({
                walletSource: source,
                tokenMint: parsed.tokenMint,
                tokenSymbol: parsed.tokenSymbol,
                type: parsed.type,
                amountSol: runtimeConfig.tradeSize,
                tpPercent: runtimeConfig.tpPercent,
                slPercent: runtimeConfig.slPercent,
                mode: config.mode
            });

            const { telegramBot } = await import('../telegram/bot');
            await telegramBot.sendTradeDetected(trade);
        }
    }

    private mockParseTransaction(log: TransactionLog, watchedWallets: string[]): ParsedTransaction {
        const relevantLog = log.logs.find(l => watchedWallets.some(w => l.includes(w)));
        
        if (relevantLog) {
            const isBuy = relevantLog.includes('transfer SOL for token');
            const isSell = relevantLog.includes('transfer token for SOL');
            const isTransfer = relevantLog.includes('transfer SOL');
            
            const source = watchedWallets.find(w => relevantLog.includes(w)) || config.masterWallet;

            if (isBuy || isSell) {
                return {
                    walletSource: source,
                    type: isBuy ? 'BUY' : 'SELL',
                    tokenMint: 'TokenMintPlaceholder',
                    tokenSymbol: isBuy ? 'BUY' : 'SELL',
                    amountSol: 1.0,
                    timestamp: Date.now()
                };
            } else if (isTransfer) {
                return {
                    walletSource: 'FromWalletPlaceholder',
                    type: 'TRANSFER',
                    amountSol: 0.5,
                    destinationWallet: 'ToWalletPlaceholder',
                    timestamp: Date.now()
                };
            }
        }
        
        if (log.signature.includes('BUY')) {
            return {
                walletSource: config.masterWallet,
                type: 'BUY',
                tokenMint: 'JUPAS2rNjpZ1A9e1P98',
                tokenSymbol: 'JUP',
                amountSol: 1.0,
                timestamp: Date.now()
            };
        }

        return {
            walletSource: config.masterWallet,
            type: 'UNKNOWN',
            amountSol: 0,
            timestamp: Date.now()
        };
    }

    addWallet(address: string) {
        if (!this.watchedWallets.has(address)) {
            this.watchedWallets.add(address);
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.subscribeToWallet(address);
            }
            console.log(`➕ Wallet ajouté: ${address.slice(0, 8)}...`);
        }
    }

    removeWallet(address: string) {
        this.watchedWallets.delete(address);
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.subscribeToWallet(address);
        }
        console.log(`➖ Wallet retiré: ${address.slice(0, 8)}...`);
    }

    getWatchedWallets(): string[] {
        return Array.from(this.watchedWallets);
    }

    isActive(): boolean {
        return this.isRunning && this.isConnected;
    }
}

export const listener = new SolanaListener();
