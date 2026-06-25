const r = require("express").Router();
const c = require("../controllers/materias.controller");
const { verificarToken } = require("../middlewares/auth.middleware");

r.use(verificarToken);

r.get("/", c.listar);
r.get("/archivadas", c.listarArchivadas);
r.get("/eliminadas/lista", c.listarEliminadas);

// Rutas de grupo deben ir ANTES de :id
r.get("/grupo/:grupoId", c.buscarGrupo);
r.post("/grupo/unirse", c.unirsaGrupo);
r.get("/invitaciones", c.listarInvitaciones);
r.post("/invitaciones/:miembroId/aceptar", c.aceptarInvitacion);
r.post("/invitaciones/:miembroId/rechazar", c.rechazarInvitacion);

r.get("/:id", c.detalle);

r.post("/", c.crear);
r.put("/:id", c.actualizar);
r.post("/:id/compartir", c.compartir);
r.post("/:id/salir", c.salirDeGrupo);

r.patch("/:id/archivar", c.archivar);
r.post("/:id/restaurar", c.restaurar);
r.delete("/:id", c.eliminar);

module.exports = r;