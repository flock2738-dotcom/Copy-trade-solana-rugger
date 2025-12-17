import { config } from '../config/environment';
import * as fs from 'fs';
import * as path from 'path';

// Interfaces
export interface Wallet {
    address: string;
    type: 'master' | 'discovery' | 'manual';
    addedAt: number;
    isActive: boolean;
}

export interface Trade {
    id: string;
    walletSource: string;
    tokenMint: string;
    tokenSymbol?: string;
    type: 'BUY' | 'SELL';
    status: 'PENDING' | 'ACTIVE' | 'CLOSED';
    amountSol: number;
    tpPercent: number;
    slPercent: number;
    mode: 'TEST' | 'REAL';
    buyPrice?: number;
    sellPrice?: number;
    pnl?: number;
    pnlPercent?: number;
    timestamp: number;
}

export interface TradeData {
    walletSource: string;
    tokenMint: string;
    tokenSymbol?: string;
    type: 'BUY' | 'SELL';
    amountSol: number;
    tpPercent: number;
    slPercent: number;
    mode: 'TEST' | 'REAL';
}

const STATE_FILE = path.join(process.cwd(), 'state.json');

class Ledger {
    private wallets: Map<string, Wallet> = new Map();
    private trades: Map<string, Trade> = new Map();

    constructor() {
        this.addWallet(config.masterWallet, 'master', false);
    }

    loadState() {
        if (!fs.existsSync(STATE_FILE)) {
            console.log('💾 Aucun fichier d\'état trouvé. Démarrage à neuf.');
            
            if (!this.wallets.has(config.masterWallet)) {
                this.addWallet(config.masterWallet, 'master', true);
            }
            return;
        }

        try {
            const data = fs.readFileSync(STATE_FILE, 'utf-8');
            const state = JSON.parse(data);
            
            this.wallets = new Map(
                state.wallets.map((w: Wallet) => [w.address, w])
            );
            
            if (!this.wallets.has(config.masterWallet)) {
                this.addWallet(config.masterWallet, 'master', true);
            } else {
                const master = this.wallets.get(config.masterWallet)!;
                if (master.type !== 'master') {
                    master.type = 'master';
                    this.wallets.set(config.masterWallet, master);
                }
            }

            this.trades = new Map(
                state.trades.map((t: Trade) => [t.id, t])
            );

            console.log(`✅ État chargé: ${this.wallets.size} wallets, ${this.trades.size} trades.`);

        } catch (error) {
            console.error('❌ Erreur lors du chargement de l\'état:', error);
        }
    }

    saveState() {
        try {
            const state = {
                wallets: Array.from(this.wallets.values()),
                trades: Array.from(this.trades.values()),
            };
            fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
        } catch (error) {
            console.error('❌ Erreur lors de la sauvegarde de l\'état:', error);
        }
    }

    addWallet(address: string, type: 'master' | 'discovery' | 'manual', isActive: boolean = true) {
        if (this.wallets.has(address)) {
            const existing = this.wallets.get(address)!;
            this.wallets.set(address, { ...existing, isActive, type });
            this.saveState();
            return;
        }

        const newWallet: Wallet = {
            address,
            type,
            addedAt: Date.now(),
            isActive
        };
        this.wallets.set(address, newWallet);
        this.saveState();
    }

    removeWallet(address: string) {
        if (address === config.masterWallet) {
            console.warn('⚠️ Le master wallet ne peut pas être supprimé.');
            return;
        }
        this.wallets.delete(address);
        this.saveState();
    }

    toggleWalletActive(address: string) {
        const wallet = this.wallets.get(address);
        if (wallet) {
            wallet.isActive = !wallet.isActive;
            this.wallets.set(address, wallet);
            this.saveState();
        }
    }

    isWalletFollowed(address: string): boolean {
        const wallet = this.wallets.get(address);
        return !!wallet && wallet.isActive;
    }

    getWallets(): Wallet[] {
        return Array.from(this.wallets.values());
    }

    createTrade(tradeData: TradeData): Trade {
        const newTrade: Trade = {
            id: 'T' + Date.now() + Math.floor(Math.random() * 1000),
            status: 'PENDING',
            ...tradeData,
            tokenSymbol: tradeData.tokenSymbol || 'MOCK',
            pnl: 0,
            timestamp: Date.now()
        };
        this.trades.set(newTrade.id, newTrade);
        this.saveState();
        return newTrade;
    }

    getTrade(id: string): Trade | undefined {
        return this.trades.get(id);
    }

    updateTrade(id: string, updates: Partial<Trade>) {
        const trade = this.getTrade(id);
        if (trade) {
            this.trades.set(id, { ...trade, ...updates });
            this.saveState();
        }
    }

    getActiveTrades(): Trade[] {
        return Array.from(this.trades.values()).filter(t => t.status === 'ACTIVE');
    }

    getStats() {
        const allTrades = Array.from(this.trades.values());
        const closedTrades = allTrades.filter(t => t.status === 'CLOSED');
        
        const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const winners = closedTrades.filter(t => (t.pnl || 0) > 0).length;
        
        return {
            activePositions: allTrades.filter(t => t.status === 'ACTIVE').length,
            totalTrades: allTrades.length,
            totalPnl,
            winRate: closedTrades.length > 0 ? (winners / closedTrades.length) * 100 : 0
        };
    }
}

export const ledger = new Ledger();
