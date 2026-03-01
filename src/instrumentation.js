export async function register() {
  // Только в Node.js рантайме (не edge) — иначе fs недоступен
  if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.TELEGRAM_BOT_TOKEN) {
    const { startBot } = await import('./lib/telegramBot.js');
    startBot();
  }
}
