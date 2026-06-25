const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed...');

  // Crear usuario de prueba
  const usuario = await prisma.usuario.create({
    data: {
      nombre: 'Usuario Prueba',
      email: 'prueba@uts.edu.co',
      passwordHash: await bcrypt.hash('password123', 10),
      aceptaTerminos: true,
      emailVerificado: true, // Ya verificado para login inmediato
      activo: true,
      rol: 'ESTUDIANTE',
    },
  });

  console.log('✅ Usuario creado:', usuario.email);

  // Crear racha
  await prisma.racha.create({
    data: { usuarioId: usuario.id },
  });

  // Crear notificación
  await prisma.notificacion.create({
    data: {
      usuarioId: usuario.id,
      activa: true,
      horaEnvio: '08:00',
      frecuencia: 'DIARIA',
    },
  });

  // Crear materias de prueba
  const materia1 = await prisma.materia.create({
    data: {
      usuarioId: usuario.id,
      nombre: 'Cálculo Diferencial',
      semestre: '2026-1',
      color: '0',
      esGrupo: false,
    },
  });

  const materia2 = await prisma.materia.create({
    data: {
      usuarioId: usuario.id,
      nombre: 'Programación Web',
      semestre: '2026-1',
      color: '1',
      esGrupo: false,
    },
  });

  console.log('✅ Materias creadas');

  // Crear notas de prueba
  await prisma.nota.create({
    data: {
      materiaId: materia1.id,
      texto: 'Estudiar derivadas',
    },
  });

  await prisma.nota.create({
    data: {
      materiaId: materia2.id,
      texto: 'Completar proyecto React',
    },
  });

  console.log('✅ Notas creadas');

  // Crear meta
  await prisma.meta.create({
    data: {
      usuarioId: usuario.id,
      paginasSemana: 50,
    },
  });

  console.log('✅ Meta creada');

  console.log('\n🎉 Seed completado exitosamente!');
  console.log('\n📝 Credenciales de prueba:');
  console.log('   Email: prueba@uts.edu.co');
  console.log('   Contraseña: password123');
  console.log('\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
