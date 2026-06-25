const fs = require('fs');
const path = require('path');
const { execFileSync, execFile } = require('child_process');
const prisma = require('../utils/prisma');
const { cloudinary, cloudinaryConfigured, uploadsDir } = require('../middlewares/upload.middleware');
const { ok, err } = require('../utils/respuesta');

function getLibreOfficeBinary() {
  const candidates = ['soffice', 'libreoffice'];
  for (const bin of candidates) {
    try {
      execFileSync(bin, ['--version'], { stdio: 'ignore' });
      return bin;
    } catch (_) {
      continue;
    }
  }
  return null;
}

function isOfficeDocument(archivo) {
  if (!archivo) return false;
  const extension = path.extname(archivo.nombreOriginal || archivo.publicId || '').toLowerCase();
  const officeExtensions = ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.pps', '.ppsx'];
  const mime = (archivo.tipo || '').toLowerCase();
  return officeExtensions.includes(extension) || /(wordprocessingml\.document|msword|presentationml\.presentation|ms-powerpoint|spreadsheetml\.sheet|ms-excel)/i.test(mime);
}

function convertOfficeToPdf(sourcePath, outputDir) {
  return new Promise((resolve, reject) => {
    const libreOffice = getLibreOfficeBinary();
    if (!libreOffice) return reject(new Error('LibreOffice no está instalado en el servidor.'));
    execFile(libreOffice, ['--headless', '--convert-to', 'pdf', '--outdir', outputDir, sourcePath], { timeout: 120000 }, (error, stdout, stderr) => {
      if (error) return reject(new Error(stderr || stdout || error.message));
      resolve(stdout);
    });
  });
}

async function eliminar(req, res) {
  try {
    const archivo = await prisma.archivo.findFirst({
      where: { id:Number(req.params.id) },
      include: { nota:{ include:{ materia:{ select:{ usuarioId:true } } } } },
    });
    if (!archivo || archivo.nota.materia.usuarioId !== req.usuario.id) return err(res,'Archivo no encontrado.',404);
    console.log(`Eliminando archivo id=${archivo.id} publicId=${archivo.publicId}`);
    if (cloudinaryConfigured) {
      try {
        const resp = await cloudinary.uploader.destroy(archivo.publicId, { resource_type:'auto' });
        console.log('Cloudinary destroy response for', archivo.publicId, resp);
      } catch (destroyErr) {
        console.warn('Error destruyendo en Cloudinary:', destroyErr);
      }
    } else {
      try {
        const localPath = path.join(uploadsDir, archivo.publicId || '');
        console.log('Intentando eliminar archivo local en', localPath);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          console.log('Archivo local eliminado:', localPath);
        } else {
          console.log('Archivo local no existe:', localPath);
        }
      } catch (innerErr) {
        console.warn('No se pudo eliminar archivo local:', innerErr);
      }
    }

    await prisma.archivo.delete({ where:{ id:archivo.id } });
    console.log('Registro de archivo eliminado id=', archivo.id);
    return ok(res,{ mensaje:'Archivo eliminado.' });
  } catch(e) {
    console.error('Error al eliminar archivo:', e);
    return err(res,'Error al eliminar archivo.',500);
  }
}

async function preview(req, res) {
  try {
    const archivo = await prisma.archivo.findFirst({
      where: { id:Number(req.params.id) },
      include: { nota:{ include:{ materia:{ select:{ usuarioId:true } } } } },
    });
    if (!archivo || archivo.nota.materia.usuarioId !== req.usuario.id) return err(res,'Archivo no encontrado.',404);

    if (archivo.tipo === 'application/pdf') {
      if (cloudinaryConfigured) return res.redirect(archivo.url);
      const localPath = path.join(uploadsDir, archivo.publicId || '');
      if (!fs.existsSync(localPath)) return err(res,'Archivo no encontrado en el servidor.',404);
      return res.sendFile(localPath);
    }

    if (!isOfficeDocument(archivo)) return err(res,'El archivo no se puede convertir a vista previa.',400);
    if (cloudinaryConfigured) return res.redirect(archivo.url);

    const sourcePath = path.join(uploadsDir, archivo.publicId || '');
    if (!fs.existsSync(sourcePath)) return err(res,'Archivo no encontrado en el servidor.',404);

    const previewDir = path.join(uploadsDir, 'previews');
    if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive:true });
    const previewFileName = `${path.basename(archivo.publicId, path.extname(archivo.publicId))}.pdf`;
    const previewFilePath = path.join(previewDir, previewFileName);

    let shouldConvert = true;
    if (fs.existsSync(previewFilePath)) {
      const sourceStats = fs.statSync(sourcePath);
      const previewStats = fs.statSync(previewFilePath);
      shouldConvert = sourceStats.mtimeMs > previewStats.mtimeMs;
    }

    if (shouldConvert) {
      await convertOfficeToPdf(sourcePath, previewDir);
    }

    if (!fs.existsSync(previewFilePath)) return err(res,'No se pudo generar la vista previa del archivo.',500);
    return res.type('application/pdf').sendFile(previewFilePath);
  } catch(e) {
    console.error('Error en vista previa de archivo:', e);
    return err(res,'Error al generar vista previa.',500);
  }
}

module.exports = { eliminar, preview };
