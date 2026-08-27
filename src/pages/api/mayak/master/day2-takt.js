import { controlDay2Takt } from "@/lib/mayakSessionRuntime";
import { resolveMasterSecret, resolveDashboardSecret } from "@/lib/mayakSessionLinks";
import { isMayakAdminAuthenticated } from "@/lib/mayakAdminAuth";

// Пульт ведущего: такт зала. Авторизация мастер-секретом из ссылки, как у
// остальных мастерских маршрутов — админский пароль ведущему не выдают, он
// работает по ссылке, полученной на сессию.
//
// Кнопку нажимает человек. Такт не переключается по расписанию сам: реальность
// вносит поправки каждый раз, и решение «идём дальше» принимает ведущий, глядя
// в зал, а не таймер, глядя в календарь.
export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    // Двое имеют право двигать такт, и входят они по-разному: ведущий в зале —
    // по ссылке на сессию, методолог — из админки под паролем. Ссылки заводятся
    // только в контуре делегированного доступа, поэтому у сессии, созданной из
    // админки, секрета может не быть вовсе.
    const secret = String(req.body?.secret || req.query?.secret || "");
    const record = secret ? (await resolveMasterSecret(secret)) || (await resolveDashboardSecret(secret)) : null;
    const sessionId = record?.sessionId
        || (isMayakAdminAuthenticated(req) ? String(req.body?.sessionId || "") : "");
    if (!sessionId) {
        return res.status(401).json({ success: false, error: "Ссылка недействительна" });
    }

    try {
        const takt = await controlDay2Takt({
            sessionId,
            action: String(req.body?.action || ""),
            minutes: req.body?.minutes,
        });
        return res.status(200).json({ success: true, data: takt });
    } catch (error) {
        return res.status(400).json({ success: false, error: error.message || "Не удалось изменить такт" });
    }
}
