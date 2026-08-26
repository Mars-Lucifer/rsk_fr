import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/layout/Layout";
import GuideTour from "@/components/features/mayak-guide/GuideTour";
import { TOUR_HANDOFF_KEY, TRAINER_TOUR, buildAccessTour } from "@/components/features/mayak-guide/accessTour.mjs";

const MAYAK_GUEST_SUFFIX = "aaaaa";

function formatDateTime(value) {
    const parsed = value ? new Date(value) : null;
    if (!parsed || Number.isNaN(parsed.getTime())) return "-";
    return parsed.toLocaleString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatRemainingTime(expiresAt, nowTs) {
    const expiresTs = Date.parse(expiresAt || "");
    if (!Number.isFinite(expiresTs)) return "--:--:--";

    const remainingMs = Math.max(0, expiresTs - nowTs);
    const totalSeconds = Math.floor(remainingMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Название по умолчанию — сегодняшняя дата. В списке у мастера копятся сессии за разные
// дни, и «1231» рядом с «Проба» не говорит ни о чём; дата говорит сразу. Мастер может
// переписать — поле обычное.
function defaultSessionName() {
    return `Занятие ${new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })}`;
}

function getStorageKey(accessId) {
    return `mayak_delegated_access_${accessId}`;
}

function buildTableOptions() {
    return Array.from({ length: 6 }, (_, index) => String(index + 1));
}

// Ссылка всё равно не влезает целиком — показываем начало и хвост, середину
// схлопываем. Полный адрес остаётся в title и уходит в буфер по кнопке копирования.
function shortenUrl(url, max = 52) {
    const value = String(url || "").replace(/^https?:\/\//, "");
    if (value.length <= max) return value;
    const head = value.slice(0, max - 14);
    const tail = value.slice(-10);
    return `${head}…${tail}`;
}

function pluralizeTeams(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return "команда";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "команды";
    return "команд";
}

function formatFileSize(value) {
    const size = Number(value) || 0;
    if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} МБ`;
    if (size >= 1024) return `${Math.round(size / 1024)} КБ`;
    return `${size} Б`;
}

export default function MayakDelegatedAccessPage() {
    const router = useRouter();
    const accessId = String(router.query?.accessId || "");
    const restoredAccessRef = useRef("");
    const [password, setPassword] = useState("");
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [loading, setLoading] = useState(false);
    // true, пока не проверили sessionStorage: до этого момента неизвестно,
    // показывать форму пароля или сразу кабинет.
    const [restoring, setRestoring] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [createFeedback, setCreateFeedback] = useState("");
    const [copiedKey, setCopiedKey] = useState("");
    const [overview, setOverview] = useState({ right: null, sessions: [] });
    const [nowTs, setNowTs] = useState(Date.now());
    const [isCompact, setIsCompact] = useState(false);
    const [form, setForm] = useState({
        sessionName: "",
        tableCount: "1",
    });
    const [tourOpen, setTourOpen] = useState(false);
    // Шаги строятся в момент запуска: шагу создания нужно число сессий ДО инструкции,
    // иначе у мастера с прошлыми занятиями он засчитается сразу и главное действие
    // инструкции — создать свою тестовую сессию — окажется пропущено.
    const [tourSteps, setTourSteps] = useState([]);
    const [demoOpen, setDemoOpen] = useState(false);

    const tableOptions = useMemo(() => buildTableOptions(), []);
    const right = overview.right || null;
    const sessions = Array.isArray(overview.sessions) ? overview.sessions : [];
    const materials = Array.isArray(overview.materials) ? overview.materials : [];
    const passedLessons = Array.isArray(overview.passedLessons) ? overview.passedLessons : [];

    // Дату подставляем на клиенте, а не в начальном состоянии: значение на сервере и в
    // браузере разошлось бы на границе суток, и React ругался бы на несовпадение разметки.
    // Срабатывает и после создания сессии — форма очищает поле, а следующей нужна та же дата.
    useEffect(() => {
        if (!isUnlocked) return;
        setForm((current) => (current.sessionName.trim() ? current : { ...current, sessionName: defaultSessionName() }));
    }, [isUnlocked, sessions.length]);

    const startTour = useCallback(() => {
        setTourSteps(buildAccessTour(sessions.length));
        // Метка для дашборда: он открывается по мастер-ссылке в новой вкладке и
        // подхватывает инструкцию с того места, где консоль закончила.
        try {
            window.localStorage.setItem(TOUR_HANDOFF_KEY, "1");
        } catch {
            // Приватный режим — дашборд просто не продолжит сам, кнопка там своя.
        }
        setTourOpen(true);
    }, [sessions.length]);

    const apiRequest = useCallback(
        async (body, passwordOverride) => {
            const resolvedPassword = passwordOverride ?? password;
            const response = await fetch(`/api/mayak/delegated-access/${encodeURIComponent(accessId)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ password: resolvedPassword, ...body }),
            });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || !payload.success) {
                throw new Error(payload.error || "Ошибка доступа");
            }
            return payload.data || {};
        },
        [accessId, password]
    );

    const loadOverview = useCallback(
        async (passwordOverride = password) => {
            const resolvedPassword = String(passwordOverride || "").trim();
            if (!accessId || !resolvedPassword) return;

            setLoading(true);
            setError("");
            try {
                const data = await apiRequest({ action: "overview" }, resolvedPassword);
                setOverview(data);
                setPassword(resolvedPassword);
                setIsUnlocked(true);
                window.sessionStorage.setItem(getStorageKey(accessId), resolvedPassword);
            } catch (loadError) {
                setIsUnlocked(false);
                setError(loadError.message || "Неверный пароль");
                window.sessionStorage.removeItem(getStorageKey(accessId));
            } finally {
                setLoading(false);
            }
        },
        [accessId, apiRequest, password]
    );

    // Пароль лежит в sessionStorage, поэтому после F5 кабинет открывается сам.
    // Пока идёт эта проверка, форму пароля не показываем: иначе она успевает
    // мигнуть вместе с кнопкой «Проверяем...» и выглядит как разлогин.
    useEffect(() => {
        if (!router.isReady || !accessId || restoredAccessRef.current === accessId) return;
        restoredAccessRef.current = accessId;
        const savedPassword = window.sessionStorage.getItem(getStorageKey(accessId)) || "";
        if (!savedPassword) {
            setRestoring(false);
            return;
        }
        loadOverview(savedPassword).finally(() => setRestoring(false));
    }, [accessId, loadOverview, router.isReady]);

    useEffect(() => {
        if (!isUnlocked) return undefined;
        const intervalId = window.setInterval(() => setNowTs(Date.now()), 1000);
        return () => window.clearInterval(intervalId);
    }, [isUnlocked]);

    useEffect(() => {
        const updateCompact = () => setIsCompact(window.innerWidth < 900);
        updateCompact();
        window.addEventListener("resize", updateCompact);
        return () => window.removeEventListener("resize", updateCompact);
    }, []);

    useEffect(() => {
        if (!message && !error) return undefined;
        const timeoutId = window.setTimeout(() => {
            setMessage("");
            setError("");
        }, message ? 1800 : 2600);
        return () => window.clearTimeout(timeoutId);
    }, [message, error]);

    useEffect(() => {
        if (!createFeedback) return undefined;
        const timeoutId = window.setTimeout(() => setCreateFeedback(""), 1800);
        return () => window.clearTimeout(timeoutId);
    }, [createFeedback]);

    useEffect(() => {
        if (!router.isReady || !isUnlocked || !accessId || !router.query.paymentId) return undefined;
        let cancelled = false;
        let timeoutId = null;
        const paymentId = String(router.query.paymentId || "").trim();

        async function checkPaymentStatus() {
            try {
                const response = await fetch(`/api/payments/status/${encodeURIComponent(paymentId)}`);
                const payload = await response.json().catch(() => ({}));
                if (!response.ok || payload?.success === false) {
                    throw new Error(payload?.error || "Не удалось проверить оплату");
                }
                if (cancelled) return;
                const status = payload?.data?.status;
                if (status === "paid") {
                    await loadOverview(password);
                    setMessage("Входы пополнены");
                    router.replace(`/mayak-access/${encodeURIComponent(accessId)}`, undefined, { shallow: true });
                    return;
                }
                if (status === "canceled") {
                    setError("Оплата отменена");
                    router.replace(`/mayak-access/${encodeURIComponent(accessId)}`, undefined, { shallow: true });
                    return;
                }
                timeoutId = window.setTimeout(checkPaymentStatus, 3000);
            } catch (statusError) {
                if (!cancelled) setError(statusError.message || "Не удалось проверить оплату");
            }
        }

        checkPaymentStatus();
        return () => {
            cancelled = true;
            if (timeoutId) window.clearTimeout(timeoutId);
        };
    }, [accessId, isUnlocked, loadOverview, password, router, router.isReady, router.query.paymentId]);

    const handleLogin = async (event) => {
        event.preventDefault();
        await loadOverview(password);
    };

    const handleCreate = async (event) => {
        event.preventDefault();
        setCreating(true);
        setError("");
        setMessage("");
        setCreateFeedback("");

        try {
            const data = await apiRequest({
                action: "create_session",
                sessionName: form.sessionName,
                tableCount: form.tableCount,
            });
            setOverview(data);
            setForm((current) => ({
                ...current,
                sessionName: "",
            }));
            setCreateFeedback("Сессия создана");
        } catch (createError) {
            setError(createError.message || "Не удалось создать сессию");
        } finally {
            setCreating(false);
        }
    };

    // Прогресс уроков хранится на сервере по accessId — отмечаем пройденный урок
    // и обновляем локальное состояние ответом сервера.
    const handlePassLesson = useCallback(
        async (lessonId) => {
            try {
                const data = await apiRequest({ action: "pass_lesson", lessonId });
                setOverview((current) => ({ ...current, passedLessons: data.passedLessons || [] }));
            } catch (passError) {
                setError(passError.message || "Не удалось сохранить прогресс урока");
            }
        },
        [apiRequest]
    );

    const handleComplete = async (sessionId, sessionName) => {
        if (!window.confirm(`Завершить сессию «${sessionName || "Сессия"}»? Все ссылки перестанут работать, вернуть их нельзя.`)) {
            return;
        }
        setError("");
        setMessage("");
        try {
            const data = await apiRequest({ action: "complete_session", sessionId });
            setOverview(data);
            setMessage("Сессия завершена");
        } catch (completeError) {
            setError(completeError.message || "Не удалось завершить сессию");
        }
    };

    const copyText = async (key, value) => {
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            setCopiedKey(key);
            window.setTimeout(() => setCopiedKey((current) => (current === key ? "" : current)), 1600);
        } catch {
            setError("Не удалось скопировать");
        }
    };

    const buildTrainerLink = (tokenValue) => {
        if (!tokenValue || typeof window === "undefined") return "";
        const token = String(tokenValue).trim();
        const guestToken = token.toLowerCase().endsWith(MAYAK_GUEST_SUFFIX) ? token : `${token}${MAYAK_GUEST_SUFFIX}`;
        return `${window.location.origin}/tools/mayak-oko?token=${encodeURIComponent(guestToken)}`;
    };

    const buildParticipantLink = buildTrainerLink;

    // Отдельной ссылки на дашборд в кабинете нет: мастер открывает его кнопкой
    // внутри тренажёра. Сам `dashboardSecret` по-прежнему создаётся и уезжает
    // в мастер-ссылку параметром `?dash=`.
    const buildMasterLink = (masterSecret) => {
        if (!masterSecret || typeof window === "undefined") return "";
        return `${window.location.origin}/mayak-master/${String(masterSecret).trim()}`;
    };

    // Демонстрация берётся из самой свежей сессии: её мастер-ссылка ведёт в демо-тренажёр
    // с колодой этого доступа. Пока своей сессии нет — нет и карточки демонстрации,
    // и инструкция сначала доводит мастера до создания.
    const demoUrl = sessions.length ? buildMasterLink(sessions[0]?.links?.masterSecret) : "";

    if (!isUnlocked && restoring) {
        return (
            <Layout style={layoutStyle}>
                <section style={loginShellStyle}>
                    <div style={{ ...loginBoxStyle, alignItems: "center", gap: 14 }}>
                        <span style={loginMarkStyle} aria-hidden="true">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="4" y="10" width="16" height="10" rx="2.5" />
                                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                            </svg>
                        </span>
                        <span style={loginRestoreTextStyle}>Открываем кабинет...</span>
                    </div>
                </section>
            </Layout>
        );
    }

    if (!isUnlocked) {
        return (
            <Layout style={layoutStyle}>
                <section style={loginShellStyle}>
                    <form onSubmit={handleLogin} style={loginBoxStyle}>
                        <span style={loginBrandStyle}>
                            <span style={loginMarkStyle} aria-hidden="true">
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="4" y="10" width="16" height="10" rx="2.5" />
                                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                                    <circle cx="12" cy="15" r="1.4" fill="currentColor" stroke="none" />
                                </svg>
                            </span>
                            <span style={loginEyebrowStyle}>Кабинет мастера МАЯК</span>
                        </span>
                        <h1 style={loginTitleStyle}>Вход по паролю доступа</h1>
                        <p style={loginHintStyle}>
                            Пароль выдаётся вместе со ссылкой. Внутри — создание сессий, ссылки для участников и дашборд.
                        </p>
                        <input
                            autoFocus
                            type="password"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            style={loginInputStyle}
                            placeholder="Пароль доступа"
                            aria-label="Пароль доступа"
                        />
                        {error ? <div style={errorStyle}>{error}</div> : null}
                        <button type="submit" className="ma-primary" style={loginButtonStyle} disabled={loading || !password.trim()}>
                            {loading ? "Проверяем..." : "Войти"}
                        </button>
                        <span style={loginFootStyle}>Не помните пароль — попросите его у организатора доступа.</span>
                    </form>
                </section>
                <style jsx global>{`
                    .ma-primary:not(:disabled):hover {
                        filter: brightness(1.06);
                    }
                `}</style>
            </Layout>
        );
    }

    return (
        <Layout style={layoutStyle}>
            <section style={{ ...pageStyle, ...(isCompact ? compactPageStyle : null) }}>
                <div style={mainColumnStyle}>
                <header style={{ ...headerStyle, ...(isCompact ? compactHeaderStyle : null) }}>
                    <div style={headerTitleBoxStyle}>
                        <div style={eyebrowStyle}>Доступ МАЯК</div>
                        <h1 style={titleStyle}>{right?.title || right?.fullName || "Сессии"}</h1>
                        {/* Инструкция идёт по этому же экрану стрелками, а не уводит на
                            отдельную страницу: мастер нажимает те самые кнопки, и шаг
                            закрывается фактом — сессия создана, ссылка скопирована. */}
                        <button type="button" style={tourButtonStyle} onClick={startTour}>
                            <span aria-hidden="true">↳</span> Показать по шагам
                        </button>
                        <div style={metaLineStyle}>
                            <span>{right?.taskRange || right?.sectionId || "Колода"}</span>
                            {right?.sectionId && right.sectionId !== right.taskRange ? <span>{right.sectionId}</span> : null}
                        </div>
                    </div>
                    <div data-tour="limit" style={{ ...metricBoxStyle, ...(isCompact ? compactMetricBoxStyle : null) }}>
                        <div style={metricTextStyle}>
                            <span style={metricValueStyle}>{`${right?.remainingParticipantLimit ?? 0}/${right?.totalParticipantLimit ?? 0}`}</span>
                            <span style={metricLabelStyle}>входов осталось</span>
                        </div>
                        <a href={`/pay?accessId=${encodeURIComponent(accessId)}`} style={metricTopUpLinkStyle}>
                            Пополнить
                        </a>
                    </div>
                </header>

                {error ? <div style={noticeErrorStyle}>{error}</div> : null}
                {message ? <div style={noticeSuccessStyle}>{message}</div> : null}

                <form onSubmit={handleCreate} style={{ ...createPanelStyle, ...(isCompact ? compactCreatePanelStyle : null) }}>
                    <label data-tour="name" style={fieldStyle}>
                        <span style={labelStyle}>Название сессии</span>
                        <input
                            value={form.sessionName}
                            onChange={(event) => setForm((current) => ({ ...current, sessionName: event.target.value }))}
                            style={inputStyle}
                            placeholder="Например, Интенсив 5 октября"
                            maxLength={80}
                        />
                    </label>

                    <label data-tour="tables" style={fieldStyle}>
                        <span style={labelStyle}>Столы (команды)</span>
                        <select
                            value={form.tableCount}
                            onChange={(event) => setForm((current) => ({ ...current, tableCount: event.target.value }))}
                            style={inputStyle}>
                            {tableOptions.map((option) => (
                                <option key={option} value={option}>
                                    {`${option} ${pluralizeTeams(Number(option))}`}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div style={createActionStyle}>
                        <button
                            type="submit"
                            data-tour="create"
                            className="ma-primary"
                            style={primaryButtonStyle}
                            disabled={creating}>
                            {creating ? "Создаём..." : "Создать сессию"}
                        </button>
                        <span style={createFeedbackStyle}>{createFeedback}</span>
                    </div>
                </form>

                {/* Руководство стоит между созданием сессии и материалами: мастер
                    читает его до игры, а материалы качает уже под конкретную. */}
                <a data-tour="guide" href="/mayak-guide" target="_blank" rel="noreferrer" style={guideCardStyle}>
                    <span style={guideCardTextStyle}>
                        <span style={eyebrowStyle}>Руководство мастера</span>
                        <span style={guideTitleStyle}>Как вести тренажёр</span>
                        <span style={guideTextStyle}>
                            Комплект, роли и карты, раскладка поля, ход этапов «Я» и «МЫ», условия победы.
                        </span>
                    </span>
                    <span style={guideActionStyle}>Открыть →</span>
                </a>

                {/* Демонстрация тренажёра прямо здесь. Это та же страница, что открывается
                    по мастер-ссылке, только не в новой вкладке: мастер смотрит, как всё
                    устроено, не теряя консоль и не тратя входы участников. Инструкция
                    целится внутрь этого окна — страница своя, документ доступен. */}
                {demoUrl ? (
                    <button type="button" data-tour="demo-open" style={demoCardStyle} onClick={() => setDemoOpen(true)}>
                        <span style={guideCardTextStyle}>
                            <span style={eyebrowStyle}>Демонстрация</span>
                            <span style={guideTitleStyle}>Тренажёр МАЯК с колодой</span>
                            <span style={guideTextStyle}>
                                Открывается здесь же: типы контента, номер задания с бумажной карты, поля промта и отправка в сервис.
                            </span>
                        </span>
                        <span style={guideActionStyle}>Показать →</span>
                    </button>
                ) : null}

                {materials.length ? (
                    <section data-tour="materials" style={materialsPanelStyle}>
                        <h2 style={panelTitleStyle}>Материалы</h2>
                        <div style={materialsGridStyle}>
                            {materials.map((material) => (
                                <a key={material.id} href={material.url} download style={materialLinkStyle}>
                                    <span style={materialTitleStyle}>{material.title || material.originalName || "Материал"}</span>
                                    <span style={materialMetaStyle}>
                                        {String(material.extension || "").replace(".", "").toUpperCase() || "Файл"} · {formatFileSize(material.size)}
                                    </span>
                                </a>
                            ))}
                        </div>
                    </section>
                ) : null}

                <div style={sessionsListStyle}>
                    {sessions.length === 0 ? (
                        <div style={emptyStyle}>
                            <strong style={emptyTitleStyle}>Активных сессий нет</strong>
                            <span>
                                Создайте сессию — сразу получите три ссылки: для участников на группу 18 человек,
                                вашу персональную мастер-ссылку с дашбордом внутри и упрощённую ссылку для 1–5 человек.
                            </span>
                        </div>
                    ) : null}

                    {sessions.map((item) => {
                        const token = item.token || {};
                        const links = item.links || {};

                        const linkRows = [
                            {
                                key: "inspector",
                                label: "Ссылка для участников",
                                short:
                                    "Отправляется участникам обучения. Полный функционал тренажёра: столы, роли, " +
                                    "инспектор и проверка заданий. Рассчитана на группу 18 человек — 3 команды по 6.",
                                accent: "#152022",
                                url: buildTrainerLink(token.value),
                            },
                            {
                                key: "master",
                                label: "Мастер-ссылка",
                                short:
                                    "Ваша персональная ссылка. Демо-тренажёр. Дашборд — экран модерации со столами, " +
                                    "прогрессом и таймером — открывается кнопкой внутри.",
                                accent: "#b45309",
                                url: buildMasterLink(links.masterSecret),
                            },
                            {
                                key: "plain",
                                label: "Ссылка для участников, упрощённая",
                                short:
                                    "Без разделения на столы, без ролей и инспектора. " +
                                    "Рассчитана на обучение от 1 до 5 человек.",
                                accent: "#2563eb",
                                url: buildTrainerLink(links.plainToken),
                            },
                        ].filter((row) => row.url);

                        return (
                            <article key={item.sessionId} data-tour="session" style={sessionRowStyle}>
                                <div style={{ ...sessionHeaderStyle, ...(isCompact ? compactSessionHeaderStyle : null) }}>
                                    <div>
                                        <h2 style={sessionTitleStyle}>{item.sessionName || "Сессия"}</h2>
                                        <div style={sessionMetaStyle}>
                                            <span style={timerChipStyle}>
                                                Ссылки действуют:
                                                <b style={timerValueStyle}>
                                                    {item.isExpired ? "истекли" : formatRemainingTime(item.expiresAt, nowTs)}
                                                </b>
                                            </span>
                                            <span>{`до ${formatDateTime(item.expiresAt)}`}</span>
                                            <span>{`Столы: ${item.tableCount}`}</span>
                                            <span>{`Входы: ${token.usedCount || 0}/${token.usageLimit || item.participantLimit || 0}`}</span>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        data-tour="finish"
                                        style={secondaryButtonStyle}
                                        onClick={() => handleComplete(item.sessionId, item.sessionName)}>
                                        Завершить
                                    </button>
                                </div>

                                <div style={linksGridStyle}>
                                    {linkRows.map((row) => {
                                        const copyKey = `${item.sessionId}:${row.key}`;
                                        const isCopied = copiedKey === copyKey;
                                        return (
                                            <div
                                                key={row.key}
                                                data-tour={`link-${row.key}`}
                                                className="ma-link-row"
                                                style={{ ...linkRowStyle, ...(isCompact ? compactLinkRowStyle : null), borderLeftColor: row.accent }}>
                                                <span style={linkLabelBoxStyle}>
                                                    <span style={linkLabelLineStyle}>
                                                        <span style={{ ...linkDotStyle, background: row.accent }} />
                                                        <span style={linkLabelStyle}>{row.label}</span>
                                                    </span>
                                                    <span style={linkShortStyle}>{row.short}</span>
                                                </span>
                                                <code style={codeStyle} title={row.url}>
                                                    {shortenUrl(row.url)}
                                                </code>
                                                <div style={linkCardActionsStyle}>
                                                    <a href={row.url} target="_blank" rel="noreferrer" className="ma-open" title="Открыть в новой вкладке">
                                                        Открыть
                                                    </a>
                                                    <button
                                                        type="button"
                                                        className={`ma-icon ${isCopied ? "is-copied" : ""}`}
                                                        title="Скопировать ссылку"
                                                        aria-label={`Скопировать ссылку: ${row.label}`}
                                                        onClick={() => copyText(copyKey, row.url)}>
                                                        {isCopied ? "✓" : "⧉"}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </article>
                        );
                    })}
                </div>
                </div>

                <style jsx global>{`
                    /* Единая система кнопок: одна высота, один радиус, мягкий hover.
                       Инлайн-стилями hover/тултип не сделать — поэтому отдельный блок.
                       global: HintDot — отдельный компонент, локальный scope styled-jsx
                       до него не долетает и тултип оставался бы видимым текстом. */
                    .ma-open,
                    .ma-icon {
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        height: 34px;
                        border: 1px solid #dbe3e9;
                        border-radius: 9px;
                        background: #fff;
                        color: #152022;
                        font-size: 13px;
                        font-weight: 700;
                        text-decoration: none;
                        cursor: pointer;
                        transition:
                            border-color 0.15s ease,
                            background 0.15s ease,
                            color 0.15s ease;
                    }

                    .ma-open {
                        padding: 0 14px;
                    }

                    .ma-icon {
                        width: 34px;
                        font-size: 14px;
                    }

                    .ma-open:hover,
                    .ma-icon:hover {
                        border-color: #94a3b8;
                        background: #f4f7f9;
                    }

                    .ma-icon.is-copied {
                        border-color: #1c6b33;
                        background: #f1fff4;
                        color: #1c6b33;
                    }

                    .ma-poster {
                        transition: transform 0.2s ease;
                    }

                    .ma-poster:hover {
                        transform: scale(1.01);
                    }

                    .ma-primary {
                        transition:
                            background 0.15s ease,
                            opacity 0.15s ease;
                    }

                    .ma-primary:hover:not(:disabled) {
                        background: #24343a;
                    }

                    .ma-link-row {
                        transition:
                            border-color 0.15s ease,
                            box-shadow 0.15s ease,
                            background 0.15s ease;
                    }

                    .ma-link-row:hover {
                        background: #fff;
                        border-color: #cbd5e1;
                        box-shadow: 0 6px 18px rgba(16, 24, 32, 0.06);
                    }

                `}</style>

                {demoOpen && demoUrl ? (
                    <div style={demoOverlayStyle} role="dialog" aria-modal="true" aria-label="Демонстрация тренажёра">
                        <div style={demoBoxStyle}>
                            <div style={demoHeadStyle}>
                                <span style={demoTitleStyle}>Тренажёр МАЯК · демонстрация</span>
                                <span style={demoHeadActionsStyle}>
                                    {/* Запуск подсказок изнутри окна: открытая демонстрация перекрывает
                                        консоль целиком, и кнопка инструкции под заголовком становится
                                        недостижимой — мастер оказывался в тренажёре без провожатого. */}
                                    <button
                                        type="button"
                                        style={demoTourButtonStyle}
                                        onClick={() => {
                                            setTourSteps(TRAINER_TOUR);
                                            setTourOpen(true);
                                        }}>
                                        <span aria-hidden="true">↳</span> Провести по тренажёру
                                    </button>
                                    <button type="button" className="ma-icon" aria-label="Закрыть" onClick={() => setDemoOpen(false)}>
                                        ✕
                                    </button>
                                </span>
                            </div>
                            <iframe id="tour-demo" title="Демонстрация тренажёра" src={demoUrl} style={demoFrameStyle} />
                        </div>
                    </div>
                ) : null}

                <GuideTour
                    steps={tourSteps}
                    open={tourOpen && tourSteps.length > 0}
                    onClose={() => setTourOpen(false)}
                    title="Как вести занятие"
                />
            </section>
        </Layout>
    );
}

// Видеоуроки мастера. Пока заглушки: плеер — плейсхолдер, тест не проверяет
// ответы, но навигация настоящая — следующий урок открывается после теста.
// ponytail: список захардкожен, вынести в API когда ролики появятся на платформе.
const LESSONS = [
    {
        id: "l1",
        title: "Подготовка сессии",
        duration: "0:12",
        summary: "Как собрать столы, раздать ссылки и не потратить лишние входы.",
        video: "/mayak-lessons/lesson-1.mp4",
        poster: "/mayak-lessons/lesson-1.jpg",
    },
    {
        id: "l2",
        title: "Роли и инспектор",
        duration: "0:12",
        summary: "Кто такой инспектор, как идёт ревью и когда включать обычный режим.",
        video: "/mayak-lessons/lesson-2.mp4",
        poster: "/mayak-lessons/lesson-2.jpg",
    },
    {
        id: "l3",
        title: "Дашборд и разбор",
        duration: "0:12",
        summary: "Что смотреть в дашборде во время игры и как подвести итоги.",
        video: "/mayak-lessons/lesson-3.mp4",
        poster: "/mayak-lessons/lesson-3.jpg",
    },
];

function LessonsPanel({ passedIds = [], onPassLesson }) {
    const [openId, setOpenId] = useState(LESSONS[0].id);
    const [playingLesson, setPlayingLesson] = useState(null);

    // Пока открыт попап: Esc закрывает, фон не скроллится.
    useEffect(() => {
        if (!playingLesson) return undefined;
        const onKeyDown = (event) => {
            if (event.key === "Escape") setPlayingLesson(null);
        };
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [playingLesson]);

    const isUnlocked = (index) => index === 0 || passedIds.includes(LESSONS[index - 1].id);

    // Пройденный урок не закрывается: его можно пересмотреть и пройти тест снова.
    const handlePassTest = (lesson, index) => {
        onPassLesson?.(lesson.id);
        const next = LESSONS[index + 1];
        if (next) setOpenId(next.id);
    };

    return (
        <section style={lessonsPanelStyle}>
            <div style={lessonsHeadStyle}>
                <span style={eyebrowStyle}>Видеоуроки</span>
                <span style={{ ...lessonsCounterStyle, ...(passedIds.length === LESSONS.length ? passedMetaStyle : null) }}>
                    {`${passedIds.length}/${LESSONS.length}`}
                </span>
            </div>

            {LESSONS.map((lesson, index) => {
                const unlocked = isUnlocked(index);
                const isOpen = openId === lesson.id && unlocked;
                const isPassed = passedIds.includes(lesson.id);

                return (
                    <article
                        key={lesson.id}
                        style={{ ...lessonCardStyle, ...(isPassed ? passedLessonStyle : null), ...(unlocked ? null : lockedLessonStyle) }}>
                        <button
                            type="button"
                            disabled={!unlocked}
                            onClick={() => setOpenId((current) => (current === lesson.id ? "" : lesson.id))}
                            style={lessonHeadButtonStyle}>
                            <span style={{ ...lessonIndexStyle, ...(isPassed ? passedIndexStyle : null) }}>
                                {isPassed ? "✓" : unlocked ? index + 1 : "🔒"}
                            </span>
                            <span style={lessonTitleBoxStyle}>
                                <span style={lessonTitleStyle}>{lesson.title}</span>
                                <span style={{ ...lessonMetaStyle, ...(isPassed ? passedMetaStyle : null) }}>
                                    {isPassed ? `Пройден · ${lesson.duration}` : unlocked ? lesson.duration : "Пройдите предыдущий тест"}
                                </span>
                            </span>
                            <span style={lessonChevronStyle}>{isOpen ? "▲" : "▼"}</span>
                        </button>

                        {isOpen ? (
                            <div style={lessonBodyStyle}>
                                {lesson.video ? (
                                    // В узкой колонке плеер мелкий — тут только превью,
                                    // сам просмотр в полноэкранном попапе.
                                    <button
                                        type="button"
                                        className="ma-poster"
                                        onClick={() => setPlayingLesson(lesson)}
                                        style={{ ...videoPosterStyle, backgroundImage: `url(${lesson.poster})` }}
                                        aria-label={`Смотреть урок: ${lesson.title}`}>
                                        <span style={videoPosterOverlayStyle}>
                                            <span style={videoIconStyle}>▶</span>
                                            <span style={videoCaptionStyle}>Старт · {lesson.duration}</span>
                                        </span>
                                    </button>
                                ) : (
                                    <div style={videoPlaceholderStyle}>
                                        <span style={videoIconStyle}>▶</span>
                                        <span style={videoCaptionStyle}>Видео скоро появится</span>
                                    </div>
                                )}
                                <p style={lessonSummaryStyle}>{lesson.summary}</p>
                                <div style={lessonActionsStyle}>
                                    <button type="button" style={lessonPrimaryButtonStyle} onClick={() => handlePassTest(lesson, index)}>
                                        {isPassed ? "Пройти тест ещё раз" : "Пройти тест"}
                                    </button>
                                    {LESSONS[index + 1] ? (
                                        <button
                                            type="button"
                                            disabled={!isPassed}
                                            title={isPassed ? "" : "Сначала пройдите тест"}
                                            style={{ ...lessonSecondaryButtonStyle, ...(isPassed ? null : disabledButtonStyle) }}
                                            onClick={() => setOpenId(LESSONS[index + 1].id)}>
                                            Следующий урок
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                    </article>
                );
            })}

            {playingLesson ? (
                <div
                    style={modalOverlayStyle}
                    role="dialog"
                    aria-modal="true"
                    aria-label={playingLesson.title}
                    onClick={() => setPlayingLesson(null)}>
                    <div style={modalBoxStyle} onClick={(event) => event.stopPropagation()}>
                        <div style={modalHeadStyle}>
                            <div style={modalTitleBoxStyle}>
                                <span style={modalEyebrowStyle}>Видеоурок</span>
                                <h3 style={modalTitleStyle}>{playingLesson.title}</h3>
                            </div>
                            <button type="button" className="ma-icon" title="Закрыть (Esc)" aria-label="Закрыть" onClick={() => setPlayingLesson(null)}>
                                ✕
                            </button>
                        </div>

                        <video
                            key={playingLesson.id}
                            src={playingLesson.video}
                            poster={playingLesson.poster}
                            controls
                            autoPlay
                            playsInline
                            style={modalVideoStyle}
                        />

                        <div style={modalFootStyle}>
                            <p style={lessonSummaryStyle}>{playingLesson.summary}</p>
                            <button
                                type="button"
                                className="ma-primary"
                                style={lessonPrimaryButtonStyle}
                                onClick={() => {
                                    const index = LESSONS.findIndex((item) => item.id === playingLesson.id);
                                    handlePassTest(playingLesson, index);
                                    setPlayingLesson(null);
                                }}>
                                {passedIds.includes(playingLesson.id) ? "Пройти тест ещё раз" : "Пройти тест"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

const layoutStyle = {
    minHeight: "100vh",
    background: "#f5f7f8",
    color: "#101820",
};

// Две колонки: рабочая часть слева, видеоуроки справа.
const pageStyle = {
    width: "min(1480px, 100%)",
    margin: "0 auto",
    padding: "28px 22px 40px",
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    alignItems: "start",
    gap: 20,
};

const compactPageStyle = {
    gridTemplateColumns: "minmax(0, 1fr)",
};

const mainColumnStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 0,
};

const loginShellStyle = {
    minHeight: "calc(100vh - 56px)",
    display: "grid",
    placeItems: "center",
    padding: 20,
    // Мягкий свет за карточкой: экран пароля — первое, что видит мастер,
    // и он не должен выглядеть служебной формой.
    background: "radial-gradient(1100px 520px at 50% -10%, #e8f0ff 0%, #f5f7f8 55%, #f5f7f8 100%)",
};

const loginBoxStyle = {
    width: "min(420px, 100%)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
    border: "1px solid #e6ecf1",
    borderRadius: 18,
    background: "#fff",
    padding: "30px 28px 26px",
    boxShadow: "0 18px 44px rgba(16, 24, 32, 0.10)",
};

// Иконка и подпись — одной строкой: подпись читается как логотип кабинета,
// а не как оторванный надзаголовок под картинкой.
const loginBrandStyle = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
};

const loginMarkStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
    flexShrink: 0,
    borderRadius: 14,
    background: "#eef4ff",
    color: "#2563eb",
};

const loginEyebrowStyle = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#8a97a4",
};

const loginTitleStyle = {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.25,
    letterSpacing: "-0.01em",
};

const loginHintStyle = {
    margin: "0 0 6px",
    fontSize: 13,
    lineHeight: 1.45,
    color: "#65727f",
};

const loginInputStyle = {
    minHeight: 50,
    border: "1px solid #d5dde4",
    borderRadius: 12,
    padding: "0 14px",
    fontSize: 17,
    letterSpacing: "0.04em",
    outlineColor: "#2563eb",
};

const loginButtonStyle = {
    minHeight: 50,
    border: "none",
    borderRadius: 12,
    background: "#2563eb",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
};

const loginRestoreTextStyle = {
    fontSize: 14,
    fontWeight: 600,
    color: "#65727f",
};

const loginFootStyle = {
    fontSize: 12,
    color: "#8a97a4",
    textAlign: "center",
    marginTop: 2,
};

const headerStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 18,
    flexWrap: "wrap",
    // Глобальный стиль тега header добавляет padding — гасим, иначе заголовок
    // уезжает вправо относительно карточек ниже.
    padding: 0,
    margin: 0,
};

const compactHeaderStyle = {
    alignItems: "flex-start",
    flexDirection: "column",
};

const headerTitleBoxStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
};

// Карточка демонстрации повторяет карточку руководства, но это кнопка, а не ссылка:
// тренажёр открывается здесь же окном, никуда не уводя.
const demoCardStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    width: "100%",
    border: "1px solid #d9e0e5",
    borderRadius: 12,
    background: "#fff",
    padding: 16,
    textAlign: "left",
    // Цвет задан явно: карточка — кнопка, а глобальный стиль портала красит текст кнопки
    // в белый. Заголовок «Тренажёр МАЯК с колодой» из-за этого пропадал на белом фоне,
    // оставляя в карточке пустую строку. У соседней карточки-ссылки такого нет.
    color: "#101820",
    cursor: "pointer",
};

const demoOverlayStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 8000,
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "rgba(10, 14, 18, 0.55)",
};

// Окно почти во весь экран: тренажёр — двухколоночный, в узком окне его правая колонка
// с промтом уезжает под сгиб, и демонстрация показывает половину экрана вместо целого.
const demoBoxStyle = {
    display: "flex",
    flexDirection: "column",
    width: "min(1440px, 96vw)",
    height: "min(900px, 92vh)",
    borderRadius: 14,
    background: "#fff",
    overflow: "hidden",
    boxShadow: "0 24px 70px rgba(8, 12, 16, 0.4)",
};

const demoHeadStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 14px",
    borderBottom: "1px solid #e6ebef",
};

const demoTitleStyle = {
    fontSize: 14,
    fontWeight: 800,
};

const demoHeadActionsStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
};

const demoTourButtonStyle = {
    width: "auto",
    minHeight: 34,
    border: "1px dashed #b45309",
    borderRadius: 9,
    background: "#fff8ef",
    color: "#8a4708",
    padding: "0 12px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
};

const demoFrameStyle = {
    flex: 1,
    width: "100%",
    border: 0,
};

// Кнопка инструкции стоит под заголовком и намеренно узкая: alignSelf держит её по
// ширине текста — в колонке заголовка она иначе растянулась бы во всю строку и читалась
// бы как главное действие экрана, а главное здесь — создать сессию.
const tourButtonStyle = {
    alignSelf: "flex-start",
    marginTop: 4,
    minHeight: 34,
    width: "auto",
    border: "1px dashed #b45309",
    borderRadius: 9,
    background: "#fff8ef",
    color: "#8a4708",
    padding: "0 12px",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
};

const eyebrowStyle = {
    fontSize: 12,
    letterSpacing: 0,
    color: "#627178",
    marginBottom: 6,
    fontWeight: 800,
};

const titleStyle = {
    margin: 0,
    fontSize: 34,
    lineHeight: 1.08,
};

// Метрика и «Пополнить» — одна строка, выровненная по низу с заголовком.
const metricBoxStyle = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    border: "1px solid #e2e8ee",
    borderRadius: 12,
    background: "#fff",
    padding: "10px 14px",
};

const compactMetricBoxStyle = {
    width: "100%",
    justifyContent: "space-between",
};

const metricTextStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
};

const metricValueStyle = {
    fontSize: 24,
    fontWeight: 800,
    lineHeight: 1.1,
};

const metricLabelStyle = {
    color: "#627178",
    fontSize: 12,
    fontWeight: 700,
};

const metricTopUpLinkStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 38,
    border: "1px solid #152022",
    borderRadius: 8,
    background: "#152022",
    color: "#fff",
    padding: "0 16px",
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "none",
    whiteSpace: "nowrap",
};

const metaLineStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 12px",
    color: "#627178",
    fontSize: 14,
};

const createPanelStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(220px, 1fr) 170px auto",
    gap: 14,
    alignItems: "end",
    border: "1px solid #e8edf1",
    borderRadius: 14,
    background: "#fff",
    padding: 16,
    boxShadow: "0 2px 10px rgba(16, 24, 32, 0.04)",
};

const panelTitleStyle = {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.25,
};

const compactCreatePanelStyle = {
    gridTemplateColumns: "minmax(0, 1fr)",
};

// Фидбек — абсолютом над кнопкой: раньше под него резервировалось 245px,
// из-за чего справа в панели зияла пустая колонка.
const createActionStyle = {
    position: "relative",
    display: "flex",
    alignItems: "center",
};

const createFeedbackStyle = {
    position: "absolute",
    bottom: "calc(100% + 6px)",
    right: 0,
    color: "#1c6b33",
    fontSize: 13,
    fontWeight: 700,
    whiteSpace: "nowrap",
};

const fieldStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 6,
};

