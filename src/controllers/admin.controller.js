const prisma = require('../utils/prisma');
const { ok, err } = require('../utils/respuesta');

async function listarUsuarios(_req, res) {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id:true, nombre:true, email:true, rol:true, activo:true, creadoEn:true,
        _count:{ select:{ materias:true, libros:true } } },
      orderBy: { creadoEn:'desc' },
    });
    return ok(res, usuarios);
  } catch(e) { return err(res,'Error al listar usuarios.',500); }
}

async function cambiarEstadoUsuario(req, res) {
  try {
    const { activo } = req.body;
    const usuario = await prisma.usuario.findUnique({ where:{ id:Number(req.params.id) } });
    if (!usuario) return err(res,'Usuario no encontrado.',404);
    const actualizado = await prisma.usuario.update({ where:{ id:usuario.id }, data:{ activo:!!activo }, select:{ id:true, nombre:true, email:true, activo:true } });
    return ok(res, actualizado);
  } catch(e) { return err(res,'Error al actualizar usuario.',500); }
}

async function statsGlobales(_req, res) {
  try {
    const [usuarios, sesiones, materias, notas, archivos] = await Promise.all([
      prisma.usuario.count({ where:{ activo:true } }),
      prisma.sesion.count(),
      prisma.materia.count(),
      prisma.nota.count(),
      prisma.archivo.count(),
    ]);
    return ok(res, { usuariosActivos:usuarios, sesionesRegistradas:sesiones, materiasCreadas:materias, notasCreadas:notas, archivosSubidos:archivos });
  } catch(e) { return err(res,'Error al obtener estadísticas globales.',500); }
}

module.exports = { listarUsuarios, cambiarEstadoUsuario, statsGlobales };
