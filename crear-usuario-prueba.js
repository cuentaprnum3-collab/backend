// Ejecutar desde la carpeta backend con: node crear-usuario-prueba.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const EMAIL = 'texting@uts.edu.co';
const PASSWORD = 'clavetexting123';
const NOMBRE = 'Texting';

async function main() {
  const existente = await prisma.usuario.findUnique({ where: { email: EMAIL } });
  if (existente) {
    console.log('Ya existe un usuario con ese correo. No se creó ninguno nuevo.');
    console.log('ID:', existente.id, '| Verificado:', existente.emailVerificado);
    return;
  }

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const usuario = await prisma.usuario.create({
    data: {
      nombre: NOMBRE,
      email: EMAIL,
      passwordHash,
      aceptaTerminos: true,
      emailVerificado: true, // queda verificado de una vez, sin pasar por el correo
    },
  });

  // Mismas filas asociadas que crea el registro normal
  await prisma.racha.create({ data: { usuarioId: usuario.id } });
  await prisma.notificacion.create({
    data: { usuarioId: usuario.id, activa: true, horaEnvio: '08:00', frecuencia: 'DIARIA' },
  });

  console.log('Usuario creado correctamente:');
  console.log('  ID:', usuario.id);
  console.log('  Email:', usuario.email);
  console.log('  Contraseña (en texto plano, solo para que la recuerdes):', PASSWORD);
  console.log('  Verificado:', usuario.emailVerificado);
}

main()
  .catch((e) => console.error('Error creando usuario:', e))
  .finally(() => prisma.$disconnect());
