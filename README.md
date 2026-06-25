# ReadTrack UTS — Backend API REST

**Capa 2 del sistema.** Servidor Node.js + Express que expone 47 endpoints sobre `/api/v1/`.

## Stack
- Node.js 18+ / Express 4
- Prisma ORM 5 → PostgreSQL 14
- JWT + bcrypt (autenticación)
- Cloudinary (archivos multimedia)
- Nodemailer + Gmail (correos)
- Railway (hosting)

## Estructura
```
backend/
├── prisma/
│   ├── schema.prisma      ← 10 tablas del DER
│   └── seed.js            ← 8 logros iniciales
├── src/
│   ├── index.js           ← Entry point, middlewares globales
│   ├── controllers/       ← Lógica de negocio por módulo
│   │   ├── auth.controller.js
│   │   ├── materias.controller.js
│   │   ├── notas.controller.js
│   │   ├── archivos.controller.js
│   │   ├── libros.controller.js
│   │   ├── sesiones.controller.js
│   │   ├── metas.controller.js
│   │   ├── stats.controller.js
│   │   ├── notificaciones.controller.js
│   │   ├── logros.controller.js
│   │   └── admin.controller.js
│   ├── routes/            ← Definición de rutas /api/v1/
│   ├── middlewares/
│   │   ├── auth.middleware.js    ← verificarToken, soloAdmin
│   │   └── upload.middleware.js  ← Multer + Cloudinary
│   └── utils/
│       ├── prisma.js      ← Singleton PrismaClient
│       ├── respuesta.js   ← ok() / err() estándar
│       └── racha.js       ← Lógica de racha de lectura
└── .env.example
```

## Puesta en marcha
```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# (editar .env con tus credenciales)

# 3. Aplicar migraciones
npx prisma migrate dev --name init

# 4. Sembrar logros iniciales
npm run db:seed

# 5. Iniciar en desarrollo
npm run dev
# → http://localhost:3000/api/v1
```

## Endpoints (resumen)
| Módulo         | Endpoints |
|----------------|-----------|
| Auth           | POST registro, login, logout, recuperar, reset-password · GET/PUT perfil |
| Materias       | GET lista/archivadas/detalle · POST crear · PUT actualizar · PATCH archivar · DELETE |
| Notas          | GET lista/buscar/detalle · POST crear · PUT actualizar · DELETE · POST adjuntar archivo |
| Archivos       | DELETE /:id |
| Libros         | GET lista/detalle · POST crear · PUT actualizar · PATCH estado · DELETE |
| Sesiones       | GET lista · POST crear · PUT actualizar · DELETE |
| Metas          | GET activa/historial · POST crear |
| Estadísticas   | GET resumen/actividad-semanal/frecuencia/libros-estado/racha |
| Notificaciones | GET · PUT |
| Logros         | GET |
| Admin          | GET usuarios/stats-globales · PATCH usuario estado |

## Formato de respuesta
```json
// Éxito
{ "error": false, "datos": { ... } }

// Error
{ "error": true, "mensaje": "Descripción del error" }
```
