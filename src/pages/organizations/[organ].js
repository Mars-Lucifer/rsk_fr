import Link from "next/link";

import Header from "@/components/layout/Header";
import Layout from "@/components/layout/Layout";
import Button from "@/components/ui/Button";

import { getEduOrg, getEduSourceDate, EduRegistryMissingError } from "@/lib/eduRegistry";
import { fetchEduParticipation, fetchInnByPortalId } from "@/lib/eduParticipation";

const CARD = "flex flex-col gap-[1rem] rounded-[1.25rem] border-[1.5px] border-(--color-gray-plus-50) bg-(--color-white-gray) p-[1.25rem]";

// Сетка карточки: три колонки, левая треть — сама организация, правые две —
// чему учит и по каким документам. Позиции в рядах задаются явно, поэтому на
// узком экране их надо снять — col-auto/row-auto возвращают обычную стопку.
const ROW_GRID = "grid grid-cols-3 gap-[1.25rem] max-[900px]:grid-cols-1";
const CELL_L = "col-start-1 max-[900px]:col-auto max-[900px]:row-auto";
const CELL_R = "col-start-2 col-span-2 max-[900px]:col-auto max-[900px]:row-auto max-[900px]:col-span-1";

/**
 * Иконки нарисованы здесь, а не разложены по `src/assets`: под карточку их нужно
 * десять, и десять svg-файлов ради одной страницы — лишние файлы в сборке.
 * Штрих в 1.6 и currentColor, чтобы цвет задавался классом на обёртке.
 */
const PATHS = {
    phone: "M4.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a1.5 1.5 0 0 1-1.6 1.5A16.5 16.5 0 0 1 3 5.1 1.5 1.5 0 0 1 4.5 3.5",
    mail: "M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5 M3 6.8l9 6.2 9-6.2",
    globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M3 12h18 M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3",
    pin: "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11 M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
    doc: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h4",
    shield: "M12 3l7 3v5.5c0 4.6-3 8-7 9.5-4-1.5-7-4.9-7-9.5V6z M9 12l2 2 4-4",
    cap: "M3 9l9-4 9 4-9 4-9-4z M7 11.2V16c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.8 M21 9v5",
    list: "M8 6h12 M8 12h12 M8 18h12 M4 6h.01 M4 12h.01 M4 18h.01",
    bank: "M3 10l9-6 9 6 M5.5 10v9 M9.8 10v9 M14.2 10v9 M18.5 10v9 M3 20h18",
    chevron: "M9 6l6 6-6 6",
};

function Icon({ name, className = "size-[1.25rem]" }) {
    return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {/* Несколько подпутей живут в одном d: при fill="none" это ровно то же,
                что россыпь <path>, только без лишних узлов. */}
            <path d={PATHS[name]} />
        </svg>
    );
}

/** Заголовок карточки: кружок с иконкой, название и счётчик справа. */
function CardHead({ icon, tone = "bg-(--color-blue-noise) text-(--color-blue)", children, count }) {
    return (
        <div className="flex items-center gap-[.75rem]">
            <span className={`shrink-0 size-[2.5rem] rounded-[.875rem] flex items-center justify-center ${tone}`}>
                <Icon name={icon} />
            </span>
            <h6 className="flex-1 min-w-0">{children}</h6>
            {count === undefined ? null : (
                <span className="link small shrink-0 rounded-[6.25rem] px-[.625rem] py-[.25rem] bg-(--color-blue-noise) text-(--color-blue)">{count}</span>
            )}
        </div>
    );
}

// Уровни образования различаем цветом кружка. Классы перечислены целиком:
// Tailwind собирает стили по литералам, склеенное из переменной имя не доедет.
const LEVEL_TONES = [
    "bg-(--color-blue-noise) text-(--color-blue)",
    "bg-(--color-green-noise) text-(--color-green-minus)",
    "bg-(--color-orange-noise) text-(--color-orange-minus)",
    "bg-(--color-gray-plus) text-(--color-gray-minus)",
];


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

