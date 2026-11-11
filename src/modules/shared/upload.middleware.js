const multer = require("multer");

const MAX_SIZE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

// O arquivo fica em memória (buffer): quem decide onde e como salvar é o image.service.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024, files: 1 },
  fileFilter(req, file, cb) {
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      const error = new Error("Formato não suportado. Envie uma imagem JPEG, PNG ou WebP");
      error.statusCode = 415;
      return cb(error);
    }
    cb(null, true);
  }
});

// Recebe um único arquivo no campo informado e traduz as falhas do Multer em respostas HTTP.
function uploadImage(fieldName = "image") {
  const single = upload.single(fieldName);

  return (req, res, next) => {
    single(req, res, (error) => {
      if (error) {
        if (error.code === "LIMIT_FILE_SIZE") {
          return res.status(413).json({ error: `A imagem deve ter no máximo ${MAX_SIZE_MB} MB` });
        }
        if (error instanceof multer.MulterError) {
          return res.status(400).json({ error: `Envie um único arquivo no campo "${fieldName}"` });
        }
        return res.status(error.statusCode || 400).json({ error: error.message });
      }

      if (!req.file) {
        return res.status(400).json({ error: `Envie a imagem no campo "${fieldName}"` });
      }

      next();
    });
  };
}

module.exports = { uploadImage, MAX_SIZE_MB, ALLOWED_TYPES };
