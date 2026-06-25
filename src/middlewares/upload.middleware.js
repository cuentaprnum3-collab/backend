const fs = require('fs');
const path = require('path');
const cloudinary  = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const cloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET &&
  !process.env.CLOUDINARY_API_KEY.includes('tu_api_key') &&
  !process.env.CLOUDINARY_CLOUD_NAME.includes('tu_cloud_name')
);

let storage;
if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name:  process.env.CLOUDINARY_CLOUD_NAME,
    api_key:     process.env.CLOUDINARY_API_KEY,
    api_secret:  process.env.CLOUDINARY_API_SECRET,
  });

  storage = new CloudinaryStorage({
    cloudinary,
    params: (req, file) => ({
      folder:   'readtrack-uts',
      resource_type: 'auto',          // acepta pdf, imagen, video
      public_id: `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`,
    }),
  });
} else {
  console.warn('Cloudinary no está configurado correctamente. Se usará almacenamiento local en uploads/.');
  storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
      const safeName = `${Date.now()}-${file.originalname.replace(/\s/g, '_')}`;
      cb(null, safeName);
    },
  });
}

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

module.exports = { upload, cloudinary, cloudinaryConfigured, uploadsDir };

