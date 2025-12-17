import TelegramBot, { InlineKeyboardButton } from 'node-telegram-bot-api';
import { PublicKey } from '@solana/web3.js';
import { config, runtimeConfig, updateRuntimeConfig, getRuntimeConfig } from '../config/environment';
import { keyboards } from './keyboards';
import { ledger, Trade } from '../core/ledger';
import { formatters } from '../utils/formatter';
import { copyEngine } from '../core/copyEngine';
import { discoveryWallet } from '../core/discoveryWallet';

class TelegramBotManager {
  private bot: TelegramBot;
  private botActive: boolean = false;
  private waitingForInput: { chatId: number; step: string; data?: any } | null = null;

  constructor() {
    this.bot = new TelegramBot(config.tgToken, { polling: true });
    this.setupHandlers();
    this.botActive = false;
  }

  init() {
    this.botActive = true;
    console.log('Telegram Bot Polling démarré.');
  }

  getBot(): TelegramBot {
    return this.bot;
  }

  private setupHandlers() {
    this.bot.onText(/\/(start|menu)/, (msg) => {
      this.sendMainMenu(msg.chat.id);
    });

    this.bot.on('callback_query', async (query) => {
      const chatId = query.message?.chat.id;
      const data = query.data;
      
      if (!chatId || !data) return;
      if (chatId.toString() !== config.chatId) {
        this.bot.sendMessage(chatId, "Accès refusé. Veuillez utiliser le bon Chat ID.");
        return;
      }
      
      await this.handleCallback(chatId, data, query.message?.message_id);
      this.bot.answerCallbackQuery(query.id);
    });

    this.bot.on('message', (msg) => {
        const chatId = msg.chat.id;

        if (chatId.toString() !== config.chatId) {
            this.bot.sendMessage(chatId, "Accès refusé.");
            return;
        }

        if (msg.text && !msg.text.startsWith('/') && this.waitingForInput && this.waitingForInput.chatId === chatId) {
            this.handleTextInput(chatId, msg.text, msg.message_id);
        }
    });
  }

  private sendMainMenu(chatId: number, messageId?: number) {
    const text = '🤖 **BOT SOLANA COPY TRADING**\n\nSélectionnez une option :';
    const options = {
      parse_mode: 'Markdown' as const,
      reply_markup: {
        inline_keyboard: keyboards.mainMenu()
      }
    };

    if (messageId) {
        this.bot.editMessageText(text, { chat_id: chatId, message_id: messageId, ...options });
    } else {
        this.bot.sendMessage(chatId, text, options);
    }
  }

