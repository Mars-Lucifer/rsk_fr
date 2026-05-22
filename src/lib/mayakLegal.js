const DEFAULT_PRICE_RUB = "200";
const DEFAULT_SERVICE_NAME = "Вход в тренажер МАЯК";
const DEFAULT_SERVICE_DESCRIPTION =
    "Один вход в цифровой тренажер МАЯК с доступом к сценарию и материалам прохождения. Каждый вход действует 1 сутки.";

function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

export function getMayakLegalData() {
    return {
        sellerName: clean(process.env.MAYAK_SELLER_NAME),
        sellerInn: clean(process.env.MAYAK_SELLER_INN),
        sellerEmail: clean(process.env.MAYAK_SELLER_EMAIL) || "help@rosdk.ru",
        sellerPhone: clean(process.env.MAYAK_SELLER_PHONE),
        sellerAddress: clean(process.env.MAYAK_SELLER_ADDRESS) || "",
        serviceName: clean(process.env.MAYAK_PAYMENT_DEFAULT_DESCRIPTION) || DEFAULT_SERVICE_NAME,
        serviceDescription: clean(process.env.MAYAK_SERVICE_DESCRIPTION) || DEFAULT_SERVICE_DESCRIPTION,
        priceRub: clean(process.env.MAYAK_PAYMENT_DEFAULT_AMOUNT_RUB) || DEFAULT_PRICE_RUB,
        priceLabel: clean(process.env.MAYAK_PRICE_LABEL) || `${clean(process.env.MAYAK_PAYMENT_DEFAULT_AMOUNT_RUB) || DEFAULT_PRICE_RUB} ₽ за 1 вход`,
        deliveryTerms:
            clean(process.env.MAYAK_SERVICE_DELIVERY_TERMS) ||
            "После успешной оплаты пользователь получает выбранное количество входов в цифровой тренажер МАЯК на сайте, по ссылке или через согласованный с исполнителем канал связи. Каждый вход действует 1 сутки.",
        supportTerms:
            clean(process.env.MAYAK_SERVICE_SUPPORT_TERMS) ||
            "Вопросы по оплате, доступу и прохождению тренажера принимаются по электронной почте исполнителя.",
    };
}
