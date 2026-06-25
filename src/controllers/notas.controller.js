const fs = require('fs');
const path = require('path');
const prisma = require('../utils/prisma');
const { ok, err } = require('../utils/respuesta');
const { cloudinary, cloudinaryConfigured, uploadsDir } = require('../middlewares/upload.middleware');
const { obtenerMateriaConAcceso } = require('../utils/materiaAcceso');

// Ancla a mediodía UTC para evitar que la fecha se corra un día al pasar de
// hora del servidor (UTC en hosting cloud) a hora local de Colombia (UTC-5).
function parseLocalDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0));
  }
  if (typeof value === 'string') {
    const dateOnlyMatch = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (dateOnlyMatch) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0));
}

function resolveFileUrl(file) {
  if (!file) return null;
  if (cloudinaryConfigured) return file.path;
  return `${process.env.BACKEND_URL || 'http://localhost:3000'}/uploads/${file.filename}`;
}

async function listar(req, res) {
  try {
    const { materiaId, eliminadas } = req.query;
    let where = { eliminada: eliminadas === 'true' ? undefined : false };
    if (materiaId) {
      const materia = await obtenerMateriaConAcceso(materiaId, req.usuario);
      if (!materia) return err(res, 'Materia no encontrada.', 404);
      where.materiaId = Number(materiaId);
    } else {
      const propias = await prisma.materia.findMany({ where: { usuarioId: req.usuario.id }, select: { id: true } });
      const compartidas = await prisma.materia.findMany({
        where: { esGrupo: true, usuarioId: { not: req.usuario.id }, miembros: { some: { email: { equals: req.usuario.email, mode: 'insensitive' }, aceptado: true } } },
        select: { id: true },
      });
      const materiasIds = [...propias, ...compartidas].map((m) => m.id);
      where.materiaId = { in: materiasIds };
    }
    if (where.eliminada === undefined) delete where.eliminada;

    const notas = await prisma.nota.findMany({
      where,
      include: { archivos: true, autor: { select: { id: true, nombre: true } } },
      orderBy: { creadoEn: 'desc' },
    });
    return ok(res, notas);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al listar notas.', 500);
  }
}

async function buscar(req, res) {
  try {
    const { q } = req.query;
    if (!q) return err(res, 'El parámetro q es obligatorio.');
    const propias = await prisma.materia.findMany({ where: { usuarioId: req.usuario.id }, select: { id: true } });
    const compartidas = await prisma.materia.findMany({
      where: { esGrupo: true, usuarioId: { not: req.usuario.id }, miembros: { some: { email: { equals: req.usuario.email, mode: 'insensitive' }, aceptado: true } } },
      select: { id: true },
    });
    const materiasIds = [...propias, ...compartidas].map((m) => m.id);
    const notas = await prisma.nota.findMany({
      where: {
        materiaId: { in: materiasIds },
        texto: { contains: q, mode: 'insensitive' },
        eliminada: false,
      },
      include: { archivos: true, materia: { select: { nombre: true, color: true } } },
      orderBy: { creadoEn: 'desc' },
    });
    return ok(res, notas);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al buscar notas.', 500);
  }
}

async function detalle(req, res) {
  try {
    const eliminadas = req.query.eliminadas === 'true';
    const nota = await prisma.nota.findFirst({
      where: { id: Number(req.params.id), eliminada: eliminadas ? undefined : false },
      include: { archivos: true, autor: { select: { id: true, nombre: true } }, materia: { select: { id: true, nombre: true } } },
    });
    if (!nota) return err(res, 'Nota no encontrada.', 404);
    const materia = await obtenerMateriaConAcceso(nota.materia.id, req.usuario);
    if (!materia) return err(res, 'Nota no encontrada.', 404);
    return ok(res, nota);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener nota.', 500);
  }
}

