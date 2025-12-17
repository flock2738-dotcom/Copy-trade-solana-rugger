import { Wallet, Trade } from '../core/ledger';

export const formatters = {
    formatStats(stats: any): string {
        return `
📊 **Statistiques Globales**

Positions Actives: ${stats.activePositions}
Trades Terminés: ${stats.totalTrades - stats.activePositions}
Win Rate: ${stats.winRate.toFixed(1)}%

PNL Total: ${stats.totalPnl.toFixed(4)} SOL
        `;
    },

    formatWallets(wallets: Wallet[]): string {
        let message = `💼 **WALLETS SUIVIS** (${wallets.length})\n\n`;
        
        wallets.forEach((w: Wallet) => {
            const status = w.isActive ? '🟢' : '🔴';
            const addr = w.address.slice(0, 8);
            const type = w.type;
            message += `${status} \`${addr}...\` (${type})\n`;
        });
        
        return message;
    },

    formatTrade(trade: Trade): string {
        const statusEmoji = trade.status === 'ACTIVE' ? '🟢' : trade.status === 'CLOSED' ? '🔴' : '🟡';
        const pnlLine = trade.pnl !== undefined ? `\n\n💰 PNL: ${trade.pnl.toFixed(4)} SOL (${trade.pnlPercent?.toFixed(2)}%)` : '';
        
        const tokenDisplay = trade.tokenSymbol || trade.tokenMint.slice(0, 8) + '...';
        const buyPriceDisplay = trade.buyPrice ? trade.buyPrice.toFixed(6) : 'N/A';
        const sellPriceDisplay = trade.sellPrice ? trade.sellPrice.toFixed(6) : 'N/A';
        
        return `
📈 **TRADE ${trade.id} - ${statusEmoji} ${trade.status}**

Token: **${tokenDisplay}**
Type: ${trade.type}
Montant: ${trade.amountSol} SOL

Entrée: ${buyPriceDisplay}
Sortie: ${sellPriceDisplay}
TP: +${trade.tpPercent}% | SL: -${trade.slPercent}%
Source: \`${trade.walletSource.slice(0, 8)}...\`
Mode: ${trade.mode}${pnlLine}
Timestamp: ${new Date(trade.timestamp).toLocaleString()}
        `;
    }
};
