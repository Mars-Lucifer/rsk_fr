import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const PAYMENTS_FILE = path.join(process.cwd(), "data", "mayak-payments.json");
const YOOKASSA_API_BASE_URL = "https://api.yookassa.ru/v3";
const RUB_CURRENCY = "RUB";

function normalizeString(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeAmount(value, fallback = process.env.MAYAK_PAYMENT_DEFAULT_AMOUNT_RUB || "990") {
    const normalized = String(value || fallback).replace(",", ".").trim();
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error("Invalid payment amount");
    }
    return parsed.toFixed(2);
}

function getBaseUrl(req) {
    const configured = normalizeString(process.env.NEXT_PUBLIC_BASE_URL || process.env.MAYAK_PUBLIC_BASE_URL);
    if (configured) return configured.replace(/\/+$/, "");

    const host = normalizeString(req?.headers?.host);
    const proto = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    return host ? `${proto}://${host}` : "http://localhost:1234";
}

function getYooKassaCredentials() {
    const shopId = normalizeString(process.env.YOOKASSA_SHOP_ID);
    const secretKey = normalizeString(process.env.YOOKASSA_SECRET_KEY);
    if (!shopId || !secretKey) {
        return null;
    }
    return { shopId, secretKey };
}

function getYooKassaAuthHeader(credentials) {
    return `Basic ${Buffer.from(`${credentials.shopId}:${credentials.secretKey}`).toString("base64")}`;
}

async function readStore() {
    try {
        const raw = await fs.readFile(PAYMENTS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return {
            payments: Array.isArray(parsed?.payments) ? parsed.payments : [],
        };
    } catch {
        return { payments: [] };
    }
}

async function writeStore(store) {
    await fs.mkdir(path.dirname(PAYMENTS_FILE), { recursive: true });
    const tempFile = `${PAYMENTS_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify({ payments: store.payments || [] }, null, 2), "utf-8");
    await fs.rename(tempFile, PAYMENTS_FILE);
}

function toPublicPayment(payment = {}) {
    return {
        id: payment.id || "",
        provider: payment.provider || "yookassa",
        providerPaymentId: payment.providerPaymentId || "",
        status: payment.status || "pending",
        amount: payment.amount || "0.00",
        currency: payment.currency || RUB_CURRENCY,
        description: payment.description || "",
        customerEmail: payment.customerEmail || "",
        customerName: payment.customerName || "",
        confirmationUrl: payment.confirmationUrl || "",
        paidAt: payment.paidAt || null,
        canceledAt: payment.canceledAt || null,
        createdAt: payment.createdAt || null,
        updatedAt: payment.updatedAt || null,
    };
}

function mapYooKassaStatus(status) {
    if (status === "succeeded") return "paid";
    if (status === "canceled") return "canceled";
    if (status === "waiting_for_capture") return "waiting_for_capture";
    return "pending";
}

async function requestYooKassa(pathname, { method = "GET", body, idempotenceKey } = {}) {
    const credentials = getYooKassaCredentials();
    if (!credentials) {
        throw new Error("YOOKASSA_SHOP_ID and YOOKASSA_SECRET_KEY are not configured");
    }

    const headers = {
        Authorization: getYooKassaAuthHeader(credentials),
        "Content-Type": "application/json",
    };
    if (idempotenceKey) {
        headers["Idempotence-Key"] = idempotenceKey;
    }

    const response = await fetch(`${YOOKASSA_API_BASE_URL}${pathname}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message = payload?.description || payload?.message || `YooKassa request failed: ${response.status}`;
        throw new Error(message);
    }
    return payload;
}

async function createYooKassaPayment({ payment, returnUrl }) {
    return requestYooKassa("/payments", {
        method: "POST",
        idempotenceKey: payment.id,
        body: {
            amount: {
                value: payment.amount,
                currency: payment.currency,
            },
            capture: true,
            confirmation: {
                type: "redirect",
                return_url: returnUrl,
            },
            description: payment.description,
            metadata: {
                local_payment_id: payment.id,
                source: "mayak",
            },
        },
    });
}

export async function listMayakPayments() {
    const store = await readStore();
    return store.payments
        .map(toPublicPayment)
        .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")));
}

