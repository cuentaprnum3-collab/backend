const r = require('express').Router();
const c = require('../controllers/notas.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { upload } = require('../middlewares/upload.middleware');

r.use(verificarToken);
r.get('/', c.listar);
r.get('/buscar', c.buscar);
r.get('/:id', c.detalle);
r.post('/', upload.array('archivos', 10), c.crear);
r.put('/:id', c.actualizar);
r.post('/:id/restaurar', c.restaurar);
r.delete('/:id', c.eliminar);
r.post('/:id/archivos', upload.array('archivos', 10), c.adjuntarArchivo);

module.exports = r;