const labelStyle = {
    fontSize: 12,
    fontWeight: 700,
    color: "#627178",
};

const inputStyle = {
    minHeight: 44,
    border: "1px solid #d7dfe6",
    borderRadius: 10,
    padding: "0 12px",
    fontSize: 14,
    background: "#fff",
    color: "#101820",
};

const primaryButtonStyle = {
    minHeight: 44,
    border: "1px solid #152022",
    borderRadius: 10,
    background: "#152022",
    color: "#fff",
    padding: "0 20px",
    fontSize: 14,
    fontWeight: 800,
    cursor: "pointer",
};

const secondaryButtonStyle = {
    flex: "0 0 auto",
    width: "auto",
    alignSelf: "flex-start",
    minHeight: 38,
    border: "1px solid #b9c4cc",
    borderRadius: 8,
    background: "#fff",
    color: "#152022",
    padding: "0 12px",
    fontWeight: 700,
    cursor: "pointer",
};

const sessionsListStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 12,
};

const guideCardStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 16,
    border: "1px solid #e8edf1",
    borderRadius: 14,
    background: "#fff",
    padding: 18,
    textDecoration: "none",
    color: "#152022",
    boxShadow: "0 2px 10px rgba(16, 24, 32, 0.04)",
};

const guideCardTextStyle = {
    display: "grid",
    gap: 6,
    minWidth: 0,
};

