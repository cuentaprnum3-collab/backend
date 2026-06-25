const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const logros = [
    { nombre:'Primera sesión',    descripcion:'Registraste tu primera sesión de lectura.',  emoji:'📖', condicion:'sesiones >= 1' },
    { nombre:'Primer libro',      descripcion:'Completaste tu primer libro.',                emoji:'✅', condicion:'librosTerminados >= 1' },
    { nombre:'Racha de 7 días',   descripcion:'Mantuviste una racha de 7 días consecutivos.',emoji:'🔥', condicion:'rachaActual >= 7' },
    { nombre:'Racha de 30 días',  descripcion:'Mantuviste una racha de 30 días.',            emoji:'🏆', condicion:'rachaActual >= 30' },
    { nombre:'10 libros',         descripcion:'Completaste 10 libros.',                      emoji:'📚', condicion:'librosTerminados >= 10' },
    { nombre:'100 notas',         descripcion:'Creaste 100 notas de estudio.',               emoji:'⭐', condicion:'notas >= 100' },
    { nombre:'1000 páginas',      descripcion:'Leíste 1000 páginas en total.',               emoji:'🌟', condicion:'paginasTotales >= 1000' },
    { nombre:'Meta cumplida',     descripcion:'Cumpliste tu meta semanal por primera vez.',  emoji:'🎯', condicion:'metasCumplidas >= 1' },
  ];
  for (const l of logros) {
    await prisma.logro.upsert({ where:{id:logros.indexOf(l)+1}, update:l, create:l });
  }
  console.log('✅ Seed completado: 8 logros creados');
}

main().catch(console.error).finally(()=>prisma.$disconnect());
