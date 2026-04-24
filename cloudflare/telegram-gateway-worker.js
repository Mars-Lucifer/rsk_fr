const TELEGRAM_API_ORIGIN = 'https://api.telegram.org';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function hasGatewayAccess(request, env) {
  return Boolean(env.GATEWAY_SECRET)
    && request.headers.get('X-Telegram-Gateway-Secret') === env.GATEWAY_SECRET;
}

async function proxyTelegramApi(request, env) {
  if (!hasGatewayAccess(request, env)) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const sourceUrl = new URL(request.url);
  const telegramPath = sourceUrl.pathname.replace(/^\/telegram-api/, '');
  const telegramUrl = `${TELEGRAM_API_ORIGIN}${telegramPath}${sourceUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('x-telegram-gateway-secret');

  return fetch(telegramUrl, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
  });
}

async function forwardWebhookToPortal(request, env) {
  if (request.method !== 'POST') {
    return json({ ok: false, error: 'Method not allowed' }, 405);
  }

  if (!env.PORTAL_WEBHOOK_URL || !env.PORTAL_SECRET) {
    return json({ ok: false, error: 'Gateway is not configured' }, 500);
  }

  const update = await request.text();
  const portalResponse = await fetch(env.PORTAL_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': request.headers.get('Content-Type') || 'application/json',
      'X-Portal-Secret': env.PORTAL_SECRET,
    },
    body: update,
  });

  if (!portalResponse.ok) {
    return json({ ok: false, error: 'Portal webhook failed' }, 502);
  }

  return json({ ok: true });
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return json({ ok: true, service: 'telegram-gateway' });
    }

    if (url.pathname === '/telegram/webhook') {
      return forwardWebhookToPortal(request, env);
    }

    if (url.pathname.startsWith('/telegram-api/')) {
      return proxyTelegramApi(request, env);
    }

    return json({ ok: false, error: 'Not found' }, 404);
  },
};

export default worker;