async function crear(req, res) {
  try {
    console.log('🔍 POST /notas - body:', req.body, '| files:', req.files?.map(f => ({ fieldname: f.fieldname, originalname: f.originalname, mimetype: f.mimetype, size: f.size })));
    const { materiaId, texto, enlace, fechaCumplimiento } = req.body;
    const archivos = req.files || [];
    if (!materiaId) {
      console.log('🔍 400: materiaId faltante');
      return err(res, 'materiaId es obligatorio.');
    }
    if (!texto && !enlace && archivos.length === 0) {
      console.log('🔍 400: sin texto, enlace ni archivos');
      return err(res, 'La nota debe tener al menos texto, enlace o un archivo adjunto.');
    }
    const materia = await obtenerMateriaConAcceso(materiaId, req.usuario);
    if (!materia) {
      console.log('🔍 404: materia no encontrada para materiaId=', materiaId, 'usuario=', req.usuario);
      return err(res, 'Materia no encontrada.', 404);
    }

    const nota = await prisma.nota.create({
      data: {
        materiaId: Number(materiaId),
        autorId: req.usuario.id,
        texto: texto || null,
        enlace: enlace || null,
        fechaCumplimiento: fechaCumplimiento ? parseLocalDate(fechaCumplimiento) : null,
      },
    });

    if (archivos.length > 0) {
      await prisma.archivo.createMany({
        data: archivos.map((archivo) => ({
          notaId: nota.id,
          url: resolveFileUrl(archivo),
          publicId: archivo.filename,
          nombreOriginal: archivo.originalname,
          tipo: archivo.mimetype,
          tamanoBytes: archivo.size,
        })),
      });
    }

    const notaCompleta = await prisma.nota.findUnique({
      where: { id: nota.id },
      include: { archivos: true, autor: { select: { id: true, nombre: true } } },
    });
    return ok(res, notaCompleta, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al crear nota.', 500);
  }
}

async function actualizar(req, res) {
  try {
    const { texto, enlace, fechaCumplimiento } = req.body;
    const nota = await prisma.nota.findFirst({
      where: { id: Number(req.params.id) },
      include: { materia: { select: { id: true } } },
    });
    if (!nota) return err(res, 'Nota no encontrada.', 404);
    const materia = await obtenerMateriaConAcceso(nota.materia.id, req.usuario);
    if (!materia) return err(res, 'Nota no encontrada.', 404);
    const actualizada = await prisma.nota.update({
      where: { id: nota.id },
      data: {
        texto,
        enlace,
        fechaCumplimiento: typeof fechaCumplimiento !== 'undefined' ? (fechaCumplimiento ? parseLocalDate(fechaCumplimiento) : null) : undefined,
      },
      include: { archivos: true },
    });
    return ok(res, actualizada);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar nota.', 500);
  }
}

async function eliminar(req, res) {
  try {
    const nota = await prisma.nota.findFirst({
      where: { id: Number(req.params.id) },
      include: { archivos: true, materia: { select: { id: true } } },
    });
    if (!nota) return err(res, 'Nota no encontrada.', 404);
    const materia = await obtenerMateriaConAcceso(nota.materia.id, req.usuario);
    if (!materia) return err(res, 'Nota no encontrada.', 404);

    const permanente = req.query.permanente === 'true';
    if (permanente) {
      for (const a of nota.archivos) {
        if (cloudinaryConfigured) {
          try {
            await cloudinary.uploader.destroy(a.publicId, { resource_type: 'auto' });
          } catch (destroyErr) {
            console.warn('Error destruyendo en Cloudinary:', destroyErr);
          }
        } else {
          try {
            const localPath = path.join(uploadsDir, a.publicId || '');
            if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
          } catch (innerErr) {
            console.warn('No se pudo eliminar archivo local:', innerErr);
          }
        }
        await prisma.archivo.delete({ where: { id: a.id } });
      }
      await prisma.nota.delete({ where: { id: nota.id } });
      return ok(res, { mensaje: 'Nota eliminada definitivamente.' });
    }

    await prisma.nota.update({
      where: { id: nota.id },
      data: { eliminada: true, deletedAt: new Date() },
    });
    return ok(res, { mensaje: 'Nota enviada a la papelera.' });
  } catch (e) {
    console.error('Error al eliminar nota:', e);
    return err(res, 'Error al eliminar nota.', 500);
  }
}

async function restaurar(req, res) {
  try {
    const nota = await prisma.nota.findFirst({
      where: { id: Number(req.params.id) },
      include: { materia: { select: { id: true } } },
    });
    if (!nota) return err(res, 'Nota no encontrada.', 404);
    const materia = await obtenerMateriaConAcceso(nota.materia.id, req.usuario);
    if (!materia) return err(res, 'Nota no encontrada.', 404);
    if (!nota.eliminada) return err(res, 'La nota no está en la papelera.', 400);

    const restaurada = await prisma.nota.update({
      where: { id: nota.id },
      data: { eliminada: false, deletedAt: null },
      include: { archivos: true },
    });
    return ok(res, restaurada);
  } catch (e) {
    console.error('Error al restaurar nota:', e);
    return err(res, 'Error al restaurar nota.', 500);
  }
}

async function adjuntarArchivo(req, res) {
  try {
    const archivos = req.files || [];
    if (archivos.length === 0) return err(res, 'No se recibió ningún archivo.');
    const nota = await prisma.nota.findFirst({
      where: { id: Number(req.params.id) },
      include: { materia: { select: { id: true } } },
    });
    if (!nota) return err(res, 'Nota no encontrada.', 404);
    const materia = await obtenerMateriaConAcceso(nota.materia.id, req.usuario);
    if (!materia) return err(res, 'Nota no encontrada.', 404);

    await prisma.archivo.createMany({
      data: archivos.map((archivo) => ({
        notaId: nota.id,
        url: resolveFileUrl(archivo),
        publicId: archivo.filename,
        nombreOriginal: archivo.originalname,
        tipo: archivo.mimetype,
        tamanoBytes: archivo.size,
      })),
    });

    const archivosCreados = await prisma.archivo.findMany({
      where: { notaId: nota.id },
      orderBy: { creadoEn: 'desc' },
      take: archivos.length,
    });
    return ok(res, archivosCreados, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al adjuntar archivo.', 500);
  }
}

module.exports = { listar, buscar, detalle, crear, actualizar, eliminar, restaurar, adjuntarArchivo };

