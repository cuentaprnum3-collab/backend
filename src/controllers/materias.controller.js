const prisma = require('../utils/prisma');
const { ok, err } = require('../utils/respuesta');
const { obtenerMateriaConAcceso } = require('../utils/materiaAcceso');

async function listar(req, res) {
  try {
    const materiasPropias = await prisma.materia.findMany({
      where: { usuarioId:req.usuario.id, archivada:false, eliminada:false },
      include: { _count:{ select:{ notas:true } }, miembros: true, usuario: { select: { nombre: true } } },
      orderBy: { creadoEn:'desc' },
    });

    // Materias de grupo a las que el usuario fue invitado y ya aceptó
    const materiasCompartidas = await prisma.materia.findMany({
      where: {
        archivada: false,
        eliminada: false,
        esGrupo: true,
        usuarioId: { not: req.usuario.id },
        miembros: { some: { email: req.usuario.email, aceptado: true } },
      },
      include: { _count:{ select:{ notas:true } }, miembros: true, usuario: { select: { nombre: true } } },
      orderBy: { creadoEn:'desc' },
    });

    const materias = [...materiasPropias, ...materiasCompartidas];
    return ok(res, materias);
  } catch(e) { return err(res,'Error al listar materias.',500); }
}

async function listarInvitaciones(req, res) {
  try {
    const invitaciones = await prisma.miembroGrupo.findMany({
      where: { email: req.usuario.email, aceptado: false },
      include: {
        materia: {
          select: { id: true, nombre: true, color: true, grupoId: true, usuario: { select: { nombre: true, email: true } } },
        },
      },
      orderBy: { creadoEn: 'desc' },
    });
    return ok(res, invitaciones);
  } catch(e) {
    console.error('Error listando invitaciones:', e);
    return err(res,'Error al listar invitaciones.',500);
  }
}

async function aceptarInvitacion(req, res) {
  try {
    const miembroId = Number(req.params.miembroId);
    const invitacion = await prisma.miembroGrupo.findFirst({
      where: { id: miembroId, email: req.usuario.email, aceptado: false },
    });
    if (!invitacion) return err(res, 'Invitación no encontrada.', 404);

    const actualizada = await prisma.miembroGrupo.update({
      where: { id: miembroId },
      data: { aceptado: true, usuarioId: req.usuario.id },
    });

    return ok(res, { mensaje: 'Te uniste al grupo.', miembro: actualizada });
  } catch(e) {
    console.error('Error aceptando invitación:', e);
    return err(res,'Error al aceptar invitación.',500);
  }
}

async function rechazarInvitacion(req, res) {
  try {
    const miembroId = Number(req.params.miembroId);
    const invitacion = await prisma.miembroGrupo.findFirst({
      where: { id: miembroId, email: req.usuario.email, aceptado: false },
    });
    if (!invitacion) return err(res, 'Invitación no encontrada.', 404);

    await prisma.miembroGrupo.delete({ where: { id: miembroId } });

    return ok(res, { mensaje: 'Invitación rechazada.' });
  } catch(e) {
    console.error('Error rechazando invitación:', e);
    return err(res,'Error al rechazar invitación.',500);
  }
}

async function listarArchivadas(req, res) {
  try {
    const materias = await prisma.materia.findMany({
      where: { usuarioId:req.usuario.id, archivada:true },
      include: { _count:{ select:{ notas:true } } },
      orderBy: { creadoEn:'desc' },
    });
    return ok(res, materias);
  } catch(e) { return err(res,'Error al listar materias archivadas.',500); }
}

async function detalle(req, res) {
  try {
    const materia = await obtenerMateriaConAcceso(req.params.id, req.usuario, {
      include: { notas:{ include:{ archivos:true }, orderBy:{ creadoEn:'desc' } }, miembros: true, usuario: { select: { nombre: true } } },
    });
    if (!materia) return err(res,'Materia no encontrada.',404);
    return ok(res, materia);
  } catch(e) { return err(res,'Error al obtener materia.',500); }
}

async function crear(req, res) {
  try {
    const { nombre, descripcion, semestre, color, esGrupo } = req.body;
    if (!nombre) return err(res,'El nombre de la materia es obligatorio.');
    
    // Generar grupoId si es grupo
    let grupoId = null;
    if (esGrupo) {
      grupoId = `${Date.now()}-${req.usuario.id}`;
    }
    
    const materia = await prisma.materia.create({
      data: { 
        usuarioId:req.usuario.id, 
        nombre, 
        descripcion, 
        semestre, 
        color,
        esGrupo: !!esGrupo,
        grupoId,
        propietarioId: esGrupo ? req.usuario.id : null
      },
      include: { miembros: true }
    });
    return ok(res, materia, 201);
  } catch(e) {
    console.error('Error creando materia:', e);
    return err(res,'Error al crear materia.',500);
  }
}

