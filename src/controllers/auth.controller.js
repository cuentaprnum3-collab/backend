const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../utils/prisma');
const { ok, err } = require('../utils/respuesta');
const { sendEmail, formatVerificationEmail, formatRecoveryEmail } = require('../utils/email');

const DOMINIOS = ['uts.edu.co', 'correo.uts.edu.co'];
const domOk = (email) => DOMINIOS.includes(String(email || '').split('@')[1]);
const mkToken = (u) => jwt.sign({ id: u.id, email: u.email, rol: u.rol }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
const usuarioPublico = (u) => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, emailVerificado: !!u.emailVerificado });

function generarCodigo(longitud = 6) {
  const min = 10 ** (longitud - 1);
  const max = 10 ** longitud - 1;
  return String(Math.floor(Math.random() * (max - min + 1)) + min);
}

async function registro(req, res) {
  try {
    const { nombre, email, password, aceptaTerminos } = req.body;
    if (!nombre || !email || !password) return err(res, 'Nombre, email y contraseña son obligatorios.');
    if (!aceptaTerminos) return err(res, 'Debes aceptar los términos y condiciones.');
    if (!domOk(email)) return err(res, 'El correo debe pertenecer al dominio @uts.edu.co o @correo.uts.edu.co.');
    if (password.length < 8) return err(res, 'La contraseña debe tener al menos 8 caracteres.');
    if (await prisma.usuario.findUnique({ where: { email } })) return err(res, 'Ya existe una cuenta con ese correo.', 409);

    const passwordHash = await bcrypt.hash(password, 10);
    const codigo = generarCodigo(6);
    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        email,
        passwordHash,
        aceptaTerminos,
        emailVerificado: false,
        verificacionCodigo: codigo,
        verificacionExpira: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await prisma.racha.create({ data: { usuarioId: usuario.id } });
    await prisma.notificacion.create({ data: { usuarioId: usuario.id, activa: true, horaEnvio: '08:00', frecuencia: 'DIARIA' } });

    let emailEnviado = true;
    let errorDev;
    try {
      const emailData = formatVerificationEmail({ nombre, codigo });
      await sendEmail({ to: email, subject: emailData.subject, text: emailData.text, html: emailData.html });
    } catch (mailError) {
      emailEnviado = false;
      errorDev = mailError.message || String(mailError);
      console.error('Error enviando correo de verificación:', errorDev);
    }

    return ok(res, {
      usuario: usuarioPublico(usuario),
      emailEnviado,
      codigoDev: process.env.NODE_ENV !== 'production' ? codigo : undefined,
      errorDev: process.env.NODE_ENV !== 'production' ? errorDev : undefined,
      mensaje: emailEnviado
        ? 'Cuenta creada. Por favor revisa tu correo para verificar tu cuenta antes de iniciar sesión.'
        : 'Cuenta creada, pero no se pudo enviar el correo de verificación. Contacta al administrador o revisa la configuración de correo.',
    }, 201);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al registrar.', 500);
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) return err(res, 'Email y contraseña son obligatorios.');
    const u = await prisma.usuario.findUnique({ where: { email } });
    if (!u) return err(res, 'Credenciales incorrectas.', 401);
    if (!u.activo) return err(res, 'Cuenta desactivada. Contacta al administrador.', 403);
    if (!u.emailVerificado) return err(res, 'Debes verificar tu correo antes de iniciar sesión.', 403);
    if (!(await bcrypt.compare(password, u.passwordHash))) return err(res, 'Credenciales incorrectas.', 401);
    return ok(res, { token: mkToken(u), usuario: usuarioPublico(u) });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al iniciar sesión.', 500);
  }
}

async function logout(_req, res) {
  return ok(res, { mensaje: 'Sesión cerrada.' });
}

async function perfil(req, res) {
  try {
    const u = await prisma.usuario.findUnique({
      where: { id: req.usuario.id },
      select: { id: true, nombre: true, email: true, rol: true, creadoEn: true, emailVerificado: true },
    });
    if (!u) return err(res, 'Usuario no encontrado.', 404);
    return ok(res, u);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener perfil.', 500);
  }
}

