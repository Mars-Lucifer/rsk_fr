import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import DropdownInput from "@/components/ui/Input/DropdownInput";

import { listEduOrgs, countEduOrgs, listEduRegions, getEduSourceDate, EduRegistryMissingError } from "@/lib/eduRegistry";

const LIMIT = 20;

export async function getServerSideProps(context) {
    // Фасад дёргается напрямую, без fetch на собственный /api/edu/orgs: это тот же
    // процесс, и HTTP-круг сюда добавил бы только сериализацию и таймауты.
    const q = String(context.query.q || "").trim();
    const region = String(context.query.region || "").trim();
    const offset = Math.max(Number.parseInt(context.query.offset, 10) || 0, 0);

    const filters = { q, region };

    try {
        // Подсказки регионов берём из самого справочника, а не из
        // public/data/regions.txt: тот файл принадлежит портальному контуру,
        // в соседней ветке его как раз переводят с «обл» на «область», и
        // привязка к точным строкам оттуда сломала бы фильтр молча.
        const regions = listEduRegions();
        const total = countEduOrgs(filters);
        // Смещение обрезаем по выдаче: ?offset=10000 иначе печатает «10001–50 из 50»
        // над пустым списком — состояние, достижимое простой правкой адреса.
        // Прижимаем к началу последней страницы, а не к последней записи: иначе
        // хвост выдачи показывался бы одной строкой посреди пагинации.
        const lastPageOffset = total === 0 ? 0 : Math.floor((total - 1) / LIMIT) * LIMIT;
        const safeOffset = Math.min(offset, lastPageOffset);

        return {
            props: {
                ...filters,
                regions,
                offset: safeOffset,
                items: listEduOrgs({ ...filters, limit: LIMIT, offset: safeOffset }),
                total,
                sourceDate: getEduSourceDate(),
                missing: false,
            },
        };
    } catch (error) {
        if (error instanceof EduRegistryMissingError) {
            // Справочник не собран — это состояние развёртывания, а не ошибка
            // запроса: страница должна объяснить это, а не отдать 500.
            return { props: { ...filters, regions: [], offset, items: [], total: 0, sourceDate: "", missing: true } };
        }

        throw error;
    }
}

function buildHref({ q, region, offset }) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (region) params.set("region", region);
    if (offset > 0) params.set("offset", String(offset));

    const query = params.toString();
    return query ? `/organizations?${query}` : "/organizations";
}

function plural(n, forms) {
    const mod100 = n % 100;
    const mod10 = n % 10;
    if (mod100 >= 11 && mod100 <= 14) return forms[2];
    if (mod10 === 1) return forms[0];
    if (mod10 >= 2 && mod10 <= 4) return forms[1];
    return forms[2];
}

const KIND_LABELS = { college: "Колледж", university: "Вуз", both: "Колледж и вуз" };

/** Дата выгрузки хранится ISO-строкой, а на карточке печатается по-русски —
 *  на соседних экранах одно и то же число обязано выглядеть одинаково. */
const asSourceDate = (iso) => {
    const [year, month, day] = String(iso || "").split("-");
    return year && month && day ? `${day}.${month}.${year}` : "";
};

const regionOf = (org) => org.region_portal || org.region || "Регион не указан";
const cityOf = (org) => org.city || org.settlement || "Город не указан";

