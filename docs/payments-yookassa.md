# YooKassa payments

This project has a minimal YooKassa integration for МАЯК payments.

## Environment

Add these variables in the runtime environment:

```env
YOOKASSA_SHOP_ID=your_shop_id
YOOKASSA_SECRET_KEY=your_secret_key
YOOKASSA_WEBHOOK_SECRET=random_long_secret
NEXT_PUBLIC_BASE_URL=https://your-domain.example
MAYAK_PAYMENT_DEFAULT_AMOUNT_RUB=990
MAYAK_PAYMENT_DEFAULT_DESCRIPTION=Цифровой продукт МАЯК
MAYAK_SERVICE_DESCRIPTION=Доступ к цифровому тренажеру МАЯК, сценариям, методическим материалам и сопровождению прохождения.
MAYAK_SERVICE_DELIVERY_TERMS=После успешной оплаты пользователь получает доступ к цифровому продукту МАЯК.
MAYAK_SERVICE_SUPPORT_TERMS=Вопросы по оплате и доступу принимаются по электронной почте исполнителя.
MAYAK_SELLER_NAME=ФИО самозанятого
MAYAK_SELLER_INN=ИНН самозанятого
MAYAK_SELLER_EMAIL=help@rosdk.ru
MAYAK_SELLER_PHONE=+7...
MAYAK_SELLER_ADDRESS=
```

Do not expose `YOOKASSA_SECRET_KEY` to the browser.

## Routes

- `GET /pay` opens the payment page.
- `GET /requisites` shows seller requisites for YooKassa moderation.
- `GET /offer` shows the public offer.
- `POST /api/payments/create` creates a YooKassa payment and returns `confirmationUrl`.
- `GET /api/payments/status/:id` returns local payment status and syncs non-final payments with YooKassa.
- `POST /api/payments/webhook?secret=<YOOKASSA_WEBHOOK_SECRET>` receives YooKassa HTTP notifications.

## YooKassa cabinet

In YooKassa, configure HTTP notifications:

- URL: `https://your-domain.example/api/payments/webhook?secret=<YOOKASSA_WEBHOOK_SECRET>`
- Events: `payment.succeeded`, `payment.canceled`

The webhook handler verifies the incoming notification by requesting the payment from YooKassa API before changing local status.

## Local storage

Payments are stored in `data/mayak-payments.json`.
