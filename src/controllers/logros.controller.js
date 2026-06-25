const prisma = require('../utils/prisma');
const { ok, err } = require('../utils/respuesta');

async function listar(req, res) {
  try {
    const logros = await prisma.logro.findMany();
    const obtenidos = await prisma.logroUsuario.findMany({ where:{ usuarioId:req.usuario.id } });
    const obtenidosIds = obtenidos.map(o=>o.logroId);
    const resultado = logros.map(l=>({ ...l, ganado:obtenidosIds.includes(l.id), obtenidoEn:obtenidos.find(o=>o.logroId===l.id)?.obtenidoEn||null }));
    return ok(res, resultado);
  } catch(e) { return err(res,'Error al listar logros.',500); }
}

module.exports = { listar };
