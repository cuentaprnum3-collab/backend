require('dotenv').config();
const prisma = require('./src/utils/prisma');
const jwt = require('jsonwebtoken');

async function run() {
  try {
    const user = await prisma.usuario.findFirst();
    if (!user) {
      console.log('No hay usuarios en la BD. Crea uno desde la app primero.');
      process.exit(1);
    }

    // Buscar una nota que tenga archivos
    let nota = await prisma.nota.findFirst({ where: { archivos: { some: {} } }, include: { archivos: true } });

    if (!nota) {
      console.log('No se encontró nota con archivos. Creando nota de prueba...');
      // crear materia si no existe
      let materia = await prisma.materia.findFirst({ where: { usuarioId: user.id } });
      if (!materia) {
        materia = await prisma.materia.create({ data: { usuarioId: user.id, nombre: 'Materia prueba' } });
      }
      nota = await prisma.nota.create({ data: { materiaId: materia.id, texto: 'Nota de prueba con archivo' } });
      const archivo = await prisma.archivo.create({ data: { notaId: nota.id, url: '/uploads/test-file', publicId: 'test-file', nombreOriginal: 'test-file.txt', tipo: 'text/plain' } });
      nota = await prisma.nota.findUnique({ where: { id: nota.id }, include: { archivos: true } });
      console.log('Nota creada con id=', nota.id);
    } else {
      console.log('Encontrada nota con id=', nota.id, 'archivos=', nota.archivos.length);
    }

    const token = jwt.sign({ id: user.id, email: user.email, rol: user.rol }, process.env.JWT_SECRET || 'cambia_esto_por_un_secreto', { expiresIn: '1h' });

    const url = `http://localhost:3000/api/v1/notas/${nota.id}`;
    console.log('Llamando DELETE', url);
    const resp = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    const json = await resp.json();
    console.log('HTTP', resp.status, json);
    process.exit(0);
  } catch (e) {
    console.error('Error en test-delete:', e);
    process.exit(1);
  }
}

run();
