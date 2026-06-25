// Ejecutar desde la carpeta backend con: node ver-usuarios.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const usuarios = await prisma.usuario.findMany({
    select: {
      id: true,
      nombre: true,
      email: true,
      passwordHash: true,
      rol: true,
      emailVerificado: true,
      activo: true,
      creadoEn: true,
    },
    orderBy: { id: 'asc' },
  });

  if (usuarios.length === 0) {
    console.log('No hay usuarios registrados.');
    return;
  }

  for (const u of usuarios) {
    console.log('----------------------------------------');
    console.log('ID:', u.id);
    console.log('Nombre:', u.nombre);
    console.log('Email:', u.email);
    console.log('Hash contraseña:', u.passwordHash);
    console.log('Rol:', u.rol);
    console.log('Verificado:', u.emailVerificado);
    console.log('Activo:', u.activo);
    console.log('Creado:', u.creadoEn);
  }
  console.log('----------------------------------------');
  console.log('Total usuarios:', usuarios.length);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
