import { getAllRequests, updateRequest, deleteRequest, createRequest, submitCode } from '../../../../utils/tokenRequests.js';
import { getTokenById } from '../../../../utils/mayakTokens.js';

const ADMIN_PASSWORD = 'a12345';

async function notifyUser(chatId, text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !chatId) return;
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
        });
    } catch {}
}

export default async function handler(req, res) {
    const password = req.query.password || req.body?.password;
    if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'GET') {
        const requests = getAllRequests();
        return res.json({ success: true, data: requests });
    }

    if (req.method === 'POST') {
        const { requestId, action, tokenId, telegramId, name } = req.body;

        // Ручное назначение токена по Telegram ID (без запроса из бота)
        if (action === 'manual_assign') {
            if (!telegramId || !tokenId) {
                return res.status(400).json({ error: 'telegramId and tokenId are required' });
            }
            const token = getTokenById(tokenId);
            if (!token) {
                return res.status(404).json({ error: 'Token not found' });
            }
            // Создаём запрос и сразу одобряем
            const result = createRequest(telegramId, null, name || null);
            const reqObj = result.request;
            // Если запрос в awaiting_code — ставим код чтобы перевести в pending
            if (reqObj.status === 'awaiting_code') {
                submitCode(telegramId, 'admin-assigned');
            }
            const updated = updateRequest(reqObj.id, {
                status: 'approved',
                assignedTokenId: tokenId,
            });
            // Уведомляем пользователя в Telegram
            await notifyUser(telegramId,
                `\u2705 \u0412\u0430\u043c \u043d\u0430\u0437\u043d\u0430\u0447\u0435\u043d \u0442\u043e\u043a\u0435\u043d \u0434\u043e\u0441\u0442\u0443\u043f\u0430!\n\n\ud83d\udd11 \u0412\u0430\u0448 \u0442\u043e\u043a\u0435\u043d:\n<code>${token.token}</code>\n\n` +
                `\ud83d\udccc \u0420\u0430\u0437\u0434\u0435\u043b: ${token.sectionId || token.taskRange || '\u0412\u0441\u0435'}\n` +
                `\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 /token \u0434\u043b\u044f \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u0438.`
            );
            return res.json({ success: true, data: updated });
        }

        if (!requestId || !action) {
            return res.status(400).json({ error: 'requestId and action are required' });
        }

        if (action === 'approve') {
            if (!tokenId) {
                return res.status(400).json({ error: 'tokenId is required for approve' });
            }
            const token = getTokenById(tokenId);
            if (!token) {
                return res.status(404).json({ error: 'Token not found' });
            }
            const updated = updateRequest(requestId, {
                status: 'approved',
                assignedTokenId: tokenId,
            });
            if (!updated) {
                return res.status(404).json({ error: 'Request not found' });
            }
            // Уведомляем пользователя в Telegram
            await notifyUser(updated.chatId,
                `\u2705 \u0412\u0430\u0448 \u0437\u0430\u043f\u0440\u043e\u0441 \u043e\u0434\u043e\u0431\u0440\u0435\u043d!\n\n\ud83d\udd11 \u0412\u0430\u0448 \u0442\u043e\u043a\u0435\u043d:\n<code>${token.token}</code>\n\n` +
                `\ud83d\udccc \u0420\u0430\u0437\u0434\u0435\u043b: ${token.sectionId || token.taskRange || '\u0412\u0441\u0435'}\n` +
                `\u0418\u0441\u043f\u043e\u043b\u044c\u0437\u0443\u0439\u0442\u0435 /token \u0434\u043b\u044f \u043f\u0440\u043e\u0441\u043c\u043e\u0442\u0440\u0430 \u0438\u043d\u0444\u043e\u0440\u043c\u0430\u0446\u0438\u0438.`
            );
            return res.json({ success: true, data: updated });
        }

        if (action === 'reject') {
            const requests = getAllRequests();
            const request = requests.find(r => r.id === requestId);
            const updated = updateRequest(requestId, { status: 'rejected' });
            if (!updated) {
                return res.status(404).json({ error: 'Request not found' });
            }
            if (request?.chatId) {
                await notifyUser(request.chatId,
                    '\u274c \u0412\u0430\u0448 \u0437\u0430\u043f\u0440\u043e\u0441 \u043d\u0430 \u043f\u043e\u043b\u0443\u0447\u0435\u043d\u0438\u0435 \u0442\u043e\u043a\u0435\u043d\u0430 \u0431\u044b\u043b \u043e\u0442\u043a\u043b\u043e\u043d\u0451\u043d.\n\n\u0415\u0441\u043b\u0438 \u0441\u0447\u0438\u0442\u0430\u0435\u0442\u0435, \u0447\u0442\u043e \u044d\u0442\u043e \u043e\u0448\u0438\u0431\u043a\u0430, \u043e\u0442\u043f\u0440\u0430\u0432\u044c\u0442\u0435 /token \u0434\u043b\u044f \u043d\u043e\u0432\u043e\u0433\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u0430.'
                );
            }
            return res.json({ success: true, data: updated });
        }

        if (action === 'delete') {
            const deleted = deleteRequest(requestId);
            if (!deleted) {
                return res.status(404).json({ error: 'Request not found' });
            }
            return res.json({ success: true, data: deleted });
        }

        return res.status(400).json({ error: 'Unknown action. Use: approve, reject, delete, manual_assign' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