const guideTitleStyle = {
    fontSize: 18,
    fontWeight: 800,
    letterSpacing: "-0.01em",
};

const guideTextStyle = {
    fontSize: 13.5,
    lineHeight: 1.4,
    color: "#64748b",
};

const guideActionStyle = {
    marginTop: 4,
    fontSize: 13.5,
    fontWeight: 700,
    color: "#c9503f",
};

const materialsPanelStyle = {
    display: "grid",
    gap: 12,
    border: "1px solid #e8edf1",
    borderRadius: 14,
    background: "#fff",
    padding: 18,
    boxShadow: "0 2px 10px rgba(16, 24, 32, 0.04)",
};

const materialsGridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 10,
};

const materialLinkStyle = {
    display: "grid",
    gap: 6,
    border: "1px solid #d9e0e5",
    borderRadius: 8,
    background: "#f5f7f8",
    padding: 12,
    color: "#152022",
    textDecoration: "none",
};

const materialTitleStyle = {
    fontSize: 14,
    fontWeight: 800,
    overflowWrap: "anywhere",
};

const materialMetaStyle = {
    color: "#627178",
    fontSize: 12,
    fontWeight: 700,
};

const sessionRowStyle = {
    border: "1px solid #e8edf1",
    borderRadius: 14,
    background: "#fff",
    padding: 18,
    boxShadow: "0 2px 10px rgba(16, 24, 32, 0.04)",
};

