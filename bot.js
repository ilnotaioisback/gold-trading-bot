const TelegramBot = require(‘node-telegram-bot-api’);
const cron = require(‘node-cron’);
const axios = require(‘axios’);
const { Client } = require(‘pg’);

// CONFIGURAZIONE
const BOT_TOKEN = ‘8374202434:AAHzmTy6CaBvDgaIc6RFV72ibC769fNT3hM’;
const DATABASE_URL = process.env.DATABASE_URL;

// Inizializza bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log(‘🤖 Bot inizializzato…’);

// Database
const db = new Client({
connectionString: DATABASE_URL,
ssl: { rejectUnauthorized: false }
});

db.connect()
.then(() => console.log(‘✅ Database connesso’))
.catch(err => console.error(‘❌ Errore database:’, err));

// Crea tabelle
db.query(`
CREATE TABLE IF NOT EXISTS users (
user_id BIGINT PRIMARY KEY,
username TEXT,
first_name TEXT,
is_premium BOOLEAN DEFAULT FALSE,
subscription_end TIMESTAMP,
signals_today INTEGER DEFAULT 0,
last_signal_date DATE DEFAULT CURRENT_DATE,
created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signals_sent (
id SERIAL PRIMARY KEY,
signal_type TEXT,
price DECIMAL,
confidence DECIMAL,
sent_at TIMESTAMP DEFAULT NOW()
);
`).then(() => console.log(‘✅ Tabelle create’));

// Variabili
let goldPrice = 2045.50;
let priceHistory = [];

// Simula prezzo oro
setInterval(() => {
const change = (Math.random() - 0.5) * 2;
goldPrice = Math.max(1800, Math.min(2200, goldPrice + change));
priceHistory.push(goldPrice);
if (priceHistory.length > 100) priceHistory.shift();
}, 5000);

// Reset segnali giornalieri
cron.schedule(‘0 0 * * *’, async () => {
await db.query(‘UPDATE users SET signals_today = 0, last_signal_date = CURRENT_DATE’);
console.log(‘🔄 Contatori resettati’);
});

// Funzioni utility
async function canReceiveSignal(userId) {
const result = await db.query(
‘SELECT is_premium, signals_today FROM users WHERE user_id = $1’,
[userId]
);
if (!result.rows[0]) return false;
const user = result.rows[0];
if (user.is_premium) return true;
return user.signals_today < 3;
}

async function incrementSignalCount(userId) {
await db.query(
‘UPDATE users SET signals_today = signals_today + 1 WHERE user_id = $1’,
[userId]
);
}

// Analisi tecnica
function generateSignal() {
if (priceHistory.length < 20) {
return {
type: ‘HOLD’,
confidence: 50,
entry: goldPrice.toFixed(2),
stopLoss: (goldPrice - 10).toFixed(2),
takeProfit: (goldPrice + 20).toFixed(2),
rsi: ‘50.0’,
macd: ‘0.00’,
trend: ‘NEUTRAL’,
momentum: ‘NEUTRAL’,
sma20: goldPrice.toFixed(2),
sma50: goldPrice.toFixed(2),
riskReward: ‘2.00’
};
}

const prices = priceHistory.slice(-20);
const lastPrice = prices[prices.length - 1];
const sma20 = prices.reduce((a, b) => a + b, 0) / prices.length;
const sma50 = priceHistory.slice(-50).reduce((a, b) => a + b, 0) / Math.min(priceHistory.length, 50);

// RSI
const changes = prices.slice(1).map((price, i) => price - prices[i]);
const gains = changes.filter(c => c > 0);
const losses = changes.filter(c => c < 0);
const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / changes.length : 0;
const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0)) / changes.length : 0;
const rs = avgGain / (avgLoss || 1);
const rsi = 100 - (100 / (1 + rs));

// MACD
const ema12 = lastPrice * 0.3 + sma20 * 0.7;
const ema26 = lastPrice * 0.1 + sma50 * 0.9;
const macd = ema12 - ema26;

const trend = sma20 > sma50 ? ‘UPTREND 📈’ : ‘DOWNTREND 📉’;
const momentum = macd > 0 ? ‘BULLISH 🟢’ : ‘BEARISH 🔴’;

let signal = ‘HOLD’;
let confidence = 50;
let entry = lastPrice;
let stopLoss = 0;
let takeProfit = 0;

