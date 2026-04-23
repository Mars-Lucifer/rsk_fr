"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { isMayakOnboardingQuestionnaireUrlConfigured } from "@/lib/mayakOnboardingQuestionnaire";

export default function QuestionnaireQrCode({ value = "", size = 180, emptyText = "QR-код появится после добавления ссылки.", className = "" }) {
    const [qrCodeUrl, setQrCodeUrl] = useState("");
    const [hasError, setHasError] = useState(false);
    const isConfigured = isMayakOnboardingQuestionnaireUrlConfigured(value);

    useEffect(() => {
        let cancelled = false;

        if (!isConfigured) {
            return undefined;
        }

        QRCode.toDataURL(String(value), {
            errorCorrectionLevel: "M",
            margin: 1,
            width: size,
        })
            .then((nextUrl) => {
                if (!cancelled) {
                    setQrCodeUrl(nextUrl);
                    setHasError(false);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setQrCodeUrl("");
                    setHasError(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isConfigured, size, value]);

    const displayQrCodeUrl = isConfigured ? qrCodeUrl : "";
    const displayHasError = isConfigured ? hasError : false;

    if (!displayQrCodeUrl) {
        return (
            <div
                className={`flex items-center justify-center rounded-[1.25rem] border border-dashed border-stone-300 bg-stone-50 p-4 text-center text-sm leading-6 text-stone-500 ${className}`.trim()}
                style={{ minHeight: `${size}px` }}>
                {displayHasError ? "Не удалось сгенерировать QR-код." : emptyText}
            </div>
        );
    }

    return (
        <div className={`rounded-[1.25rem] border border-stone-200 bg-white p-3 shadow-[0_12px_30px_rgba(28,25,23,0.05)] ${className}`.trim()}>
            <img src={displayQrCodeUrl} alt="QR-код анкеты" className="mx-auto h-auto max-w-full rounded-[0.9rem]" width={size} height={size} />
        </div>
    );
}
