const { google } = require('googleapis');

const OAuth2 = google.auth.OAuth2;

async function enviarEmail({ to, subject, html }) {
  const oauth2Client = new OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground'
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  const accessToken = await oauth2Client.getAccessToken();
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  const from = process.env.EMAIL_USER;
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `From: "DIGSA España" <${from}>`,
    `To: ${to}`,
    `Content-Type: text/html; charset=utf-8`,
    `MIME-Version: 1.0`,
    `Subject: ${utf8Subject}`,
    '',
    html
  ];
  const message = messageParts.join('\n');
  const encodedMessage = Buffer.from(message).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: encodedMessage } });
}

async function enviarCambioPassword(email, nombre, nuevaPassword) {
  await enviarEmail({
    to: email,
    subject: 'Tu contraseña ha sido actualizada — DIGSA España',
    html: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto"><div style="background:#1a1a1a;padding:24px;text-align:center"><h2 style="color:#fff;margin:0">DIGSA España</h2></div><div style="padding:32px;background:#f9f9f9"><p>Hola <strong>' + nombre + '</strong>,</p><p>Tu contraseña fue actualizada.</p><div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin:20px 0;text-align:center"><p style="margin:0;color:#666;font-size:13px">Tu nueva contraseña:</p><p style="margin:12px 0 0;font-size:22px;font-weight:700;letter-spacing:2px">' + nuevaPassword + '</p></div></div><div style="padding:16px;text-align:center;color:#aaa;font-size:12px">Villanueva 27, Madrid · La Pampa 1517 3C, Buenos Aires</div></div>'
  });
}

async function enviarNotificacionEmail(email, nombre, titulo, mensaje) {
  await enviarEmail({
    to: email,
    subject: titulo + ' — DIGSA España',
    html: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto"><div style="background:#1a1a1a;padding:24px;text-align:center"><h2 style="color:#fff;margin:0">DIGSA España</h2></div><div style="padding:32px;background:#f9f9f9"><p>Hola <strong>' + nombre + '</strong>,</p><h3>' + titulo + '</h3><p>' + mensaje + '</p><a href="https://digsa-inversores-production.up.railway.app" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#FF4D0F;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Ver en el portal</a></div><div style="padding:16px;text-align:center;color:#aaa;font-size:12px">Villanueva 27, Madrid · La Pampa 1517 3C, Buenos Aires</div></div>'
  });
}

async function enviarResetPassword(email, nombre, link) {
  await enviarEmail({
    to: email,
    subject: 'Recuperar contraseña — DIGSA España',
    html: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto"><div style="background:#1a1a1a;padding:24px;text-align:center"><h2 style="color:#fff;margin:0">DIGSA España</h2></div><div style="padding:32px;background:#f9f9f9"><p>Hola <strong>' + nombre + '</strong>,</p><p>Para restablecer tu contraseña hacé click aquí:</p><p style="text-align:center;margin:32px 0"><a href="' + link + '" style="background:#FF4D0F;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:700">Restablecer contraseña</a></p><p style="color:#888;font-size:13px">Expira en 1 hora.</p></div><div style="padding:16px;text-align:center;color:#aaa;font-size:12px">Villanueva 27, Madrid · La Pampa 1517 3C, Buenos Aires</div></div>'
  });
}

module.exports = { enviarEmail, enviarCambioPassword, enviarNotificacionEmail, enviarResetPassword };
