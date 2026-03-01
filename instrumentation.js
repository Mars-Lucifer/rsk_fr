export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startBot } = await import('./src/lib/telegramBot.js');
    startBot();
  }
}
