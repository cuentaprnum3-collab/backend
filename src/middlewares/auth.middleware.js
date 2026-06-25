const jwt = require('jsonwebtoken');

/**
 * Verifica el token JWT en el header Authorization.
 * Si es válido, agrega req.usuario con { id, email, rol }.
 */
function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: true, mensaje: 'Token no proporcionado.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = payload; // { id, email, rol }
    next();
  } catch {
    return res.status(401).json({ error: true, mensaje: 'Token inválido o expirado. Por favor inicia sesión nuevamente.' });
  }
}

/**
 * Restringe el acceso solo a usuarios con rol ADMIN.
 * Debe usarse después de verificarToken.
 */
function soloAdmin(req, res, next) {
  if (req.usuario?.rol !== 'ADMIN') {
    return res.status(403).json({ error: true, mensaje: 'Acceso restringido a administradores.' });
  }
  next();
}

module.exports = { verificarToken, soloAdmin };
