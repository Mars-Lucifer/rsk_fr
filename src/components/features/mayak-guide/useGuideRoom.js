import { useCallback, useEffect, useRef, useState } from "react";

// Клиентская сторона живого стола: создать комнату, сесть за неё, двигать свою фишку по
// правилам такта, видеть чужие. Транспорт — опрос, а не сокет: состояние стола это шесть
// ячеек и журнал карт, оно лежит в памяти сервера, и держать ради него постоянное
// соединение нечем оправдать. Свой ход применяется на месте, поэтому задержка опроса
// видна только на чужих фишках.
const POLL_MS = 1500;

// Место за столом переживает перезагрузку: без этого обновление страницы отбирало бы у
// участника фишку и сажало его на новое место.
const MEMBER_KEY = "mayak-guide-room-member";
const TOKEN_KEY = "mayak-guide-room-token";
const MASTER_KEY = "mayak-guide-room-master";

function readStored(key) {
    if (typeof window === "undefined") return "";
    try {
        return window.localStorage.getItem(key) || "";
    } catch {
        return "";
    }
}

function store(key, value) {
    try {
        if (value) window.localStorage.setItem(key, value);
        else window.localStorage.removeItem(key);
    } catch {
        // Приватный режим браузера: место просто не переживёт перезагрузку.
    }
}

async function call(body) {
    const res = await fetch("/api/mayak-guide/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok || !payload.success) {
        const error = new Error(payload.error || "Стол недоступен");
        error.status = res.status;
        throw error;
    }
    return payload.data;
}