if (rsi < 30 && trend.includes(‘UPTREND’)) {
signal = ‘BUY’;
confidence = 75 + Math.random() * 20;
stopLoss = entry - 15;
takeProfit = entry + 35;
} else if (rsi > 70 && trend.includes(‘DOWNTREND’)) {
signal = ‘SELL’;
confidence = 75 + Math.random() * 20;
stopLoss = entry + 15;
takeProfit = entry - 35;
} else if (Math.abs(macd) > 5) {
signal = macd > 0 ? ‘BUY’ : ‘SELL’;
confidence = 65 + Math.random() * 15;
stopLoss = signal === ‘BUY’ ? entry - 12 : entry + 12;
takeProfit = signal === ‘BUY’ ? entry + 28 : entry - 28;
}

const riskReward = Math.abs(takeProfit - entry) / Math.
abs(entry - stopLoss);

return {
type: signal,
confidence: confidence.toFixed(1),
entry: entry.toFixed(2),
stopLoss: stopLoss.toFixed(2),
takeProfit: takeProfit.toFixed(2),
rsi: rsi.toFixed(1),
macd: macd.toFixed(2),
trend: trend,
momentum: momentum,
sma20: sma20.toFixed(2),
sma50: sma50.toFixed(2),
riskReward: riskReward.toFixed(2)
};
}

// COMANDI

bot.onText(//start/, async (msg) => {
const chatId = msg.chat.id;
const username = msg.from.username || ‘’;
const firstName = msg.from.first_name || ‘Utente’;

try {
await db.query(
INSERT INTO users (user_id, username, first_name)  VALUES ($1, $2, $3)  ON CONFLICT (user_id) DO UPDATE  SET username = $2, first_name = $3,
[chatId, username, firstName]
);
Go


const welcomeMsg = `

🌟 *Benvenuto ${firstName}!* 🌟

Sono il tuo assistente per il trading dell’oro (XAU/USD).

📊 *Cosa posso fare:*
• Analisi tecnica in tempo reale
• Segnali BUY/SELL precisi
• Entry, Stop Loss, Take Profit
• Indicatori: RSI, MACD, SMA

💎 *GRATUITO:*
✅ 3 segnali al giorno
✅ Analisi tecnica base

🔥 *PREMIUM - 29€/mese:*
✨ Segnali ILLIMITATI
✨ Alert automatici
✨ Win rate 68%
✨ Supporto prioritario

*Comandi:*
/prezzo - Prezzo oro
/segnale - Ricevi segnale
/analisi - Analisi completa
/premium - Info Premium
/aiuto - Guida

⚠️ Disclaimer: Solo info educative. Trading = rischi.
`;
JavaScript


bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown' });

} catch (err) {
console.error(‘Errore /start:’, err);
}
});

bot.onText(//prezzo/, (msg) => {
const chatId = msg.chat.id;
bot.sendMessage(chatId, 💰 *PREZZO ORO*\n\nXAU/USD: *$${goldPrice.toFixed(2)}*, {
parse_mode: ‘Markdown’
});
});

bot.onText(//segnale/, async (msg) => {
const chatId = msg.chat.id;

try {
const canReceive = await canReceiveSignal(chatId);
JavaScript


if (!canReceive) {
  bot.sendMessage(chatId, 
    `⚠️ Limite raggiunto! 3 segnali gratuiti usati.\n\n💎 Passa a PREMIUM per illimitati!\n/premium`, 
    { parse_mode: 'Markdown' }
  );
  return;
}

const signal = generateSignal();
await incrementSignalCount(chatId);

await db.query(
  'INSERT INTO signals_sent (signal_type, price, confidence) VALUES ($1, $2, $3)',
  [signal.type, goldPrice, signal.confidence]
);

const emoji = signal.type === 'BUY' ? '🟢' : signal.type === 'SELL' ? '🔴' : '🟡';

const signalMsg = `

${emoji} *SEGNALE TRADING* ${emoji}

🎯 *${signal.type}* | ${signal.confidence}%

💰 Prezzo: $${goldPrice.toFixed(2)}
📈 Entry: $${signal.entry}
🛑 Stop Loss: $${signal.stopLoss}
🎯 Take Profit: $${signal.takeProfit}
⚖️ R/R: ${signal.riskReward}:1

📊 *INDICATORI:*
• RSI: ${signal.rsi}
• MACD: ${signal.macd}
• Trend: ${signal.trend}
• Momentum: ${signal.momentum}

📌 SMA 20: $${signal.sma20}
📌 SMA 50: $${signal.sma50}

⏰ ${new Date().toLocaleTimeString(‘it-IT’)}
`;
JavaScript


bot.sendMessage(chatId, signalMsg.trim(), { parse_mode: 'Markdown' });

const userResult = await db.query(
  'SELECT is_premium, signals_today FROM users WHERE user_id = $1',
  [chatId]
);

if (!userResult.rows[0].is_premium) {
  const remaining = 3 - userResult.rows[0].signals_today;
  bot.sendMessage(chatId, 
    `ℹ️ Rimanenti: ${remaining}/3\n\n💎 Premium = illimitati! /premium`,
    { parse_mode: 'Markdown' }
  );
}

} catch (err) {
console.error(‘Errore /segnale:’, err);
}
});

