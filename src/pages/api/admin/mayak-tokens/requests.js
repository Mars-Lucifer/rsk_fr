import { getAllRequests, updateRequest, deleteRequest } from '../../../../utils/tokenRequests.js';
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
        const { requestId, action, tokenId } = req.body;

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
                `✅ Ваш запрос одобрен!\n\n🔑 Ваш токен:\n<code>${token.token}</code>\n\n` +
                `📌 Раздел: ${token.sectionId || token.taskRange || 'Все'}\n` +
                `Используйте /token для просмотра информации.`
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
            // Уведомляем пользователя
            if (request?.chatId) {
                await notifyUser(request.chatId,
                    '❌ Ваш запрос на получение токена был отклонён.\n\nЕсли считаете, что это ошибка, отправьте /token для нового запроса.'
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

        return res.status(400).json({ error: 'Unknown action. Use: approve, reject, delete' });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
