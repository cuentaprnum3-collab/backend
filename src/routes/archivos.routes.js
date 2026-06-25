const r = require('express').Router();
const c = require('../controllers/archivos.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

r.use(verificarToken);
r.get('/:id/preview', c.preview);
r.delete('/:id', c.eliminar);

module.exports = r;