const sessionHeaderStyle = {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "start",
};

const compactSessionHeaderStyle = {
    flexDirection: "column",
};

const sessionTitleStyle = {
    margin: 0,
    fontSize: 20,
};

// Таймер тикает раз в секунду: моноширинные цифры фиксированной ширины, иначе
// смена 1 на 8 меняет ширину строки и весь мета-ряд дёргается.
const timerChipStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    background: "#eef2f5",
    padding: "2px 10px",
    color: "#3d4a52",
    fontWeight: 700,
};

const timerValueStyle = {
    display: "inline-block",
    minWidth: "8ch",
    color: "#101820",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    fontVariantNumeric: "tabular-nums",
    fontWeight: 800,
};

const sessionMetaStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px 12px",
    marginTop: 6,
    color: "#627178",
    fontSize: 13,
};

const codeStyle = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: 13,
};

const linksGridStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    marginTop: 14,
};

// Одна ссылка — одна строка: тип | адрес | действия. Описание — в подсказке «?».
const linkRowStyle = {
    display: "grid",
    // Колонка описания шире оболочки на глаз: при 280px текст ссылки для
    // участников ломался на четыре строки и карточка росла вверх.
    gridTemplateColumns: "minmax(320px, 460px) minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 14,
    border: "1px solid #e8edf1",
    borderLeft: "3px solid #152022",
    borderRadius: 12,
    background: "#fbfcfd",
    padding: "10px 12px",
};

