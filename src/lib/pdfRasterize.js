// Растеризация PDF → PNG через PDF.js (пакет pdf-to-img).
// Используется вместо LibreOffice для карт: LibreOffice при импорте PDF двоит текст,
// а PDF.js рендерит его чисто. Для pptx→pdf по-прежнему используется LibreOffice.

/**
 * Рендерит первую страницу PDF в PNG.
 * @param {string|Buffer|Uint8Array} input путь к файлу или буфер PDF
 * @param {{ scale?: number }} [options] scale — множитель разрешения (2 ≈ ретина)
 * @returns {Promise<Buffer>} PNG-буфер
 */
export async function rasterizePdfFirstPageToPng(input, { scale = 2 } = {}) {
    // Динамический импорт: pdf-to-img — ESM-пакет с нативным @napi-rs/canvas,
    // грузим в рантайме, чтобы не мешать бандлингу.
    const { pdf } = await import("pdf-to-img");
    const document = await pdf(input, { scale });
    const firstPage = await document.getPage(1);
    return firstPage;
}
