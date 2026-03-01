const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const val = trimmed.slice(eqIndex + 1).trim();
    if (key && process.env[key] === undefined) {
      process.env[key] = val;
    }
  });
}

async function main() {
  const SESSIONS_DIR = path.join(process.cwd(), 'data', 'telegram-sessions');

  // Find a session with logdata
  const files = fs.readdirSync(SESSIONS_DIR);
  const logDataFiles = files.filter(f => f.endsWith('_logdata.json'));

  if (logDataFiles.length === 0) {
    console.log('No logdata files found');
    return;
  }

  const sessionId = logDataFiles[0].replace('_logdata.json', '');
  console.log('Testing with session:', sessionId);
  console.log('LogData file:', logDataFiles[0]);

  // Try importing generateAnalytics
  console.log('\n--- Importing generateAnalytics ---');
  try {
    const mod = await import('../src/lib/analyticsGenerator.js');
    console.log('Import OK, function exists:', typeof mod.generateAnalytics);

    console.log('\n--- Running generateAnalytics ---');
    const startTime = Date.now();
    const result = await mod.generateAnalytics(sessionId, SESSIONS_DIR);
    const elapsed = Date.now() - startTime;
    console.log('SUCCESS! Analytics PDF generated in', elapsed, 'ms');
    console.log('Output path:', result);
    console.log('File size:', fs.statSync(result).size, 'bytes');
  } catch (e) {
    console.log('ERROR:', e.message);
    console.log('Stack:', e.stack);
  }
}

main();