const compactLinkRowStyle = {
    gridTemplateColumns: "minmax(0, 1fr)",
    gap: 8,
};

const linkLabelBoxStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
};

const linkLabelLineStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
};

const linkShortStyle = {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.3,
};

const linkDotStyle = {
    flex: "0 0 auto",
    width: 7,
    height: 7,
    borderRadius: 999,
};

const linkCardActionsStyle = {
    display: "flex",
    alignItems: "center",
    gap: 8,
};

const linkLabelStyle = {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    color: "#101820",
    fontSize: 13,
    fontWeight: 800,
    letterSpacing: 0.1,
};

const asideStyle = {
    position: "sticky",
    top: 20,
    minWidth: 0,
};

const compactAsideStyle = {
    position: "static",
};

const lessonsPanelStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    border: "1px solid #e2e8ee",
    borderRadius: 12,
    background: "#fff",
    padding: 14,
};

const lessonsHeadStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
};

const lessonsCounterStyle = {
    color: "#627178",
    fontSize: 12,
    fontWeight: 800,
};

const lessonCardStyle = {
    border: "1px solid #e2e8ee",
    borderRadius: 10,
    background: "#fbfcfd",
    overflow: "hidden",
};

// Пройденный урок подсвечен зелёным, но остаётся полностью доступным.
const passedLessonStyle = {
    borderColor: "#bde4c7",
    background: "#f6fdf8",
};

