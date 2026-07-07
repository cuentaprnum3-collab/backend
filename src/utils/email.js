const RESEND_API_URL = 'https://api.resend.com/emails';

async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log('[DEV] Sin RESEND_API_KEY, simulando envío a:', to);
    return;
  }
  const from = process.env.MAIL_FROM;
  if (!from) {
    console.error('Error enviando correo: falta MAIL_FROM en las variables de entorno.');
    return;
  }

  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, text, html }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const detalle = data?.message || res.statusText;
    console.error(`Error Resend (${res.status}):`, detalle);
    throw new Error(`Resend error ${res.status}: ${detalle}`);
  }

  console.log(`[EMAIL] Enviado a ${to} — ID: ${data.id}`);
  return data;
}

function formatVerificationEmail({ nombre, codigo }) {
  return {
    subject: 'Verificación de correo electrónico — ReadTrack UTS',
    text: `Hola ${nombre},\n\nTu código de verificación es: ${codigo}\n\nExpira en 10 minutos.\n\nReadTrack UTS`,
    html: `<div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:30px"><div style="max-width:600px;margin:auto;background:white;padding:40px;border-radius:12px"><h2 style="color:#2c3e50;text-align:center">Verificación de correo</h2><p>Hola <strong>${nombre}</strong>,</p><p>Usa este código para verificar tu correo en ReadTrack UTS:</p><div style="background:#f0f0f0;padding:25px;border-radius:10px;text-align:center;margin:25px 0"><h1 style="letter-spacing:8px;color:#111;margin:0;font-size:42px">${codigo}</h1></div><p>Expira en <strong>10 minutos</strong>.</p></div></div>`,
  };
}

function formatRecoveryEmail({ nombre, codigo }) {
  return {
    subject: 'Recuperación de contraseña — ReadTrack UTS',
    text: `Hola ${nombre},\n\nTu código de recuperación es: ${codigo}\n\nExpira en 1 hora.\n\nReadTrack UTS`,
    html: `<div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:30px"><div style="max-width:600px;margin:auto;background:white;padding:40px;border-radius:12px"><h2 style="color:#2c3e50;text-align:center">Recuperar contraseña</h2><p>Hola <strong>${nombre}</strong>,</p><p>Usa este código para restablecer tu contraseña:</p><div style="background:#f0f0f0;padding:25px;border-radius:10px;text-align:center;margin:25px 0"><h1 style="letter-spacing:8px;color:#111;margin:0;font-size:42px">${codigo}</h1></div><p>Expira en <strong>1 hora</strong>.</p></div></div>`,
  };
}

function formatReminderEmail({ nombre }) {
  return {
    subject: 'Recordatorio de lectura — ReadTrack UTS',
    text: `Hola ${nombre},\n\n¡No olvides registrar tu progreso de lectura de hoy!\n\nReadTrack UTS`,
    html: `<div style="font-family:Arial,sans-serif;background:#f5f5f5;padding:30px"><div style="max-width:600px;margin:auto;background:white;padding:40px;border-radius:12px"><h2 style="color:#2c3e50;text-align:center">Recordatorio de lectura</h2><p>Hola <strong>${nombre}</strong>,</p><p>¡No olvides registrar tu progreso de lectura de hoy!</p></div></div>`,
  };
}

module.exports = { sendEmail, formatVerificationEmail, formatRecoveryEmail, formatReminderEmail };