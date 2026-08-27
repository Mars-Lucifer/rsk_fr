import Link from "next/link";

import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import Button from "@/components/ui/Button";

import { getEduOrg, getEduSourceDate, EduRegistryMissingError } from "@/lib/eduRegistry";
import { fetchEduParticipation, fetchInnByPortalId } from "@/lib/eduParticipation";

const SECTION = "col-span-12 flex flex-col gap-[1rem] rounded-[1rem] border-[1.5px] border-(--color-gray-plus-50) p-[1.25rem]";

const KIND_LABEL = { college: "Колледж", university: "Вуз", both: "Колледж и вуз" };

// Реестр Рособрнадзора о состоянии юрлица в ЕГРЮЛ не знает: у ликвидированной
// организации лицензия по-прежнему числится действующей. Поэтому состояние —
// отдельная заметная плашка, а не строчка среди реквизитов.
//
// Классы держим строками целиком: Tailwind собирает стили по литералам в
// исходниках, и склеенное из переменной имя класса до сборки не доезжает.
const STATE_NOTICE = {
    LIQUIDATED: { text: "Юридическое лицо ликвидировано", box: "bg-(--color-red-noise)", accent: "text-(--color-red-minus)" },
    LIQUIDATING: { text: "Юридическое лицо в процессе ликвидации", box: "bg-(--color-red-noise)", accent: "text-(--color-red-minus)" },
    REORGANIZING: { text: "Юридическое лицо в процессе реорганизации", box: "bg-(--color-orange-noise)", accent: "text-(--color-orange-minus)" },
    BANKRUPT: { text: "В отношении юридического лица идёт дело о банкротстве", box: "bg-(--color-orange-noise)", accent: "text-(--color-orange-minus)" },
};

/**
 * Даты в реестре в двух видах: дата регистрации юрлица — строка с эпохой в
 * миллисекундах ("765590400000"), дата выгрузки — YYYY-MM-DD.
 *
 * Разбираем по UTC и вручную: полночь UTC в отрицательной зоне съезжает на день
 * назад, а toLocaleDateString даёт на сервере и в браузере разный текст, и React
 * ругается на расхождение гидратации.
 */
function asDate(value) {
    const raw = String(value ?? "").trim();

    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        return raw.slice(0, 10).split("-").reverse().join(".");
    }

    // Знак обязателен в шаблоне: 13 организаций зарегистрированы до 1970 года,
    // и их эпоха отрицательна — без минуса они печатали «-342489600000».
    if (/^-?\d{10,}$/.test(raw)) {
        const date = new Date(Number(raw));
        const year = date.getUTCFullYear();
        // Мусор в колонке лучше показать как есть, чем как «01.01.1970».
        if (year >= 1900 && year <= 2100) {
            return `${String(date.getUTCDate()).padStart(2, "0")}.${String(date.getUTCMonth() + 1).padStart(2, "0")}.${year}`;
        }
    }

    return raw;
}

/** Реестр повторяет одно и то же разными словами: city «г Екатеринбург» рядом с
 *  settlement «Екатеринбург», индекс отдельным полем и он же в начале адреса. */
function joinUnique(values) {
    const kept = [];
    for (const value of values.map((item) => String(item ?? "").trim()).filter(Boolean)) {
        if (kept.some((item) => item.toLowerCase().includes(value.toLowerCase()))) {
            continue;
        }
        // Более полная запись вытесняет уже добавленную короткую.
        const shorter = kept.findIndex((item) => value.toLowerCase().includes(item.toLowerCase()));
        if (shorter >= 0) {
            kept[shorter] = value;
        } else {
            kept.push(value);
        }
    }

    return kept.join(", ");
}

/** В одном поле реестра бывает несколько телефонов или почт через запятую. */
const parts = (value) =>
    String(value ?? "")
        .split(/[,;]/)
        .map((item) => item.trim())
        .filter(Boolean);

const isEmpty = (value) => value === null || value === undefined || String(value).trim() === "";