  private sendSettingsMenu(chatId: number, messageId: number) {
    const cfg = getRuntimeConfig();
    const discoveryStatus = cfg.discoveryEnabled ? '🟢 ACTIF' : '🔴 INACTIF';
    const autoCopyStatus = cfg.autoCopy ? '✅ OUI' : '❌ NON';

    const text = `⚙️ **PARAMÈTRES ACTUELS**\n\nTaille Trade: \`${cfg.tradeSize} SOL\`\nTake Profit: \`+${cfg.tpPercent}%\`\nStop Loss: \`-${cfg.slPercent}%\`\nAuto Copy: \`${autoCopyStatus}\`\nDiscovery Mode: \`${discoveryStatus}\`\n\nSélectionnez ce que vous souhaitez modifier :`;
    
    this.bot.editMessageText(text, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: keyboards.settingsMenu(cfg.autoCopy, cfg.discoveryEnabled)
      }
    });
  }

  private async handleCallback(chatId: number, data: string, messageId?: number) {
    if (!messageId) return;

    if (data === 'main_menu') {
        this.sendMainMenu(chatId, messageId);
        return;
    }
    
    if (data === 'start_bot') {
        const { listener } = await import('../core/listener');
        listener.start();
        discoveryWallet.start();
        await this.bot.editMessageText('✅ Bot démarré. Le listener et le discovery wallet sont actifs.', { chat_id: chatId, message_id: messageId });
        this.sendMainMenu(chatId, messageId);
        return;
    }

    if (data === 'stop_bot') {
        const { listener } = await import('../core/listener');
        listener.stop();
        discoveryWallet.stop();
        await this.bot.editMessageText('🛑 Bot arrêté. Le listener et le discovery wallet sont inactifs.', { chat_id: chatId, message_id: messageId });
        this.sendMainMenu(chatId, messageId);
        return;
    }

    if (data === 'settings') {
        this.sendSettingsMenu(chatId, messageId);
        return;
    }

    if (data === 'show_config') {
        this.sendSettingsMenu(chatId, messageId);
        return;
    }
    
    if (data === 'show_wallets') {
        const wallets = ledger.getWallets();
        const message = formatters.formatWallets(wallets);
        this.bot.editMessageText(message, { 
            chat_id: chatId, 
            message_id: messageId, 
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboards.backToMain() } // CORRECTION: backToMain au lieu de backToMenu
        });
        return;
    }

    if (data === 'show_pnl') {
        const stats = ledger.getStats();
        const message = formatters.formatStats(stats);
        this.bot.editMessageText(message, { 
            chat_id: chatId, 
            message_id: messageId, 
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboards.backToMain() } // CORRECTION: backToMain au lieu de backToMenu
        });
        return;
    }

    if (data.startsWith('set_')) {
        this.waitingForInput = { chatId: chatId, step: data, data: { messageId } };
        let prompt = '';

        if (data === 'set_trade_size') {
            prompt = `Entrez la nouvelle taille de trade en SOL (actuel: ${runtimeConfig.tradeSize} SOL).`;
        } else if (data === 'set_tp') {
            prompt = `Entrez le nouveau pourcentage de Take Profit (actuel: +${runtimeConfig.tpPercent}%). Exemple: 50`;
        } else if (data === 'set_sl') {
            prompt = `Entrez le nouveau pourcentage de Stop Loss (actuel: -${runtimeConfig.slPercent}%). Exemple: 20`;
        } else if (data === 'add_wallet') {
            prompt = `Entrez l'adresse du wallet Solana à suivre.`;
        }
        
        await this.bot.editMessageText(prompt, { 
            chat_id: chatId, 
            message_id: messageId, 
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboards.backToMain() } // CORRECTION: backToMain au lieu de backToMenu
        });
        return;
    }

    if (data === 'toggle_discovery') {
        const newStatus = !runtimeConfig.discoveryEnabled;
        updateRuntimeConfig({ discoveryEnabled: newStatus });
        const statusText = newStatus ? '🟢 ACTIF' : '🔴 INACTIF';
        await this.bot.editMessageText(`✅ Discovery Mode mis à jour: **${statusText}**`, { 
            chat_id: chatId, 
            message_id: messageId, 
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboards.backToSettings() } // CORRECTION: Ajouté
        });
        setTimeout(() => this.sendSettingsMenu(chatId, messageId), 1500);
        return;
    }

    if (data === 'toggle_autocopy') {
        const newStatus = !runtimeConfig.autoCopy;
        updateRuntimeConfig({ autoCopy: newStatus });
        const statusText = newStatus ? '✅ OUI' : '❌ NON';
        await this.bot.editMessageText(`✅ Auto Copy mis à jour: **${statusText}**`, { 
            chat_id: chatId, 
            message_id: messageId, 
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboards.backToSettings() } // CORRECTION: Ajouté
        });
        setTimeout(() => this.sendSettingsMenu(chatId, messageId), 1500);
        return;
    }

    if (data.startsWith('follow_wallet_')) {
        const address = data.substring('follow_wallet_'.length);
        const success = await discoveryWallet.addDiscoveredWalletToFollow(address);
        
        if (success) {
            await this.bot.editMessageText(`✅ Le wallet \`${address.slice(0, 8)}...\` a été ajouté à la liste des suivis.`, { 
                chat_id: chatId, 
                message_id: messageId, 
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboards.backToMain() } // CORRECTION: backToMain au lieu de backToMenu
            });
        } else {
            await this.bot.editMessageText(`❌ Erreur: Impossible d'ajouter le wallet \`${address.slice(0, 8)}...\`. Il est peut-être déjà suivi ou n'a pas été découvert.`, { 
                chat_id: chatId, 
                message_id: messageId, 
                parse_mode: 'Markdown',
                reply_markup: { inline_keyboard: keyboards.backToMain() } // CORRECTION: backToMain au lieu de backToMenu
            });
        }
        return;
    }

    if (data === 'ignore_wallet') {
        this.bot.deleteMessage(chatId, messageId);
        return;
    }
  }

  private async handleTextInput(chatId: number, text: string, messageId: number) {
    if (!this.waitingForInput) return;
    
    const step = this.waitingForInput.step;
    const previousMessageId = this.waitingForInput.data?.messageId;
    this.waitingForInput = null;

    let responseText = `✅ Modification enregistrée.`;

    if (step === 'set_trade_size') {
        const value = parseFloat(text);
        if (isNaN(value) || value <= 0) {
            responseText = '❌ Erreur: Veuillez entrer un nombre valide supérieur à zéro.';
        } else {
            updateRuntimeConfig({ tradeSize: value });
            responseText = `✅ Taille de trade mise à jour à **${value} SOL**.`;
        }
    } else if (step === 'set_tp') {
        const value = parseInt(text);
        if (isNaN(value) || value <= 0) {
            responseText = '❌ Erreur: Veuillez entrer un pourcentage valide (nombre entier > 0).';
        } else {
            updateRuntimeConfig({ tpPercent: value });
            responseText = `✅ Take Profit mis à jour à **+${value}%**.`;
        }
    } else if (step === 'set_sl') {
        const value = parseInt(text);
        if (isNaN(value) || value <= 0) {
            responseText = '❌ Erreur: Veuillez entrer un pourcentage valide (nombre entier > 0).';
        } else {
            updateRuntimeConfig({ slPercent: value });
            responseText = `✅ Stop Loss mis à jour à **-${value}%**.`;
        }
    } else if (step === 'add_wallet') {
        const address = text.trim();
        try {
            new PublicKey(address);
            ledger.addWallet(address, 'manual');
            const { listener } = await import('../core/listener');
            listener.addWallet(address);
            responseText = `✅ Wallet \`${address.slice(0, 8)}...\` ajouté à la liste des suivis.`;
        } catch (e) {
            responseText = `❌ Erreur: \`${address}\` n'est pas une adresse Solana valide.`;
        }
    }

    if (previousMessageId) {
        try { this.bot.deleteMessage(chatId, previousMessageId); } catch {}
    }
    try { this.bot.deleteMessage(chatId, messageId); } catch {}
    
    await this.bot.sendMessage(chatId, responseText, { parse_mode: 'Markdown' });
    
    setTimeout(() => this.sendSettingsMenu(chatId, previousMessageId || messageId), 1500);
  }

  async sendTradeDetected(trade: Trade) {
    if (!runtimeConfig.autoCopy) {
        const message = `
⚠️ **TRADE DÉTECTÉ**

Wallet Source: \`${trade.walletSource.slice(0, 8)}...\`
Token: **${trade.tokenSymbol || 'Unknown'}**
Type: **${trade.type}**
Montant: ${trade.amountSol} SOL

Voulez-vous copier ce trade ?
        `;

        await this.bot.sendMessage(config.chatId, message, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard: keyboards.confirmTrade(trade.id) } // CORRECTION: Ajouté
        });
    } else {
        const success = await copyEngine.executeTrade(trade.id);
        
        if (success) {
            await this.bot.sendMessage(
                config.chatId,
                `✅ **TRADE EXÉCUTÉ AUTOMATIQUEMENT**\n\nTrade ID: ${trade.id}\nVous serez notifié quand TP/SL sera atteint.`,
                { parse_mode: 'Markdown' }
            );
        }
    }
  }

  sendWalletDiscovered(wallet: string, amount: number) {
    const cfg = getRuntimeConfig();
    
    if (!cfg.discoveryEnabled) {
      return;
    }
    
    const message = `
🔍 **NOUVEAU WALLET DÉCOUVERT**

Wallet: \`${wallet}\`
Transfer: ${amount} SOL
From: Inconnu

Voulez-vous suivre ce wallet ?
    `;

    this.bot.sendMessage(config.chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboards.confirmWallet(wallet) }
    });
  }

  sendTPSLTriggered(trade: Trade, type: 'TP' | 'SL') {
    const emoji = type === 'TP' ? '🎯' : '🛑';
    const message = `
${emoji} **${type} ATTEINT**

Token: ${trade.tokenSymbol || 'Unknown'}
Prix entrée: ${trade.buyPrice}
Prix sortie: ${trade.sellPrice}
PNL: ${trade.pnlPercent?.toFixed(2)}% (${trade.pnl?.toFixed(4)} SOL)

La position a été fermée automatiquement.
    `;

    this.bot.sendMessage(config.chatId, message, { parse_mode: 'Markdown' });
  }
}

export const telegramBot = new TelegramBotManager();