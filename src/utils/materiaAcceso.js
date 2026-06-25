const prisma = require('./prisma');

// Devuelve la materia si el usuario tiene acceso a ella, ya sea como
// dueño (usuarioId) o como miembro aceptado del grupo (MiembroGrupo con su
// email y aceptado:true). Si no tiene acceso, devuelve null.
//
// El objeto devuelto incluye `esPropietario: boolean` para que el llamador
// pueda decidir qué acciones permitir (editar/compartir/eliminar materia son
// solo del dueño; crear/editar notas es de cualquier miembro con acceso).
async function obtenerMateriaConAcceso(materiaId, usuario, opciones = {}) {
  const id = Number(materiaId);
  if (!id || Number.isNaN(id)) return null;

  const materia = await prisma.materia.findFirst({
    where: { id, eliminada: opciones.incluirEliminadas ? undefined : false },
    include: opciones.include,
  });
  if (!materia) return null;

  if (materia.usuarioId === usuario.id) {
    return { ...materia, esPropietario: true };
  }

  if (materia.esGrupo) {
    const miembro = await prisma.miembroGrupo.findFirst({
      where: { materiaId: id, email: usuario.email, aceptado: true },
    });
    if (miembro) {
      return { ...materia, esPropietario: false };
    }
  }

  return null;
}

module.exports = { obtenerMateriaConAcceso };
