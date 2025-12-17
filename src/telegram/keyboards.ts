import { InlineKeyboardButton } from 'node-telegram-bot-api';

export const keyboards = {
  // Menu Principal
  mainMenu: (): InlineKeyboardButton[][] => [
    [
      { text: '▶️ Démarrer Bot', callback_data: 'start_bot' },
      { text: '⏸ Arrêter Bot', callback_data: 'stop_bot' }
    ],
    [
      { text: '📊 Voir PNL', callback_data: 'show_pnl' },
      { text: '💼 Wallets Suivis', callback_data: 'show_wallets' }
    ],
    [
      { text: '📈 Dernier Trade', callback_data: 'last_trade' },
      { text: '🎯 Positions Actives', callback_data: 'active_positions' }
    ],
    [
      { text: '➕ Ajouter Wallet', callback_data: 'add_wallet' },
      { text: '⚙️ Paramètres', callback_data: 'settings' }
    ]
  ],

  // Menu Paramètres (accepte 2 paramètres)
  settingsMenu: (autoCopyStatus: boolean, discoveryStatus: boolean): InlineKeyboardButton[][] => [
    [
      { text: '💰 Taille de Trade', callback_data: 'set_trade_size' },
      { text: '🎯 Take Profit', callback_data: 'set_tp' }
    ],
    [
      { text: '🛑 Stop Loss', callback_data: 'set_sl' },
      { text: `🔍 Discovery: ${discoveryStatus ? '🟢' : '🔴'}`, callback_data: 'toggle_discovery' }
    ],
    [
      { text: `🔄 Auto Copy: ${autoCopyStatus ? '✅' : '❌'}`, callback_data: 'toggle_autocopy' },
      { text: '📊 Voir Config', callback_data: 'show_config' }
    ],
    [
      { text: '🔙 Menu Principal', callback_data: 'main_menu' }
    ]
  ],

  // Menu Taille de Trade
  tradeSizeMenu: (): InlineKeyboardButton[][] => [
    [
      { text: '0.1 SOL', callback_data: 'trade_size_0.1' },
      { text: '0.5 SOL', callback_data: 'trade_size_0.5' },
      { text: '1 SOL', callback_data: 'trade_size_1' }
    ],
    [
      { text: '2 SOL', callback_data: 'trade_size_2' },
      { text: '5 SOL', callback_data: 'trade_size_5' }
    ],
    [
      { text: '✏️ Personnalisé', callback_data: 'set_trade_size' }
    ],
    [
      { text: '🔙 Paramètres', callback_data: 'settings' }
    ]
  ],

  // Menu Take Profit
  takeProfitMenu: (): InlineKeyboardButton[][] => [
    [
      { text: '+25%', callback_data: 'tp_25' },
      { text: '+50%', callback_data: 'tp_50' },
      { text: '+100%', callback_data: 'tp_100' }
    ],
    [
      { text: '+200%', callback_data: 'tp_200' },
      { text: '+500%', callback_data: 'tp_500' }
    ],
    [
      { text: '✏️ Personnalisé', callback_data: 'set_tp' }
    ],
    [
      { text: '🔙 Paramètres', callback_data: 'settings' }
    ]
  ],

  // Menu Stop Loss
  stopLossMenu: (): InlineKeyboardButton[][] => [
    [
      { text: '-10%', callback_data: 'sl_10' },
      { text: '-20%', callback_data: 'sl_20' },
      { text: '-30%', callback_data: 'sl_30' }
    ],
    [
      { text: '-50%', callback_data: 'sl_50' },
      { text: '-75%', callback_data: 'sl_75' }
    ],
    [
      { text: '✏️ Personnalisé', callback_data: 'set_sl' }
    ],
    [
      { text: '🔙 Paramètres', callback_data: 'settings' }
    ]
  ],

  // Confirmation de Trade
  confirmTrade: (tradeId: string): InlineKeyboardButton[][] => [
    [
      { text: '✅ Copier Trade', callback_data: `copy_trade_${tradeId}` },
      { text: '❌ Ignorer', callback_data: 'ignore_trade' }
    ],
    [
      { text: '⚙️ Ajuster TP/SL', callback_data: `adjust_tpsl_${tradeId}` }
    ]
  ],

  // Confirmation de Wallet Découvert
  confirmWallet: (address: string): InlineKeyboardButton[][] => [
    [
      { text: '✅ Suivre Wallet', callback_data: `follow_wallet_${address}` },
      { text: '❌ Ignorer', callback_data: 'ignore_wallet' }
    ]
  ],

  // Actions sur un Wallet
  walletActions: (address: string): InlineKeyboardButton[][] => [
    [
      { text: '🔄 Activer/Désactiver', callback_data: `toggle_${address}` },
      { text: '🗑 Supprimer', callback_data: `remove_${address}` }
    ],
    [
      { text: '📊 Voir Trades', callback_data: `trades_${address}` }
    ],
    [
      { text: '🔙 Retour', callback_data: 'show_wallets' }
    ]
  ],

  // Ajustement TP/SL
  tpSlAdjust: (tradeId: string): InlineKeyboardButton[][] => [
    [
      { text: 'TP: +10%', callback_data: `tp_10_${tradeId}` },
      { text: 'TP: +25%', callback_data: `tp_25_${tradeId}` },
      { text: 'TP: +50%', callback_data: `tp_50_${tradeId}` }
    ],
    [
      { text: 'TP: +100%', callback_data: `tp_100_${tradeId}` },
      { text: 'TP: +200%', callback_data: `tp_200_${tradeId}` }
    ],
    [
      { text: 'SL: -10%', callback_data: `sl_10_${tradeId}` },
      { text: 'SL: -20%', callback_data: `sl_20_${tradeId}` },
      { text: 'SL: -30%', callback_data: `sl_30_${tradeId}` }
    ],
    [
      { text: '✅ Valider et Copier', callback_data: `copy_trade_${tradeId}` }
    ],
    [
      { text: '❌ Annuler', callback_data: 'ignore_trade' }
    ]
  ],

  // Boutons de retour (TOUS LES TROIS SONT NÉCESSAIRES)
  backToMenu: (): InlineKeyboardButton[][] => [
    [
      { text: '🔙 Menu Principal', callback_data: 'main_menu' }
    ]
  ],

  backToSettings: (): InlineKeyboardButton[][] => [
    [
      { text: '🔙 Paramètres', callback_data: 'settings' }
    ]
  ],

  backToMain: (): InlineKeyboardButton[][] => [
    [
      { text: '🔙 Menu Principal', callback_data: 'main_menu' }
    ]
  ]
};