export default function OrganizationsPage(props) {
    const { regions = [], sourceDate, missing } = props;
    const router = useRouter();

    // Серверная отрисовка остаётся первой и главной: страница приходит уже
    // с выдачей, ссылка на отфильтрованный список работает, поиск виден без JS.
    // Клиентская дозагрузка только освежает эту же выдачу по ходу ввода.
    const [q, setQ] = useState(props.q ?? "");
    const [region, setRegion] = useState(props.region ?? "");
    const [offset, setOffset] = useState(props.offset || 0);
    const [items, setItems] = useState(props.items || []);
    const [total, setTotal] = useState(props.total || 0);

    // Первый проход после гидратации совпадает с тем, что уже отрисовал сервер:
    // запрашивать то же самое заново — лишний круг и мигание списка.
    const hydrated = useRef(false);

    // Переход по ссылке или «назад» приносит новые пропсы — состояние обязано
    // за ними последовать, иначе на экране останется прежняя выдача.
    useEffect(() => {
        setQ(props.q ?? "");
        setRegion(props.region ?? "");
        setOffset(props.offset || 0);
        setItems(props.items || []);
        setTotal(props.total || 0);
        hydrated.current = false;
    }, [props.items, props.total, props.offset, props.q, props.region]);

    useEffect(() => {
        if (!hydrated.current) {
            hydrated.current = true;
            return undefined;
        }

        const controller = new AbortController();
        // Задержка на ввод: без неё каждая буква уходит отдельным запросом,
        // а ответы возвращаются вперемешку. Прерывание предыдущего запроса
        // закрывает вторую половину той же беды — устаревший ответ, пришедший
        // позже свежего, затирал бы верную выдачу.
        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ q, region, limit: String(LIMIT), offset: String(offset) });
                const response = await fetch(`/api/edu/orgs?${params}`, { signal: controller.signal });
                const payload = await response.json();

                if (payload?.success) {
                    setItems(payload.data.items);
                    setTotal(payload.data.total);
                    // Адрес обновляем без перезагрузки: ссылку по-прежнему можно
                    // переслать, «назад» возвращает прежнюю выдачу.
                    router.replace(buildHref({ q, region, offset }), undefined, { shallow: true });
                }
            } catch (error) {
                // AbortError — не сбой, а отменённый устаревший запрос.
                if (error?.name !== "AbortError") {
                    console.error("Не удалось обновить список организаций:", error);
                }
            }
        }, 250);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [q, region, offset]);

    // Смена условий возвращает на первую страницу: остаться на седьмой при
    // выдаче из трёх записей значит показать пустоту.
    const change = (setter) => (value) => {
        setter(value);
        setOffset(0);
    };

    const from = total === 0 ? 0 : offset + 1;
    const to = Math.min(offset + LIMIT, total);
    const pages = Math.ceil(total / LIMIT);
    const currentPage = Math.floor(offset / LIMIT);
    const firstPage = Math.max(0, Math.min(currentPage - 2, pages - 5));

    return (
        <Layout>
            <Header>
                <Header.Heading>
                    Организации <span className="text-(--color-gray-black)">/</span> Справочник
                </Header.Heading>
            </Header>
            {/* Одна колонка внутри сетки, а не четыре её строки. У `.hero` стоит
                flex:1, и при короткой выдаче лишняя высота растягивала строки —
                единственная найденная организация уезжала на середину экрана.
                Здесь же сноска прижимается книзу через mt-auto. */}
            <div className="hero" style={{ gridTemplateRows: "1fr" }}>
                <div className="col-span-12 flex flex-col gap-[1.25rem]">
                    <h3>Колледжи и техникумы</h3>

                    {missing ? (
                        <div className="flex flex-col gap-[.5rem] items-center py-[3rem]">
                            <h6>Справочник не собран</h6>
                            <p className="text-center text-(--color-gray-black)">
                                База справочника отсутствует в этом окружении. Соберите её командой{" "}
                                <span className="link">node scripts/edu-registry-build.mjs</span> и обновите страницу.
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Форма остаётся обычной GET-формой и без JS работает как
                                раньше: это же и запасной путь, если дозагрузка не удалась.
                                С JS отправку перехватываем — выдача обновляется по ходу ввода. */}
                            <form
                                method="get"
                                action="/organizations"
                                onSubmit={(event) => event.preventDefault()}
                                className="flex gap-[.75rem] w-full max-[640px]:flex-col">
                                <div className="input-wrapper w-full">
                                    <input
                                        type="search"
                                        id="edu-q"
                                        name="q"
                                        autoComplete="off"
                                        value={q}
                                        onChange={(event) => change(setQ)(event.target.value)}
                                        placeholder="Название, ИНН или город"
                                        className="w-full"
                                    />
                                </div>
                                {/* Портальный DropdownInput вместо родного datalist: тот
                                    рисуется средствами ОС и к остальной странице отношения
                                    не имеет. onQueryChange оставляет прежнее поведение —
                                    набрал «Моск», выдача сузилась, не дожидаясь выбора из
                                    списка. Введённое сводится к настоящим названиям
                                    субъектов в фасаде. */}
                                <div className="w-[20rem] max-[640px]:w-full">
                                    <DropdownInput
                                        id="edu-region"
                                        name="region"
                                        placeholder="Регион"
                                        value={region}
                                        options={regions}
                                        onQueryChange={change(setRegion)}
                                        onChange={(event) => change(setRegion)(event.target.value)}
                                        className="w-full"
                                    />
                                </div>
                            </form>

                            <div className="flex flex-col gap-[.75rem]">
                                {items.length === 0 ? (
                                    <div className="flex flex-col gap-[.5rem] items-center py-[3rem]">
                                        <h6>Ничего не найдено</h6>
                                        <p className="text-center text-(--color-gray-black)">
                                            Справочник знает 89 субъектов Российской Федерации — попробуйте другой регион или короткий запрос.
                                        </p>
                                    </div>
                                ) : (
                                    items.map((org) => (
                                        <Link
                                            // Ключ — ИНН-строка: у 298 организаций значащий ведущий ноль,
                                            // любое приведение к числу теряет организацию.
                                            key={org.inn}
                                            href={`/organizations/${org.inn}`}
                                            className="group flex flex-col p-[1rem] rounded-[1rem] gap-[.5rem] h-fit
                                            border-[1.5px] border-(--color-gray-plus-50) transition-all duration-300 cursor-pointer
                                            hover:bg-(--color-white-gray) hover:border-(--color-white-gray)">
                                            {/* Кламп не для красоты: у иных организаций в кратком имени
                                                лежит перечисление всех вариантов названия на 354 символа. */}
                                            <span className="link big group-hover:text-(--color-blue) line-clamp-2" title={org.short_name || org.full_name}>
                                                {org.short_name || org.full_name}
                                            </span>
                                            {/* Краткое имя в схеме NOT NULL и пусто ни у кого: без сверки
                                                с полным 45 организаций печатают одно и то же дважды. */}
                                            {org.short_name && org.short_name !== org.full_name ? (
                                                <p className="small text-(--color-gray-black) line-clamp-2">{org.full_name}</p>
                                            ) : null}
                                            <div className="flex gap-[.5rem] items-center flex-wrap text-(--color-gray-black) group-hover:text-(--color-black)">
                                                <span className="link small">{KIND_LABELS[org.kind] || "Организация"}</span>
                                                <span className="link small">·</span>
                                                <span className="link small">{regionOf(org)}</span>
                                                {/* У городов федерального значения регион и город — одна строка,
                                                    «г Москва · г Москва» выглядит как ошибка данных. */}
                                                {cityOf(org) === regionOf(org) ? null : (
                                                    <>
                                                        <span className="link small">·</span>
                                                        <span className="link small">{cityOf(org)}</span>
                                                    </>
                                                )}
                                                <span className="link small">·</span>
                                                <span className="link small">
                                                    {org.programs_count} {plural(org.programs_count, ["программа", "программы", "программ"])}
                                                </span>
                                            </div>
                                        </Link>
                                    ))
                                )}
                            </div>

                            {pages > 1 ? (
                                <div className="flex items-center justify-between gap-[.75rem] max-[640px]:flex-col">
                                    <span className="link small text-(--color-gray-black)">
                                        {from}–{to} из {total}
                                    </span>
                                    <div className="switcher w-fit">
                                        <Link
                                            href={buildHref({ q, region, offset: Math.max(offset - LIMIT, 0) })}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                setOffset(Math.max(offset - LIMIT, 0));
                                            }}
                                            className={`link option ${offset === 0 ? "disabled pointer-events-none opacity-50" : ""}`}
                                            aria-label="Предыдущая страница">
                                            {"<"}
                                        </Link>
                                        {Array.from({ length: Math.min(5, pages) }, (_, i) => firstPage + i).map((page) => (
                                            <Link
                                                key={page}
                                                href={buildHref({ q, region, offset: page * LIMIT })}
                                                onClick={(event) => {
                                                    event.preventDefault();
                                                    setOffset(page * LIMIT);
                                                }}
                                                className={`link option ${page === currentPage ? "active" : ""}`}
                                                aria-current={page === currentPage ? "page" : undefined}>
                                                {page + 1}
                                            </Link>
                                        ))}
                                        <Link
                                            href={buildHref({ q, region, offset: Math.min(offset + LIMIT, (pages - 1) * LIMIT) })}
                                            onClick={(event) => {
                                                event.preventDefault();
                                                setOffset(Math.min(offset + LIMIT, (pages - 1) * LIMIT));
                                            }}
                                            className={`link option ${currentPage >= pages - 1 ? "disabled pointer-events-none opacity-50" : ""}`}
                                            aria-label="Следующая страница">
                                            {">"}
                                        </Link>
                                    </div>
                                </div>
                            ) : null}
                        </>
                    )}

                    {/* mt-auto прижимает сноску к низу экрана, когда выдача короткая,
                        и оставляет её под списком, когда длинная. */}
                    <p className="small text-(--color-gray-black) mt-auto pt-[1rem]">
                        Сведения из государственных реестров Рособрнадзора, ЕГРЮЛ и bus.gov.ru на {asSourceDate(sourceDate) || "дату выгрузки"}. Лицензия
                        даёт право вести обучение, аккредитация — выдавать диплом государственного образца.
                    </p>
                </div>
            </div>
        </Layout>
    );
}
