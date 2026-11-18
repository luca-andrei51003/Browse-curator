// BrowseCurator - Native Zero-Dependency SMTP Client for Gmail (smtp.gmail.com:465 SSL)
const tls = require('tls');

function sendGmail({ senderEmail, appPassword, recipientEmail, subject, text, html }) {
  return new Promise((resolve, reject) => {
    if (!appPassword || appPassword === 'YOUR_GMAIL_APP_PASSWORD_HERE' || appPassword.trim().length === 0) {
      return reject(new Error('Lipseste parola de aplicatie Gmail (App Password).'));
    }

    const cleanPass = appPassword.replace(/\s+/g, '');
    const socket = tls.connect(465, 'smtp.gmail.com', { rejectUnauthorized: false }, () => {
      // Connected
    });

    let step = 0;
    let log = '';

    function send(cmd) {
      socket.write(cmd + '\r\n');
    }

    socket.on('data', (data) => {
      const msg = data.toString();
      log += msg;

      if (step === 0 && msg.startsWith('220')) {
        step = 1;
        send('EHLO localhost');
      } else if (step === 1 && msg.includes('250')) {
        step = 2;
        send('AUTH LOGIN');
      } else if (step === 2 && msg.startsWith('334')) {
        step = 3;
        send(Buffer.from(senderEmail).toString('base64'));
      } else if (step === 3 && msg.startsWith('334')) {
        step = 4;
        send(Buffer.from(cleanPass).toString('base64'));
      } else if (step === 4 && msg.startsWith('235')) {
        step = 5;
        send(`MAIL FROM:<${senderEmail}>`);
      } else if (step === 5 && msg.startsWith('250')) {
        step = 6;
        send(`RCPT TO:<${recipientEmail}>`);
      } else if (step === 6 && msg.startsWith('250')) {
        step = 7;
        send('DATA');
      } else if (step === 7 && msg.startsWith('354')) {
        step = 8;
        const boundary = '----BrowseCuratorBoundary' + Date.now();
        const headers = [
          `From: "BrowseCurator Family Shield" <${senderEmail}>`,
          `To: <${recipientEmail}>`,
          `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
          'MIME-Version: 1.0',
          `Content-Type: multipart/alternative; boundary="${boundary}"`,
          '',
          `--${boundary}`,
          'Content-Type: text/plain; charset=UTF-8',
          '',
          text,
          '',
          `--${boundary}`,
          'Content-Type: text/html; charset=UTF-8',
          '',
          html || `<p>${text.replace(/\n/g, '<br>')}</p>`,
          '',
          `--${boundary}--`,
          '.'
        ].join('\r\n');

        socket.write(headers + '\r\n');
      } else if (step === 8 && msg.startsWith('250')) {
        step = 9;
        send('QUIT');
        socket.end();
        resolve({ success: true, message: 'Email sent successfully via Gmail SMTP' });
      } else if (msg.startsWith('5') || msg.startsWith('4')) {
        socket.end();
        reject(new Error(`SMTP Error: ${msg.trim()}`));
      }
    });

    socket.on('error', (err) => {
      reject(err);
    });
  });
}

module.exports = { sendGmail };
