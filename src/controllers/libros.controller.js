const prisma = require('../utils/prisma');
const { ok, err } = require('../utils/respuesta');

const progreso = (l) => ({ ...l, progresoPorcentaje: l.totalPaginas > 0 ? Math.round((l.paginasLeidas / l.totalPaginas) * 100 * 10) / 10 : 0 });

async function listar(req, res) {
  try {
    const { estado, tipo, eliminados } = req.query;
    const where = { usuarioId: req.usuario.id };
    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;
    if (eliminados !== 'true') where.eliminada = false;

    const libros = await prisma.libro.findMany({ where, orderBy: { actualizadoEn: 'desc' } });
    return ok(res, libros.map(progreso));
  } catch (e) {
    console.error(e);
    return err(res, 'Error al listar libros.', 500);
  }
}

async function detalle(req, res) {
  try {
    const eliminadas = req.query.eliminados === 'true';
    const libro = await prisma.libro.findFirst({
      where: { id: Number(req.params.id), usuarioId: req.usuario.id, eliminada: eliminadas ? undefined : false },
      include: { sesiones: { orderBy: { fecha: 'desc' } } },
    });
    if (!libro) return err(res, 'Libro no encontrado.', 404);
    return ok(res, progreso(libro));
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener libro.', 500);
  }
}

const TIPOS_LIBRO_VALIDOS = ['PDF', 'EPUB', 'FISICO', 'OTRO'];

async function crear(req, res) {
  try {
    const { titulo, autor, tipo, totalPaginas, portadaUrl, estado } = req.body;
    if (!titulo || !totalPaginas) return err(res, 'Título y total de páginas son obligatorios.');
    if (Number(totalPaginas) < 1) return err(res, 'Total de páginas debe ser mayor a 0.');
    const tipoFinal = tipo || 'FISICO';
    if (!TIPOS_LIBRO_VALIDOS.includes(tipoFinal)) {
      return err(res, `Tipo de libro inválido. Debe ser uno de: ${TIPOS_LIBRO_VALIDOS.join(', ')}.`);
    }
    const libro = await prisma.libro.create({
      data: { usuarioId: req.usuario.id, titulo, autor, tipo: tipoFinal, totalPaginas: Number(totalPaginas), portadaUrl, estado: estado || 'PENDIENTE' },
    });
    return ok(res, progreso(libro), 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al crear libro.', 500);
  }
}

async function actualizar(req, res) {
  try {
    const libro = await prisma.libro.findFirst({ where: { id: Number(req.params.id), usuarioId: req.usuario.id } });
    if (!libro) return err(res, 'Libro no encontrado.', 404);
    const { titulo, autor, tipo, totalPaginas, portadaUrl } = req.body;
    if (tipo && !TIPOS_LIBRO_VALIDOS.includes(tipo)) {
      return err(res, `Tipo de libro inválido. Debe ser uno de: ${TIPOS_LIBRO_VALIDOS.join(', ')}.`);
    }
    const actualizado = await prisma.libro.update({
      where: { id: libro.id },
      data: { titulo, autor, tipo, totalPaginas: totalPaginas ? Number(totalPaginas) : undefined, portadaUrl },
    });
    return ok(res, progreso(actualizado));
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar libro.', 500);
  }
}

async function cambiarEstado(req, res) {
  try {
    const { estado } = req.body;
    const estadosValidos = ['PENDIENTE', 'LEYENDO', 'TERMINADO'];
    if (!estadosValidos.includes(estado)) return err(res, 'Estado inválido.');
    const libro = await prisma.libro.findFirst({ where: { id: Number(req.params.id), usuarioId: req.usuario.id } });
    if (!libro) return err(res, 'Libro no encontrado.', 404);

    const data = { estado };
    const reiniciarLectura = libro.estado === 'TERMINADO' && estado === 'LEYENDO';
    if (estado === 'PENDIENTE') {
      data.paginasLeidas = 0;
    } else if (estado === 'LEYENDO' && libro.paginasLeidas >= libro.totalPaginas) {
      data.paginasLeidas = 0;
    } else if (estado === 'TERMINADO') {
      if (libro.paginasLeidas < libro.totalPaginas) {
        const paginasRestantes = libro.totalPaginas - libro.paginasLeidas;
        if (paginasRestantes > 0) {
          await prisma.sesion.create({
            data: {
              libroId: libro.id,
              paginaInicio: libro.paginasLeidas,
              paginaFin: libro.totalPaginas,
              paginasLeidas: paginasRestantes,
              fecha: new Date(),
            },
          });
        }
      }
      data.paginasLeidas = libro.totalPaginas;
    }

    if (reiniciarLectura) {
      await prisma.sesion.deleteMany({ where: { libroId: libro.id } });
    }

    const actualizado = await prisma.libro.update({ where: { id: libro.id }, data });
    return ok(res, progreso(actualizado));
  } catch (e) {
    console.error(e);
    return err(res, 'Error al cambiar estado.', 500);
  }
}

async function eliminar(req, res) {
  try {
    const libro = await prisma.libro.findFirst({ where: { id: Number(req.params.id), usuarioId: req.usuario.id } });
    if (!libro) return err(res, 'Libro no encontrado.', 404);

    const permanente = req.query.permanente === 'true';
    if (permanente) {
      await prisma.libro.delete({ where: { id: libro.id } });
      return ok(res, { mensaje: 'Libro eliminado definitivamente.' });
    }

    const actualizado = await prisma.libro.update({
      where: { id: libro.id },
      data: { eliminada: true, deletedAt: new Date() },
    });
    return ok(res, progreso(actualizado));
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar libro.', 500);
  }
}

async function restaurar(req, res) {
  try {
    const libro = await prisma.libro.findFirst({ where: { id: Number(req.params.id), usuarioId: req.usuario.id } });
    if (!libro) return err(res, 'Libro no encontrado.', 404);
    if (!libro.eliminada) return err(res, 'El libro no está en la papelera.', 400);

    const restaurado = await prisma.libro.update({
      where: { id: libro.id },
      data: { eliminada: false, deletedAt: null },
    });
    return ok(res, progreso(restaurado));
  } catch (e) {
    console.error(e);
    return err(res, 'Error al restaurar libro.', 500);
  }
}

module.exports = { listar, detalle, crear, actualizar, cambiarEstado, eliminar, restaurar };