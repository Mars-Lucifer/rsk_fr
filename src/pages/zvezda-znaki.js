// Матрица знаков 6 × 6. Набор оценивается только целиком: по строке видно, растёт ли луч,
// по столбцу — одинаково ли кодируется уровень у разных лучей. По одному знаку этого не видно,
// поэтому страница и существует.
//
// Состояние в адресе (?size=): знак проверяется в том размере, в котором будет жить.
// Мелкий размер — главная проверка набора: в 32 px разваливается всё лишнее.

import Head from "next/head";
import { useRouter } from "next/router";

import Sign from "@/components/features/mayak-zvezda/signs/Sign";
import { LEVEL_ROLES, ROLES, matrix } from "@/components/features/mayak-zvezda/model/signs.mjs";
import { ACCENT } from "@/components/features/mayak-zvezda/model/platform.mjs";
import { CELLS } from "@/components/features/mayak-zvezda/model/artifacts.mjs";
import { LEVELS } from "@/components/features/mayak-zvezda/model/zvezda.mjs";

const SIZES = [32, 48, 72];

// Короткие имена ролей для шапки: полные формулировки живут в model/signs.mjs и показаны
// внизу страницы, в шапке от них остаётся только метка.
const ROLE_RU = {
    source: "источник",
    channel: "канал",
    result: "результат",
    count: "счёт",
    initiative: "инициатива",
};

export default function ZvezdaZnaki() {
    const router = useRouter();
    const size = SIZES.includes(Number(router.query.size)) ? Number(router.query.size) : 72;
    const rows = matrix();

    return (
        <>
            <Head>
                <title>ЗВЕЗДА · знаки</title>
            </Head>
            <main className="znaki">
                <header>
                    <p className="kicker">// ЗВЕЗДА</p>
                    <h1>Знаки клеток</h1>
                    <p className="sub">
                        Цвет кодирует луч, форма — уровень. Уровень принадлежит организации целиком: строка меняется
                        вся, поднять один луч отдельно нельзя.
                    </p>
                    <div className="sizes">
                        {SIZES.map((s) => (
                            <button
                                key={s}
                                type="button"
                                className={s === size ? "on" : ""}
                                onClick={() => router.replace({ query: { ...router.query, size: s } }, undefined, { shallow: true })}
                            >
                                {s} px
                            </button>
                        ))}
                    </div>
                </header>

                <table>
                    <thead>
                        <tr>
                            <th className="corner" />
                            {LEVELS.map((level) => (
                                <th key={level.n}>
                                    <b>
                                        {level.icz > 0 ? `+${level.icz}` : level.icz}
                                    </b>
                                    <span>{level.name}</span>
                                    <i>{LEVEL_ROLES[level.n].map((role) => ROLE_RU[role]).join(" · ")}</i>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ ray, cells }) => (
                            <tr key={ray.id}>
                                <th scope="row" style={{ "--c": ACCENT[ray.id] }}>
                                    <i />
                                    <b>{ray.name}</b>
                                    <span>{ray.about}</span>
                                </th>
                                {cells.map((cell) => (
                                    <td key={cell.level}>
                                        <Sign
                                            cell={cell}
                                            color={ACCENT[ray.id]}
                                            size={size}
                                            title={`${ray.name} · ${LEVELS[cell.level - 1].name}`}
                                        />
                                        <p>{CELLS[ray.id][cell.level].lead}</p>
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>

                <section className="roles">
                    <h2>Роли</h2>
                    <ul>
                        {Object.entries(ROLES).map(([id, text]) => (
                            <li key={id}>
                                <b>{id}</b> — {text}
                            </li>
                        ))}
                    </ul>
                    <p>
                        Три перелома модели: на +1 появляется обратный поток, на +2 результат перестаёт быть бумажным,
                        на +4 инициатива переходит к системе.
                    </p>
                </section>
            </main>

            <style jsx>{`
                .znaki {
                    min-height: 100vh;
                    padding: 48px 40px 80px;
                    background: #eceef1;
                    color: #2a2d33;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
                }
                .kicker {
                    margin: 0;
                    font-size: 11px;
                    letter-spacing: 0.22em;
                    color: #9aa0aa;
                }
                h1 {
                    margin: 6px 0 8px;
                    font-size: 30px;
                    font-weight: 500;
                }
                .sub {
                    margin: 0 0 20px;
                    max-width: 720px;
                    color: #6b7280;
                    font-size: 14px;
                    line-height: 1.5;
                }
                .sizes {
                    display: flex;
                    gap: 6px;
                    margin-bottom: 28px;
                }
                .sizes button {
                    padding: 5px 12px;
                    border: 1px solid #d4d8de;
                    border-radius: 4px;
                    background: #f7f8fa;
                    color: #6b7280;
                    font-size: 12px;
                    cursor: pointer;
                }
                .sizes button.on {
                    border-color: #2a2d33;
                    color: #2a2d33;
                    background: #fff;
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                }
                thead th {
                    padding: 0 10px 14px;
                    text-align: left;
                    vertical-align: bottom;
                    font-weight: 400;
                }
                thead th b {
                    display: block;
                    font-size: 17px;
                    font-weight: 500;
                }
                thead th span {
                    display: block;
                    font-size: 12px;
                    color: #6b7280;
                }
                thead th i {
                    display: block;
                    margin-top: 4px;
                    font-size: 9px;
                    font-style: normal;
                    letter-spacing: 0.06em;
                    color: #a8aeb8;
                }
                .corner {
                    width: 210px;
                }
                tbody th {
                    padding: 14px 14px 14px 0;
                    text-align: left;
                    vertical-align: top;
                    font-weight: 400;
                    border-top: 1px solid #e0e3e8;
                }
                tbody th i {
                    display: inline-block;
                    width: 8px;
                    height: 8px;
                    margin-right: 8px;
                    border-radius: 50%;
                    background: var(--c);
                }
                tbody th b {
                    font-size: 14px;
                    font-weight: 500;
                }
                tbody th span {
                    display: block;
                    margin-top: 4px;
                    font-size: 11px;
                    line-height: 1.45;
                    color: #8b919b;
                }
                td {
                    padding: 14px 10px;
                    vertical-align: top;
                    border-top: 1px solid #e0e3e8;
                }
                td p {
                    margin: 10px 0 0;
                    max-width: 190px;
                    font-size: 11px;
                    line-height: 1.45;
                    color: #767c86;
                }
                .roles {
                    margin-top: 44px;
                    padding-top: 20px;
                    border-top: 1px solid #e0e3e8;
                    max-width: 760px;
                }
                .roles h2 {
                    margin: 0 0 10px;
                    font-size: 15px;
                    font-weight: 500;
                }
                .roles ul {
                    margin: 0 0 12px;
                    padding-left: 18px;
                    color: #6b7280;
                    font-size: 13px;
                    line-height: 1.7;
                }
                .roles b {
                    color: #2a2d33;
                    font-weight: 500;
                }
                .roles p {
                    margin: 0;
                    color: #6b7280;
                    font-size: 13px;
                    line-height: 1.6;
                }
            `}</style>
        </>
    );
}
