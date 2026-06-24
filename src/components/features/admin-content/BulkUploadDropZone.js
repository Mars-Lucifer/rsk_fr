import { useState, useRef } from "react";

const UPLOAD_ICON = (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 3v10M10 3L6 7M10 3l4 4M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2" stroke="#8b5cf6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

// ============ Drag-and-drop зона загрузки ============
export function BulkUploadDropZone({ onUploadInstructions, onUploadFiles, onUploadMaps, uploading }) {
    const [dropTarget, setDropTarget] = useState(null); // "instructions" | "files" | "maps"
    const instrRef = useRef(null);
    const filesRef = useRef(null);
    const mapsRef = useRef(null);

    const handleDragOver = (e, target) => { e.preventDefault(); e.stopPropagation(); setDropTarget(target); };
    const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDropTarget(null); };
    const handleDrop = async (e, target) => {
        e.preventDefault(); e.stopPropagation(); setDropTarget(null);
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;
        if (target === "instructions") await onUploadInstructions(files);
        else if (target === "maps") await onUploadMaps(files);
        else await onUploadFiles(files);
    };

    // Цвет зоны зависит от того, перетаскивают ли файл именно над ней (dropTarget).
    const zoneClass = (target) => [
        "flex-1 min-h-[70px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5 transition-all px-3 py-2",
        dropTarget === target ? "border-violet-500 bg-violet-50" : "border-slate-300 bg-neutral-50",
        uploading ? "cursor-not-allowed" : "cursor-pointer",
    ].join(" ");

    return (
        <div className="flex gap-2.5 mb-2">
            <div
                className={zoneClass("instructions")}
                onDragOver={(e) => handleDragOver(e, "instructions")}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, "instructions")}
                onClick={() => !uploading && instrRef.current?.click()}
            >
                {UPLOAD_ICON}
                <span className="text-[12px] font-semibold text-violet-700">{uploading ? "Загрузка..." : "Инструкции"}</span>
                <span className="text-[10px] text-slate-400">Перетащите файлы или нажмите</span>
                <input ref={instrRef} type="file" multiple onChange={async (e) => { const f = Array.from(e.target.files); e.target.value = ""; if (f.length) await onUploadInstructions(f); }} className="hidden" />
            </div>
            <div
                className={zoneClass("files")}
                onDragOver={(e) => handleDragOver(e, "files")}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, "files")}
                onClick={() => !uploading && filesRef.current?.click()}
            >
                {UPLOAD_ICON}
                <span className="text-[12px] font-semibold text-violet-700">{uploading ? "Загрузка..." : "Доп. материалы"}</span>
                <span className="text-[10px] text-slate-400">Перетащите файлы или нажмите</span>
                <input ref={filesRef} type="file" multiple onChange={async (e) => { const f = Array.from(e.target.files); e.target.value = ""; if (f.length) await onUploadFiles(f); }} className="hidden" />
            </div>
            <div
                className={zoneClass("maps")}
                onDragOver={(e) => handleDragOver(e, "maps")}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, "maps")}
                onClick={() => !uploading && mapsRef.current?.click()}
            >
                {UPLOAD_ICON}
                <span className="text-[12px] font-semibold text-violet-700">{uploading ? "Загрузка..." : "Карты"}</span>
                <span className="text-[10px] text-slate-400">Перетащите PDF или нажмите</span>
                <input ref={mapsRef} type="file" multiple accept="application/pdf,.pdf" onChange={async (e) => { const f = Array.from(e.target.files); e.target.value = ""; if (f.length) await onUploadMaps(f); }} className="hidden" />
            </div>
        </div>
    );
}
