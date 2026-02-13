const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive:  true });
}

// Create subdirectories
const subdirs = ['profiles', 'supplements', 'qr', 'invoices', 'membership-cards', 'others'];
subdirs.forEach(subdir => {
    const dir = `${uploadDir}/${subdir}`;
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let folder = 'others';
        
        if (file.fieldname === 'profileImage') {
            folder = 'profiles';
        } else if (file.fieldname === 'supplementImage') {
            folder = 'supplements';
        }
        
        const dest = `${uploadDir}/${folder}`;
        cb(null, dest);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (extname && mimetype) {
        return cb(null, true);
    } else {
        cb(new Error('Only image files (jpeg, jpg, png, gif) and PDF are allowed! '));
    }
};

// Configure multer
const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB default
    },
    fileFilter:  fileFilter
});

module.exports = upload;