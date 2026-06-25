const prisma = require('../utils/prisma');
const { ok, err } = require('../utils/respuesta');

async function obtener(req, res) {
  try {
    const n = await prisma.notificacion.findUnique({ where:{ usuarioId:req.usuario.id } });
    if (!n) return err(res,'Configuración de notificaciones no encontrada.',404);
    return ok(res, n);
  } catch(e) { return err(res,'Error al obtener notificaciones.',500); }
}

async function actualizar(req, res) {
  try {
    const { activa, horaEnvio, frecuencia } = req.body;
    const n = await prisma.notificacion.upsert({
      where: { usuarioId:req.usuario.id },
      update: { activa, horaEnvio, frecuencia },
      create: { usuarioId:req.usuario.id, activa:activa??true, horaEnvio, frecuencia },
    });
    return ok(res, n);
  } catch(e) { return err(res,'Error al actualizar notificaciones.',500); }
}

module.exports = { obtener, actualizar };
