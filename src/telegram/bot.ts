// bot.ts

import TelegramBot, { InlineKeyboardButton } from 'node-telegram-bot-api';
import { PublicKey } from '@solana/web3.js'; // ✅ CORRECTION 4
import { config, runtimeConfig, updateRuntimeConfig, getRuntimeConfig } from '../config/environment';
import { Listener } from './listener';
import { formatters } from '../utils/formatter';
import { Wallet } from '../core/ledger'; // Import supposé

// Interface pour le contexte du bot
interface BotContext {
    listener: Listener;
    // ... autres services
}

export class TradingBot {
    private bot: TelegramBot;
    private context: BotContext;

    constructor(token: string, context: BotContext) {
        this.bot = new TelegramBot(token, { polling: true });
        this.context = context;
        this.setupListeners();
    }

    private setupListeners() {
        this.bot.onText(/\/start/, this.handleStart.bind(this));
        this.bot.onText(/\/status/, this.handleStatus.bind(this));
        this.bot.onText(/\/wallets/, this.handleWallets.bind(this));
        this.bot.onText(/\/addwallet (.+)/, this.handleAddWallet.bind(this));
        
        // Écoute des trades pour les envoyer au canal Telegram
        this.context.listener.on('newTrade', (trade) => {
            this.sendTradeNotification(trade);
        });
        
        console.log("Listeners Telegram initialisés.");
    }
    
    // ... (autres méthodes du bot)

    private handleStart(msg: TelegramBot.Message) {
        const chatId = msg.chat.id;
        this.bot.sendMessage(chatId, `Bienvenue ! Je suis le bot de trading Solana. Utilisez /status pour vérifier l'état.`);
    }

    private handleStatus(msg: TelegramBot.Message) {
        const chatId = msg.chat.id;
        const stats = {
            tradesProcessed: 42,
            totalProfit: 10.5123,
            lastUpdated: Date.now()
        };
        const message = formatters.formatStats(stats);
        this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }

    private handleWallets(msg: TelegramBot.Message) {
        const chatId = msg.chat.id;
        // Simulation de la récupération des wallets (à remplacer par une vraie fonction)
        const mockWallets: Wallet[] = [
            { address: config.masterWallet, type: 'MASTER', isActive: true, balanceSol: 50.0 },
            { address: 'A1B2C3D4E5F6G7H8I9J0', type: 'LIQUIDITY', isActive: true, balanceSol: 5.2 },
            { address: 'Z9Y8X7W6V5U4T3S2R1Q0', type: 'OTHER', isActive: false, balanceSol: 0.1 }
        ];
        const message = formatters.formatWallets(mockWallets);
        this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }

    private handleAddWallet(msg: TelegramBot.Message, match: RegExpExecArray | null) {
        const chatId = msg.chat.id;
        const address = match?.[1];

        if (!address) {
            this.bot.sendMessage(chatId, "Veuillez spécifier une adresse de wallet valide.");
            return;
        }

        try {
            // Teste la validité de l'adresse Solana en utilisant l'import PublicKey
            const newPubKey = new PublicKey(address); // L'import est maintenant disponible
            
            // Logique d'ajout du wallet
            const newWallet: Wallet = { 
                address: newPubKey.toBase58(), 
                type: 'OTHER', 
                isActive: true, 
                balanceSol: 0 
            };
            
            // Logique pour mettre à jour la liste des wallets suivis dans le Listener...
            // this.context.listener.updateWatchedWallets([...currentWallets, newWallet]);

            this.bot.sendMessage(chatId, `Wallet \`${newPubKey.toBase58().slice(0, 8)}...\` ajouté pour le suivi.`, { parse_mode: 'Markdown' });
            
        } catch (e) {
            this.bot.sendMessage(chatId, `L'adresse '${address}' n'est pas une PublicKey Solana valide.`);
        }
    }
    
    private sendTradeNotification(trade: any) {
        // Envoi de la notification au canal ou à l'utilisateur
        const chatId = config.telegram.chatId; // Doit être configuré
        const message = formatters.formatTrade(trade);
        this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
    }

    public async start() {
        await this.context.listener.start();
        console.log("Bot et Listener démarrés.");
    }
}
