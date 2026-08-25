import { useState } from "react";

// Обложка вместо плеера: iframe создаётся только по клику.
//
// Зачем: embed RuTube тянет ~2 МБ своего JS плюс 271 КБ метрики Яндекса — на
// каждый вставленный ролик. Восемь уроков превращались в двадцать мегабайт
// внешних запросов и восемь крутилок вместо страницы.
//
// Место под ролик зарезервировано пропорцией 16/9 и у обложки, и у плеера,
// поэтому подмена не сдвигает вёрстку.
//
// ponytail: своей картинки-обложки у уроков пока нет, показываем оформленную
// заглушку. У RuTube превью не взять — его API и oEmbed отвечают 403. Когда
// появится поле с обложкой, достаточно передать её в `poster`.

function withAutoplay(url) {
    if (!url) return url;
    return url.includes("?") ? `${url}&autoplay=1` : `${url}?autoplay=1`;
}

export default function VideoFacade({ url, title = "Видеоурок", poster = "", label = "Смотреть видеоурок", style = {} }) {
    const [isPlaying, setIsPlaying] = useState(false);

    if (!url) {
        return null;
    }

    const frameStyle = { border: "none", borderRadius: "0.75rem", aspectRatio: 16 / 9, width: "100%", ...style };

    if (isPlaying) {
        return <iframe src={withAutoplay(url)} style={frameStyle} allow="autoplay; fullscreen" allowFullScreen title={title} />;
    }

    return (
        <button
            type="button"
            onClick={() => setIsPlaying(true)}
            title={`Смотреть: ${title}`}
            style={{
                ...frameStyle,
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: 0,
                overflow: "hidden",
                cursor: "pointer",
                background: poster ? "var(--color-black)" : "linear-gradient(135deg, var(--color-blue-noise), var(--color-white-gray))",
                color: "var(--color-blue)",
                fontSize: "0.8125rem",
                fontWeight: 500,
            }}>
            {poster && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.85 }} />
            )}

            <span
                style={{
                    position: "relative",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "3rem",
                    height: "3rem",
                    borderRadius: "50%",
                    background: "var(--color-blue)",
                    color: "var(--color-white)",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
                    flexShrink: 0,
                }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                </svg>
            </span>

            <span style={{ position: "relative", color: poster ? "var(--color-white)" : "var(--color-blue)" }}>{label}</span>
        </button>
    );
}
