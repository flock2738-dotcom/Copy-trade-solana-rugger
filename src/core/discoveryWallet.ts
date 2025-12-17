import { Connection, PublicKey } from '@solana/web3.js';
import { config, runtimeConfig, getRuntimeConfig } from '../config/environment';
import { ledger } from './ledger';

interface DiscoveredWallet {
    address: string;
    discoveredAt: number;
    transferAmount: number;
    fromWallet: string;
    notified: boolean;
}

class DiscoveryWallet {
    private connection: Connection;
    private discoveredWallets: Map<string, DiscoveredWallet> = new Map();
    private _isRunning: boolean = false;

    constructor() {
        this.connection = new Connection(config.rpcHttps, 'confirmed');
    }

    start() {
        if (this._isRunning) {
            console.log('Discovery Wallet déjà actif');
            return;
        }

        console.log('🔍 Démarrage Discovery Wallet...');
        this._isRunning = true;

        console.log(`📊 Critères de découverte:`);
        console.log(`   Min: ${runtimeConfig.minSolTransfer} SOL`);
        console.log(`   Max: ${runtimeConfig.maxSolTransfer} SOL`);
    }

    stop() {
        this._isRunning = false;
        console.log('🛑 Discovery Wallet arrêté');
    }

    async processTransfer(
        fromWallet: string,
        toWallet: string,
        amount: number,
        signature: string
    ) {
        if (!this._isRunning) return;

        if (amount < runtimeConfig.minSolTransfer || amount > runtimeConfig.maxSolTransfer) {
            return;
        }

        if (ledger.isWalletFollowed(toWallet)) {
            return;
        }

        if (this.discoveredWallets.has(toWallet)) {
            const existing = this.discoveredWallets.get(toWallet)!;
            if (amount > existing.transferAmount) {
                existing.transferAmount = amount;
            }
            return;
        }
        
        const discovery: DiscoveredWallet = {
            address: toWallet,
            discoveredAt: Date.now(),
            transferAmount: amount,
            fromWallet: fromWallet,
            notified: false
        };

        this.discoveredWallets.set(toWallet, discovery);
        
        const botConfig = getRuntimeConfig();
        if (botConfig.discoveryEnabled) {
            const { telegramBot } = await import('../telegram/bot');
            telegramBot.sendWalletDiscovered(toWallet, amount);
            discovery.notified = true;
        }
        
        console.log(`✨ Nouveau wallet découvert: ${toWallet.slice(0, 8)}... (from ${fromWallet.slice(0, 8)}...) - ${amount} SOL`);
    }

    async addDiscoveredWalletToFollow(address: string): Promise<boolean> {
        const discovery = this.discoveredWallets.get(address);

        if (!discovery) {
            return false;
        }

        if (ledger.isWalletFollowed(address)) {
            return false;
        }

        ledger.addWallet(address, 'discovery');

        const { listener } = await import('./listener');
        listener.addWallet(address);

        console.log(`✅ Wallet ${address.slice(0, 8)}... ajouté avec succès`);

        const { telegramBot } = await import('../telegram/bot');
        telegramBot.getBot().sendMessage(
            config.chatId,
            `✅ Wallet ajouté avec succès!\n\n\`${address}\`\n\nLe bot surveille maintenant ce wallet.`,
            { parse_mode: 'Markdown' }
        );

        return true;
    }

    getDiscoveredWallets(): DiscoveredWallet[] {
        return Array.from(this.discoveredWallets.values());
    }

    getUnnotifiedCount(): number {
        return Array.from(this.discoveredWallets.values())
            .filter(d => !d.notified).length;
    }

    clearOldDiscoveries(olderThanHours: number = 24) {
        const cutoff = Date.now() - (olderThanHours * 60 * 60 * 1000);

        let cleared = 0;
        for (const [address, discovery] of this.discoveredWallets.entries()) {
            if (discovery.discoveredAt < cutoff) {
                this.discoveredWallets.delete(address);
                cleared++;
            }
        }

        if (cleared > 0) {
            console.log(`🧹 ${cleared} découvertes anciennes nettoyées`);
        }
    }

    isRunning(): boolean {
        return this._isRunning;
    }

    getStats() {
        const discoveries = this.getDiscoveredWallets();
        const added = discoveries.filter(d => ledger.isWalletFollowed(d.address)).length;

        return {
            totalDiscoveries: discoveries.length,
            addedToFollow: added,
            pendingReview: discoveries.length - added,
            isRunning: this.isRunning()
        };
    }
}

export const discoveryWallet = new DiscoveryWallet();
