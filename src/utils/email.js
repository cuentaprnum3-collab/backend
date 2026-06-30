// Envía correos a través de la API HTTP de Resend (https://resend.com) en
// vez de SMTP directo. Esto evita el bloqueo de puertos SMTP salientes que
// algunos proveedores de hosting (como Railway en su plan gratuito) aplican
// por defecto — la API de Resend funciona sobre HTTPS (puerto 443), que
// siempre está disponible.
//
// Variables de entorno necesarias:
//   RESEND_API_KEY   -> tu API key de resend.com (empieza con "re_")
//   MAIL_FROM        -> remitente, ej. "ReadTrack UTS <onboarding@resend.dev>"
//                        (onboarding@resend.dev funciona sin verificar dominio)

const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log('[DEV] Email no enviado (falta RESEND_API_KEY). Simulando envío:');
    console.log({ to, subject, text, html });
    return;
  }

  const from = process.env.MAIL_FROM || 'ReadTrack UTS <onboarding@resend.dev>';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let response;
  try {
    response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text, html }),
      signal: controller.signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new Error('Tiempo de espera agotado al contactar el servicio de correo (Resend).');
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const mensaje = data?.message || `Error HTTP ${response.status} de Resend`;
    throw new Error(mensaje);
  }

  console.log(`[EMAIL] Enviado a ${to} con ID ${data.id}`);
  return data;
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