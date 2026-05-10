import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve uploads folder to: server/uploads/products/
const UPLOADS_DIR = path.join(__dirname, '..', '..', 'uploads', 'products');

// Create directory if it doesn't exist
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Use disk storage — files saved to /server/uploads/products/
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.'), false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
    files: 5,
  },
});

// Middleware: attach local URLs to req.localImageUrls for use in controllers
export const handleLocalUpload = (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      req.localImageUrls = [];
      return next();
    }

    const baseUrl = process.env.SERVER_URL || `http://localhost:${process.env.PORT || 5000}`;
    req.localImageUrls = req.files.map(
      (file) => `${baseUrl}/uploads/products/${file.filename}`
    );

    next();
  } catch (error) {
    console.error('Local upload error:', error);
    return res.status(500).json({ message: 'Failed to process uploaded images' });
  }
};

export const handleUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Max size is 5MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: 'Too many files. Max is 5.' });
    }
    return res.status(400).json({ message: err.message });
  }
  if (err) {
    return res.status(400).json({ message: err.message });
  }
  next();
};

export default upload;
