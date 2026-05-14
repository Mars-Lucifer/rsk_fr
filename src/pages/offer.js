import LegalShell from "@/components/legal/LegalShell";
import { getMayakLegalData } from "@/lib/mayakLegal";

export async function getServerSideProps() {
    return { props: { legal: getMayakLegalData(), updatedAt: new Date().toISOString().slice(0, 10) } };
}

export default function OfferPage({ legal, updatedAt }) {
    return (
        <LegalShell
            eyebrow="Публичная оферта"
            title="Условия оказания цифровой услуги MAYAK"
            lead="Оферта описывает порядок оплаты, получения доступа, поддержки и возвратов для пользователей цифрового тренажера MAYAK.">
            <div className="legal-grid">
                <article className="legal-card wide">
                    <h2>1. Общие положения</h2>
                    <p>
                        Настоящий документ является публичной офертой самозанятого исполнителя {legal.sellerName}, ИНН {legal.sellerInn},
                        применяющего налог на профессиональный доход. Оплата услуги означает согласие пользователя с условиями оферты.
                    </p>
                    <p className="legal-muted">Дата редакции: {updatedAt}</p>
                </article>

                <article className="legal-card">
                    <h2>2. Предмет</h2>
                    <p>
                        Исполнитель предоставляет пользователю доступ к услуге: {legal.serviceName}. {legal.serviceDescription}
                    </p>
                </article>

                <article className="legal-card">
                    <h2>3. Стоимость и оплата</h2>
                    <p>
                        Стоимость услуги составляет {legal.priceRub} ₽. Оплата проводится онлайн через платежную форму ЮKassa.
                        Обязанность пользователя по оплате считается исполненной после подтверждения успешного платежа платежным сервисом.
                    </p>
                </article>

                <article className="legal-card">
                    <h2>4. Получение услуги</h2>
                    <p>{legal.deliveryTerms}</p>
                </article>

                <article className="legal-card">
                    <h2>5. Возвраты</h2>
                    <p>
                        Пользователь может направить запрос на возврат на email {legal.sellerEmail}. Возврат рассматривается индивидуально,
                        если доступ не был предоставлен, услуга оказана ненадлежащим образом или платеж был совершен ошибочно.
                    </p>
                </article>

                <article className="legal-card">
                    <h2>6. Поддержка</h2>
                    <p>{legal.supportTerms}</p>
                    <p>
                        Email: <a href={`mailto:${legal.sellerEmail}`}>{legal.sellerEmail}</a>
                    </p>
                </article>

                <article className="legal-card">
                    <h2>7. Персональные данные</h2>
                    <p>
                        Пользователь передает данные, необходимые для оплаты, получения доступа и обратной связи. Данные используются только
                        для исполнения заказа, поддержки пользователя и выполнения требований законодательства.
                    </p>
                </article>

                <article className="legal-card wide">
                    <h2>8. Реквизиты исполнителя</h2>
                    <dl>
                        <div>
                            <dt>ФИО</dt>
                            <dd>{legal.sellerName}</dd>
                        </div>
                        <div>
                            <dt>ИНН</dt>
                            <dd>{legal.sellerInn}</dd>
                        </div>
                        <div>
                            <dt>Email</dt>
                            <dd>
                                <a href={`mailto:${legal.sellerEmail}`}>{legal.sellerEmail}</a>
                            </dd>
                        </div>
                        <div>
                            <dt>Телефон</dt>
                            <dd>{legal.sellerPhone}</dd>
                        </div>
                    </dl>
                </article>
            </div>
        </LegalShell>
    );
}
