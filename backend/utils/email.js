const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function enviarEmail({ to, subject, html }) {
  await transporter.sendMail({
    from: `"DIGSA España" <contacto@digsa.es>`,
    to,
    subject,
    html
  });
}

async function enviarCambioPassword(email, nombre, nuevaPassword) {
  await enviarEmail({
    to: email,
    subject: 'Tu contraseña ha sido actualizada — DIGSA España',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
        <div style="background:#1a1a1a;padding:24px;text-align:center">
          <h2 style="color:#fff;margin:0;font-size:20px">DIGSA España</h2>
        </div>
        <div style="padding:32px;background:#f9f9f9">
          <p>Hola <strong>${nombre}</strong>,</p>
          <p>Tu contraseña en el portal de inversores ha sido actualizada.</p>
          <div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin:20px 0;text-align:center">
            <p style="margin:0;color:#666;font-size:13px">Tu nueva contraseña es:</p>
            <p style="margin:12px 0 0;font-size:22px;font-weight:700;letter-spacing:2px;color:#1a1a1a">${nuevaPassword}</p>
          </div>
          <p style="color:#888;font-size:13px">Por seguridad, te recomendamos cambiarla desde tu perfil una vez que ingreses.</p>
        </div>
        <div style="padding:16px;text-align:center;color:#aaa;font-size:12px">
          Villanueva 27, Madrid · La Pampa 1517 3C, Buenos Aires
        </div>
      </div>
    `
  });
}

async function enviarNotificacionEmail(email, nombre, titulo, mensaje) {
  await enviarEmail({
    to: email,
    subject: `${titulo} — DIGSA España`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto">
        <div style="background:#1a1a1a;padding:24px;text-align:center">
          <h2 style="color:#fff;margin:0;font-size:20px">DIGSA España</h2>
        </div>
        <div style="padding:32px;background:#f9f9f9">
          <p>Hola <strong>${nombre}</strong>,</p>
          <h3 style="color:#1a1a1a">${titulo}</h3>
          <p>${mensaje}</p>
          <a href="https://digsa-inversores-production.up.railway.app" 
             style="display:inline-block;margin-top:16px;padding:12px 24px;background:#FF4D0F;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">
            Ver en el portal →
          </a>
        </div>
        <div style="padding:16px;text-align:center;color:#aaa;font-size:12px">
          Villanueva 27, Madrid · La Pampa 1517 3C, Buenos Aires
        </div>
      </div>
    `
  });
}

module.exports = { enviarEmail, enviarCambioPassword, enviarNotificacionEmail };
