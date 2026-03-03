export async function register() {
  // Только в Node.js рантайме (не edge) — иначе fs недоступен
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Загружаем настройки из JSON (приоритет над .env)
    const fs = await import('fs');
    const path = await import('path');
    const settingsPath = path.join(process.cwd(), 'data', 'mayak-settings.json');
    try {
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        if (settings.telegramBotToken) process.env['TELEGRAM_BOT_TOKEN'] = settings.telegramBotToken;
        if (settings.openrouterApiKey) process.env['OPENROUTER_API_KEY'] = settings.openrouterApiKey;
        if (settings.telegramBotUsername) process.env['TELEGRAM_BOT_USERNAME'] = settings.telegramBotUsername;
        if (settings.telegramWebhookUrl) process.env['TELEGRAM_WEBHOOK_URL'] = settings.telegramWebhookUrl;
        const baseUrlKey = 'NEXT_PUBLIC' + '_BASE_URL';
        if (settings.baseUrl) process.env[baseUrlKey] = settings.baseUrl;
      }
    } catch {}

    if (process.env.TELEGRAM_BOT_TOKEN) {
      const { startBot } = await import('./lib/telegramBot.js');
      startBot();
    }
  }
}
