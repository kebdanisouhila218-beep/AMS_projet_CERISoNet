const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

// Configuration du stockage des images uploadées
const storage = multer.diskStorage({
    destination: (req, file, cb) => { 
        cb(null, __dirname + '/../uploads/'); 
    },
    filename: (req, file, cb) => { 
        // Nom unique basé sur le timestamp
        cb(null, Date.now() + path.extname(file.originalname)); 
    }
});
const upload = multer({ storage });

// ============================================================
// ROUTE POST /upload : upload d'une image
// ============================================================
router.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) {
        return res.json({ success: false, message: 'Aucun fichier reçu' });
    }
    // Retourne l'URL publique de l'image
    const imageUrl = `https://pedago.univ-avignon.fr:3170/uploads/${req.file.filename}`;
    res.json({ success: true, url: imageUrl });
});

module.exports = router;