async function actualizar(req, res) {
  try {
    const { nombre, descripcion, semestre, color, esGrupo } = req.body;
    const materia = await prisma.materia.findFirst({ where:{ id:Number(req.params.id), usuarioId:req.usuario.id } });
    if (!materia) return err(res,'Materia no encontrada.',404);
    
    // Si se cambio a grupo, generar grupoId
    let grupoId = materia.grupoId;
    if (esGrupo && !materia.esGrupo) {
      grupoId = `${materia.id}-${req.usuario.id}`;
    }
    
    const actualizada = await prisma.materia.update({
      where: { id:materia.id },
      data: { 
        nombre, 
        descripcion, 
        semestre, 
        color,
        esGrupo: esGrupo !== undefined ? !!esGrupo : materia.esGrupo,
        grupoId: esGrupo ? grupoId : null,
        propietarioId: esGrupo ? req.usuario.id : null
      },
      include: { miembros: true }
    });
    return ok(res, actualizada);
  } catch(e) { 
    console.error('Error actualizando materia:', e);
    return err(res,'Error al actualizar materia.',500); 
  }
}

async function compartir(req, res) {
  try {
    const { emails } = req.body;
    const materiaId = Number(req.params.id);
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return err(res, 'Debes proporcionar al menos un email');
    }
    
    const materia = await prisma.materia.findFirst({
      where: { id: materiaId, usuarioId: req.usuario.id }
    });
    
    if (!materia) return err(res, 'Materia no encontrada', 404);
    if (!materia.esGrupo) return err(res, 'Solo puedes compartir materias de grupo', 400);

    const emailsLimpios = [...new Set(emails.map(e => e.trim().toLowerCase()).filter(Boolean))];

    // No invitarse a sí mismo
    const emailsValidos = emailsLimpios.filter(e => e !== req.usuario.email.toLowerCase());

    // Evitar invitaciones duplicadas (ya invitado o ya miembro de esta materia)
    const existentes = await prisma.miembroGrupo.findMany({
      where: { materiaId, email: { in: emailsValidos } },
    });
    const emailsExistentes = new Set(existentes.map(m => m.email.toLowerCase()));
    const emailsNuevos = emailsValidos.filter(e => !emailsExistentes.has(e));

    const miembros = await Promise.all(
      emailsNuevos.map(email =>
        prisma.miembroGrupo.create({
          data: {
            materiaId,
            usuarioId: req.usuario.id,
            email,
            aceptado: false
          }
        })
      )
    );

    let mensaje = `Materia compartida con ${miembros.length} compañero(s).`;
    if (emailsExistentes.size > 0) {
      mensaje += ` ${emailsExistentes.size} ya tenía(n) invitación previa.`;
    }

    return ok(res, {
      mensaje,
      miembros,
      grupoId: materia.grupoId,
    });
  } catch(e) {
    console.error('Error compartiendo materia:', e);
    return err(res, 'Error al compartir materia', 500);
  }
}

async function buscarGrupo(req, res) {
  try {
    const { grupoId } = req.params;
    
    const materia = await prisma.materia.findFirst({
      where: { 
        grupoId: grupoId,
        esGrupo: true,
        eliminada: false
      },
      include: { 
        miembros: true,
        usuario: { select: { nombre: true, email: true } }
      }
    });
    
    if (!materia) return err(res, 'Grupo no encontrado', 404);
    
    return ok(res, materia);
  } catch(e) {
    console.error('Error buscando grupo:', e);
    return err(res, 'Error al buscar grupo', 500);
  }
}

