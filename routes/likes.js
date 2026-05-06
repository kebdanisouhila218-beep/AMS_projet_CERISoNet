const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { connectMongo } = require('../config/db');

// ============================================================
// ROUTE POST /:id/like : ajoute ou retire un like
// Gère deux formats : likes = nombre (ancien) ou likes = tableau (nouveau)
// ============================================================
router.post('/:id/like', (req, res) => {
    const postId = req.params.id;
    const userId = req.session.userId;

    if (!req.session || !req.session.isConnected) {
        return res.json({ success: false, message: "Non connecté" });
    }

    connectMongo()
        .then(mongoBase => {
            const col = mongoBase.db().collection('CERISoNet');

            return col.findOne({ _id: new ObjectId(postId) })
                .then(post => {
                    if (!post) {
                        return res.json({ success: false, message: "Post non trouvé" });
                    }

                    if (Array.isArray(post.likes)) {
                        // Nouveau format : likes = tableau d'IDs
                        // On ajoute ou retire l'ID de l'utilisateur
                        const hasLiked = post.likes.includes(userId);
                        const updatedLikes = hasLiked
                            ? post.likes.filter(id => id !== userId)
                            : [...post.likes, userId];

                        return col.updateOne(
                            { _id: new ObjectId(postId) },
                            { $set: { likes: updatedLikes } }
                        ).then(() => {
                            // Notifie tous les clients via WebSocket
                            if (req.io) {
                                req.io.emit('postLiked', {
                                    postId, userId,
                                    userPseudo: req.session.userPseudo,
                                    liked: !hasLiked,
                                    totalLikes: updatedLikes.length
                                });
                                // Notifie le propriétaire du post
                                const ownerSocketId = req.userSockets?.get(post.createdBy);
                                if (ownerSocketId && post.createdBy !== userId) {
                                    req.io.to(ownerSocketId).emit('likeNotification', {
                                        message: `${req.session.userPseudo} a aimé votre post !`
                                    });
                                }
                            }
                            res.json({
                                success: true,
                                liked: !hasLiked,
                                totalLikes: updatedLikes.length
                            });
                        });

                    } else if (typeof post.likes === 'number') {
                        // Ancien format : likes = nombre simple
                        // On fait +1 ou -1 et on met à jour likedBy
                        const likedBy = Array.isArray(post.likedBy) ? post.likedBy : [];
                        const hasLiked = likedBy.includes(userId);
                        const newCount = hasLiked ? post.likes - 1 : post.likes + 1;
                        const updatedLikedBy = hasLiked
                            ? likedBy.filter(id => id !== userId)
                            : [...likedBy, userId];

                        return col.updateOne(
                            { _id: new ObjectId(postId) },
                            { $set: { likes: newCount, likedBy: updatedLikedBy } }
                        ).then(() => {
                            // Notifie tous les clients via WebSocket
                            if (req.io) {
                                req.io.emit('postLiked', {
                                    postId, userId,
                                    userPseudo: req.session.userPseudo,
                                    liked: !hasLiked,
                                    totalLikes: newCount
                                });
                                // Notifie le propriétaire du post
                                const ownerSocketId = req.userSockets?.get(post.createdBy);
                                if (ownerSocketId && post.createdBy !== userId) {
                                    req.io.to(ownerSocketId).emit('likeNotification', {
                                        message: `${req.session.userPseudo} a aimé votre post !`
                                    });
                                }
                            }
                            res.json({
                                success: true,
                                liked: !hasLiked,
                                totalLikes: newCount
                            });
                        });
                    }
                });
        })
        .catch(err => {
            console.log('Erreur MongoDB like:', err);
            res.json({ success: false, error: err.message });
        });
});

module.exports = router;