export function useGuideRoom({ active, invite, inviteMaster }) {
    const [token, setToken] = useState("");
    const [room, setRoom] = useState(null);
    const [seatIndex, setSeatIndex] = useState(null);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [isMaster, setIsMaster] = useState(false);
    // Ключ отдаётся наружу только чтобы мастер мог скопировать себе ссылку возврата.
    const [masterToken, setMasterToken] = useState("");

    const memberId = useRef("");
    const masterKey = useRef("");
    // Версия последнего применённого снимка. Ответы опроса приходят не в том порядке, в
    // каком уходили, и снимок, отправленный до чужого хода, откатывал бы фишки назад.
    const applied = useRef(0);
    // Опрос не пускается внахлёст: два запроса в полёте — это гарантированный шанс
    // применить их в обратном порядке.
    const polling = useRef(false);

    const apply = useCallback((next) => {
        if (!next) return null;
        if (next.version <= applied.current) return null;
        applied.current = next.version;
        setRoom(next);
        return next;
    }, []);

    useEffect(() => {
        memberId.current = readStored(MEMBER_KEY);
        masterKey.current = readStored(MASTER_KEY);
        // Приглашение перебивает сохранённый токен: иначе участник, пробовавший стол
        // вчера в этом же браузере, молча садится за вчерашний стол, и заметить это
        // невозможно — у него на экране всё живое, а у мастера место «свободно».
        const saved = invite || readStored(TOKEN_KEY);
        if (saved) setToken(saved);
        if (invite && invite !== readStored(TOKEN_KEY)) {
            store(TOKEN_KEY, invite);
            // Ключ мастера принадлежит другому столу — для нового он не действует.
            store(MASTER_KEY, "");
            masterKey.current = "";
        }
        // Ключ мастера в ссылке: так роль возвращается после очистки кэша и переезда на
        // другое устройство. Без этого потеря localStorage останавливает занятие
        // насмерть — такт принять некому, а нового стола участникам не раздать.
        //
        // Ключ в адресе равен паролю: ссылка мастера остаётся в истории браузера, и
        // делиться ею с участниками нельзя. В интерфейсе она подписана отдельно от
        // ссылки-приглашения именно поэтому.
        if (inviteMaster) {
            store(MASTER_KEY, inviteMaster);
            masterKey.current = inviteMaster;
            setMasterToken(inviteMaster);
            setIsMaster(true);
        } else if (masterKey.current) {
            setMasterToken(masterKey.current);
        }
    }, [invite, inviteMaster]);

    const refresh = useCallback(
        async (value) => {
            const target = value || token;
            if (!target || polling.current) return null;
            polling.current = true;
            try {
                // memberId уходит с опросом: он же отметка «я на связи». Отдельного
                // пульса нет намеренно — лишний запрос ради того, что и так летит.
                const mine = memberId.current ? `&member=${encodeURIComponent(memberId.current)}` : "";
                const res = await fetch(`/api/mayak-guide/room?token=${encodeURIComponent(target)}${mine}`);
                const payload = await res.json().catch(() => ({}));
                if (!res.ok || !payload.success) {
                    // Пропавший стол показываем, а не глотаем: иначе доска просто
                    // замирает на последнем снимке и выглядит живой.
                    if (res.status === 404) setError("Стол не найден — попросите новую ссылку");
                    return null;
                }
                setError((current) => (current === "Стол не найден — попросите новую ссылку" ? "" : current));
                return apply(payload.data);
            } catch {
                return null;
            } finally {
                polling.current = false;
            }
        },
        [token, apply]
    );

    // Возвращение после перезагрузки: место у сервера сохранено за memberId, но клиент
    // о нём не знает, пока не представится. Без этого перезагрузка вкладки превращает
    // участника в зрителя — фишка на поле есть, а двигать её нечем.
    const rejoined = useRef("");
    useEffect(() => {
        if (!active || !token || seatIndex !== null || !memberId.current) return;
        if (rejoined.current === token) return;
        rejoined.current = token;
        call({ action: "join", token, memberId: memberId.current })
            .then((data) => {
                setSeatIndex(data.seatIndex);
                apply(data.room);
            })
            .catch(() => {
                // Места не нашлось (стол чужой или занят) — останемся зрителем, форма
                // входа в панели никуда не делась.
            });
    }, [active, token, seatIndex, apply]);

    useEffect(() => {
        if (!active || !token) return undefined;
        refresh(token);
        const timer = window.setInterval(() => refresh(token), POLL_MS);
        return () => window.clearInterval(timer);
    }, [active, token, refresh]);

    useEffect(() => {
        setIsMaster(Boolean(masterKey.current) && Boolean(token));
    }, [token, room]);

    const create = useCallback(async () => {
        setBusy(true);
        setError("");
        try {
            const data = await call({ action: "create" });
            store(TOKEN_KEY, data.token);
            store(MASTER_KEY, data.masterKey);
            masterKey.current = data.masterKey;
            setMasterToken(data.masterKey);
            applied.current = 0;
            setToken(data.token);
            setSeatIndex(null);
            rejoined.current = "";
            apply(data);
            setIsMaster(true);
            return data.token;
        } catch (err) {
            setError(err.message);
            return "";
        } finally {
            setBusy(false);
        }
    }, [apply]);

    const join = useCallback(
        async (value, name) => {
            const target = String(value || "").trim();
            if (!target) return false;
            setBusy(true);
            setError("");
            try {
                const data = await call({ action: "join", token: target, name, memberId: memberId.current });
                memberId.current = data.memberId;
                store(MEMBER_KEY, data.memberId);
                store(TOKEN_KEY, target);
                if (target !== token) applied.current = 0;
                setToken(target);
                setSeatIndex(data.seatIndex);
                apply(data.room);
                return true;
            } catch (err) {
                setError(err.message);
                return false;
            } finally {
                setBusy(false);
            }
        },
        [token, apply]
    );

    const send = useCallback(
        async (body, { quiet = false } = {}) => {
            if (!token) return null;
            try {
                const data = await call({ token, memberId: memberId.current, masterKey: masterKey.current, ...body });
                setError("");
                return apply(data.room || data);
            } catch (err) {
                if (!quiet) setError(err.message);
                // Отказ сервера — повод не гадать, а взять его состояние: клетка могла
                // закрыться, пока участник целился.
                refresh(token);
                return null;
            }
        },
        [token, apply, refresh]
    );

    const move = useCallback((cell) => send({ action: "move", cell }), [send]);
    const chooseType = useCallback((typeId) => send({ action: "type", typeId }), [send]);
    const accept = useCallback((force) => send({ action: "accept", force }), [send]);
    const freeSeat = useCallback((index) => send({ action: "free", seatIndex: index }), [send]);
    const moveAny = useCallback((index, cell) => send({ action: "moveAny", seatIndex: index, cell }), [send]);
    const restart = useCallback(() => send({ action: "reset" }), [send]);
    // Переворот полотна на сторону «МЫ»: доступен мастеру, когда «Я» пройдена целиком.
    const flipSide = useCallback(() => send({ action: "flip" }), [send]);

    const leave = useCallback(() => {
        if (token && memberId.current) call({ action: "leave", token, memberId: memberId.current }).catch(() => {});
        store(TOKEN_KEY, "");
        store(MASTER_KEY, "");
        masterKey.current = "";
        setMasterToken("");
        applied.current = 0;
        rejoined.current = "";
        setToken("");
        setRoom(null);
        setSeatIndex(null);
        setIsMaster(false);
        setError("");
    }, [token]);

    return {
        token,
        room,
        seatIndex,
        isMaster,
        masterKey: masterToken,
        error,
        busy,
        create,
        join,
        move,
        chooseType,
        accept,
        freeSeat,
        moveAny,
        restart,
        flipSide,
        leave,
        refresh,
    };
}

export default useGuideRoom;