const passedIndexStyle = {
    background: "#1c6b33",
    color: "#fff",
};

const passedMetaStyle = {
    color: "#1c6b33",
    fontWeight: 700,
};

const lockedLessonStyle = {
    opacity: 0.6,
};

const lessonHeadButtonStyle = {
    display: "grid",
    gridTemplateColumns: "26px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 10,
    width: "100%",
    border: 0,
    background: "none",
    padding: "10px 12px",
    textAlign: "left",
    cursor: "pointer",
    font: "inherit",
};

const lessonIndexStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "#eef2f5",
    color: "#152022",
    fontSize: 12,
    fontWeight: 800,
};

const lessonTitleBoxStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
};

const lessonTitleStyle = {
    color: "#101820",
    fontSize: 14,
    fontWeight: 800,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
};

const lessonMetaStyle = {
    color: "#627178",
    fontSize: 12,
};

const lessonChevronStyle = {
    color: "#94a3b8",
    fontSize: 10,
};

const lessonBodyStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    borderTop: "1px solid #e2e8ee",
    padding: 12,
};

const videoPosterStyle = {
    position: "relative",
    display: "block",
    width: "100%",
    aspectRatio: "16 / 9",
    border: 0,
    borderRadius: 8,
    padding: 0,
    background: "#1f2933 center/cover no-repeat",
    cursor: "pointer",
    overflow: "hidden",
};

