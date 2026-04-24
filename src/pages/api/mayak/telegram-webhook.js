import { processUpdate } from '@/lib/telegramBot';
import { readMayakSettings } from '@/lib/mayakSettings';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const settings = await readMayakSettings();
  const expectedSecret = process.env.TELEGRAM_PORTAL_SECRET || settings.telegramPortalSecret;
  if (expectedSecret && req.headers['x-portal-secret'] !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const update = req.body;

    // Telegram шлёт update — обрабатываем асинхронно, отвечаем сразу 200
    // (Telegram ждёт ответ не дольше 60 сек, но лучше отвечать быстро)
    processUpdate(update).catch(err => {
      console.error('[TG Webhook] Ошибка обработки update:', err);
    });

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[TG Webhook] Ошибка:', error);
    return res.status(200).json({ ok: true }); // Всегда 200, иначе Telegram будет ретраить
  }
}
