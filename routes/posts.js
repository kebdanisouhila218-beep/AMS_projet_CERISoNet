const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { pgClient, connectMongo } = require('../config/db');

// ============================================================
// ROUTE GET /hashtags : récupère tous les hashtags distincts
// ============================================================
router.get('/hashtags', (req, res) => {
    connectMongo()
        .then(mongoBase => {
            return mongoBase.db()
                .collection('CERISoNet')
                .distinct('hashtags', { hashtags: { $exists: true, $ne: [] } });
        })
        .then(hashtags => res.json({ success: true, hashtags: hashtags.filter(h => h) }))
        .catch(err => res.json({ success: false, error: err.message }));
});

// ============================================================
// ROUTE GET / : récupère les posts avec tri, filtre et pagination
// ============================================================
router.get('/', (req, res) => {
    const page    = parseInt(req.query.page) || 1;
    const limit   = 10;
    const skip    = (page - 1) * limit;
    const sort    = req.query.sort    || 'recent';
    const hashtag = req.query.hashtag || null;
    const author  = req.query.author  || null;

    const userId = req.session?.userId;
    const filter = {};
    if (hashtag) filter.hashtags = hashtag;
    if (author === 'me' && userId) {
        filter.createdBy = parseInt(userId);
    } else if (author === 'others' && userId) {
        filter.createdBy = { $ne: parseInt(userId) };
    }

    connectMongo()
        .then(mongoBase => {
            const col = mongoBase.db().collection('CERISoNet');
            return col.countDocuments(filter).then(total => {
                return col.find(filter)
                    .sort({ _id: -1 })
                    .toArray()
                    .then(allPosts => ({ allPosts, total, mongoBase }));
            });
        })
        .then(({ allPosts, total, mongoBase }) => {
            let posts = allPosts.map(p => {
                let dateISO = null;

                if (p.date && p.hour) {
                    if (typeof p.date === 'string') {
                        const dateStr = p.date.includes('/')
                            ? p.date.split('/').reverse().join('-')
                            : p.date;
                        dateISO = new Date(`${dateStr}T${p.hour}:00`);
                    } else if (p.date instanceof Date) {
                        dateISO = p.date;
                    } else if (typeof p.date === 'number') {
                        dateISO = new Date(p.date);
                    }
                } else if (p.date) {
                    if (typeof p.date === 'string') {
                        const dateStr = p.date.includes('/')
                            ? p.date.split('/').reverse().join('-')
                            : p.date;
                        dateISO = new Date(`${dateStr}T12:00:00`);
                    } else if (p.date instanceof Date) {
                        dateISO = p.date;
                    } else if (typeof p.date === 'number') {
                        dateISO = new Date(p.date);
                    }
                } else if (p.dateCreation) {
                    dateISO = new Date(p.dateCreation);
                } else if (p._id) {
                    dateISO = new Date(parseInt(p._id.toString().substring(0, 8), 16) * 1000);
                }

                return { ...p, dateISO };
            });

            posts = posts.filter(p => p.dateISO && !isNaN(new Date(p.dateISO).getTime()));

            if (sort === 'oldest') {
                posts.sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());
            } else if (sort === 'recent') {
                posts.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
            } else if (sort === 'likes') {
                posts.sort((a, b) => {
                    const likesA = Array.isArray(a.likes) ? a.likes.length : (typeof a.likes === 'number' ? a.likes : 0);
                    const likesB = Array.isArray(b.likes) ? b.likes.length : (typeof b.likes === 'number' ? b.likes : 0);
                    return likesB - likesA;
                });
            }

            posts = posts.slice(skip, skip + limit);

            const ids = [...new Set(
                posts.map(p => p.createdBy).filter(id => id && Number.isInteger(Number(id)))
            )].map(Number);

            if (ids.length === 0) {
                return res.json({ success: true, posts, total, page, limit });
            }

            return pgClient.query(
                `SELECT id, prenom, nom FROM fredouil.compte WHERE id = ANY($1)`, [ids]
            ).then(async pgResult => {
                const userMap = {};
                pgResult.rows.forEach(u => { userMap[u.id] = `${u.nom} ${u.prenom}`; });

                const userId = req.session?.userId;

                posts = posts.map(p => {
                    let totalLikes = 0;
                    let userHasLiked = false;

                    if (Array.isArray(p.likes)) {
                        totalLikes = p.likes.length;
                        userHasLiked = userId ? p.likes.includes(userId) : false;
                    } else if (typeof p.likes === 'number') {
                        totalLikes = p.likes;
                        const likedBy = Array.isArray(p.likedBy) ? p.likedBy : [];
                        userHasLiked = userId ? likedBy.includes(userId) : false;
                    }

                    return {
                        ...p,
                        createdByName: userMap[p.createdBy] || `Utilisateur #${p.createdBy}`,
                        totalLikes,
                        userHasLiked
                    };
                });

                // ============================================================
                // POPULATE DU POST PARTAGÉ
                // ============================================================
                posts = await Promise.all(posts.map(async (p) => {
                    if (p.shared) {
                        const original = await mongoBase.db()
                            .collection('CERISoNet')
                            .findOne({ _id: new ObjectId(p.shared) });
                        if (original) {
                            let originalDateISO = null;
                            if (original.date && original.hour) {
                                const dateStr = typeof original.date === 'string' && original.date.includes('/')
                                    ? original.date.split('/').reverse().join('-')
                                    : original.date;
                                originalDateISO = new Date(`${dateStr}T${original.hour}:00`);
                            }
                            p.sharedPost = {
                                ...original,
                                createdByName: userMap[original.createdBy] || `Utilisateur #${original.createdBy}`,
                                dateISO: originalDateISO
                            };
                        }
                    }
                    return p;
                }));

                res.json({ success: true, posts, total, page, limit });
            });
        })
        .catch(err => {
            console.log('ERREUR /posts:', err);
            res.json({ success: false, error: err.message });
        });
});

// ============================================================
// ROUTE POST /new : crée un nouveau post
// ============================================================
router.post('/new', (req, res) => {
    if (!req.session.isConnected) {
        return res.json({ success: false, message: "Non connecté" });
    }

    const now = new Date();
    const newPost = {
        date: now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }).split('/').reverse().join('-'),
        hour: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }),
        body: req.body.body,
        createdBy: req.session.userId,
        image: req.body.image || null,
        likes: [],
        hashtags: req.body.hashtags || [],
        comments: [],
        shared: null
    };

    connectMongo()
        .then(mongoBase => mongoBase.db().collection('CERISoNet').insertOne(newPost))
        .then(result => res.json({ success: true, insertedId: result.insertedId }))
        .catch(err => res.json({ success: false, error: err.message }));
});

// ============================================================
// ROUTE POST /share : partage un post existant
// ============================================================
router.post('/share', (req, res) => {
    if (!req.session.isConnected) {
        return res.json({ success: false, message: "Non connecté" });
    }

    const { sharedPostId, body } = req.body;
    if (!sharedPostId) {
        return res.json({ success: false, message: "Post à partager manquant" });
    }

    const now = new Date();
    const sharedPost = {
        date: now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }).split('/').reverse().join('-'),
        hour: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }),
        body: body || 'Je partage ce post.',
        createdBy: req.session.userId,
        image: null,
        likes: [],
        hashtags: [],
        comments: [],
        shared: new ObjectId(sharedPostId)
    };

    connectMongo()
        .then(mongoBase => mongoBase.db().collection('CERISoNet').insertOne(sharedPost))
        .then(result => res.json({ success: true, insertedId: result.insertedId }))
        .catch(err => res.json({ success: false, error: err.message }));
});

module.exports = router;