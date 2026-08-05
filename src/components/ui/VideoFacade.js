import { useState } from "react";

// Заглушка вместо плеера: iframe создаётся только после клика.
//
// Зачем: на списке уроков восемь роликов RuTube, и все они грузились сразу —
// восемь внешних плееров с крутилками вместо картинки. Плеер тяжёлый, а до
// просмотра дело доходит редко, поэтому до клика показываем статичный блок.
//
// Открытые уроки грузим сразу (eager) — там плеер и нужен. Закрытые остаются
// заглушкой: смотреть их всё равно нельзя, а восемь плееров разом превращают
// список в восемь крутилок.
//
// ponytail: постера нет — RuTube отдаёт превью только своим клиентам, его API
// и oEmbed отвечают 403. Настоящие обложки придётся хранить у себя: добавить
// поле к уроку и заливать картинку вместе с видео.

function withAutoplay(url) {
    if (!url) return url;
    return url.includes("?") ? `${url}&autoplay=1` : `${url}?autoplay=1`;
}

export default function VideoFacade({ url, title = "Видеоурок", eager = false, style = {} }) {
    const [isPlaying, setIsPlaying] = useState(eager);

    if (!url) {
        return null;
    }

    const frameStyle = { border: "none", borderRadius: "0.75rem", aspectRatio: 16 / 9, width: "100%", ...style };

    if (isPlaying) {
        // Автозапуск только когда участник сам нажал: иначе открытый урок
        // начинал бы играть при загрузке списка.
        return <iframe src={eager ? url : withAutoplay(url)} style={frameStyle} allow="autoplay; fullscreen" allowFullScreen title={title} />;
    }

    return (
        <button
            type="button"
            onClick={() => setIsPlaying(true)}
            title={`Смотреть: ${title}`}
            style={{
                ...frameStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                background: "var(--color-white-gray)",
                color: "var(--color-gray-black)",
                cursor: "pointer",
                padding: 0,
                fontSize: "0.8125rem",
            }}>
            <span
                style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "2.5rem",
                    height: "2.5rem",
                    borderRadius: "50%",
                    background: "var(--color-blue)",
                    color: "var(--color-white)",
                    flexShrink: 0,
                }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                </svg>
            </span>
            Смотреть видеоурок
        </button>
    );
}