/** Реестр повторяет одно и то же разными словами: индекс лежит отдельным полем
 *  и он же стоит в начале адреса. */
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

    // Строка контакта: кружок с иконкой и сама ссылка. Три вида отличаются
    // только иконкой и href, поэтому разводить их по компонентам нечего.
    const Row = ({ icon, children }) => (
        <div className="flex items-center gap-[.75rem] min-w-0">
            <span className="shrink-0 size-[2.25rem] rounded-[.75rem] flex items-center justify-center bg-white/15 text-white">
                <Icon name={icon} />
            </span>
            <span className="min-w-0 break-all">{children}</span>
        </div>
    );

    return (
        <div className="relative overflow-hidden rounded-[1.25rem] p-[1.25rem] text-white bg-[linear-gradient(125deg,var(--color-blue-minus)_0%,var(--color-blue)_55%,var(--color-blue-plus)_100%)]">
            {/* Дом контуром — декорация фона. aria-hidden и pointer-events-none:
                для скринридера и мыши его нет, он только заполняет пустой угол. */}
            <svg className="absolute -right-[1rem] -bottom-[1.5rem] w-[11rem] opacity-20 pointer-events-none" viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path d="M8 96V44l30-16v68 M38 96V56l32 14v26 M70 96V32l38 20v44 M18 54h8M18 66h8M18 78h8M48 70h8M48 82h8M80 56h8M80 68h8M80 80h8" />
            </svg>

            <div className="relative flex flex-col gap-[1rem]">
                <h6>Контакты</h6>
                <div className="flex flex-col gap-[.75rem]">
                    {phones.map((phone) =>
                        // Реестр пишет факс в том же поле через запятую: «…, факс 8 812…».
                        // Ссылкой tel: он быть не должен — по факсу не звонят.
                        /факс/i.test(phone) ? (
                            <Row key={phone} icon="phone">Факс: {phone.replace(/факс/i, "").trim()}</Row>
                        ) : (
                            <Row key={phone} icon="phone">
                                {/* В href оставляем только цифры и плюс: скобки и пробелы из
                                    реестра часть наборников телефона понимает как разделители. */}
                                <a href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a>
                            </Row>
                        )
                    )}
                    {emails.map((email) => (
                        <Row key={email} icon="mail">
                            <a href={`mailto:${email}`}>{email}</a>
                        </Row>
                    ))}
                    {site ? (
                        <Row icon="globe">
                            <a href={/^https?:\/\//i.test(site) ? site : `https://${site}`} target="_blank" rel="noreferrer noopener">
                                {site}
                            </a>
                        </Row>
                    ) : null}
                </div>
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
        <div className="flex flex-col gap-[1rem] rounded-[1.25rem] bg-(--color-blue-noise)/40 p-[1.25rem] h-full min-h-0">
            <CardHead icon="cap">Образовательные программы — {programs.length}</CardHead>
            {/* Прокрутка внутри списка, а не всей карточки: заголовок с числом
                программ должен оставаться на виду. */}
            <div className="flex flex-col gap-[.75rem] min-h-0 overflow-y-auto">
                {[...byLevel].map(([level, items], levelIdx) => {
                    const tone = LEVEL_TONES[levelIdx % LEVEL_TONES.length];

                    return (
                        // Свёрнуто по умолчанию: у одной организации бывает до 453 программ.
                        <details key={level} className="group rounded-[1rem] bg-(--color-white) px-[1.25rem] py-[1rem]">
                            <summary className="flex items-center gap-[.75rem] cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                                <span className={`shrink-0 size-[2.5rem] rounded-[.875rem] flex items-center justify-center ${tone}`}>
                                    <Icon name="list" />
                                </span>
                                <span className="link big flex-1 min-w-0">{level}</span>
                                <span className={`link small shrink-0 rounded-[6.25rem] px-[.625rem] py-[.25rem] ${tone}`}>{items.length}</span>
                                <Icon name="chevron" className="size-[1.25rem] shrink-0 text-(--color-gray-white) transition-transform group-open:rotate-90" />
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
                    );
                })}
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

    const Address = ({ address }) => (
        <div className="flex gap-[.625rem] items-start">
            <Icon name="pin" className="size-[1.125rem] shrink-0 mt-[.125rem] text-(--color-blue)" />
            <p className="small">{address}</p>
        </div>
    );

    return (
        <div className={CARD}>
            <CardHead icon="pin" count={places.length}>
                Адреса мест осуществления образовательной деятельности
            </CardHead>
            <div className="flex flex-col gap-[.625rem]">
                {visible.map((place, idx) => (
                    <Address key={idx} address={place.address} />
                ))}
            </div>
            {hidden.length ? (
                <details className="rounded-[1rem] bg-(--color-white) p-[1rem]">
                    <summary className="link big cursor-pointer">Показать все {places.length}</summary>
                    <div className="flex flex-col gap-[.625rem] pt-[1rem]">
                        {hidden.map((place, idx) => (
                            <Address key={idx} address={place.address} />
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
        <div className={CARD}>
            <CardHead icon="shield">Участие в конкурсе</CardHead>
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
            <div className={CARD}>
                <CardHead icon="shield" tone="bg-(--color-gray-plus) text-(--color-gray-minus)">
                    Государственная аккредитация
                </CardHead>
                <p className="small text-(--color-gray-black)">
                    Сведений в реестре аккредитации нет. Это не значит, что аккредитации нет: организация может в реестр просто не попасть.
                </p>
            </div>
        );
    }

    // Насыщенный оттенок семейства вместо базового: --color-green на своём
    // noise-фоне почти не читается, а это не декоративный тег, а сообщение.
    const has = activeCerts > 0;
    const box = has ? "bg-(--color-green-noise) border-(--color-green-plus-50)" : "bg-(--color-orange-noise) border-(--color-orange-plus-50)";
    const tone = has ? "bg-(--color-green-plus-50) text-(--color-green-minus-50)" : "bg-(--color-orange-plus-50) text-(--color-orange-minus)";

    return (
        <div className={`flex flex-col gap-[.75rem] rounded-[1.25rem] border-[1.5px] p-[1.25rem] ${box}`}>
            <CardHead icon="shield" tone={tone}>
                Государственная аккредитация
            </CardHead>
            <p className="small text-(--color-gray-black)">
                {has ? `Действующих свидетельств: ${activeCerts}, вправе выдавать диплом государственного образца` : "Государственной аккредитации нет"}
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
    // ЕГРЮЛ и реестр образования печатают руководителя по-разному; берём того,
    // кто есть, вторым источником не дублируем.
    const chief = org.management_name || org.head_name;
    const chiefPost = org.management_post || org.head_post;

    return (
        <Layout>
            <Header>
                {/* className задаём полным списком: Header.Heading разливает props
                    после базовых классов, и переданный className их вытесняет. */}
                <Header.Heading className="flex gap-[0.25rem] items-center min-w-0 flex-1">
                    Организации <span className="text-(--color-gray-black)">/</span>
                    {/* Краткое название бывает длиной в четыре строки — шапка от него
                        расползается, поэтому в ней строка одна, полностью в title.
                        Именно line-clamp, а не truncate: `* { text-wrap: balance }`
                        в globals.css лежит вне слоёв и перебивает nowrap у truncate. */}
                    <span className="line-clamp-1 min-w-0" title={org.short_name || org.full_name}>
                        {org.short_name || org.full_name}
                    </span>
                </Header.Heading>
                {/* Возврат в каталог — в шапке, а не под карточкой: до низа страницы
                    с двумя десятками программ ещё надо доскроллить. */}
                <Link href="/organizations" className="shrink-0">
                    <Button inverted>Назад в каталог</Button>
                </Link>
            </Header>

            <div className="hero" style={{ gridTemplateRows: "max-content" }}>
                {notice ? (
                    <div className={`col-span-12 rounded-[1.25rem] px-[1.25rem] py-[1rem] max-[900px]:col-span-6 ${notice.box}`}>
                        <h6 className={notice.accent}>{notice.text}</h6>
                        <p className="small text-(--color-gray-black)">Лицензия в реестре Рособрнадзора может по-прежнему числиться действующей: реестр о состоянии юридического лица в ЕГРЮЛ не знает.</p>
                    </div>
                ) : null}

                {/* Две колонки рядами, а не двумя стопками: правый блок обязан начинаться
                    и заканчиваться там же, где левый. Стопки этого не дают — они
                    выравнивают только верх, а дальше расходятся по высоте содержимого.
                    Отсюда явные row-start; на узком экране раскладка сбрасывается
                    в одну колонку, и явные позиции надо снять — иначе блоки лягут
                    друг на друга. */}
                <div className={`${ROW_GRID} col-span-12 max-[900px]:col-span-6`}>
                    <hgroup className={`${CELL_L} row-start-1 flex flex-col gap-[.5rem]`}>
                        <h4>{org.short_name || org.full_name}</h4>
                        {org.short_name && org.full_name && org.short_name !== org.full_name ? <p className="small text-(--color-gray-black)">{org.full_name}</p> : null}
                    </hgroup>

                    <div className={`${CELL_L} row-start-2 flex flex-col gap-[1.25rem]`}>
                        <Contacts org={org} />
                        <Places places={places} />
                    </div>

                    {/* Программы вынуты из потока абсолютом. Иначе высокий список растит
                        ряд и тянет левую колонку за собой: `auto`-ряд меряется по
                        max-content, и ни overflow-hidden, ни min-h-0 этого не отменяют —
                        они снимают минимальный размер, а не максимальный. Так блок
                        привязан к левой колонке и стоит на месте хоть при одном адресе,
                        хоть при четырёх, а список прокручивается внутри.
                        На узком экране абсолют снимается — там одна колонка и якорить
                        не к чему. */}
                    <div className={`${CELL_R} row-start-2 relative min-h-[16rem]`}>
                        <div className="absolute inset-0 flex flex-col max-[900px]:static max-[900px]:inset-auto">
                            <Programs programs={programs} />
                        </div>
                    </div>

                    <div className={`${CELL_L} row-start-3 flex flex-col gap-[1.25rem]`}>
                        {/* Лицензия и аккредитация — разные вещи: первая даёт право учить,
                            вторая — право выдавать диплом государственного образца.
                            Одной строкой «работает» их не сводить. */}
                        {licenses.length ? (
                            <div className={CARD}>
                                <CardHead icon="doc">Лицензия на образовательную деятельность</CardHead>
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

                        <Accreditation activeCerts={org.active_certs} />

                        {org.rating === null || org.rating === undefined ? null : (
                            <div className={CARD}>
                                <CardHead icon="shield">Независимая оценка качества</CardHead>
                                {/* Шкала bus.gov.ru — 0..100, не пятибалльная: звёзды тут врут. */}
                                <p className="big">{org.rating} из 100 по независимой оценке качества</p>
                                <div className="w-full h-[.25rem] rounded-[6.25rem] overflow-hidden bg-(--color-blue-noise)">
                                    <div className="bg-(--color-blue) h-full" style={{ width: `${Math.min(Math.max(org.rating, 0), 100)}%` }} />
                                </div>
                                <span className="link small text-(--color-gray-black)">Источник — bus.gov.ru</span>
                            </div>
                        )}
                    </div>

                    {/* Здесь без overflow-hidden: реквизитов ровно девять, прокручивать
                        нечего. Карточка растягивается на всю высоту ряда — низ сходится
                        с низом аккредитации. */}
                    <div className={`${CELL_R} row-start-3 flex flex-col gap-[1.25rem]`}>
                        <Participation participation={participation} />

                        <div className={`${CARD} bg-(--color-white) flex-1`}>
                            <CardHead icon="bank">О юридическом лице</CardHead>
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
                                <a className="small text-(--color-blue) w-fit flex items-center gap-[.375rem]" href={`https://yandex.ru/maps/?pt=${org.lon},${org.lat}&z=16`} target="_blank" rel="noreferrer noopener">
                                    <Icon name="pin" className="size-[1.125rem] shrink-0" />
                                    Показать юридический адрес на карте
                                </a>
                            ) : null}
                        </div>
                    </div>
                </div>

                <div className="col-span-12 max-[900px]:col-span-6">
                    <span className="link small text-(--color-gray-black)">Сведения из реестров на {asDate(sourceDate) || "неизвестную дату"}</span>
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
