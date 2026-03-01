require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const bot = new TelegramBot(process.env.BOT_TOKEN);
bot.deleteWebHook().then(() => {
    console.log('Webhook deleted successfully');
    process.exit(0);
}).catch(err => {
    console.error('Error deleting webhook:', err);
    process.exit(1);
});