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

const apiKey = process.env.OPENROUTER_API_KEY;
console.log('API Key exists:', Boolean(apiKey));
console.log('API Key length:', apiKey ? apiKey.length : 0);
console.log('API Key prefix:', apiKey ? apiKey.substring(0, 10) + '...' : 'N/A');

async function testAPI() {
  console.log('\n--- Testing OpenRouter API ---');
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Say hello in one word' }],
        max_tokens: 50,
      }),
    });
    console.log('HTTP Status:', res.status);
    const data = await res.json();
    if (res.ok) {
      console.log('SUCCESS! Response:', data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content);
    } else {
      console.log('API ERROR:', JSON.stringify(data, null, 2));
    }
  } catch (e) {
    console.log('FETCH ERROR:', e.message);
  }
}

async function testPDFRender() {
  console.log('\n--- Testing PDF render (@react-pdf/renderer) ---');
  try {
    const React = require('react');
    const { Page, Text, Document, renderToBuffer } = require('@react-pdf/renderer');
    console.log('react-pdf/renderer loaded OK');

    const doc = React.createElement(Document, {},
      React.createElement(Page, { size: 'A4' },
        React.createElement(Text, {}, 'Test PDF')
      )
    );
    const buffer = await renderToBuffer(doc);
    console.log('PDF rendered OK, size:', buffer.length, 'bytes');
  } catch (e) {
    console.log('PDF RENDER ERROR:', e.message);
    console.log('Stack:', e.stack);
  }
}

async function main() {
  await testAPI();
  await testPDFRender();
}

main().catch(e => console.error('Fatal:', e));
