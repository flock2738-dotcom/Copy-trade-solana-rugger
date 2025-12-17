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
            reply_markup: { inline_keyboard: keyboards.backToMenu() }
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
            reply_markup: { inline_keyboard: keyboards.backToMenu() }
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
            reply_markup: { inline_keyboard: keyboards.backToMenu() }
        });
        return;
    }​​​​​​​​​​​​​​​​