const videoPosterOverlayStyle = {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    background: "rgba(15, 23, 32, 0.45)",
    color: "#fff",
};

const modalOverlayStyle = {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    padding: 20,
    background: "rgba(9, 14, 18, 0.72)",
    backdropFilter: "blur(2px)",
};

const modalBoxStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    width: "min(1040px, 100%)",
    maxHeight: "92vh",
    overflowY: "auto",
    borderRadius: 16,
    background: "#fff",
    padding: 18,
    boxShadow: "0 30px 80px rgba(0, 0, 0, 0.35)",
};

const modalHeadStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
};

const modalTitleBoxStyle = {
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
};

const modalEyebrowStyle = {
    color: "#627178",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.4,
    textTransform: "uppercase",
};

const modalTitleStyle = {
    margin: 0,
    fontSize: 20,
    lineHeight: 1.2,
};

const modalVideoStyle = {
    display: "block",
    width: "100%",
    maxHeight: "68vh",
    borderRadius: 10,
    background: "#0f1720",
};

const modalFootStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: 12,
};

const videoPlaceholderStyle = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    aspectRatio: "16 / 9",
    borderRadius: 8,
    background: "linear-gradient(135deg, #1f2933, #37474f)",
    color: "#fff",
};

const videoIconStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 40,
    height: 40,
    borderRadius: 999,
    background: "rgba(255,255,255,0.16)",
    fontSize: 15,
};

