// Envía correos a través de la API HTTP de Resend (https://resend.com).
// IMPORTANTE: Railway bloquea SMTP saliente en los planes Free/Trial/Hobby,
// por eso usamos la API HTTPS de Resend (puerto 443), que siempre está disponible.
//
// Variables de entorno necesarias:
//   RESEND_API_KEY   -> tu API key de resend.com (empieza con "re_")
//   MAIL_FROM        -> remitente, ej. "ReadTrack UTS <onboarding@resend.dev>"

const https = require('https');

const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log('[DEV] Email no enviado (falta RESEND_API_KEY). Simulando envío:');
    console.log({ to, subject, text, html });
    return;
  }

  const from = process.env.MAIL_FROM || 'ReadTrack UTS <onboarding@resend.dev>';
  const payload = JSON.stringify({ from, to: [to], subject, text, html });

  return new Promise((resolve, reject) => {
    const req = https.request(
      RESEND_API_URL,
      {
        method: 'POST',
        family: 4, // fuerza IPv4 para evitar timeouts de IPv6 en contenedores de Railway
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 15000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          let data = {};
          try {
            data = JSON.parse(body);
          } catch (_) {
            // respuesta no JSON, se deja vacío
          }

          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`[EMAIL] Enviado a ${to} con ID ${data.id}`);
            resolve(data);
          } else {
            const mensaje = data?.message || `Error HTTP ${res.statusCode} de Resend`;
            reject(new Error(mensaje));
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Tiempo de espera agotado al contactar el servicio de correo (Resend).'));
    });

    req.on('error', (e) => {
      reject(new Error(e.message || 'Error de red al contactar Resend.'));
    });

    req.write(payload);
    req.end();
  });
}

function formatVerificationEmail({ nombre, codigo }) {
  return {
    subject: 'Verificación de correo electrónico — ReadTrack UTS',
    text: `Hola ${nombre},\n\nTu código de verificación de correo es: ${codigo}\n\nEste código expira en 10 minutos.\n\nSi no solicitaste esta verificación, ignora este correo.\n\nReadTrack UTS`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 30px;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 40px; border-radius: 12px;">
          <h2 style="color: #2c3e50; text-align: center;">Verificación de correo electrónico</h2>
          <p style="color: #555; font-size: 16px;">Hola <strong>${nombre}</strong>,</p>
          <p style="color: #555; font-size: 16px; line-height: 1.6;">Gracias por crear tu cuenta en ReadTrack UTS. Usa el siguiente código para verificar tu correo electrónico.</p>
          <div style="background: #f0f0f0; padding: 25px; border-radius: 10px; text-align: center; margin: 25px 0;">
            <h1 style="letter-spacing: 8px; color: #111; margin: 0; font-size: 42px;">${codigo}</h1>
          </div>
          <p style="color: #555; font-size: 16px;">Este código expira en <strong>10 minutos</strong>.</p>
          <p style="color: #888; font-size: 12px; text-align: center;">Si no solicitaste este código, ignora este correo.</p>
        </div>
      </div>
    `,
  };
}

function formatRecoveryEmail({ nombre, codigo }) {
  return {
    subject: 'Recuperación de contraseña — ReadTrack UTS',
    text: `Hola ${nombre},\n\nTu código para recuperar la contraseña es: ${codigo}\n\nEste código expira en 1 hora.\n\nSi no solicitaste este cambio, ignora este correo.\n\nReadTrack UTS`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 30px;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 40px; border-radius: 12px;">
          <h2 style="color: #2c3e50; text-align: center;">Recuperar contraseña</h2>
          <p style="color: #555; font-size: 16px;">Hola <strong>${nombre}</strong>,</p>
          <p style="color: #555; font-size: 16px; line-height: 1.6;">Usa el siguiente código para restablecer tu contraseña.</p>
          <div style="background: #f0f0f0; padding: 25px; border-radius: 10px; text-align: center; margin: 25px 0;">
            <h1 style="letter-spacing: 8px; color: #111; margin: 0; font-size: 42px;">${codigo}</h1>
          </div>
          <p style="color: #555; font-size: 16px;">Este código expira en <strong>1 hora</strong>.</p>
          <p style="color: #888; font-size: 12px; text-align: center;">Si no solicitaste este cambio, ignora este correo.</p>
        </div>
      </div>
    `,
  };
}

function formatReminderEmail({ nombre }) {
  return {
    subject: 'Recordatorio de lectura — ReadTrack UTS',
    text: `Hola ${nombre},\n\n¡No olvides completar tus actividades, revisar tus notas y registrar tu progreso de lectura de hoy!\n\nReadTrack UTS`,
    html: `
      <div style="font-family: Arial, sans-serif; background: #f5f5f5; padding: 30px;">
        <div style="max-width: 600px; margin: auto; background: white; padding: 40px; border-radius: 12px;">
          <h2 style="color: #2c3e50; text-align: center;">Recordatorio de lectura</h2>
          <p style="color: #555; font-size: 16px;">Hola <strong>${nombre}</strong>,</p>
          <p style="color: #555; font-size: 16px; line-height: 1.6;">¡No olvides completar tus actividades, revisar tus notas y registrar tu progreso de lectura de hoy!</p>
          <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">ReadTrack UTS</p>
        </div>
      </div>
    `,
  };
}

module.exports = {
  sendEmail,
  formatVerificationEmail,
  formatRecoveryEmail,
  formatReminderEmail,
};