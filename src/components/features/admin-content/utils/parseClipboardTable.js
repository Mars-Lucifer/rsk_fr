// Парсер табличного буфера обмена (формат Excel/Google Sheets).
// Ячейки, содержащие таб/перевод строки/кавычку, обёрнуты в "...", внутренние
// кавычки удвоены ("" -> "). Прежний наивный split("\n")/split("\t") ломал
// многострочные ячейки («Описание»/«Задание») — из-за этого «плохо копировалось».
export function parseClipboardTable(text) {
    const s = String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (inQuotes) {
            if (ch === '"') {
                if (s[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else {
                field += ch;
            }
        } else if (ch === '"' && field === "") {
            inQuotes = true;
        } else if (ch === "\t") {
            row.push(field); field = "";
        } else if (ch === "\n") {
            row.push(field); rows.push(row); row = []; field = "";
        } else {
            field += ch;
        }
    }
    row.push(field);
    rows.push(row);
    // Убираем финальную пустую строку от завершающего перевода строки.
    if (rows.length > 1) {
        const last = rows[rows.length - 1];
        if (last.length === 1 && last[0] === "") rows.pop();
    }
    return rows;
}