export async function getMayakPayment(paymentId) {
    const normalizedId = normalizeString(paymentId);
    if (!normalizedId) return null;
    const store = await readStore();
    const payment = store.payments.find((item) => item.id === normalizedId);
    return payment ? toPublicPayment(payment) : null;
}

export async function createMayakPayment(req, payload = {}) {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const amount = normalizeAmount(payload.amount);
    const baseUrl = getBaseUrl(req);
    const requestedReturnUrl = normalizeString(payload.returnUrl);
    const returnUrl = requestedReturnUrl
        ? requestedReturnUrl.includes("{paymentId}")
            ? requestedReturnUrl.replace("{paymentId}", encodeURIComponent(id))
            : `${requestedReturnUrl}${requestedReturnUrl.includes("?") ? "&" : "?"}paymentId=${encodeURIComponent(id)}`
        : `${baseUrl}/pay?paymentId=${encodeURIComponent(id)}`;
    const description =
        normalizeString(payload.description) ||
        normalizeString(process.env.MAYAK_PAYMENT_DEFAULT_DESCRIPTION) ||
        `Доступ к МАЯК ${id.slice(0, 8)}`;

    const payment = {
        id,
        provider: "yookassa",
        providerPaymentId: "",
        status: "pending",
        amount,
        currency: RUB_CURRENCY,
        description,
        customerEmail: normalizeString(payload.customerEmail),
        customerName: normalizeString(payload.customerName),
        confirmationUrl: "",
        rawProviderStatus: "",
        rawProviderPayload: null,
        createdAt: now,
        updatedAt: now,
        paidAt: null,
        canceledAt: null,
    };

    const store = await readStore();
    store.payments.push(payment);
    await writeStore(store);

    const providerPayment = await createYooKassaPayment({ payment, returnUrl });
    const confirmationUrl = normalizeString(providerPayment?.confirmation?.confirmation_url);

    return updateMayakPayment(id, {
        providerPaymentId: normalizeString(providerPayment?.id),
        status: mapYooKassaStatus(providerPayment?.status),
        confirmationUrl,
        rawProviderStatus: normalizeString(providerPayment?.status),
        rawProviderPayload: providerPayment,
    });
}

async function updateMayakPayment(paymentId, updates = {}) {
    const store = await readStore();
    const index = store.payments.findIndex((item) => item.id === paymentId);
    if (index === -1) {
        return null;
    }
    store.payments[index] = {
        ...store.payments[index],
        ...updates,
        updatedAt: new Date().toISOString(),
    };
    await writeStore(store);
    return toPublicPayment(store.payments[index]);
}

export async function syncMayakPaymentFromProvider({ localPaymentId, providerPaymentId }) {
    const store = await readStore();
    const payment =
        store.payments.find((item) => localPaymentId && item.id === localPaymentId) ||
        store.payments.find((item) => providerPaymentId && item.providerPaymentId === providerPaymentId);

    if (!payment?.providerPaymentId && !providerPaymentId) {
        return null;
    }

    const actualProviderPaymentId = providerPaymentId || payment.providerPaymentId;
    const providerPayment = await requestYooKassa(`/payments/${encodeURIComponent(actualProviderPaymentId)}`);
    const providerLocalPaymentId = normalizeString(providerPayment?.metadata?.local_payment_id);
    const actualLocalPaymentId = payment?.id || providerLocalPaymentId;

    if (payment && providerLocalPaymentId && providerLocalPaymentId !== payment.id) {
        throw new Error("YooKassa metadata does not match local payment");
    }

    const status = mapYooKassaStatus(providerPayment?.status);
    const timestampUpdates = {};
    if (status === "paid") {
        timestampUpdates.paidAt = payment?.paidAt || new Date().toISOString();
    }
    if (status === "canceled") {
        timestampUpdates.canceledAt = payment?.canceledAt || new Date().toISOString();
    }

    return updateMayakPayment(actualLocalPaymentId, {
        providerPaymentId: normalizeString(providerPayment?.id),
        status,
        rawProviderStatus: normalizeString(providerPayment?.status),
        rawProviderPayload: providerPayment,
        ...timestampUpdates,
    });
}

export function isYooKassaConfigured() {
    return Boolean(getYooKassaCredentials());
}
