const prisma = require('../utils/prisma');
const { sendEmail, formatReminderEmail } = require('../utils/email');

function sameCalendarDay(dateA, dateB) {
  if (!dateA || !dateB) return false;
  const a = new Date(dateA);
  const b = new Date(dateB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function parseHoraEnvio(horaEnvio) {
  if (typeof horaEnvio !== 'string') return null;
  const [hour, minute] = horaEnvio.split(':').map((v) => Number(v));
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  return { hour, minute };
}

async function enviarRecordatoriosDiarios() {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentWeekday = now.getDay(); // 0 Domingo, 1 Lunes, ...

    const notifications = await prisma.notificacion.findMany({
      where: { activa: true },
      include: { usuario: true },
    });

    for (const notificacion of notifications) {
      if (!notificacion.usuario || !notificacion.usuario.emailVerificado) continue;
      if (!notificacion.horaEnvio) continue;

      const parsed = parseHoraEnvio(notificacion.horaEnvio);
      if (!parsed) continue;
      if (parsed.hour !== currentHour || parsed.minute !== currentMinute) continue;
      if (sameCalendarDay(notificacion.ultimaEnviada, now)) continue;
      if (notificacion.frecuencia === 'SEMANAL' && currentWeekday !== 1) continue;

      try {
        const emailData = formatReminderEmail({ nombre: notificacion.usuario.nombre });
        await sendEmail({ to: notificacion.usuario.email, subject: emailData.subject, text: emailData.text, html: emailData.html });
        await prisma.notificacion.update({
          where: { id: notificacion.id },
          data: { ultimaEnviada: new Date() },
        });
        console.log(`Recordatorio enviado a ${notificacion.usuario.email}`);
      } catch (sendError) {
        console.error('Error enviando recordatorio a', notificacion.usuario.email, sendError);
      }
    }
  } catch (error) {
    console.error('Error en el worker de recordatorios:', error);
  }
}

function startReminderScheduler() {
  const interval = 60 * 1000;
  setInterval(enviarRecordatoriosDiarios, interval);
  console.log('Worker de recordatorios iniciado, revisando notificaciones cada minuto.');
}

module.exports = { startReminderScheduler, enviarRecordatoriosDiarios };
