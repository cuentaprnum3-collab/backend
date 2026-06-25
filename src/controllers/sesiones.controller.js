const prisma = require('../utils/prisma');
const { ok, err } = require('../utils/respuesta');
const { actualizarRacha } = require('../utils/racha');

// Si 'valor' viene como 'YYYY-MM-DD' (sin hora), lo anclamos a mediodía UTC
// (12:00:00Z) en vez de medianoche local del servidor. Esto evita que la fecha
// se corra un día hacia atrás al convertirse a zonas horarias negativas como
// Colombia (UTC-5) cuando el servidor corre en UTC (caso típico en hosting cloud).
function parsearFechaLocal(valor) {
  if (!valor) {
    const ahora = new Date();
    return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 12, 0, 0));
  }
  if (typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [anio, mes, dia] = valor.split('-').map(Number);
    return new Date(Date.UTC(anio, mes - 1, dia, 12, 0, 0));
  }
  return new Date(valor);
}

async function recalcularProgreso(libroId) {
  const sesiones = await prisma.sesion.findMany({ where:{ libroId } });
  const maxPagina = sesiones.length > 0 ? Math.max(...sesiones.map(s=>s.paginaFin)) : 0;
  const libro = await prisma.libro.findUnique({ where:{ id:libroId } });
  const estado = maxPagina >= libro.totalPaginas ? 'TERMINADO' : maxPagina > 0 ? 'LEYENDO' : 'PENDIENTE';
  return prisma.libro.update({ where:{ id:libroId }, data:{ paginasLeidas:Math.min(maxPagina, libro.totalPaginas), estado } });
}

async function listar(req, res) {
  try {
    const { libroId } = req.query;
    let where;
    if (libroId) {
      const libro = await prisma.libro.findFirst({ where:{ id:Number(libroId), usuarioId:req.usuario.id } });
      if (!libro) return err(res,'Libro no encontrado.',404);
      where = { libroId:Number(libroId) };
    } else {
      where = { libro:{ usuarioId:req.usuario.id } };
    }
    const sesiones = await prisma.sesion.findMany({
      where,
      orderBy:{ fecha:'desc' },
      include: { libro:{ select:{ id:true, titulo:true } } },
    });
    return ok(res, sesiones);
  } catch(e) { return err(res,'Error al listar sesiones.',500); }
}

async function crear(req, res) {
  try {
    const { libroId, paginaInicio, paginaFin, fecha, duracionMinutos, notas } = req.body;
    if (libroId == null || paginaInicio == null || paginaFin == null) return err(res,'libroId, paginaInicio y paginaFin son obligatorios.');
    if (Number(paginaFin) <= Number(paginaInicio)) return err(res,'paginaFin debe ser mayor a paginaInicio.');
    const libro = await prisma.libro.findFirst({ where:{ id:Number(libroId), usuarioId:req.usuario.id } });
    if (!libro) return err(res,'Libro no encontrado.',404);

    const paginasLeidas = Number(paginaFin) - Number(paginaInicio);
    const sesion = await prisma.sesion.create({
      data: { libroId:Number(libroId), paginaInicio:Number(paginaInicio), paginaFin:Number(paginaFin), paginasLeidas, fecha:parsearFechaLocal(fecha), duracionMinutos:duracionMinutos?Number(duracionMinutos):null, notas:notas||null },
    });

    const libroActualizado = await recalcularProgreso(Number(libroId));
    const racha = await actualizarRacha(req.usuario.id);

    return ok(res, { sesion, libroActualizado:{ ...libroActualizado, progresoPorcentaje:Math.round((libroActualizado.paginasLeidas/libroActualizado.totalPaginas)*100*10)/10 }, rachaActual:racha.rachaActual }, 201);
  } catch(e) { console.error(e); return err(res,'Error al registrar sesión.',500); }
}

async function actualizar(req, res) {
  try {
    const sesion = await prisma.sesion.findFirst({
      where: { id:Number(req.params.id) },
      include: { libro:{ select:{ usuarioId:true } } },
    });
    if (!sesion || sesion.libro.usuarioId !== req.usuario.id) return err(res,'Sesión no encontrada.',404);
    const { paginaInicio, paginaFin, duracionMinutos, notas, fecha } = req.body;
    if (paginaFin && paginaInicio && Number(paginaFin) <= Number(paginaInicio)) return err(res,'paginaFin debe ser mayor a paginaInicio.');
    const paginasLeidas = (paginaFin && paginaInicio) ? Number(paginaFin)-Number(paginaInicio) : sesion.paginasLeidas;
    const actualizada = await prisma.sesion.update({
      where: { id:sesion.id },
      data: { paginaInicio:paginaInicio?Number(paginaInicio):undefined, paginaFin:paginaFin?Number(paginaFin):undefined, paginasLeidas, duracionMinutos:duracionMinutos?Number(duracionMinutos):undefined, notas, fecha:fecha?parsearFechaLocal(fecha):undefined },
    });
    await recalcularProgreso(sesion.libroId);
    return ok(res, actualizada);
  } catch(e) { return err(res,'Error al actualizar sesión.',500); }
}

async function eliminar(req, res) {
  try {
    const sesion = await prisma.sesion.findFirst({
      where: { id:Number(req.params.id) },
      include: { libro:{ select:{ usuarioId:true, id:true } } },
    });
    if (!sesion || sesion.libro.usuarioId !== req.usuario.id) return err(res,'Sesión no encontrada.',404);
    await prisma.sesion.delete({ where:{ id:sesion.id } });
    await recalcularProgreso(sesion.libroId);
    return ok(res,{ mensaje:'Sesión eliminada.' });
  } catch(e) { return err(res,'Error al eliminar sesión.',500); }
}

module.exports = { listar, crear, actualizar, eliminar };
