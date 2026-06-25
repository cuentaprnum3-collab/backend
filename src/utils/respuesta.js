const ok  = (res, datos, status = 200) => res.status(status).json({ error: false, datos });
const err = (res, mensaje, status = 400) => res.status(status).json({ error: true, mensaje });
module.exports = { ok, err };
