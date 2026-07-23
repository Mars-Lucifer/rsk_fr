export async function register() {
  // Только в Node.js рантайме (не edge) — иначе fs недоступен
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Загружаем настройки из JSON (приоритет над .env)
    const fs = await import('fs');
    const path = await import('path');
    const settingsPath = path.join(process.cwd(), 'data', 'mayak-settings.json');
    try {
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        if (settings.openrouterApiKey) process.env['OPENROUTER_API_KEY'] = settings.openrouterApiKey;
        const baseUrlKey = 'NEXT_PUBLIC' + '_BASE_URL';
        if (settings.baseUrl) process.env[baseUrlKey] = settings.baseUrl;
      }
    } catch {}

    // Подчищаем осиротевшие .tmp от прерванной атомарной записи в data/
    // (краши/рестарты оставляют файлы вида *.json.<pid>.<ts>.<rand>.tmp).
    sweepOrphanTempFiles(fs.promises, path).catch(() => {});
  }
}

// Удаляет из data/ временные файлы атомарной записи старше порога. Свежие не
// трогаем — они могут принадлежать записи, идущей прямо сейчас.
async function sweepOrphanTempFiles(fsp, path) {
  const dir = path.join(process.cwd(), 'data');
  const MAX_AGE_MS = 10 * 60 * 1000;
  let entries = [];
  try {
    entries = await fsp.readdir(dir);
  } catch {
    return;
  }
  const now = Date.now();
  let removed = 0;
  for (const name of entries) {
    if (!name.endsWith('.tmp')) continue;
    const full = path.join(dir, name);
    try {
      const stat = await fsp.stat(full);
      if (now - stat.mtimeMs > MAX_AGE_MS) {
        await fsp.unlink(full);
        removed += 1;
      }
    } catch {
      // файл исчез/занят — пропускаем
    }
  }
  if (removed > 0) {
    console.log(`[instrumentation] удалено осиротевших .tmp в data/: ${removed}`);
  }
}
