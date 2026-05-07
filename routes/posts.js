const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { pgClient, connectMongo } = require('../config/db');

// ============================================================
// ROUTE GET /hashtags
// Récupère tous les hashtags distincts depuis MongoDB
// Utilisée pour remplir le filtre hashtag dans FilterBar
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
// ROUTE GET /authors
// Récupère tous les auteurs distincts depuis MongoDB
// Puis récupère leurs noms depuis PostgreSQL
// DOIT être AVANT la route GET / sinon Express confond avec /:id
// ============================================================
router.get('/authors', (req, res) => {
    connectMongo()
        .then(mongoBase => {
            // Récupère les IDs distincts des auteurs dans MongoDB
            return mongoBase.db()
                .collection('CERISoNet')
                .distinct('createdBy', { createdBy: { $exists: true } });
        })
        .then(authorIds => {
            // Filtre et convertit les IDs en nombres entiers
            const ids = authorIds.filter(id => id && Number.isInteger(Number(id))).map(Number);
            if (ids.length === 0) return res.json({ success: true, authors: [] });

            // Joint avec PostgreSQL pour récupérer les noms
            return pgClient.query(
                `SELECT id, prenom, nom FROM fredouil.compte WHERE id = ANY($1)`, [ids]
            ).then(pgResult => {
                const authors = pgResult.rows.map(u => ({ id: u.id, name: `${u.nom} ${u.prenom}` }));
                res.json({ success: true, authors });
            });
        })
        .catch(err => res.json({ success: false, error: err.message }));
});

