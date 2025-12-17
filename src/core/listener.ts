// core/listener.ts

import { Connection, PublicKey, SignatureResult, TransactionResponse } from '@solana/web3.js';
import { EventEmitter } from 'events';
import { config } from '../config/environment';
import { Wallet } from './ledger'; // Import supposé
import { TransactionLog, ParsedTransaction } from './types'; // Types supposés

/**
 * Gère l'écoute des logs et des transactions sur la blockchain Solana.
 */
export class Listener extends EventEmitter {
    private connection: Connection;
    private subscriptionId: number | null = null;
    private watchedWallets: Map<string, Wallet> = new Map();

    constructor(connection: Connection) {
        super();
        this.connection = connection;
    }

    public async start() {
        if (this.subscriptionId) {
            console.log("Listener est déjà démarré.");
            return;
        }

        const programId = new PublicKey(config.programId); 
        
        console.log(`Démarrage de l'écoute des logs pour le Programme ID: ${config.programId}...`);

        this.subscriptionId = this.connection.onProgramAccountChange(
            programId,
            (accountInfo, context) => {
                // Ce bloc est pour les changements d'état de compte, non utilisé ici
            },
            'confirmed'
        );

        // Cette partie est généralement pour l'écoute des logs (signatures de transactions)
        // On utilise ici une simulation ou un programme d'écoute plus spécifique,
        // mais pour l'exemple, nous allons simuler la réception d'un log.
        // En production, on utiliserait onLogs ou un service RPC pour les logs de transactions.
        
        // Simulation d'une boucle d'écoute pour l'exemple
        setInterval(() => {
            if (Math.random() < 0.2) {
                this.simulateNewTransactionLog();
            }
        }, 5000);
    }

    public async stop() {
        if (this.subscriptionId !== null) {
            await this.connection.removeAccountChangeListener(this.subscriptionId);
            this.subscriptionId = null;
            console.log("Listener arrêté.");
        }
    }

    public updateWatchedWallets(wallets: Wallet[]) {
        this.watchedWallets.clear();
        wallets.forEach(w => this.watchedWallets.set(w.address, w));
        console.log(`Nombre de Wallets suivis mis à jour : ${this.watchedWallets.size}`);
    }

    private simulateNewTransactionLog() {
        const mockLog: TransactionLog = {
            signature: `MockTxn${Date.now()}`,
            err: null,
            slot: Math.floor(Math.random() * 1000000),
            meta: { 
                logMessages: ['Program log: Instruction A', 'Program log: Instruction B'],
                fee: 5000,
                // ... autres champs
            }
        };
        this.handleLogMessage(mockLog);
    }

    private handleLogMessage(log: TransactionLog) {
        if (log.err) return; 

        const watchedWalletsArray = Array.from(this.watchedWallets.keys());
        
        // 1. Simuler le parsing de la transaction pour extraire les données pertinentes
        const parsed: ParsedTransaction = this.mockParseTransaction(log, watchedWalletsArray);
        
        if (parsed.type === 'UNKNOWN') return;
        
        // --- CORRECTION 2 : AJOUT DE VALIDATION ---
        if (!parsed.walletSource || parsed.walletSource === 'N/A') {
            console.warn(`⚠️ Wallet source invalide dans le parsing: ${log.signature}`);
            return;
        }
        
        // 2. Émettre l'événement pour le bot ou le module de trading
        this.emit('newTrade', parsed);
        console.log(`Trade détecté: ${parsed.type} de ${parsed.amountSol} SOL par ${parsed.walletSource}`);
    }

    // Fonction de simulation qui devrait être remplacée par un vrai parseur
    private mockParseTransaction(log: TransactionLog, watchedWallets: string[]): ParsedTransaction {
        // Logique de simulation pour trouver un wallet
        const foundWallet = watchedWallets.find(w => w.includes('...')) || null; // Simuler la recherche

        if (foundWallet && Math.random() > 0.5) {
            return {
                walletSource: foundWallet, 
                type: Math.random() > 0.7 ? 'BUY' : 'SELL',
                amountSol: parseFloat((Math.random() * 10).toFixed(4)),
                timestamp: Date.now()
            };
        }
        
        // --- CORRECTION 1 : Remplacement de 'N/A' ---
        // Utilise toujours une string valide pour satisfaire le type ParsedTransaction
        return {
            walletSource: config.masterWallet, // ✅ CORRECTION
            type: 'UNKNOWN',
            amountSol: 0,
            timestamp: Date.now()
        };
    }
}
