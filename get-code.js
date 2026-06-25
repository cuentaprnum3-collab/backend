const prisma = require('./src/utils/prisma');

async function getCode() {
  try {
    const user = await prisma.usuario.findUnique({
      where: { email: 'juan.perez@uts.edu.co' },
      select: {
        id: true,
        nombre: true,
        email: true,
        verificacionCodigo: true,
        verificacionExpira: true,
        emailVerificado: true,
      },
    });

    if (!user) {
      console.log('Usuario no encontrado');
      return;
    }

    console.log('=== USUARIO ENCONTRADO ===');
    console.log(`ID: ${user.id}`);
    console.log(`Nombre: ${user.nombre}`);
    console.log(`Email: ${user.email}`);
    console.log(`Código de Verificación: ${user.verificacionCodigo}`);
    console.log(`Verificación Expira: ${user.verificacionExpira}`);
    console.log(`Email Verificado: ${user.emailVerificado}`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

getCode();
