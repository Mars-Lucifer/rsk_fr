import Link from "next/link";

export default function LegalShell({ title, eyebrow, lead, children }) {
    return (
        <main className="legal-page">
            <nav className="legal-nav" aria-label="Юридические страницы">
                <Link href="/">МАЯК</Link>
                <span />
                <Link href="/pay">Оплата</Link>
                <Link href="/requisites">Реквизиты</Link>
                <Link href="/offer">Оферта</Link>
            </nav>

            <header className="legal-hero">
                <p>{eyebrow}</p>
                <h1>{title}</h1>
                {lead ? <div>{lead}</div> : null}
            </header>

            <section className="legal-content">{children}</section>

            <style jsx>{`
                .legal-page {
                    min-height: 100vh;
                    padding: 28px;
                    background: #f7f8fb;
                    color: #07111f;
                }

                .legal-nav {
                    width: min(1040px, 100%);
                    margin: 0 auto 28px;
                    display: flex;
                    align-items: center;
                    gap: 14px;
                    color: #546179;
                }

                .legal-nav span {
                    flex: 1;
                }

                .legal-nav :global(a) {
                    color: inherit;
                    text-decoration: none;
                }

                .legal-nav :global(a:first-child) {
                    color: #07111f;
                    font-weight: 800;
                }

                .legal-hero,
                .legal-content {
                    width: min(1040px, 100%);
                    margin: 0 auto;
                }

                .legal-hero {
                    display: grid;
                    gap: 14px;
                    padding: 42px 0 30px;
                    border-top: 1px solid #dce3ee;
                    border-bottom: 1px solid #dce3ee;
                }

                .legal-hero p {
                    margin: 0;
                    color: #315dff;
                    font-size: 12px;
                    font-weight: 900;
                    letter-spacing: 0;
                    text-transform: uppercase;
                }

                .legal-hero h1 {
                    max-width: 780px;
                    margin: 0;
                    font-size: clamp(34px, 7vw, 72px);
                    line-height: 0.98;
                    letter-spacing: 0;
                }

                .legal-hero div {
                    max-width: 720px;
                    color: #536074;
                    font-size: 17px;
                    line-height: 1.58;
                }

                .legal-content {
                    display: grid;
                    gap: 18px;
                    padding: 28px 0 64px;
                }

                :global(.legal-grid) {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: 18px;
                }

                :global(.legal-card) {
                    display: grid;
                    gap: 12px;
                    min-width: 0;
                    padding: 22px;
                    border: 1px solid #dce3ee;
                    border-radius: 8px;
                    background: #fff;
                }

                :global(.legal-card.wide) {
                    grid-column: 1 / -1;
                }

                :global(.legal-card h2),
                :global(.legal-card h3) {
                    margin: 0;
                    font-size: 20px;
                    line-height: 1.25;
                }

                :global(.legal-card p),
                :global(.legal-card li),
                :global(.legal-card dd),
                :global(.legal-card dt) {
                    font-size: 15px;
                    line-height: 1.55;
                }

                :global(.legal-card p),
                :global(.legal-card ul),
                :global(.legal-card ol),
                :global(.legal-card dl) {
                    margin: 0;
                }

                :global(.legal-card dl) {
                    display: grid;
                    gap: 10px;
                }

                :global(.legal-card dt) {
                    color: #68758a;
                    font-weight: 700;
                }

                :global(.legal-card dd) {
                    margin: 2px 0 0;
                    color: #07111f;
                    overflow-wrap: anywhere;
                }

                :global(.legal-card a) {
                    color: #315dff;
                }

                :global(.legal-muted) {
                    color: #68758a;
                }

                :global(.legal-alert) {
                    border-color: #ffd27a;
                    background: #fff8e8;
                }

                @media (max-width: 760px) {
                    .legal-page {
                        padding: 18px;
                    }

                    .legal-nav {
                        flex-wrap: wrap;
                        margin-bottom: 18px;
                    }

                    .legal-nav span {
                        display: none;
                    }

                    .legal-hero {
                        padding: 28px 0 22px;
                    }

                    :global(.legal-grid) {
                        grid-template-columns: 1fr;
                    }

                    :global(.legal-card) {
                        padding: 18px;
                    }
                }
            `}</style>
        </main>
    );
}
