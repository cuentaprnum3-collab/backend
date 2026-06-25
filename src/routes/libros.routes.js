const r = require('express').Router();
const c = require('../controllers/libros.controller');
const { verificarToken } = require('../middlewares/auth.middleware');

r.use(verificarToken);

r.get('/', c.listar);
r.get('/:id', c.detalle);
r.post('/', c.crear);
r.put('/:id', c.actualizar);
r.patch('/:id/estado', c.cambiarEstado);
r.post('/:id/restaurar', c.restaurar);
r.delete('/:id', c.eliminar);

module.exports = r;

