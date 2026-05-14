import { syncMayakPaymentFromProvider } from "@/lib/mayakPayments";

function isWebhookSecretValid(req) {
    const expected = String(process.env.YOOKASSA_WEBHOOK_SECRET || "").trim();
    if (!expected) return true;
    return String(req.query.secret || "").trim() === expected;
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    if (!isWebhookSecretValid(req)) {
        return res.status(403).json({ success: false, error: "Forbidden" });
    }

    try {
        const event = String(req.body?.event || "");
        const providerPaymentId = String(req.body?.object?.id || "").trim();
        const localPaymentId = String(req.body?.object?.metadata?.local_payment_id || "").trim();

        if (!event.startsWith("payment.") || !providerPaymentId) {
            return res.status(200).json({ success: true, ignored: true });
        }

        const payment = await syncMayakPaymentFromProvider({ localPaymentId, providerPaymentId });
        return res.status(200).json({ success: true, data: payment });
    } catch (error) {
        console.error("Payment webhook error:", error);
        return res.status(500).json({ success: false, error: error.message || "Payment webhook failed" });
    }
}
