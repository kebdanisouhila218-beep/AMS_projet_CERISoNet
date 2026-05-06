const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { connectMongo } = require('../config/db');

// ============================================================
// ROUTE POST /:id/comment : ajoute un commentaire à un post
// ============================================================
router.post('/:id/comment', (req, res) => {
    const postId = req.params.id;
    const { text } = req.body;

    // Vérification que l'utilisateur est connecté
    if (!req.session || !req.session.isConnected) {
        return res.json({ success: false, message: "Non connecté" });
    }

    // Vérification que le commentaire n'est pas vide
    if (!text || !text.trim()) {
        return res.json({ success: false, message: "Commentaire vide" });
    }

    const now = new Date();
    const newComment = {
        text: text.trim(),
        commentedBy: req.session.userId,
        date: now.toISOString().split('T')[0],
        hour: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };

    connectMongo()
        .then(mongoBase => {
            const col = mongoBase.db().collection('CERISoNet');
            // Ajoute le commentaire au tableau comments du post
            return col.updateOne(
                { _id: new ObjectId(postId) },
                { $push: { comments: newComment } }
            );
        })
        .then(result => {
            if (result.matchedCount === 0) {
                return res.json({ success: false, message: "Post non trouvé" });
            }
            // Notifie tous les clients via WebSocket
            if (req.io) {
                req.io.emit('newComment', {
                    postId,
                    comment: newComment,
                    authorPseudo: req.session.userPseudo
                });
            }
            res.json({ success: true, comment: newComment });
        })
        .catch(err => {
            console.log('Erreur MongoDB commentaire:', err);
            res.json({ success: false, error: err.message });
        });
});

module.exports = router;