function Fact({ label, value }) {
    if (isEmpty(value)) {
        return null;
    }

    return (
        <div className="flex flex-col gap-[.125rem]">
            <span className="link small text-(--color-gray-black)">{label}</span>
            <p className="small">{value}</p>
        </div>
    );
}

function Contacts({ org }) {
    const phones = parts(org.phone);
    const emails = parts(org.email);
    const site = String(org.website || "").trim();

    if (!phones.length && !emails.length && !site) {
        return null;
    }

    return (
        <div className={SECTION}>
            <h6>Контакты</h6>
            <div className="flex flex-col gap-[.5rem]">
                {phones.map((phone) =>
                    // Реестр пишет факс в том же поле через запятую: «…, факс 8 812…».
                    // Ссылкой tel: он быть не должен — по факсу не звонят.
                    /факс/i.test(phone) ? (
                        <p key={phone} className="big text-(--color-gray-black)">
                            Факс: {phone.replace(/факс/i, "").trim()}
                        </p>
                    ) : (
                        // В href оставляем только цифры и плюс: скобки и пробелы из
                        // реестра часть наборников телефона понимает как разделители.
                        <a key={phone} className="big text-(--color-blue)" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>
                            {phone}
                        </a>
                    )
                )}
                {emails.map((email) => (
                    <a key={email} className="big text-(--color-blue)" href={`mailto:${email}`}>
                        {email}
                    </a>
                ))}
                {site ? (
                    <a className="big text-(--color-blue) break-all" href={/^https?:\/\//i.test(site) ? site : `https://${site}`} target="_blank" rel="noreferrer noopener">
                        {site}
                    </a>
                ) : null}
            </div>
        </div>
    );
}

function Programs({ programs }) {
    if (!programs.length) {
        return null;
    }

    const byLevel = new Map();
    for (const program of programs) {
        const level = program.level || "Уровень не указан";
        if (!byLevel.has(level)) {
            byLevel.set(level, []);
        }
        byLevel.get(level).push(program);
    }

    return (
        <div className={SECTION}>
            <h6>Образовательные программы — {programs.length}</h6>
            <div className="flex flex-col gap-[.75rem]">
                {[...byLevel].map(([level, items]) => (
                    // Свёрнуто по умолчанию: у одной организации бывает до 453 программ.
                    <details key={level} className="rounded-[1rem] bg-(--color-white-gray) p-[1rem]">
                        <summary className="link big cursor-pointer">
                            {level} <span className="text-(--color-gray-black)">— {items.length}</span>
                        </summary>
                        <div className="flex flex-col gap-[.75rem] pt-[1rem]">
                            {items.map((program, idx) => (
                                <div key={`${program.code}-${idx}`} className="flex flex-col gap-[.125rem]">
                                    {program.code ? <span className="link small text-(--color-gray-black)">{program.code}</span> : null}
                                    {/* Названия доходят до 4384 символов с реестровым мусором:
                                        режем тремя строками, целиком отдаём в title. */}
                                    <p className="small line-clamp-3 break-words" title={program.name}>
                                        {program.name}
                                    </p>
                                    {program.qualification ? <span className="link small text-(--color-gray-black)">Квалификация: {program.qualification}</span> : null}
                                </div>
                            ))}
                        </div>
                    </details>
                ))}
            </div>
        </div>
    );
}

function Places({ places }) {
    if (!places.length) {
        return null;
    }

    const visible = places.slice(0, 5);
    const hidden = places.slice(5);

    return (
        <div className={SECTION}>
            <h6>Адреса мест осуществления образовательной деятельности — {places.length}</h6>
            <div className="flex flex-col gap-[.5rem]">
                {visible.map((place, idx) => (
                    <p key={idx} className="small">
                        {place.address}
                    </p>
                ))}
            </div>
            {hidden.length ? (
                <details className="rounded-[1rem] bg-(--color-white-gray) p-[1rem]">
                    <summary className="link big cursor-pointer">Показать все {places.length}</summary>
                    <div className="flex flex-col gap-[.5rem] pt-[1rem]">
                        {hidden.map((place, idx) => (
                            <p key={idx} className="small">
                                {place.address}
                            </p>
                        ))}
                    </div>
                </details>
            ) : null}
        </div>
    );
}

/**
 * Участие организации в конкурсе. Блока нет, пока участия нет: шесть нулей на
 * карточке колледжа, который о конкурсе не слышал, — это шум, а не сведения.
 * Сейчас так у всех 4163 организаций, и появится этот блок только с запуском.
 */
function Participation({ participation }) {
    if (!participation?.participates) {
        return null;
    }

    return (
        <div className={SECTION}>
            <h6>Участие в конкурсе</h6>
            <div className="flex gap-[1.5rem] flex-wrap">
                <div className="flex flex-col gap-[.125rem]">
                    <span className="link small text-(--color-gray-black)">Индекс цифровой зрелости</span>
                    <p className="big text-(--color-blue)">{participation.star}</p>
                </div>
                <div className="flex flex-col gap-[.125rem]">
                    <span className="link small text-(--color-gray-black)">Участников</span>
                    <p className="big">{participation.members}</p>
                </div>
                <div className="flex flex-col gap-[.125rem]">
                    <span className="link small text-(--color-gray-black)">Команд</span>
                    <p className="big">{participation.teams}</p>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-[1rem] max-[640px]:grid-cols-1">
                {participation.axes.map((axis) => (
                    <div key={axis.label} className="flex flex-col gap-[.125rem]">
                        <span className="link small text-(--color-gray-black)">{axis.label}</span>
                        <p className="small">{axis.value}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function Accreditation({ activeCerts }) {
    // Три разных состояния, и сливать их нельзя: null — организации нет в реестре
    // аккредитации, 0 — свидетельства были и истекли, N — есть действующие.
    if (activeCerts === null || activeCerts === undefined) {
        // 438 организаций из 5180 — не редкий случай, и висящая строка без
        // заголовка среди карточек читается как обрыв вёрстки, а не как факт.
        return (
            <div className={SECTION}>
                <h6>Государственная аккредитация</h6>
                <p className="small text-(--color-gray-black)">
                    Сведений в реестре аккредитации нет. Это не значит, что аккредитации нет: организация может в реестр просто не попасть.
                </p>
            </div>
        );
    }

    // Насыщенный оттенок семейства вместо базового: --color-green на своём
    // noise-фоне почти не читается, а это не декоративный тег, а сообщение.
    const tone = activeCerts > 0 ? "bg-(--color-green-noise) text-(--color-green-minus-50)" : "bg-(--color-orange-noise) text-(--color-orange-minus)";

    return (
        <div className={SECTION}>
            <h6>Государственная аккредитация</h6>
            <p className={`big w-fit rounded-[.625rem] px-[.75rem] py-[.5rem] ${tone}`}>
                {activeCerts > 0 ? `Действующих свидетельств: ${activeCerts}, вправе выдавать диплом государственного образца` : "Государственной аккредитации нет"}
            </p>
        </div>
    );
}

export default function OrganizationPage({ org, licenses, programs, places, participation, sourceDate, missing }) {
    if (missing) {
        return (
            <Layout>
                <Header>
                    <Header.Heading>
                        Образование <span className="text-(--color-gray-black)">/</span> Организация
                    </Header.Heading>
                </Header>
                <div className="hero" style={{ placeItems: "center" }}>
                    <div className="flex flex-col gap-[1rem] col-start-4 col-end-10 max-[900px]:col-start-1 max-[900px]:col-end-7">
                        <h1 className="text-center">Справочник не собран</h1>
                        <p className="text-center text-(--color-gray-black)">Реестр образовательных организаций ещё не выгружен на этом стенде. Карточка появится после сборки справочника.</p>
                    </div>
                </div>
            </Layout>
        );
    }

    const notice = STATE_NOTICE[org.state_status];
    const place = joinUnique([org.city, org.settlement]);
    // ЕГРЮЛ и реестр образования печатают руководителя по-разному; берём того,
    // кто есть, вторым источником не дублируем.
    const chief = org.management_name || org.head_name;
    const chiefPost = org.management_post || org.head_post;

    return (
        <Layout>
            <Header>
                {/* className задаём полным списком: Header.Heading разливает props
                    после базовых классов, и переданный className их вытесняет. */}
                <Header.Heading className="flex gap-[0.25rem] items-center min-w-0">
                    Образование <span className="text-(--color-gray-black)">/</span>
                    {/* Краткое название бывает длиной в четыре строки — шапка от него
                        расползается, поэтому в ней строка одна, полностью в title.
                        Именно line-clamp, а не truncate: `* { text-wrap: balance }`
                        в globals.css лежит вне слоёв и перебивает nowrap у truncate. */}
                    <span className="line-clamp-1 min-w-0" title={org.short_name || org.full_name}>
                        {org.short_name || org.full_name}
                    </span>
                </Header.Heading>
            </Header>

            <div className="hero" style={{ gridTemplateRows: "max-content" }}>
                <hgroup className="col-span-12 flex flex-col gap-[.5rem]">
                    <h3>{org.short_name || org.full_name}</h3>
                    {org.short_name && org.full_name && org.short_name !== org.full_name ? <p className="text-(--color-gray-black)">{org.full_name}</p> : null}
                    <div className="flex gap-[.75rem] flex-wrap pt-[.25rem]">
                        <span className="link small rounded-[6.25rem] px-[.75rem] py-[.5rem] bg-(--color-blue-noise) text-(--color-blue)">{KIND_LABEL[org.kind] || "Образовательная организация"}</span>
                        {/* type — это тот же вид словами справочника orgs_service, и у
                            колледжей он слово в слово совпадает с плашкой рядом.
                            Показываем, только когда он что-то добавляет. */}
                        {org.type && org.type !== KIND_LABEL[org.kind] ? (
                            <span className="link small rounded-[6.25rem] px-[.75rem] py-[.5rem] bg-(--color-gray-plus-50) text-(--color-gray-black)">{org.type}</span>
                        ) : null}
                        {place ? <span className="link small rounded-[6.25rem] px-[.75rem] py-[.5rem] bg-(--color-gray-plus-50) text-(--color-gray-black)">{place}</span> : null}
                        {org.region ? <span className="link small rounded-[6.25rem] px-[.75rem] py-[.5rem] bg-(--color-gray-plus-50) text-(--color-gray-black)">{org.region}</span> : null}
                    </div>
                </hgroup>

                {notice ? (
                    <div className={`col-span-12 rounded-[1rem] px-[1.25rem] py-[1rem] ${notice.box}`}>
                        <h6 className={notice.accent}>{notice.text}</h6>
                        <p className="small text-(--color-gray-black)">Лицензия в реестре Рособрнадзора может по-прежнему числиться действующей: реестр о состоянии юридического лица в ЕГРЮЛ не знает.</p>
                    </div>
                ) : null}

                <Contacts org={org} />
                <Programs programs={programs} />
                <Places places={places} />

                {/* Лицензия и аккредитация — разные вещи: первая даёт право учить,
                    вторая — право выдавать диплом государственного образца.
                    Одной строкой «работает» их не сводить. */}
                {licenses.length ? (
                    <div className={SECTION}>
                        <h6>Лицензия на образовательную деятельность</h6>
                        <div className="flex flex-col gap-[.75rem]">
                            {licenses.map((license) => (
                                <div key={license.license_id} className="flex flex-col gap-[.125rem]">
                                    <span className="link big">
                                        № {license.reg_num || "—"}
                                        {/* Сегодня в справочнике все лицензии действующие, и статус
                                            выглядит лишним. Но выгрузка обновляется, и прекращённая
                                            лицензия иначе отрисуется неотличимо от действующей. */}
                                        {license.status && license.status !== "Действующая" ? (
                                            <span className="small text-(--color-red-minus)"> — {license.status.toLowerCase()}</span>
                                        ) : null}
                                    </span>
                                    {license.licensing_body ? <p className="small text-(--color-gray-black)">{license.licensing_body}</p> : null}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                <Participation participation={participation} />

                <Accreditation activeCerts={org.active_certs} />

                {org.rating === null || org.rating === undefined ? null : (
                    <div className={SECTION}>
                        <h6>Независимая оценка качества</h6>
                        {/* Шкала bus.gov.ru — 0..100, не пятибалльная: звёзды тут врут. */}
                        <p className="big">{org.rating} из 100 по независимой оценке качества</p>
                        <div className="w-full h-[.25rem] rounded-[6.25rem] overflow-hidden bg-(--color-blue-noise)">
                            <div className="bg-(--color-blue) h-full" style={{ width: `${Math.min(Math.max(org.rating, 0), 100)}%` }} />
                        </div>
                        <span className="link small text-(--color-gray-black)">Источник — bus.gov.ru</span>
                    </div>
                )}

                <div className={SECTION}>
                    <h6>О юридическом лице</h6>
                    <div className="grid grid-cols-3 gap-[1rem] max-[900px]:grid-cols-2 max-[640px]:grid-cols-1">
                        <Fact label="ИНН" value={org.inn} />
                        <Fact label="КПП" value={org.kpp} />
                        <Fact label="ОГРН" value={org.ogrn} />
                        <Fact label="ОПФ" value={org.opf} />
                        <Fact label="ОКВЭД" value={org.okved} />
                        <Fact label="ОКТМО" value={org.oktmo} />
                        <Fact label="Дата регистрации" value={asDate(org.registration_date)} />
                        <Fact label="Руководитель" value={chief && chiefPost ? `${chief}, ${chiefPost}` : chief || chiefPost} />
                        {/* Индекс приклеиваем, только если его нет в самом адресе:
                            в 545 случаях ЕГРЮЛ и реестр печатают РАЗНЫЕ индексы
                            одной организации, и joinUnique их не схлопывает,
                            а склеивает — «199004, 197110, г. Санкт-Петербург…». */}
                        <Fact
                            label="Юридический адрес"
                            value={/\d{6}/.test(org.address) ? org.address : joinUnique([org.postal_code, org.address])}
                        />
                    </div>
                    {org.lat && org.lon ? (
                        <a className="small text-(--color-blue) w-fit" href={`https://yandex.ru/maps/?pt=${org.lon},${org.lat}&z=16`} target="_blank" rel="noreferrer noopener">
                            Показать юридический адрес на карте
                        </a>
                    ) : null}
                </div>

                <div className="col-span-12 flex items-center justify-between gap-[1rem] flex-wrap">
                    <span className="link small text-(--color-gray-black)">Сведения из реестров на {asDate(sourceDate) || "неизвестную дату"}</span>
                    <Link href="/organizations">
                        <Button inverted>Назад в каталог</Button>
                    </Link>
                </div>
            </div>
        </Layout>
    );
}

export async function getServerSideProps({ params }) {
    // Маршрут принимает два вида ключа. Десять или двенадцать цифр — это ИНН.
    // Всё остальное считаем внутренним id из orgs_service: по таким ссылкам
    // ведут профиль и «Команды», и ломать их нельзя. Постоянный редирект
    // переводит их на ИНН — ключ, который переживёт перезаливку справочника.
    const key = String(params.organ ?? "");

    if (!/^\d{10}$|^\d{12}$/.test(key)) {
        const inn = await fetchInnByPortalId(key);

        if (!inn) {
            return { notFound: true };
        }

        return { redirect: { destination: `/organizations/${inn}`, permanent: true } };
    }

    try {
        const card = getEduOrg(key);

        if (!card) {
            return { notFound: true };
        }

        // Метрики конкурса живут в orgs_service и справочнику неизвестны.
        // Их отсутствие — обычное состояние организации, а не сбой: страница
        // обязана открыться и при погашенном бэкенде.
        const participation = await fetchEduParticipation({
            inn: key,
            shortName: card.org.short_name,
        });

        return { props: { ...card, participation, sourceDate: getEduSourceDate(), missing: false } };
    } catch (error) {
        if (error instanceof EduRegistryMissingError) {
            return {
                props: {
                    org: null, licenses: [], programs: [], places: [],
                    participation: { participates: false }, sourceDate: "", missing: true,
                },
            };
        }

        throw error;
    }
}
