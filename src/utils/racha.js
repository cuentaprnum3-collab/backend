const prisma = require('./prisma');

async function actualizarRacha(usuarioId) {
  const hoy  = new Date(); hoy.setHours(0, 0, 0, 0);
  const ayer = new Date(hoy); ayer.setDate(ayer.getDate() - 1);

  let racha = await prisma.racha.findUnique({ where: { usuarioId } });

  if (!racha) {
    return prisma.racha.create({
      data: { usuarioId, rachaActual: 1, rachMaxima: 1, ultimaSesion: new Date() },
    });
  }

  const ultima = racha.ultimaSesion ? new Date(racha.ultimaSesion) : null;
  if (ultima) ultima.setHours(0, 0, 0, 0);

  let nueva = racha.rachaActual;
  if (!ultima || ultima < ayer)                        nueva = 1;
  else if (ultima.getTime() === ayer.getTime())        nueva = racha.rachaActual + 1;
  // Si ultima === hoy: misma racha, no cambia

  return prisma.racha.update({
    where: { usuarioId },
    data: {
      rachaActual:  nueva,
      rachMaxima:   Math.max(nueva, racha.rachMaxima),
      ultimaSesion: new Date(),
    },
  });
}

module.exports = { actualizarRacha };
