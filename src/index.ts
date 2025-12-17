import { config, validateConfig, runtimeConfig } from './config/environment';
import { copyEngine } from './core/copyEngine';
import { discoveryWallet } from './core/discoveryWallet';
import { ledger } from './core/ledger';

async function main() {
  try {
    console.log('🚀 DÉMARRAGE DU BOT COPY TRADING SOLANA');
    console.log('==========================================\n');

    console.log('🔧 Validation de la configuration...');
    validateConfig();
    console.log('✅ Configuration valide\n');

    console.log('💾 Chargement de l\'état précédent...');
    ledger.loadState();
    console.log('✅ État chargé.\n');

    console.log('⚙️ PARAMÈTRES:');
    console.log(`   Mode: ${config.mode}`);
    console.log(`   Master Wallet: ${config.masterWallet.slice(0, 8)}...`);
    console.log(`   Auto Copy: ${runtimeConfig.autoCopy ? '✅ OUI' : '❌ NON'}`);
    console.log('\n📊 Configuration Runtime (modifiable via Telegram):');
    console.log(`   Discovery: ${runtimeConfig.discoveryEnabled ? '🟢 ACTIF' : '🔴 INACTIF'}`);
    console.log(`   Discovery Range: ${runtimeConfig.minSolTransfer} - ${runtimeConfig.maxSolTransfer} SOL`);
    console.log(`   Taille Trade: ${runtimeConfig.tradeSize} SOL`);
    console.log(`   TP/SL: +${runtimeConfig.tpPercent}% / -${runtimeConfig.slPercent}%\n`);

    console.log('▶️ Démarrage des modules...');
    
    // Import dynamique pour éviter les dépendances circulaires
    const { listener } = await import('./core/listener');
    const { telegramBot } = await import('./telegram/bot');
    
    listener.start();
    discoveryWallet.start();

    telegramBot.init();
    console.log('✅ Bot Telegram initialisé');

    await telegramBot.getBot().sendMessage(
      config.chatId,
      '🚀 **BOT DÉMARRÉ**\n\nEnvoyez /start pour interagir.',
      { parse_mode: 'Markdown' }
    );
    
    console.log('\n✅ Le bot est prêt.');
    console.log('Instructions: Ouvrez votre Telegram et envoyez /start au bot.');
    
    setInterval(() => {
      const stats = ledger.getStats();
      console.log(`📊 [${new Date().toLocaleTimeString()}] Positions: ${stats.activePositions} | PNL: ${stats.totalPnl.toFixed(4)} SOL`);
      
      discoveryWallet.clearOldDiscoveries(24);
      ledger.saveState();
    }, 60000);

    process.on('unhandledRejection', async (error: any) => {
      console.error('❌ Unhandled rejection:', error);
      const { telegramBot } = await import('./telegram/bot');
      telegramBot.getBot().sendMessage(
        config.chatId,
        `⚠️ Erreur non gérée: ${error.message}`
      );
    });

    process.on('SIGINT', async () => {
      console.log('\n🛑 Arrêt du bot...');
      
      const { listener } = await import('./core/listener');
      const { telegramBot } = await import('./telegram/bot');
      
      listener.stop();
      discoveryWallet.stop();
      copyEngine.stopAllMonitoring();
      ledger.saveState();
      
      await telegramBot.getBot().sendMessage(
        config.chatId,
        '🛑 Bot arrêté'
      );
      
      process.exit(0);
    });

  } catch (error: any) {
    console.error('❌ ERREUR FATALE:', error);
    
    try {
      const { telegramBot } = await import('./telegram/bot');
      await telegramBot.getBot().sendMessage(
        config.chatId,
        `❌ **ERREUR FATALE**\n\n\`${error.message}\``,
        { parse_mode: 'Markdown' }
      );
    } catch (e) {
      console.error('Impossible d\'envoyer le message d\'erreur au chat Telegram.');
    }

    process.exit(1);
  }
}

main();
