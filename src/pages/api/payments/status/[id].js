import { getMayakPayment, syncMayakPaymentFromProvider } from "@/lib/mayakPayments";

export default async function handler(req, res) {
    if (req.method !== "GET") {
        return res.status(405).json({ success: false, error: "Method not allowed" });
    }

    try {
        const paymentId = String(req.query.id || "").trim();
        const existing = await getMayakPayment(paymentId);
        if (!existing) {
            return res.status(404).json({ success: false, error: "Payment not found" });
        }

        const shouldSync = existing.providerPaymentId && !["paid", "canceled"].includes(existing.status);
        const payment = shouldSync
            ? await syncMayakPaymentFromProvider({ localPaymentId: existing.id, providerPaymentId: existing.providerPaymentId })
            : existing;

        return res.status(200).json({ success: true, data: payment || existing });
    } catch (error) {
        console.error("Payment status error:", error);
        return res.status(500).json({ success: false, error: error.message || "Payment status failed" });
    }
}
