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

const TIPOS_LIBRO_VALIDOS = ['PDF', 'EPUB', 'FISICO', 'OTRO', 'DIGITAL'];

async function crear(req, res) {
  try {
    const { titulo, autor, tipo, totalPaginas, portadaUrl, estado, paginasLeidas } = req.body;
    if (!titulo || !totalPaginas) return err(res, 'Título y total de páginas son obligatorios.');
    if (Number(totalPaginas) < 1) return err(res, 'Total de páginas debe ser mayor a 0.');
    const tipoFinal = tipo || 'FISICO';
    if (!TIPOS_LIBRO_VALIDOS.includes(tipoFinal)) {
      return err(res, `Tipo de libro inválido. Debe ser uno de: ${TIPOS_LIBRO_VALIDOS.join(', ')}.`);
    }
    let estadoFinal = estado || 'PENDIENTE';
    const totalPaginasNum = Number(totalPaginas);

    // Las paginas leidas al crear dependen del estado: si esta pendiente
    // siempre es 0, si esta terminado siempre es el total, y si esta
    // leyendo se usa el valor que indique el usuario (acotado al total).
    // Si el usuario dice estar "leyendo" pero indica una pagina igual o
    // mayor al total (ej. puso 100 en un libro de 100 paginas), en la
    // practica ya lo termino: se corrige el estado a TERMINADO para que
    // no quede guardado como "Leyendo" con 100% de progreso, algo
    // inconsistente que no deja avanzar bien el resto de la app.
    let paginasLeidasFinal = 0;
    if (estadoFinal === 'TERMINADO') {
      paginasLeidasFinal = totalPaginasNum;
    } else if (estadoFinal === 'LEYENDO') {
      const paginaIndicada = Math.max(0, Number(paginasLeidas) || 0);
      if (paginaIndicada >= totalPaginasNum) {
        estadoFinal = 'TERMINADO';
        paginasLeidasFinal = totalPaginasNum;
      } else {
        paginasLeidasFinal = paginaIndicada;
      }
    }

    const libro = await prisma.libro.create({
      data: { usuarioId: req.usuario.id, titulo, autor, tipo: tipoFinal, totalPaginas: totalPaginasNum, portadaUrl, estado: estadoFinal, paginasLeidas: paginasLeidasFinal },
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
    const { titulo, autor, tipo, totalPaginas, portadaUrl, estado } = req.body;
    if (tipo && !TIPOS_LIBRO_VALIDOS.includes(tipo)) {
      return err(res, `Tipo de libro inválido. Debe ser uno de: ${TIPOS_LIBRO_VALIDOS.join(', ')}.`);
    }
    const estadosValidos = ['PENDIENTE', 'LEYENDO', 'TERMINADO'];
    if (estado && !estadosValidos.includes(estado)) {
      return err(res, 'Estado inválido.');
    }

    let data = { titulo, autor, tipo, totalPaginas: totalPaginas ? Number(totalPaginas) : undefined, portadaUrl };

    if (estado && estado !== libro.estado) {
      const cambioEstado = await calcularCambioEstado(libro, estado);
      data = { ...data, ...cambioEstado };
    }

    const actualizado = await prisma.libro.update({ where: { id: libro.id }, data });
    return ok(res, progreso(actualizado));
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar libro.', 500);
  }
}

// Calcula los campos a actualizar (y efectos secundarios como crear/borrar
// sesiones) al pasar un libro de 'libro.estado' a 'estado'. La usan tanto
// 'actualizar' (Editar libro) como 'cambiarEstado', para que el
// comportamiento sea siempre el mismo sin importar desde dónde se cambie.
async function calcularCambioEstado(libro, estado) {
  const data = { estado };

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

  // Al salir de TERMINADO (reiniciar), se borran las sesiones anteriores.
  // Si no se hiciera esto, la siguiente sesión que se registre recalcularía
  // el progreso tomando en cuenta esas sesiones viejas (que ya llegaban al
  // 100%) y el libro volvería a marcarse como terminado aunque solo se
  // hayan leído unas pocas páginas del nuevo ciclo de lectura.
  if (libro.estado === 'TERMINADO' && estado !== 'TERMINADO') {
    await prisma.sesion.deleteMany({ where: { libroId: libro.id } });
  }

  return data;
}

async function cambiarEstado(req, res) {
  try {
    const { estado } = req.body;
    const estadosValidos = ['PENDIENTE', 'LEYENDO', 'TERMINADO'];
    if (!estadosValidos.includes(estado)) return err(res, 'Estado inválido.');
    const libro = await prisma.libro.findFirst({ where: { id: Number(req.params.id), usuarioId: req.usuario.id } });
    if (!libro) return err(res, 'Libro no encontrado.', 404);

    const data = await calcularCambioEstado(libro, estado);

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