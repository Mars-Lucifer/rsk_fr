const DEFAULT_PRICE_RUB = "990";
const DEFAULT_SERVICE_NAME = "Цифровой продукт МАЯК";
const DEFAULT_SERVICE_DESCRIPTION =
    "Доступ к цифровому тренажеру МАЯК, сценариям, методическим материалам и сопровождению прохождения.";

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
        priceLabel: clean(process.env.MAYAK_PRICE_LABEL) || `от ${clean(process.env.MAYAK_PAYMENT_DEFAULT_AMOUNT_RUB) || DEFAULT_PRICE_RUB} ₽`,
        deliveryTerms:
            clean(process.env.MAYAK_SERVICE_DELIVERY_TERMS) ||
            "После успешной оплаты пользователь получает доступ к цифровому продукту МАЯК на сайте, по ссылке или через согласованный с исполнителем канал связи.",
        supportTerms:
            clean(process.env.MAYAK_SERVICE_SUPPORT_TERMS) ||
            "Вопросы по оплате, доступу и прохождению тренажера принимаются по электронной почте исполнителя.",
    };
}
