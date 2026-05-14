import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";

import { getMayakLegalData } from "@/lib/mayakLegal";

async function parseJsonResponse(response, fallbackMessage) {
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.success === false) {
        throw new Error(payload.error || fallbackMessage);
    }
    return payload;
}

function formatPaymentStatus(status) {
    if (status === "paid") return "Оплачено";
    if (status === "canceled") return "Отменено";
    if (status === "waiting_for_capture") return "Ожидает подтверждения";
    return "Ожидает оплаты";
}

export async function getServerSideProps() {
    return { props: { legal: getMayakLegalData() } };
}

export default function PayPage({ legal }) {
    const router = useRouter();
    const [form, setForm] = useState({
        amount: legal.priceRub,
        description: legal.serviceName,
        customerEmail: "",
        customerName: "",
    });
    const [payment, setPayment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const paymentId = useMemo(() => String(router.query.paymentId || "").trim(), [router.query.paymentId]);

    useEffect(() => {
        if (!paymentId) return undefined;
        let cancelled = false;
        let timeoutId = null;

        async function loadStatus() {
            try {
                const payload = await parseJsonResponse(
                    await fetch(`/api/payments/status/${encodeURIComponent(paymentId)}`),
                    "Не удалось получить статус платежа"
                );
                if (cancelled) return;
                setPayment(payload.data || null);
                if (!["paid", "canceled"].includes(payload.data?.status)) {
                    timeoutId = window.setTimeout(loadStatus, 5000);
                }
            } catch (statusError) {
                if (!cancelled) setError(statusError.message);
            }
        }

        loadStatus();
        return () => {
            cancelled = true;
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [paymentId]);

    async function handleSubmit(event) {
        event.preventDefault();
        setLoading(true);
        setError("");
        setPayment(null);

        try {
            const payload = await parseJsonResponse(
                await fetch("/api/payments/create", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ...form,
                        returnUrl: `${window.location.origin}/pay`,
                    }),
                }),
                "Не удалось создать платеж"
            );
            const createdPayment = payload.data;
            setPayment(createdPayment);
            if (createdPayment?.confirmationUrl) {
                window.location.href = createdPayment.confirmationUrl;
            }
        } catch (createError) {
            setError(createError.message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="pay-page">
            <nav className="pay-nav" aria-label="Оплата MAYAK">
                <Link href="/">MAYAK</Link>
                <span />
                <Link href="/requisites">Реквизиты</Link>
                <Link href="/offer">Оферта</Link>
            </nav>

            <section className="pay-shell">
                <div className="pay-copy">
                    <p className="eyebrow">Онлайн-оплата</p>
                    <h1>Оплата доступа к MAYAK</h1>
                    <p className="lead">
                        Оплата проходит через ЮKassa. После успешного платежа доступ к цифровому тренажеру предоставляется по условиям
                        оферты.
                    </p>
                    <div className="service-summary">
                        <span>{legal.serviceName}</span>
                        <strong>{legal.priceRub} ₽</strong>
                        <p>{legal.serviceDescription}</p>
                    </div>
                </div>

                <form className="pay-form" onSubmit={handleSubmit}>
                    <label>
                        <span>Сумма, RUB</span>
                        <input
                            value={form.amount}
                            inputMode="decimal"
                            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                        />
                    </label>
                    <label>
                        <span>Описание</span>
                        <input
                            value={form.description}
                            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                        />
                    </label>
                    <label>
                        <span>Email клиента</span>
                        <input
                            type="email"
                            value={form.customerEmail}
                            onChange={(event) => setForm((current) => ({ ...current, customerEmail: event.target.value }))}
                            placeholder="client@example.com"
                        />
                    </label>
                    <label>
                        <span>Имя клиента</span>
                        <input
                            value={form.customerName}
                            onChange={(event) => setForm((current) => ({ ...current, customerName: event.target.value }))}
                            placeholder="Иван"
                        />
                    </label>
                    <button type="submit" disabled={loading}>
                        {loading ? "Создаем платеж..." : "Перейти к оплате"}
                    </button>
                    <p className="form-note">
                        Нажимая кнопку, вы соглашаетесь с <Link href="/offer">публичной офертой</Link>. Реквизиты исполнителя
                        опубликованы на странице <Link href="/requisites">реквизитов</Link>.
                    </p>
                </form>

                {error ? <div className="notice error">{error}</div> : null}

                {payment ? (
                    <section className={`payment-status ${payment.status}`}>
                        <span>Статус</span>
                        <strong>{formatPaymentStatus(payment.status)}</strong>
                        <code>{payment.id}</code>
                        {payment.confirmationUrl && payment.status !== "paid" ? (
                            <a href={payment.confirmationUrl}>Открыть страницу оплаты</a>
                        ) : null}
                    </section>
                ) : null}
            </section>

            <style jsx>{`
                .pay-page {
                    min-height: 100vh;
                    padding: 28px;
                    background: #f7f8fb;
                    color: #07111f;
                }

                .pay-nav {
                    width: min(1040px, 100%);
                    margin: 0 auto 28px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    color: #546179;
                }

                .pay-nav span {
                    flex: 1;
                }

                .pay-nav :global(a) {
                    color: inherit;
                    text-decoration: none;
                }

                .pay-nav :global(a:first-child) {
                    color: #07111f;
                    font-weight: 800;
                }

                .pay-shell {
                    width: min(1040px, 100%);
                    margin: 0 auto;
                    display: grid;
                    grid-template-columns: minmax(0, 0.92fr) minmax(340px, 1.08fr);
                    gap: 28px;
                    align-items: start;
                    padding-top: 34px;
                    border-top: 1px solid #dce3ee;
                }

                .pay-copy {
                    display: grid;
                    gap: 18px;
                    padding-top: 6px;
                }

                .eyebrow {
                    margin: 0;
                    color: #315dff;
                    font-size: 12px;
                    font-weight: 900;
                    letter-spacing: 0;
                    text-transform: uppercase;
                }

                h1 {
                    max-width: 520px;
                    margin: 0;
                    font-size: clamp(36px, 6vw, 68px);
                    line-height: 0.98;
                    letter-spacing: 0;
                }

                .lead {
                    max-width: 520px;
                    margin: 0;
                    color: #536074;
                    font-size: 17px;
                    line-height: 1.58;
                }

                .service-summary,
                .pay-form,
                .payment-status,
                .notice {
                    border: 1px solid #dce3ee;
                    border-radius: 8px;
                    background: #fff;
                }

                .service-summary {
                    display: grid;
                    gap: 10px;
                    max-width: 520px;
                    padding: 18px;
                }

                .service-summary span {
                    color: #536074;
                    font-size: 13px;
                    font-weight: 800;
                    text-transform: uppercase;
                }

                .service-summary strong {
                    font-size: 32px;
                }

                .service-summary p {
                    margin: 0;
                    color: #536074;
                    font-size: 15px;
                    line-height: 1.5;
                }

                .pay-form {
                    display: grid;
                    gap: 14px;
                    padding: 22px;
                }

                label {
                    display: grid;
                    gap: 7px;
                }

                label span {
                    color: #546179;
                    font-size: 12px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                input {
                    width: 100%;
                    min-height: 44px;
                    border: 1px solid #cad4e3;
                    border-radius: 8px;
                    padding: 10px 12px;
                    background: #fff;
                    color: #07111f;
                    font: inherit;
                    outline: none;
                }

                input:focus {
                    border-color: #315dff;
                    box-shadow: 0 0 0 3px rgba(49, 93, 255, 0.12);
                }

                button,
                .payment-status a {
                    min-height: 44px;
                    border: 1px solid #07111f;
                    border-radius: 8px;
                    background: #07111f;
                    color: #fff;
                    font: inherit;
                    font-weight: 900;
                    text-align: center;
                    text-decoration: none;
                    cursor: pointer;
                }

                button {
                    padding: 10px 16px;
                }

                button:disabled {
                    opacity: 0.55;
                    cursor: not-allowed;
                }

                .form-note {
                    margin: 0;
                    color: #68758a;
                    font-size: 13px;
                    line-height: 1.5;
                }

                .form-note :global(a) {
                    color: #315dff;
                }

                .notice,
                .payment-status {
                    grid-column: 2;
                    padding: 16px;
                }

                .notice.error {
                    border-color: #ffc4c4;
                    background: #fff1f1;
                    color: #8f1d1d;
                }

                .payment-status {
                    display: grid;
                    gap: 8px;
                }

                .payment-status span {
                    color: #68758a;
                    font-size: 12px;
                    font-weight: 900;
                    text-transform: uppercase;
                }

                .payment-status strong {
                    font-size: 22px;
                }

                .payment-status.paid {
                    border-color: #84d69a;
                    background: #f1fff5;
                }

                code {
                    max-width: 100%;
                    overflow: hidden;
                    color: #536074;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .payment-status a {
                    display: inline-grid;
                    place-items: center;
                    width: fit-content;
                    padding: 0 14px;
                }

                @media (max-width: 760px) {
                    .pay-page {
                        padding: 18px;
                    }

                    .pay-nav {
                        flex-wrap: wrap;
                        margin-bottom: 18px;
                    }

                    .pay-nav span {
                        display: none;
                    }

                    .pay-shell {
                        grid-template-columns: 1fr;
                        gap: 18px;
                        padding-top: 26px;
                    }

                    .notice,
                    .payment-status {
                        grid-column: 1;
                    }
                }
            `}</style>
        </main>
    );
}
