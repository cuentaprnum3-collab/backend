const prisma = require('../utils/prisma');
const { ok, err } = require('../utils/respuesta');

async function resumen(req, res) {
  try {
    const uid = req.usuario.id;
    const [materias, notas, libros, sesiones, racha] = await Promise.all([
      prisma.materia.count({ where:{ usuarioId:uid, archivada:false } }),
      prisma.nota.count({ where:{ materia:{ usuarioId:uid } } }),
      prisma.libro.count({ where:{ usuarioId:uid } }),
      prisma.sesion.count({ where:{ libro:{ usuarioId:uid } } }),
      prisma.racha.findUnique({ where:{ usuarioId:uid } }),
    ]);
    const paginasTotales = (await prisma.libro.aggregate({ where:{ usuarioId:uid }, _sum:{ paginasLeidas:true } }))._sum.paginasLeidas || 0;
    return ok(res, { materias, notas, libros, sesiones, paginasTotales, rachaActual:racha?.rachaActual||0, rachMaxima:racha?.rachMaxima||0 });
  } catch(e) { return err(res,'Error al obtener resumen.',500); }
}

async function actividadSemanal(req, res) {
  try {
    const uid = req.usuario.id;
    const resultado = [];
    for (let i=4; i>=0; i--) {
      const inicio = new Date(); inicio.setDate(inicio.getDate()-inicio.getDay()+1-i*7); inicio.setHours(0,0,0,0);
      const fin = new Date(inicio); fin.setDate(fin.getDate()+6); fin.setHours(23,59,59,999);
      const sesiones = await prisma.sesion.findMany({ where:{ fecha:{ gte:inicio, lte:fin }, libro:{ usuarioId:uid } } });
      for (let d=0; d<7; d++) {
        const dia = new Date(inicio); dia.setDate(dia.getDate()+d);
        const sesD = sesiones.filter(s=>{ const fd=new Date(s.fecha); return fd.getDate()===dia.getDate()&&fd.getMonth()===dia.getMonth(); });
        resultado.push({ fecha:dia.toISOString().split('T')[0], paginas:sesD.reduce((s,ses)=>s+ses.paginasLeidas,0) });
      }
    }
    return ok(res, resultado);
  } catch(e) { return err(res,'Error al obtener actividad semanal.',500); }
}

async function frecuencia(req, res) {
  try {
    const uid = req.usuario.id;
    const sesiones = await prisma.sesion.findMany({ where:{ libro:{ usuarioId:uid } } });
    if (sesiones.length === 0) return ok(res,{ promedioPaginasSesion:0, sesionesSemanales:0, diaMayorActividad:null });
    const promedioPaginas = Math.round(sesiones.reduce((s,ses)=>s+ses.paginasLeidas,0)/sesiones.length);
    const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const porDia = [0,0,0,0,0,0,0];
    sesiones.forEach(s=>{ porDia[new Date(s.fecha).getDay()]++; });
    const diaMayorActividad = dias[porDia.indexOf(Math.max(...porDia))];
    const semanas = Math.max(1, Math.ceil(sesiones.length/7));
    return ok(res, { promedioPaginasSesion:promedioPaginas, sesionesSemanales:Math.round(sesiones.length/semanas*10)/10, diaMayorActividad });
  } catch(e) { return err(res,'Error al obtener frecuencia.',500); }
}

async function librosEstado(req, res) {
  try {
    const uid = req.usuario.id;
    const [leyendo, terminado, pendiente] = await Promise.all([
      prisma.libro.count({ where:{ usuarioId:uid, estado:'LEYENDO' } }),
      prisma.libro.count({ where:{ usuarioId:uid, estado:'TERMINADO' } }),
      prisma.libro.count({ where:{ usuarioId:uid, estado:'PENDIENTE' } }),
    ]);
    const porTipo = await prisma.libro.groupBy({ by:['tipo'], where:{ usuarioId:uid }, _count:{ tipo:true } });
    return ok(res, { estados:{ LEYENDO:leyendo, TERMINADO:terminado, PENDIENTE:pendiente }, tipos:porTipo });
  } catch(e) { return err(res,'Error al obtener estadísticas de libros.',500); }
}

async function racha(req, res) {
  try {
    const r = await prisma.racha.findUnique({ where:{ usuarioId:req.usuario.id } });
    if (!r) return ok(res,{ rachaActual:0, rachMaxima:0, ultimaSesion:null });
    return ok(res,{ rachaActual:r.rachaActual, rachMaxima:r.rachMaxima, ultimaSesion:r.ultimaSesion });
  } catch(e) { return err(res,'Error al obtener racha.',500); }
}

module.exports = { resumen, actividadSemanal, frecuencia, librosEstado, racha };