async function actualizarPerfil(req, res) {
  try {
    const { nombre, passwordActual, nuevaPassword } = req.body;
    const data = {};
    if (nombre) data.nombre = nombre;
    if (nuevaPassword) {
      if (!passwordActual) return err(res, 'Debes proporcionar tu contraseña actual.');
      const u = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
      if (!u) return err(res, 'Usuario no encontrado.', 404);
      if (!(await bcrypt.compare(passwordActual, u.passwordHash))) return err(res, 'Contraseña actual incorrecta.');
      if (nuevaPassword.length < 8) return err(res, 'La nueva contraseña debe tener al menos 8 caracteres.');
      data.passwordHash = await bcrypt.hash(nuevaPassword, 10);
    }

    const actualizado = await prisma.usuario.update({
      where: { id: req.usuario.id },
      data,
      select: { id: true, nombre: true, email: true, rol: true, emailVerificado: true },
    });
    return ok(res, actualizado);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al actualizar perfil.', 500);
  }
}

async function verificarCorreo(req, res) {
  try {
    const { email, codigo } = req.body;
    if (!email || !codigo) return err(res, 'Email y código de verificación son obligatorios.');
    const u = await prisma.usuario.findUnique({ where: { email } });
    if (!u) return err(res, 'Usuario no encontrado.', 404);
    if (u.emailVerificado) return ok(res, { mensaje: 'El correo ya está verificado.' });
    if (!u.verificacionCodigo || !u.verificacionExpira) return err(res, 'No existe un código de verificación válido.', 400);
    if (u.verificacionCodigo !== String(codigo).trim()) return err(res, 'Código de verificación incorrecto.', 400);
    if (u.verificacionExpira < new Date()) return err(res, 'El código de verificación ha expirado.', 400);

    await prisma.usuario.update({
      where: { id: u.id },
      data: {
        emailVerificado: true,
        verificacionCodigo: null,
        verificacionExpira: null,
      },
    });

    return ok(res, { mensaje: 'Correo verificado correctamente. Ya puedes iniciar sesión.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al verificar correo.', 500);
  }
}

async function reenviarCodigo(req, res) {
  try {
    const { email } = req.body;
    if (!email) return err(res, 'El email es obligatorio.');
    const u = await prisma.usuario.findUnique({ where: { email } });
    if (!u) return err(res, 'Usuario no encontrado.', 404);
    if (u.emailVerificado) return ok(res, { mensaje: 'El correo ya está verificado.' });

    const codigo = generarCodigo(6);
    await prisma.usuario.update({
      where: { id: u.id },
      data: { verificacionCodigo: codigo, verificacionExpira: new Date(Date.now() + 10 * 60 * 1000) },
    });

    let emailEnviado = true;
    let errorDev;
    try {
      const emailData = formatVerificationEmail({ nombre: u.nombre, codigo });
      await sendEmail({ to: email, subject: emailData.subject, text: emailData.text, html: emailData.html });
    } catch (mailError) {
      emailEnviado = false;
      errorDev = mailError.message || String(mailError);
      console.error('Error reenviando código de verificación:', errorDev);
    }

    return ok(res, {
      emailEnviado,
      codigoDev: process.env.NODE_ENV !== 'production' ? codigo : undefined,
      errorDev: process.env.NODE_ENV !== 'production' ? errorDev : undefined,
      mensaje: emailEnviado
        ? 'Código reenviado. Revisa tu correo.'
        : 'No se pudo enviar el correo. Contacta al administrador o revisa la configuración de correo.',
    });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al reenviar código.', 500);
  }
}

async function recuperar(req, res) {
  try {
    const { email } = req.body;
    if (!email) return err(res, 'El email es obligatorio.');
    const u = await prisma.usuario.findUnique({ where: { email } });
    let emailEnviado = false;
    let codigoDev;
    let errorDev;
    if (u) {
      const codigo = generarCodigo(6);
      await prisma.usuario.update({
        where: { id: u.id },
        data: { resetToken: codigo, resetTokenExpira: new Date(Date.now() + 60 * 60 * 1000) },
      });
      codigoDev = process.env.NODE_ENV !== 'production' ? codigo : undefined;
      try {
        const emailData = formatRecoveryEmail({ nombre: u.nombre, codigo });
        await sendEmail({ to: email, subject: emailData.subject, text: emailData.text, html: emailData.html });
        emailEnviado = true;
      } catch (mailError) {
        errorDev = mailError.message || String(mailError);
        console.error('Error enviando correo de recuperación:', errorDev);
      }
    }
    return ok(res, {
      mensaje: 'Si el correo existe, recibirás el código de recuperación.',
      emailEnviado,
      codigoDev,
      errorDev: process.env.NODE_ENV !== 'production' ? errorDev : undefined,
    });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al procesar.', 500);
  }
}

async function resetPassword(req, res) {
  try {
    const { email, codigo, nuevaPassword } = req.body;
    if (!email || !codigo || !nuevaPassword) return err(res, 'Email, código y nueva contraseña son obligatorios.');
    if (nuevaPassword.length < 8) return err(res, 'La contraseña debe tener al menos 8 caracteres.');
    const u = await prisma.usuario.findFirst({
      where: {
        email,
        resetToken: String(codigo).trim(),
        resetTokenExpira: { gt: new Date() },
      },
    });
    if (!u) return err(res, 'Código inválido o expirado.', 400);

    await prisma.usuario.update({
      where: { id: u.id },
      data: {
        passwordHash: await bcrypt.hash(nuevaPassword, 10),
        resetToken: null,
        resetTokenExpira: null,
      },
    });
    return ok(res, { mensaje: 'Contraseña restablecida correctamente.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al restablecer.', 500);
  }
}

async function eliminarCuenta(req, res) {
  try {
    const usuario = await prisma.usuario.findUnique({ where: { id: req.usuario.id } });
    if (!usuario) return err(res, 'Usuario no encontrado.', 404);
    await prisma.usuario.delete({ where: { id: usuario.id } });
    return ok(res, { mensaje: 'Cuenta eliminada correctamente.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al eliminar la cuenta.', 500);
  }
}

async function obtenerPapelera(req, res) {
  try {
    const usuarioId = req.usuario.id;
    
    // Obtener elementos eliminados hace menos de 72 horas
    const hace72horas = new Date(Date.now() - 72 * 60 * 60 * 1000);
    
    const [libros, notas, materias] = await Promise.all([
      prisma.libro.findMany({
        where: {
          usuarioId,
          eliminada: true,
          deletedAt: { gte: hace72horas }
        },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.nota.findMany({
        where: {
          eliminada: true,
          deletedAt: { gte: hace72horas },
          materia: { usuarioId }
        },
        include: { materia: { select: { nombre: true } }, archivos: true },
        orderBy: { deletedAt: 'desc' }
      }),
      prisma.materia.findMany({
        where: {
          usuarioId,
          eliminada: true,
          deletedAt: { gte: hace72horas }
        },
        orderBy: { deletedAt: 'desc' }
      })
    ]);
    
    // Calcular tiempo restante para cada elemento
    const calcularTiempoRestante = (deletedAt) => {
      const ahora = new Date();
      const tiempoTranscurrido = ahora - new Date(deletedAt);
      const tiempoRestante = 72 * 60 * 60 * 1000 - tiempoTranscurrido;
      return Math.max(0, Math.ceil(tiempoRestante / 1000)); // segundos
    };
    
    const papelera = {
      libros: libros.map(l => ({
        ...l,
        tipo: 'libro',
        tiempoRestante: calcularTiempoRestante(l.deletedAt)
      })),
      notas: notas.map(n => ({
        ...n,
        tipo: 'nota',
        tiempoRestante: calcularTiempoRestante(n.deletedAt)
      })),
      materias: materias.map(m => ({
        ...m,
        tipo: 'materia',
        tiempoRestante: calcularTiempoRestante(m.deletedAt)
      }))
    };
    
    return ok(res, papelera);
  } catch (e) {
    console.error(e);
    return err(res, 'Error al obtener papelera.', 500);
  }
}

async function limpiarPapeleraExpirada(req, res) {
  try {
    const hace72horas = new Date(Date.now() - 72 * 60 * 60 * 1000);
    
    // Eliminar permanentemente elementos expirados
    await Promise.all([
      prisma.libro.deleteMany({
        where: {
          usuarioId: req.usuario.id,
          eliminada: true,
          deletedAt: { lt: hace72horas }
        }
      }),
      prisma.nota.deleteMany({
        where: {
          eliminada: true,
          deletedAt: { lt: hace72horas },
          materia: { usuarioId: req.usuario.id }
        }
      }),
      prisma.materia.deleteMany({
        where: {
          usuarioId: req.usuario.id,
          eliminada: true,
          deletedAt: { lt: hace72horas }
        }
      })
    ]);
    
    return ok(res, { mensaje: 'Papelera limpiada.' });
  } catch (e) {
    console.error(e);
    return err(res, 'Error al limpiar papelera.', 500);
  }
}

module.exports = {
  registro,
  login,
  logout,
  perfil,
  actualizarPerfil,
  verificarCorreo,
  reenviarCodigo,
  recuperar,
  resetPassword,
  eliminarCuenta,
  obtenerPapelera,
  limpiarPapeleraExpirada,
};