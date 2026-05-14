const DEFAULT_PRICE_RUB = "990";
const DEFAULT_SERVICE_NAME = "Доступ к цифровому тренажеру MAYAK";
const DEFAULT_SERVICE_DESCRIPTION =
    "Оплачиваемый доступ к цифровому образовательному тренажеру MAYAK для прохождения сценариев, выполнения заданий и получения материалов по итогам работы.";

function clean(value) {
    return typeof value === "string" ? value.trim() : "";
}

export function getMayakLegalData() {
    return {
        sellerName: clean(process.env.MAYAK_SELLER_NAME) || "Укажите ФИО самозанятого",
        sellerInn: clean(process.env.MAYAK_SELLER_INN) || "Укажите ИНН самозанятого",
        sellerEmail: clean(process.env.MAYAK_SELLER_EMAIL) || "help@rosdk.ru",
        sellerPhone: clean(process.env.MAYAK_SELLER_PHONE) || "Укажите телефон",
        sellerAddress: clean(process.env.MAYAK_SELLER_ADDRESS) || "",
        serviceName: clean(process.env.MAYAK_PAYMENT_DEFAULT_DESCRIPTION) || DEFAULT_SERVICE_NAME,
        serviceDescription: clean(process.env.MAYAK_SERVICE_DESCRIPTION) || DEFAULT_SERVICE_DESCRIPTION,
        priceRub: clean(process.env.MAYAK_PAYMENT_DEFAULT_AMOUNT_RUB) || DEFAULT_PRICE_RUB,
        deliveryTerms:
            clean(process.env.MAYAK_SERVICE_DELIVERY_TERMS) ||
            "После успешной оплаты пользователь получает доступ к цифровому продукту MAYAK на сайте или по ссылке, предоставленной исполнителем.",
        supportTerms:
            clean(process.env.MAYAK_SERVICE_SUPPORT_TERMS) ||
            "Вопросы по оплате, доступу и прохождению тренажера принимаются по электронной почте исполнителя.",
    };
}
