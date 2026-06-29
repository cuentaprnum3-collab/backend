require('dotenv').config();
const path    = require('path');
const express = require('express');
const cors    = require('cors');
const morgan  = require('morgan');

const app = express();

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ── Rutas /api/v1 ─────────────────────────────────────────────────────────────
app.use('/api/v1/auth',          require('./routes/auth.routes'));
app.use('/api/v1/materias',      require('./routes/materias.routes'));
app.use('/api/v1/notas',         require('./routes/notas.routes'));
app.use('/api/v1/archivos',      require('./routes/archivos.routes'));
app.use('/api/v1/libros',        require('./routes/libros.routes'));
app.use('/api/v1/sesiones',      require('./routes/sesiones.routes'));
app.use('/api/v1/metas',         require('./routes/metas.routes'));
app.use('/api/v1/stats',         require('./routes/stats.routes'));
app.use('/api/v1/notificaciones',require('./routes/notificaciones.routes'));
app.use('/api/v1/logros',        require('./routes/logros.routes'));
app.use('/api/v1/admin',         require('./routes/admin.routes'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/v1/health', (_req, res) => {
  res.json({ error: false, mensaje: 'ReadTrack UTS API v1.0 — OK' });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: true, mensaje: 'Ruta no encontrada' });
});

// ── Error handler global ──────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: true,
    mensaje: err.message || 'Error interno del servidor',
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 ReadTrack UTS API corriendo en el puerto ${PORT} /api/v1`));