// ============================================================
// ROUTE GET /
// Récupère les posts avec tri, filtre par hashtag/auteur et pagination
// Reçoit : page, sort, hashtag, author en query params
// ============================================================
router.get('/', (req, res) => {
    const page    = parseInt(req.query.page) || 1;
    const limit   = 10;
    const skip    = (page - 1) * limit; // calcul de l'offset pour la pagination
    const sort    = req.query.sort    || 'recent';
    const hashtag = req.query.hashtag || null;
    const author  = req.query.author  || null;

    const userId = req.session?.userId;

    // Construction du filtre MongoDB selon les paramètres reçus
    const filter = {};
    if (hashtag) filter.hashtags = hashtag;
    if (author && author !== '') {
        filter.createdBy = parseInt(author);
    }

    connectMongo()
        .then(mongoBase => {
            const col = mongoBase.db().collection('CERISoNet');

            // Compte le total pour la pagination côté client
            return col.countDocuments(filter).then(total => {
                return col.find(filter)
                    .sort({ _id: -1 })
                    .toArray()
                    .then(allPosts => ({ allPosts, total, mongoBase }));
            });
        })
        .then(({ allPosts, total, mongoBase }) => {

            // ============================================================
            // NORMALISATION DES DATES
            // Les posts ont des formats de date variés → on les convertit
            // tous en dateISO pour pouvoir trier correctement
            // ============================================================
            let posts = allPosts.map(p => {
                let dateISO = null;

                if (p.date && p.hour) {
                    if (typeof p.date === 'string') {
                        // Convertit JJ/MM/AAAA → AAAA-MM-JJ
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
                    // Extrait la date depuis l'ObjectId MongoDB si aucune date disponible
                    dateISO = new Date(parseInt(p._id.toString().substring(0, 8), 16) * 1000);
                }

                return { ...p, dateISO };
            });

            // Filtre les posts avec une date invalide
            posts = posts.filter(p => p.dateISO && !isNaN(new Date(p.dateISO).getTime()));

            // ============================================================
            // TRI DES POSTS selon le paramètre sort
            // ============================================================
            if (sort === 'oldest') {
                // Du plus ancien au plus récent
                posts.sort((a, b) => new Date(a.dateISO).getTime() - new Date(b.dateISO).getTime());
            } else if (sort === 'recent') {
                // Du plus récent au plus ancien
                posts.sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());
            } else if (sort === 'likes') {
                // Par nombre de likes décroissant
                // Gère les deux formats : likes = tableau ou likes = nombre
                posts.sort((a, b) => {
                    const likesA = Array.isArray(a.likes) ? a.likes.length : (typeof a.likes === 'number' ? a.likes : 0);
                    const likesB = Array.isArray(b.likes) ? b.likes.length : (typeof b.likes === 'number' ? b.likes : 0);
                    return likesB - likesA;
                });
            }

            // Applique la pagination après le tri
            posts = posts.slice(skip, skip + limit);

            // Récupère les IDs uniques des auteurs pour les noms
            const ids = [...new Set(
                posts.map(p => p.createdBy).filter(id => id && Number.isInteger(Number(id)))
            )].map(Number);

            if (ids.length === 0) {
                return res.json({ success: true, posts, total, page, limit });
            }

            // Joint avec PostgreSQL pour récupérer les noms des auteurs
            return pgClient.query(
                `SELECT id, prenom, nom FROM fredouil.compte WHERE id = ANY($1)`, [ids]
            ).then(async pgResult => {
                // Crée un dictionnaire userId → nom
                const userMap = {};
                pgResult.rows.forEach(u => { userMap[u.id] = `${u.nom} ${u.prenom}`; });

                const userId = req.session?.userId;

                // ============================================================
                // CALCUL DES LIKES pour chaque post
                // Gère deux formats : likes = tableau d'IDs ou likes = nombre
                // ============================================================
                posts = posts.map(p => {
                    let totalLikes = 0;
                    let userHasLiked = false;

                    if (Array.isArray(p.likes)) {
                        // Nouveau format : likes = [userId1, userId2, ...]
                        totalLikes = p.likes.length;
                        userHasLiked = userId ? p.likes.includes(userId) : false;
                    } else if (typeof p.likes === 'number') {
                        // Ancien format : likes = nombre + likedBy = tableau
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
                // Si un post a un champ 'shared', on récupère le post original
                // pour l'afficher à l'intérieur du post partagé
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
                            // Ajoute le post original dans le champ sharedPost
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
// ROUTE POST /new
// Crée un nouveau post dans MongoDB
// Vérifie que l'utilisateur est connecté via la session
// ============================================================
router.post('/new', (req, res) => {
    // Vérifie que l'utilisateur est connecté
    if (!req.session.isConnected) {
        return res.json({ success: false, message: "Non connecté" });
    }

    const now = new Date();

    // Construit le nouveau post avec les données reçues
    const newPost = {
        date: now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }).split('/').reverse().join('-'),
        hour: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }),
        body: req.body.body,
        createdBy: req.session.userId, // ID de l'utilisateur connecté
        image: req.body.image || null,
        likes: [],      // tableau vide au départ
        hashtags: req.body.hashtags || [],
        comments: [],   // tableau vide au départ
        shared: null    // pas un partage
    };

    connectMongo()
        .then(mongoBase => mongoBase.db().collection('CERISoNet').insertOne(newPost))
        .then(result => res.json({ success: true, insertedId: result.insertedId }))
        .catch(err => res.json({ success: false, error: err.message }));
});

// ============================================================
// ROUTE POST /share
// Crée un nouveau post qui référence un post existant
// Le champ 'shared' contient l'ObjectId du post original
// ============================================================
router.post('/share', (req, res) => {
    // Vérifie que l'utilisateur est connecté
    if (!req.session.isConnected) {
        return res.json({ success: false, message: "Non connecté" });
    }

    const { sharedPostId, body } = req.body;

    // Vérifie que l'ID du post à partager est fourni
    if (!sharedPostId) {
        return res.json({ success: false, message: "Post à partager manquant" });
    }

    const now = new Date();

    // Crée un nouveau post avec référence au post original
    const sharedPost = {
        date: now.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }).split('/').reverse().join('-'),
        hour: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }),
        body: body || 'Je partage ce post.',
        createdBy: req.session.userId,
        image: null,
        likes: [],
        hashtags: [],
        comments: [],
        shared: new ObjectId(sharedPostId) // référence vers le post original
    };

    connectMongo()
        .then(mongoBase => mongoBase.db().collection('CERISoNet').insertOne(sharedPost))
        .then(result => res.json({ success: true, insertedId: result.insertedId }))
        .catch(err => res.json({ success: false, error: err.message }));
});

module.exports = router;