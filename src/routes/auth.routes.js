const r = require('express').Router();
const c = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

r.post('/registro', c.registro);
r.post('/login', c.login);
r.post('/logout', verificarToken, c.logout);
r.post('/verificar-correo', c.verificarCorreo);
r.post('/reenviar-codigo', c.reenviarCodigo);
r.post('/recuperar', c.recuperar);
r.post('/reset-password', c.resetPassword);
r.get('/perfil', verificarToken, c.perfil);
r.put('/perfil', verificarToken, c.actualizarPerfil);
r.delete('/perfil', verificarToken, c.eliminarCuenta);
r.get('/papelera', verificarToken, c.obtenerPapelera);
r.post('/papelera/limpiar', verificarToken, c.limpiarPapeleraExpirada);

module.exports = r;