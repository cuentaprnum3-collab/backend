const nodemailer = require('nodemailer');

const mailPort = Number(process.env.MAIL_PORT || 587);
const mailSecure = process.env.MAIL_SECURE === 'true'
  ? true
  : mailPort === 465
    ? true
    : false;

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: mailPort,
  secure: mailSecure,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000,
});

async function sendEmail({ to, subject, text, html }) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    const message = 'No hay configuración SMTP válida. Verifica MAIL_USER y MAIL_PASS.';
    console.error('[EMAIL] ' + message, { to, subject });
    throw new Error(message);
  }

  await transporter.verify();

  const info = await transporter.sendMail({
    from: `"ReadTrack UTS" <${process.env.MAIL_USER}>`,
    replyTo: process.env.MAIL_USER,
    to,
    subject,
    text,
    html,
  });

  console.log(`[EMAIL] Enviado a ${to} con ID ${info.messageId}`);
  return info;
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