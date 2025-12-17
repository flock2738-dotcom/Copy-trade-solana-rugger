// utils/formatter.ts

// Les imports doivent pointer vers la définition de Wallet et Trade
import { Wallet, Trade } from '../core/ledger'; 

export const formatters = {
    /**
     * Formate les statistiques générales du bot.
     */
    formatStats(stats: any): string {
        return `📊 **STATISTIQUES**
- Trades traités: **${stats.tradesProcessed}**
- Profit total: **${stats.totalProfit.toFixed(4)} SOL**
- Dernière mise à jour: \`${new Date(stats.lastUpdated).toLocaleTimeString()}\`
        `;
    },

    /**
     * Formate la liste des wallets suivis.
     * @param wallets Liste des objets Wallet.
     */
    // --- CORRECTION 3 : TYPAGE CORRECT ---
    formatWallets(wallets: Wallet[]): string {
        let message = `💼 **WALLETS SUIVIS** (${wallets.length})\n\n`;
        
        if (wallets.length === 0) {
            return message + "_Aucun wallet n'est actuellement suivi._";
        }

        wallets.forEach(w => {
            // Les propriétés (isActive, address, type) sont maintenant garanties par le type Wallet
            const status = w.isActive ? '🟢 Actif' : '🔴 Inactif';
            const addressShort = w.address.slice(0, 8) + '...';
            message += `${status} \`${addressShort}\` (${w.type})\n`;
        });
        
        return message;
    },

    /**
     * Formate un événement de trade pour l'affichage.
     */
    formatTrade(trade: Trade): string {
        // La structure de Trade est hypothétique ici
        const typeEmoji = trade.type === 'BUY' ? '⬆️ Achat' : '⬇️ Vente';
        return `
🚨 **NOUVEAU TRADE DÉTECTÉ** 🚨
Type: **${typeEmoji}**
Montant: **${trade.amountSol.toFixed(4)} SOL**
Source: \`${trade.walletSource.slice(0, 8)}...\`
Heure: \`${new Date(trade.timestamp).toLocaleTimeString()}\`
        `;
    }
};
