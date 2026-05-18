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
                    Услуги по сопровождению
                    <br />
                    работы с тренажером МАЯК
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
                            <dd>Один доступ/одно сопровождение прохождения цифрового продукта МАЯК</dd>
                        </div>
                        <div>
                            <dt>Что входит</dt>
                            <dd>Настройка доступа, консультационная поддержка, методическое сопровождение и помощь пользователю при прохождении.</dd>
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
                    <h2>Настройка доступа</h2>
                    <p>Подготовка доступа пользователя к цифровому тренажеру МАЯК и проверка возможности начать прохождение.</p>
                    <dl>
                        <div>
                            <dt>Цена</dt>
                            <dd>Включено в основной тариф</dd>
                        </div>
                    </dl>
                </article>

                <article className="legal-card">
                    <h2>Консультационная поддержка</h2>
                    <p>Ответы на вопросы пользователя по прохождению, работе со сценариями и использованию материалов.</p>
                    <dl>
                        <div>
                            <dt>Цена</dt>
                            <dd>Включено в основной тариф</dd>
                        </div>
                    </dl>
                </article>

                <article className="legal-card">
                    <h2>Методическое сопровождение</h2>
                    <p>Помощь при работе с заданиями, сценариями и материалами цифрового продукта МАЯК.</p>
                    <dl>
                        <div>
                            <dt>Цена</dt>
                            <dd>Включено в основной тариф</dd>
                        </div>
                    </dl>
                </article>

                <article className="legal-card">
                    <h2>Техническая поддержка</h2>
                    <p>Помощь по вопросам доступа, оплаты и использования цифрового продукта.</p>
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
