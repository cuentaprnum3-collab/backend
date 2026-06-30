// Envía correos a través de Gmail SMTP usando Nodemailer.
//
// Variables de entorno necesarias:
//   MAIL_USER    -> tu correo de Gmail, ej. "readtrackuts@gmail.com"
//   MAIL_PASS    -> contraseña de aplicación de Gmail (App Password, 16 caracteres)
//   MAIL_PORT    -> puerto SMTP, normalmente 465 (SSL) o 587 (TLS)
//   MAIL_SECURE  -> "true" si usas el puerto 465, "false" si usas 587
//   MAIL_FROM    -> remitente que verán los usuarios, ej. "ReadTrack UTS <readtrackuts@gmail.com>"

const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: Number(process.env.MAIL_PORT) || 465,
    secure: process.env.MAIL_SECURE !== 'false',
    family: 4,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });

  transporter.verify((error) => {
    if (error) {
      console.error('Error de verificación SMTP:', error.message);
    } else {
      console.log('Servidor SMTP (Gmail) listo para enviar correos.');
    }
  });

  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  const t = getTransporter();

  if (!t) {
    console.log('[DEV] Email no enviado (falta MAIL_USER o MAIL_PASS). Simulando envío:');
    console.log({ to, subject, text, html });
    return;
  }

  const from = process.env.MAIL_FROM || process.env.MAIL_USER;

  try {
    const info = await t.sendMail({ from, to, subject, text, html });
    console.log(`[EMAIL] Enviado a ${to} — Message ID: ${info.messageId}`);
    return info;
  } catch (e) {
    console.error('Error enviando email vía SMTP:', e.message);
    throw new Error(e.message || 'No se pudo enviar el correo.');
  }
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