async function unirsaGrupo(req, res) {
  try {
    const { grupoId } = req.body;

    const materia = await prisma.materia.findFirst({
      where: {
        grupoId: grupoId,
        esGrupo: true,
        eliminada: false
      }
    });

    if (!materia) return err(res, 'Grupo no encontrado', 404);
    if (materia.usuarioId === req.usuario.id) {
      return err(res, 'Ya eres el creador de este grupo.', 400);
    }

    const existente = await prisma.miembroGrupo.findFirst({
      where: { materiaId: materia.id, email: req.usuario.email },
    });

    if (existente) {
      if (existente.aceptado) {
        return err(res, 'Ya eres miembro de este grupo.', 400);
      }
      // Tenía una invitación pendiente por email: la aceptamos directamente
      const actualizado = await prisma.miembroGrupo.update({
        where: { id: existente.id },
        data: { aceptado: true, usuarioId: req.usuario.id },
      });
      return ok(res, { mensaje: 'Te uniste al grupo', miembro: actualizado }, 201);
    }

    // Crear miembro en el grupo
    const miembro = await prisma.miembroGrupo.create({
      data: {
        materiaId: materia.id,
        usuarioId: req.usuario.id,
        email: req.usuario.email,
        aceptado: true
      }
    });

    return ok(res, { mensaje: 'Te uniste al grupo', miembro }, 201);
  } catch(e) {
    console.error('Error uniéndose al grupo:', e);
    return err(res, 'Error al unirse al grupo', 500);
  }
}

async function salirDeGrupo(req, res) {
  try {
    const materiaId = Number(req.params.id);

    const materia = await prisma.materia.findFirst({
      where: { id: materiaId, esGrupo: true, eliminada: false },
    });
    if (!materia) return err(res, 'Materia no encontrada.', 404);

    if (materia.usuarioId === req.usuario.id) {
      return err(res, 'El creador no puede salir de su propio grupo. Puedes eliminar la materia si ya no la necesitas.', 400);
    }

    const miembro = await prisma.miembroGrupo.findFirst({
      where: { materiaId, email: req.usuario.email, aceptado: true },
    });
    if (!miembro) return err(res, 'No eres miembro de este grupo.', 404);

    // Solo se borra la membresía del que sale; la materia y los demás
    // miembros quedan intactos (igual que salir de un grupo de WhatsApp).
    await prisma.miembroGrupo.delete({ where: { id: miembro.id } });

    return ok(res, { mensaje: 'Saliste del grupo.' });
  } catch(e) {
    console.error('Error al salir del grupo:', e);
    return err(res, 'Error al salir del grupo.', 500);
  }
}

async function archivar(req, res) {
  try {
    const { archivada } = req.body;
    const materia = await prisma.materia.findFirst({ where:{ id:Number(req.params.id), usuarioId:req.usuario.id } });
    if (!materia) return err(res,'Materia no encontrada.',404);
    const actualizada = await prisma.materia.update({ where:{id:materia.id}, data:{ archivada:!!archivada } });
    return ok(res, actualizada);
  } catch(e) { return err(res,'Error al archivar materia.',500); }
}

async function eliminar(req, res) {
  try {
    const materia = await prisma.materia.findFirst({ where:{ id:Number(req.params.id), usuarioId:req.usuario.id } });
    if (!materia) return err(res,'Materia no encontrada.',404);
    
    const permanente = req.query.permanente === 'true';
    if (permanente) {
      await prisma.materia.delete({ where:{ id:materia.id } });
      return ok(res,{ mensaje:'Materia eliminada definitivamente.' });
    }
    
    await prisma.materia.update({
      where: { id: materia.id },
      data: { eliminada: true, deletedAt: new Date() },
    });
    return ok(res,{ mensaje:'Materia enviada a la papelera.' });
  } catch(e) { return err(res,'Error al eliminar materia.',500); }
}

async function restaurar(req, res) {
  try {
    const materia = await prisma.materia.findFirst({
      where: { id: Number(req.params.id), usuarioId: req.usuario.id, eliminada: true },
    });
    if (!materia) return err(res,'Materia no encontrada en papelera.',404);
    const restaurada = await prisma.materia.update({
      where: { id: materia.id },
      data: { eliminada: false, deletedAt: null },
    });
    return ok(res, restaurada);
  } catch(e) { return err(res,'Error al restaurar materia.',500); }
}

async function listarEliminadas(req, res) {
  try {
    const materias = await prisma.materia.findMany({
      where: { usuarioId:req.usuario.id, eliminada:true },
      include: { _count:{ select:{ notas:true } } },
      orderBy: { deletedAt:'desc' },
    });
    return ok(res, materias);
  } catch(e) { return err(res,'Error al listar materias eliminadas.',500); }
}

module.exports = { listar, listarArchivadas, detalle, crear, actualizar, compartir, buscarGrupo, unirsaGrupo, salirDeGrupo, archivar, eliminar, restaurar, listarEliminadas, listarInvitaciones, aceptarInvitacion, rechazarInvitacion };