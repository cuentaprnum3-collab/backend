/**
 * SCRIPT DE FIX - Verificar usuario manualmente
 * 
 * Ejecutar desde la carpeta backend/:
 *   node verificar-usuario.js tu@correo.uts.edu.co
 * 
 * O sin argumento para ver todos los usuarios:
 *   node verificar-usuario.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const emailArg = process.argv[2];

  if (!emailArg) {
    // Listar todos los usuarios con su estado
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nombre: true, email: true, emailVerificado: true, activo: true, creadoEn: true }
    });

    if (usuarios.length === 0) {
      console.log('❌ No hay usuarios en la base de datos.');
      console.log('   Primero regístrate en la app, luego corre: node verificar-usuario.js tu@correo.uts.edu.co');
      return;
    }

    console.log('\n📋 Usuarios en la DB:\n');
    usuarios.forEach(u => {
      const estadoEmail = u.emailVerificado ? '✅ Verificado' : '❌ Sin verificar';
      const estadoCuenta = u.activo ? '🟢 Activa' : '🔴 Inactiva';
      console.log(`  ${u.nombre}`);
      console.log(`    Email:  ${u.email}`);
      console.log(`    Correo: ${estadoEmail}`);
      console.log(`    Cuenta: ${estadoCuenta}`);
      console.log('');
    });

    console.log('💡 Para verificar un correo, corre:');
    console.log('   node verificar-usuario.js email@uts.edu.co\n');
    return;
  }

  // Verificar usuario específico
  const usuario = await prisma.usuario.findUnique({ where: { email: emailArg } });

  if (!usuario) {
    console.log(`❌ No se encontró usuario con email: ${emailArg}`);
    return;
  }

  if (usuario.emailVerificado) {
    console.log(`✅ El usuario ${usuario.nombre} (${emailArg}) ya está verificado.`);
    if (!usuario.activo) {
      console.log('⚠️  Pero la cuenta está INACTIVA. Activando...');
      await prisma.usuario.update({ where: { email: emailArg }, data: { activo: true } });
      console.log('✅ Cuenta activada.');
    }
    return;
  }

  // Verificar el correo
  await prisma.usuario.update({
    where: { email: emailArg },
    data: {
      emailVerificado: true,
      verificacionCodigo: null,
      verificacionExpira: null,
      activo: true,
    }
  });

  console.log(`✅ Usuario verificado exitosamente:`);
  console.log(`   Nombre: ${usuario.nombre}`);
  console.log(`   Email:  ${emailArg}`);
  console.log(`\n🚀 Ya puedes iniciar sesión en la app.`);
}

main()
  .catch(e => { console.error('Error:', e.message); })
  .finally(() => prisma.$disconnect());