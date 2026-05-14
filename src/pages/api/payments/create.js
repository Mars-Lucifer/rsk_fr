import { createMayakPayment, isYooKassaConfigured } from "@/lib/mayakPayments";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    if (!isYooKassaConfigured()) {
        return res.status(503).json({
            success: false,
            error: "YooKassa is not configured. Set YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY.",
        });
    }

    try {
        const payment = await createMayakPayment(req, req.body || {});
        return res.status(201).json({ success: true, data: payment });
    } catch (error) {
        console.error("Payment create error:", error);
        return res.status(500).json({ success: false, error: error.message || "Payment create failed" });
    }
}
