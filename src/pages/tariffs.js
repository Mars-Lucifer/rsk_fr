import LegalShell from "@/components/legal/LegalShell";
import { getMayakLegalData } from "@/lib/mayakLegal";

export async function getServerSideProps() {
    return { props: { legal: getMayakLegalData() } };
}

export default function TariffsPage({ legal }) {
    return (
        <LegalShell
            eyebrow="Услуги и тарифы"
            title={
                <>
                    Входы в тренажер
                    <br />
                    МАЯК
                </>
            }>
            <div className="legal-grid">
                <article className="legal-card wide tariff-primary">
                    <div className="tariff-heading">
                        <div>
                            <h2>{legal.serviceName}</h2>
                            <p>{legal.serviceDescription}</p>
                        </div>
                        <strong>{legal.priceRub} ₽</strong>
                    </div>
                    <dl>
                        <div>
                            <dt>Единица услуги</dt>
                            <dd>1 вход в цифровой тренажер МАЯК. Каждый вход действует 1 сутки.</dd>
                        </div>
                        <div>
                            <dt>Что входит</dt>
                            <dd>Доступ к тренажеру МАЯК, сценарию и материалам прохождения на срок действия входа.</dd>
                        </div>
                        <div>
                            <dt>Получение услуги</dt>
                            <dd>{legal.deliveryTerms}</dd>
                        </div>
                    </dl>
                    <a className="tariff-button" href="/pay">
                        Перейти к оплате
                    </a>
                </article>

                <article className="legal-card">
                    <h2>Срок действия</h2>
                    <p>Каждый оплаченный вход действует 1 сутки с момента выдачи доступа.</p>
                    <dl>
                        <div>
                            <dt>Цена</dt>
                            <dd>{legal.priceRub} ₽ за 1 вход</dd>
                        </div>
                    </dl>
                </article>

                <article className="legal-card">
                    <h2>Количество входов</h2>
                    <p>На странице оплаты можно выбрать или вписать нужное количество входов. Итоговая сумма считается автоматически.</p>
                    <dl>
                        <div>
                            <dt>Расчет</dt>
                            <dd>{legal.priceRub} ₽ × выбранное количество входов</dd>
                        </div>
                    </dl>
                </article>

                <article className="legal-card">
                    <h2>Сопровождение</h2>
                    <p>При необходимости исполнитель помогает с выдачей доступа и вопросами по прохождению тренажера.</p>
                    <dl>
                        <div>
                            <dt>Цена</dt>
                            <dd>Включено в основной тариф</dd>
                        </div>
                    </dl>
                </article>

                <article className="legal-card">
                    <h2>Техническая поддержка</h2>
                    <p>Помощь по вопросам оплаты, выдачи доступа и использования тренажера МАЯК.</p>
                    <dl>
                        <div>
                            <dt>Цена</dt>
                            <dd>Включено в основной тариф</dd>
                        </div>
                    </dl>
                </article>

                <article className="legal-card wide">
                    <h2>Исполнитель</h2>
                    <p>
                        Услуги оказывает самозанятый: {legal.sellerName}, ИНН {legal.sellerInn}. Контакты и реквизиты опубликованы на
                        странице <a href="/requisites">реквизитов</a>.
                    </p>
                </article>
            </div>

            <style jsx>{`
                .tariff-primary {
                    border-color: #b7c5ff;
                    background: #f8faff;
                }

                .tariff-heading {
                    display: grid;
                    grid-template-columns: minmax(0, 1fr) auto;
                    gap: 18px;
                    align-items: start;
                }

                .tariff-heading p {
                    margin-top: 8px;
                    color: #536074;
                }

                .tariff-heading strong {
                    color: #07111f;
                    font-size: 34px;
                    line-height: 1;
                    white-space: nowrap;
                }

                .tariff-button {
                    display: inline-grid;
                    place-items: center;
                    width: fit-content;
                    min-height: 44px;
                    padding: 0 16px;
                    border-radius: 8px;
                    background: #07111f;
                    color: #fff;
                    text-decoration: none;
                    font-weight: 900;
                }

                @media (max-width: 760px) {
                    .tariff-heading {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </LegalShell>
    );
}