const videoCaptionStyle = {
    fontSize: 12,
    fontWeight: 700,
    opacity: 0.85,
};

const lessonSummaryStyle = {
    margin: 0,
    color: "#475569",
    fontSize: 13,
    lineHeight: 1.4,
};

const lessonActionsStyle = {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
};

const lessonPrimaryButtonStyle = {
    flex: "1 1 130px",
    minHeight: 38,
    border: "1px solid #152022",
    borderRadius: 8,
    background: "#152022",
    color: "#fff",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
};

const lessonSecondaryButtonStyle = {
    flex: "1 1 130px",
    minHeight: 38,
    border: "1px solid #c7d2da",
    borderRadius: 8,
    background: "#fff",
    color: "#152022",
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
};

const disabledButtonStyle = {
    opacity: 0.45,
    cursor: "not-allowed",
};

const emptyStyle = {
    display: "grid",
    gap: 6,
    border: "1px dashed #c3ced7",
    borderRadius: 14,
    padding: 22,
    background: "#fff",
    color: "#627178",
    fontSize: 14,
    lineHeight: 1.45,
};

const emptyTitleStyle = {
    color: "#101820",
    fontSize: 16,
};

const errorStyle = {
    color: "#b42318",
    fontSize: 13,
};

const noticeErrorStyle = {
    border: "1px solid #f4b8b1",
    borderRadius: 8,
    background: "#fff3f1",
    color: "#9f1f14",
    padding: "10px 12px",
};

const noticeSuccessStyle = {
    border: "1px solid #bde4c7",
    borderRadius: 8,
    background: "#f1fff4",
    color: "#1c6b33",
    padding: "10px 12px",
};

