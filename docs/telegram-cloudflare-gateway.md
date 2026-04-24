# Telegram Cloudflare gateway

This gateway lets a Russian-hosted portal use Telegram Bot API through Cloudflare Workers.

## Cloudflare Worker variables

Set these variables in the Worker dashboard:

```text
GATEWAY_SECRET=<long random string>
PORTAL_SECRET=<long random string>
PORTAL_WEBHOOK_URL=https://rosdk.ru/api/mayak/telegram-webhook
```

Use `cloudflare/telegram-gateway-worker.js` as the Worker code.

After publishing, the Worker URLs are:

```text
https://your-worker.workers.dev/telegram/webhook
https://your-worker.workers.dev/telegram-api
```

## Portal environment variables

Set these on the Next.js portal server:

```text
TELEGRAM_BOT_TOKEN=<token from BotFather>
TELEGRAM_BOT_USERNAME=<bot username without @>
TELEGRAM_API_BASE=https://your-worker.workers.dev/telegram-api
TELEGRAM_WEBHOOK_URL=https://your-worker.workers.dev/telegram/webhook
TELEGRAM_GATEWAY_SECRET=<same value as GATEWAY_SECRET>
TELEGRAM_PORTAL_SECRET=<same value as PORTAL_SECRET>
NEXT_PUBLIC_BASE_URL=https://rosdk.ru
```

`TELEGRAM_API_BASE` makes all outgoing Bot API calls go through Cloudflare.
`TELEGRAM_WEBHOOK_URL` makes Telegram send incoming updates to Cloudflare.
`TELEGRAM_PORTAL_SECRET` protects the portal webhook from direct public calls.

## Register webhook

The app registers the webhook when `startBot()` runs. You can trigger it by calling an endpoint that starts the bot, for example:

```bash
curl -X POST https://rosdk.ru/api/mayak/telegram-prepare \
  -H "Content-Type: application/json" \
  -d '{"certificate":"AA==","log":"AA=="}'
```

That request may fail business validation depending on payload, but it imports `startBot()`.

If you prefer a direct manual setup from a machine that can reach Telegram:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://your-worker.workers.dev/telegram/webhook"
```

Check the Worker:

```bash
curl https://your-worker.workers.dev/health
```

Check Telegram through the Worker from the portal server:

```bash
curl -H "X-Telegram-Gateway-Secret: <GATEWAY_SECRET>" \
  "https://your-worker.workers.dev/telegram-api/bot<TELEGRAM_BOT_TOKEN>/getMe"
```
