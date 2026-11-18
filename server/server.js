// BrowseCurator - Remote Alert Server (for GCP VM)
// Listens on 0.0.0.0 for notifications from the extension and sends Gmail alerts

const http = require('http');
const fs = require('fs');
const path = require('path');
const { sendGmail } = require('./gmail-smtp');

const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Error reading config.json:', e);
  }
  return {
    senderEmail: 'luca.culcean@gmail.com',
    recipientEmail: 'luca.culcean@gmail.com',
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
    port: parseInt(process.env.PORT, 10) || 3001
  };
}

async function sendParentAlert({ recipientEmail = null, url = 'Nespecificat', reason = 'Conținut neadecvat', matches = 'Niciun termen specific', timestamp = null }) {
  const config = loadConfig();
  const targetRecipient = recipientEmail || config.recipientEmail || 'luca.culcean@gmail.com';
  const timeStr = timestamp || new Date().toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' });

  let domain = url;
  try {
    domain = new URL(url).hostname || url;
  } catch (e) {}

  const subject = `🛡️ [BrowseCurator Alert] Pagină blocată: ${domain}`;

  const textBody = [
    `Salut,`,
    ``,
    `BrowseCurator a blocat accesul la o pagină web pe dispozitivul copilului.`,
    ``,
    `--------------------------------------------------`,
    `DETALII EVENIMENT BLOCARE:`,
    `• Adresă web încercată: ${url}`,
    `• Motivul blocării: ${reason}`,
    `• Termeni detectați: ${matches}`,
    `• Data și ora: ${timeStr}`,
    `--------------------------------------------------`,
    ``,
    `Copilul a fost redirecționat către ecranul prietenos de siguranță fără ca detaliile de mai sus să îi fie afișate.`,
    ``,
    `Cu respect,`,
    `Echipa BrowseCurator (Server GCP)`
  ].join('\n');

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; padding: 20px; margin: 0; }
        .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .header { background: #2563eb; color: #ffffff; padding: 20px 24px; }
        .header h2 { margin: 0; font-size: 18px; font-weight: 700; }
        .content { padding: 24px; font-size: 14px; line-height: 1.6; color: #334155; }
        .card { background: #f1f5f9; border-radius: 8px; padding: 16px; margin: 16px 0; border-left: 4px solid #ef4444; }
        .row { margin-bottom: 8px; }
        .row strong { color: #0f172a; }
        .footer { font-size: 12px; color: #94a3b8; padding: 16px 24px; border-top: 1px solid #e2e8f0; background: #fafafa; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🛡️ BrowseCurator — Alertă Părinte</h2>
        </div>
        <div class="content">
          <p>Salut,</p>
          <p>BrowseCurator a blocat o pagină web pe dispozitivul copilului pentru a preveni expunerea la conținut nepotrivit.</p>
          
          <div class="card">
            <div class="row"><strong>🌐 Adresă web:</strong> <span style="word-break: break-all;">${url}</span></div>
            <div class="row"><strong>⚠️ Motiv blocare:</strong> ${reason}</div>
            <div class="row"><strong>🔍 Termeni detectați:</strong> <code style="background:#fee2e2; color:#991b1b; padding:2px 6px; border-radius:4px;">${matches}</code></div>
            <div class="row"><strong>🕒 Data și ora:</strong> ${timeStr}</div>
          </div>

          <p style="font-size: 13px; color: #64748b;">
            <em>Notă: Copilul a văzut doar ecranul de siguranță; detaliile și termenii de mai sus NU au fost afișați pe ecran.</em>
          </p>
        </div>
        <div class="footer">
          Trimis prin serverul GCP BrowseCurator către ${targetRecipient}.
        </div>
      </div>
    </body>
    </html>
  `;

  const appPassword = config.gmailAppPassword || process.env.GMAIL_APP_PASSWORD;

  return await sendGmail({
    senderEmail: config.senderEmail,
    appPassword: appPassword,
    recipientEmail: targetRecipient,
    subject: subject,
    text: textBody,
    html: htmlBody
  });
}

const config = loadConfig();
const PORT = config.port || 3001;

const server = http.createServer(async (req, res) => {
  // CORS Headers allowing extension from any browser instance
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Health check endpoint
  if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'online', service: 'BrowseCurator Alert Server (GCP)', time: new Date().toISOString() }));
    return;
  }

  // Notification API endpoint
  if (req.method === 'POST' && req.url === '/api/notify') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        console.log(`[${new Date().toISOString()}] Primită alertă blocare pentru: ${data.url || 'necunoscut'}`);
        await sendParentAlert(data);
        console.log(`[${new Date().toISOString()}] Email trimis cu succes către părinte.`);
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'ok', sent: true }));
      } catch (err) {
        console.error('Eroare la procesarea alertei:', err.message);
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ status: 'error', message: err.message }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end('Not Found');
});

// Bind to 0.0.0.0 so the GCP VM accepts external traffic
server.listen(PORT, '0.0.0.0', () => {
  console.log(`======================================================`);
  console.log(`🚀 Serverul BrowseCurator rulează pe GCP VM!`);
  console.log(`Port: ${PORT} (0.0.0.0:${PORT})`);
  console.log(`Health check: http://<EXTERNAL_IP>:${PORT}/health`);
  console.log(`Alert endpoint: http://<EXTERNAL_IP>:${PORT}/api/notify`);
  console.log(`======================================================`);
});
