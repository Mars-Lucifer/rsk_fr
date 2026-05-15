import LegalShell from "@/components/legal/LegalShell";
import { getMayakLegalData } from "@/lib/mayakLegal";

export async function getServerSideProps() {
    return { props: { legal: getMayakLegalData() } };
}

export default function RequisitesPage({ legal }) {
    return (
        <LegalShell
            eyebrow="Реквизиты"
            title="Реквизиты самозанятого исполнителя"
            lead="Эта страница содержит сведения о продавце, контакты поддержки, описание услуги и условия получения доступа после оплаты. Ссылка на нее подходит для анкеты ЮKassa.">
            <div className="legal-grid">
                <article className="legal-card">
                    <h2>Исполнитель</h2>
                    <dl>
                        <div>
                            <dt>Статус</dt>
                            <dd>Самозанятый, плательщик налога на профессиональный доход</dd>
                        </div>
                        <div>
                            <dt>ФИО</dt>
                            <dd>{legal.sellerName || "—"}</dd>
                        </div>
                        <div>
                            <dt>ИНН</dt>
                            <dd>{legal.sellerInn || "—"}</dd>
                        </div>
                        {legal.sellerAddress ? (
                            <div>
                                <dt>Адрес</dt>
                                <dd>{legal.sellerAddress}</dd>
                            </div>
                        ) : null}
                    </dl>
                </article>

                <article className="legal-card">
                    <h2>Контакты</h2>
                    <dl>
                        <div>
                            <dt>Email</dt>
                            <dd>
                                <a href={`mailto:${legal.sellerEmail}`}>{legal.sellerEmail}</a>
                            </dd>
                        </div>
                        <div>
                            <dt>Телефон</dt>
                            <dd>{legal.sellerPhone || "—"}</dd>
                        </div>
                    </dl>
                </article>

                <article className="legal-card wide">
                    <h2>Услуга</h2>
                    <dl>
                        <div>
                            <dt>Наименование</dt>
                            <dd>{legal.serviceName}</dd>
                        </div>
                        <div>
                            <dt>Описание</dt>
                            <dd>{legal.serviceDescription}</dd>
                        </div>
                        <div>
                            <dt>Стоимость</dt>
                            <dd>{legal.priceLabel}</dd>
                        </div>
                        <div>
                            <dt>Получение доступа</dt>
                            <dd>{legal.deliveryTerms}</dd>
                        </div>
                    </dl>
                </article>
            </div>
        </LegalShell>
    );
}
