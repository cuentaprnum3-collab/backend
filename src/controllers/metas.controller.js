const prisma = require('../utils/prisma');
const { ok, err } = require('../utils/respuesta');

function inicioSemana(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // calcular lunes de la misma semana (lunes = primer día)
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d;
}

async function metaActiva(req, res) {
  try {
    const meta = await prisma.meta.findFirst({ where:{ usuarioId:req.usuario.id, activa:true } });
    if (!meta) return ok(res, null);
    
    // Calcular páginas leídas DESDE LA FECHA DE INICIO DE LA META (no desde hoy)
    const inicio = new Date(meta.semanaInicio);
    inicio.setHours(0, 0, 0, 0);
    const fin = new Date(inicio);
    fin.setDate(fin.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    
    const sesiones = await prisma.sesion.findMany({
      where: { fecha:{ gte:inicio, lte:fin }, libro:{ usuarioId:req.usuario.id } },
    });
    const paginasLeidas = sesiones.reduce((s,ses)=>s+ses.paginasLeidas,0);
    const porcentaje = Math.round((paginasLeidas/meta.paginasSemana)*100);
    return ok(res, { 
      id: meta.id,
      usuarioId: meta.usuarioId,
      paginasSemana: meta.paginasSemana, 
      paginasLeidas, 
      porcentaje,
      semanaInicio: meta.semanaInicio,
      activa: meta.activa,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt
    });
  } catch(e) { return err(res,'Error al obtener meta activa.',500); }
}

async function historial(req, res) {
  try {
    const metas = await prisma.meta.findMany({
      where: { usuarioId:req.usuario.id },
      orderBy: { semanaInicio:'desc' },
    });

    const historial = await Promise.all(metas.map(async (meta) => {
      const inicio = new Date(meta.semanaInicio);
      inicio.setHours(0, 0, 0, 0);
      const fin = new Date(inicio);
      fin.setDate(fin.getDate() + 6);
      fin.setHours(23, 59, 59, 999);

      const sesiones = await prisma.sesion.findMany({
        where: { fecha: { gte: inicio, lte: fin }, libro: { usuarioId: req.usuario.id } },
      });

      const paginasLeidas = sesiones.reduce((s, ses) => s + ses.paginasLeidas, 0);
      const porcentaje = Math.round((paginasLeidas / meta.paginasSemana) * 100);
      const monthNames = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
      const inicioLabel = `${inicio.getDate()} ${monthNames[inicio.getMonth()]}`;
      const finLabel = `${fin.getDate()} ${monthNames[fin.getMonth()]}`;
      const semana = inicio.getMonth() === fin.getMonth() ? `${inicio.getDate()}-${fin.getDate()} ${monthNames[inicio.getMonth()]}` : `${inicioLabel} - ${finLabel}`;

      return {
        id: meta.id,
        semanaInicio: meta.semanaInicio,
        semana,
        paginasSemana: meta.paginasSemana,
        paginasLeidas,
        porcentaje,
      };
    }));

    return ok(res, historial);
  } catch (e) {
    return err(res, 'Error al obtener historial.', 500);
  }
}

async function crear(req, res) {
  try {
    const { paginasSemana } = req.body;
    if (!paginasSemana || Number(paginasSemana) < 1) return err(res,'paginasSemana debe ser mayor a 0.');
    // Desactivar meta anterior
    await prisma.meta.updateMany({ where:{ usuarioId:req.usuario.id, activa:true }, data:{ activa:false } });
    const meta = await prisma.meta.create({ data:{ usuarioId:req.usuario.id, paginasSemana:Number(paginasSemana), activa:true, semanaInicio:inicioSemana() } });
    return ok(res, meta, 201);
  } catch(e) { return err(res,'Error al crear meta.',500); }
}

module.exports = { metaActiva, historial, crear };
