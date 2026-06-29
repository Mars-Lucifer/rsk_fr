// Модальный попап с тайной миссией. Открывается сразу после подтверждения роли.
// Описание самой миссии (заголовок + текст) также показывается в тултипе роли
// в шапке тренажёра (см. trainer.js), поэтому отдельной кнопки/чипа миссии нет.
export function SecretMissionPopup({ mission, onClose }) {
    if (!mission || !mission.text) {
        return null;
    }

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
            <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl" style={{ padding: "28px", textAlign: "center" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#7c3aed", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "10px" }}>
                    🎯 Твоя тайная миссия
                </div>
                {mission.title ? (
                    <div style={{ fontSize: "20px", fontWeight: 700, marginBottom: "12px", color: "#111" }}>«{mission.title}»</div>
                ) : null}
                <p style={{ fontSize: "15px", lineHeight: "1.6", color: "#374151", marginBottom: "24px" }}>{mission.text}</p>
                <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex items-center justify-center !rounded-full !bg-blue-500 hover:!bg-blue-600 !px-8 !py-2 leading-none text-sm font-semibold !text-white cursor-pointer transition-colors whitespace-nowrap">
                        Понятно
                    </button>
                </div>
            </div>
        </div>
    );
}
