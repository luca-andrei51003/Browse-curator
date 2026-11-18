// BrowseCurator - Email Notification Service
// Sends clean parent email alerts from luca.culcean@gmail.com on blocked events

const http = require('http');
const fs = require('fs');
const path = require('path');
const { sendGmail } = require('./gmail-smtp');

const CONFIG_PATH = path.join(__dirname, 'email-config.json');

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    console.error('Error reading email-config.json:', e);
  }
  return {
    senderEmail: 'luca.culcean@gmail.com',
    recipientEmail: 'luca.culcean@gmail.com',
    gmailAppPassword: process.env.GMAIL_APP_PASSWORD || '',
    serverPort: 3001
  };
}

/**
 * Format and send the email
 */
async function sendParentAlert({ recipientEmail = null, url = 'Nespecificat', reason = 'Conținut neadecvat', matches = 'Niciun termen specific', timestamp = null }) {
  const config = loadConfig();
  const targetRecipient = recipientEmail || config.recipientEmail || 'luca.culcean@gmail.com';
  const timeStr = timestamp || new Date().toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' });

  // Clean domain extraction for subject
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
    `Echipa BrowseCurator`
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
          Trimis automat din contul ${config.senderEmail} către ${targetRecipient} pentru siguranța familiei dumneavoastră.
        </div>
      </div>
    </body>
    </html>
  `;

  // Log to local alert history
  saveAlertHistory({ recipient: targetRecipient, url, reason, matches, timestamp: timeStr });

  const appPassword = config.gmailAppPassword || process.env.GMAIL_APP_PASSWORD;

  if (!appPassword || appPassword === 'YOUR_GMAIL_APP_PASSWORD_HERE') {
    console.log('\n======================================================');
    console.log('📬 [NOTIFICARE PREGĂTITĂ]');
    console.log(`De la: ${config.senderEmail}`);
    console.log(`Către: ${targetRecipient}`);
    console.log(`Subiect: ${subject}`);
    console.log(`Adresă: ${url}`);
    console.log(`Motiv: ${reason}`);
    console.log(`Termeni: ${matches}`);
    console.log('------------------------------------------------------');
    console.log('💡 Pentru trimitere reală prin Gmail, adăugați Parola de Aplicație');
    console.log('   (16 caractere de pe https://myaccount.google.com/apppasswords)');
    console.log('   în fișierul scripts/email-config.json');
    console.log('======================================================\n');
    return { success: false, simulated: true, message: 'App password not set yet' };
  }

  try {
    const res = await sendGmail({
      senderEmail: config.senderEmail,
      appPassword: appPassword,
      recipientEmail: targetRecipient,
      subject: subject,
      text: textBody,
      html: htmlBody
    });
    console.log('✅ Email trimis cu succes către', targetRecipient);
    return res;
  } catch (err) {
    console.error('❌ Eroare la trimiterea emailului:', err.message);
    throw err;
  }
}

function saveAlertHistory(entry) {
  const historyPath = path.join(__dirname, 'alert-history.json');
  let list = [];
  try {
    if (fs.existsSync(historyPath)) {
      list = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }
  } catch (e) {}
  list.unshift(entry);
  if (list.length > 50) list = list.slice(0, 50); // keep last 50
  fs.writeFileSync(historyPath, JSON.stringify(list, null, 2), 'utf-8');
}

/**
 * Start background alert receiver server
 */
function startServer(port = 3001) {
  const server = http.createServer(async (req, res) => {
    // Enable CORS for Chrome Extension requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/api/notify') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          await sendParentAlert(data);
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', delivered: true }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'error', message: err.message }));
        }
      });
      return;
    }

    res.statusCode = 404;
    res.end('Not found');
  });

  server.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`📧 Serviciul de Alerte Email BrowseCurator rulează pe portul ${port}!`);
    console.log(`Expeditor: luca.culcean@gmail.com`);
    console.log(`Destinatar: luca.culcean@gmail.com`);
    console.log(`Endpoint ascultare extensie: http://localhost:${port}/api/notify`);
    console.log(`======================================================\n`);
  });

  return server;
}

// CLI Execution handler
const args = process.argv.slice(2);
if (args.includes('--server')) {
  const config = loadConfig();
  startServer(config.serverPort || 3001);
} else if (args.includes('--test')) {
  sendParentAlert({
    url: 'https://example-test-site.com/mature-content',
    reason: 'Illicit imagery or explicit text detected',
    matches: 'erotic photo, adult terms'
  }).catch(() => {});
}

module.exports = { sendParentAlert, startServer };