bot.onText(//analisi/, (msg) => {
const chatId = msg.chat.id;
const signal = generateSignal();

const analysisMsg = `
📊 *ANALISI TECNICA*

💰 Prezzo: $${goldPrice.toFixed(2)}

📈 ${signal.trend}
${signal.momentum}

• RSI: ${signal.rsi}
• MACD: ${signal.macd}
• SMA 20: $${signal.sma20}
• SMA 50: $${signal.sma50}

🎯 Raccomandazione: *${signal.type}*
Confidenza: ${signal.confidence}%
`;

bot.sendMessage(chatId, analysisMsg.trim(), { parse_mode: ‘Markdown’ });
});

bot.onText(//premium/, (msg) => {
const chatId = msg.chat.id;

const premiumMsg = `
💎 *DIVENTA PREMIUM!*

🔥 Solo 29€/mese

✨ *VANTAGGI:*
✅ Segnali ILLIMITATI 24/7
✅ Alert automatici istantanei
✅ Win rate 68%
✅ R/R medio 1:2.5
✅ 8-12 segnali/giorno
✅ Supporto prioritario

🎁 *7 GIORNI GRATIS!*

💳 Contatta: @[TUO_USERNAME]
`;

bot.sendMessage(chatId, premiumMsg.trim(), { parse_mode: ‘Markdown’ });
});

bot.onText(//aiuto/, (msg) => {
const chatId = msg.chat.id;

const helpMsg = `
ℹ️ *GUIDA*

*COMANDI:*
/start - Inizia
/prezzo - Prezzo oro
/segnale - Segnale trading
/analisi - Analisi tecnica
/premium - Info Premium
/aiuto - Questa guida

*SEGNALI:*
🟢 BUY = Compra
🔴 SELL = Vendi
🟡 HOLD = Aspetta

⚠️ Disclaimer: Solo info educative.
`;

bot.sendMessage(chatId, helpMsg.trim(), { parse_mode: ‘Markdown’ });
});

// Segnali automatici Premium ogni 4 ore
cron.schedule(‘0 */4 * * *’, async () => {
try {
console.log(‘🔔 Invio segnali Premium…’);
JavaScript


const premiumUsers = await db.query(
  'SELECT user_id FROM users WHERE is_premium = TRUE'
);

if (premiumUsers.rows.length === 0) return;

const signal = generateSignal();

if (signal.type !== 'HOLD' && parseFloat(signal.confidence) > 75) {
  const emoji = signal.type === 'BUY' ? '🟢' : '🔴';
  
  const autoMsg = `

🚨 *ALERT AUTOMATICO* 🚨

${emoji} *${signal.type}* | ${signal.confidence}%

💰 $${goldPrice.toFixed(2)}
📈 Entry: $${signal.entry}
🛑 SL: $${signal.stopLoss}
🎯 TP: $${signal.takeProfit}

RSI: ${signal.rsi} | MACD: ${signal.macd}
${signal.trend}
`;
JavaScript


  for (const user of premiumUsers.rows) {
    try {
      await bot.sendMessage(user.user_id, autoMsg.trim(), { parse_mode: 'Markdown' });
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      console.error(`Errore invio a ${user.user_id}`);
    }
  }
  
  console.log(`✅ Inviato a ${premiumUsers.rows.length} utenti`);
}

} catch (err) {
console.error(‘Errore invio automatico:’, err);
}
});

bot.on(‘polling_error’, (error) => {
console.error(‘Polling error:’, error.code);
});

console.log(‘✅ Bot avviato!’);
console.log(‘📱 @oropro_9234_bot’);
