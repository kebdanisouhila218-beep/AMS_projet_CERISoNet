const express = require("express");
const https = require("https");
const fs = require("fs");
const cors = require('cors');
const { Pool } = require('pg');
const pgClient = new Pool({
    user: 'uapv2600478',
    host: '127.0.0.1',
    database: 'etd',
    password: 'ftdv7h',
    port: 5432
});

pgClient.query('SELECT 1 as test')
    .then(result => console.log(' Connexion PostgreSQL réussie:', result.rows))
    .catch(err => console.log(' Erreur connexion PostgreSQL:', err));

const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const { Server } = require("socket.io");
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => { cb(null, __dirname + '/uploads/'); },
    filename: (req, file, cb) => { cb(null, Date.now() + path.extname(file.originalname)); }
});
const upload = multer({ storage });
const app = express();
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

const dsnMongoDB = "mongodb://127.0.0.1:27017/db-CERI";

const sessionStore = new MongoDBStore({ uri: dsnMongoDB, collection: 'MySession3170' });
app.use(session({
    secret: 'mon_secret_super_securise_2026',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { maxAge: 1000 * 60 * 60 }
}));

const port = 3170;
const options = { key: fs.readFileSync('key.pem'), cert: fs.readFileSync('cert.pem') };

app.use(express.static(__dirname + '/frontend/dist/frontend/browser'));
app.use('/uploads', express.static(__dirname + '/uploads'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/frontend/dist/frontend/browser/index.html');
});

// LOGIN
app.get('/login', (req, res) => {
    const email = req.query.email;
    const password = req.query.password;

    console.log(' Tentative de connexion:', { email, hasPassword: !!password });

    if (!email || !password) {
        return res.json({ success: false, message: 'Email et mot de passe requis' });
    }

    pgClient.query('SELECT * FROM fredouil.compte WHERE mail = $1', [email])
        .then(result => {
            console.log(' Résultat PostgreSQL:', {
                rowCount: result.rowCount,
                firstUser: result.rows[0]
            });

            const user = result.rows[0];

            if (!user) {
                console.log(' Utilisateur non trouvé:', email);
                return res.json({ success: false, message: 'Email ou mot de passe incorrect' });
            }

            const hash = crypto.createHash('sha1').update(password).digest('hex');

            console.log(' Debug mot de passe:', {
                email,
                hashInput: hash,
                hashStored: user.motpasse,
                match: hash === user.motpasse
            });

            if (hash !== user.motpasse) {
                console.log(' Mot de passe incorrect pour:', email);
                return res.json({ success: false, message: 'Email ou mot de passe incorrect' });
            }

            req.session.isConnected = true;
            req.session.userId = user.id;
            req.session.userPseudo = user.pseudo;
            req.session.userEmail = user.mail;

            console.log(' Connexion réussie pour:', user.pseudo);

            if (req.io) {
                req.io.emit('userConnected', {
                    userId: user.id,
                    pseudo: user.pseudo,
                    email: user.mail
                });
            }

            res.json({
                success: true,
                pseudo: user.pseudo,
                user: {
                    id: user.id,
                    pseudo: user.pseudo,
                    email: user.mail
                }
            });
        })
        .catch(err => {
            console.log(' Erreur base de données:', err);
            res.json({ success: false, message: 'Erreur serveur' });
        });
});

// CHECK TABLE
app.get('/check-table', (req, res) => {
    pgClient.query('SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1 ORDER BY ordinal_position', ['fredouil.compte'])
        .then(result => {
            return pgClient.query('SELECT * FROM fredouil.compte LIMIT 10')
                .then(dataResult => {
                    return pgClient.query('SELECT COUNT(*) as total FROM fredouil.compte')
                        .then(countResult => {
                            return pgClient.query('SELECT * FROM fredouil.compte WHERE mail = $1', ['fourmi@gmail.com'])
                                .then(fourmiResult => {
                                    res.json({
                                        success: true,
                                        structure: result.rows,
                                        data: dataResult.rows,
                                        totalUsers: countResult.rows[0].total,
                                        fourmiUser: fourmiResult.rows[0] || null
                                    });
                                });
                        });
                });
        })
        .catch(err => res.json({ success: false, error: err.message }));
});

// LOGOUT
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

// /posts/hashtags AVANT /posts
app.get('/posts/hashtags', (req, res) => {
    MongoClient.connect(dsnMongoDB)
        .then(mongoBase => {
            return mongoBase.db()
                .collection('CERISoNet')
                .distinct('hashtags', { hashtags: { $exists: true, $ne: [] } });
        })
        .then(hashtags => res.json({ success: true, hashtags: hashtags.filter(h => h) }))
        .catch(err => res.json({ success: false, error: err.message }));
});

// GET /posts
app.get('/posts', (req, res) => {
    const page    = parseInt(req.query.page) || 1;
    const limit   = 10;
    const skip    = (page - 1) * limit;
    const sort    = req.query.sort    || 'recent';
    const hashtag = req.query.hashtag || null;
    const author  = req.query.author  || null;

    const filter = {};
    if (hashtag) filter.hashtags = hashtag;
    if (author)  filter.createdBy = parseInt(author);

    const mongoSort = { _id: -1 };

    MongoClient.connect(dsnMongoDB)
        .then(mongoBase => {
            const col = mongoBase.db().collection('CERISoNet');
            return col.countDocuments(filter).then(total => {
                return col.find(filter)
                    .sort(mongoSort)
                    .toArray()
                    .then(allPosts => ({ allPosts, total }));
            });
        })
        .then(({ allPosts, total }) => {
            let posts = allPosts.map(p => {
                let dateISO = null;

                if (p.date && p.date !== undefined && p.date !== null) {
                    if (p.date instanceof Date) {
                        dateISO = p.date;
                    } else if (typeof p.date === 'string') {
                        if (p.date.includes('/')) {
                            const parts = p.date.split('/');
                            if (parts.length === 3) {
                                dateISO = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                            }
                        } else if (p.date.includes('-')) {
                            dateISO = new Date(p.date);
                        } else if (p.date.includes(' ') && !p.date.includes('/')) {
                            dateISO = new Date(p.date);
                        } else {
                            dateISO = new Date(p.date);
                        }
                    } else if (typeof p.date === 'number') {
                        dateISO = new Date(p.date);
                    }
                } else if (p.dateCreation) {
                    dateISO = p.dateCreation;
                }

                if (!dateISO && p._id) {
                    const id = p._id;
                    if (typeof id === 'string' && id.length === 24) {
                        dateISO = new Date(parseInt(id.substring(0, 8), 16) * 1000);
                    } else if (typeof id === 'number') {
                        dateISO = new Date(id);
                    }
                }

                return { ...p, dateISO };
            });

            posts = posts.filter(p => p.dateISO && !isNaN(new Date(p.dateISO).getTime()));

            // Tri complet côté Node
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

            // Pagination après tri
            posts = posts.slice(skip, skip + limit);

            const ids = [...new Set(
                posts.map(p => p.createdBy).filter(id => id && Number.isInteger(Number(id)))
            )].map(Number);

            if (ids.length === 0) {
                return res.json({ success: true, posts, total, page, limit });
            }

            return pgClient.query(
                `SELECT id, prenom, nom FROM fredouil.compte WHERE id = ANY($1)`, [ids]
            ).then(pgResult => {
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
                        if (Array.isArray(p.likedBy)) {
                            userHasLiked = userId ? p.likedBy.includes(userId) : false;
                        }
                    }
                    
                    return {
                        ...p,
                        createdByName: userMap[p.createdBy] || `Utilisateur #${p.createdBy}`,
                        totalLikes: totalLikes,
                        userHasLiked: userHasLiked
                    };
                });
                res.json({ success: true, posts, total, page, limit });
            });
        })
        .catch(err => {
            console.log('ERREUR /posts:', err);
            res.json({ success: false, error: err.message });
        });
});

// POST /posts/new
app.post('/posts/new', (req, res) => {
    if (!req.session.isConnected) {
        return res.json({ success: false, message: "Non connecté" });
    }
    const now = new Date();
    const newPost = {
        date: now.toISOString().split('T')[0],
        hour: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        body: req.body.body,
        createdBy: req.session.userId,
        image: req.body.image || null,
        likes: [],
        hashtags: req.body.hashtags || [],
        comments: [],
        shared: null
    };
    MongoClient.connect(dsnMongoDB)
        .then(mongoBase => mongoBase.db().collection('CERISoNet').insertOne(newPost))
        .then(result => res.json({ success: true, insertedId: result.insertedId }))
        .catch(err => res.json({ success: false, error: err.message }));
});

// POST /upload
app.post('/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.json({ success: false, message: 'Aucun fichier reçu' });
    const imageUrl = `https://pedago.univ-avignon.fr:3170/uploads/${req.file.filename}`;
    res.json({ success: true, url: imageUrl });
});

// GET /test-session
app.get('/test-session', (req, res) => {
  

    res.json({
        success: true,
        isConnected: req.session.isConnected || false,
        userId: req.session.userId || null,
        userPseudo: req.session.userPseudo || null
    });
});

// POST /posts/:id/comment
app.post('/posts/:id/comment', (req, res) => {
    const postId = req.params.id;
    const { text } = req.body;

    if (!req.session || !req.session.isConnected) {
        return res.json({ success: false, message: "Non connecté" });
    }

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

    MongoClient.connect(dsnMongoDB)
        .then(mongoBase => {
            const col = mongoBase.db().collection('CERISoNet');
            return col.updateOne(
                { _id: new ObjectId(postId) },
                { $push: { comments: newComment } }
            );
        })
        .then(result => {
            if (result.matchedCount === 0) {
                return res.json({ success: false, message: "Post non trouvé" });
            }

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
            console.log('Erreur MongoDB:', err);
            res.json({ success: false, error: err.message });
        });
});

// POST /posts/:id/like
app.post('/posts/:id/like', (req, res) => {
    const postId = req.params.id;
    const userId = req.session.userId;

    if (!req.session || !req.session.isConnected) {
        return res.json({ success: false, message: "Non connecté" });
    }

    MongoClient.connect(dsnMongoDB)
        .then(mongoBase => {
            const col = mongoBase.db().collection('CERISoNet');

            return col.findOne({ _id: new ObjectId(postId) })
                .then(post => {
                    if (!post) {
                        return res.json({ success: false, message: "Post non trouvé" });
                    }

                    let likesArray = [];
                    
                    if (Array.isArray(post.likes)) {
                        // Système nouveau : likes = [1, 2, 3]
                        likesArray = post.likes;
                    } else if (typeof post.likes === 'number') {
                        // Système ancien : likes = 21, likedBy = [2, 5, ...]
                        likesArray = Array.isArray(post.likedBy) ? [...post.likedBy] : [];
                    }

                    // Vérifier si l'utilisateur a déjà liké
                    const hasLiked = likesArray.includes(userId);

                    // Ajouter ou retirer le like
                    const updatedLikes = hasLiked
                        ? likesArray.filter(id => id !== userId)
                        : [...likesArray, userId];

                    // Sauvegarder dans MongoDB
                    return col.updateOne(
                        { _id: new ObjectId(postId) },
                        { $set: { likes: updatedLikes } }
                    ).then(() => {
                        if (req.io) {
    // Mise à jour du compteur pour tout le monde
    req.io.emit('postLiked', {
        postId,
        userId,
        userPseudo: req.session.userPseudo,
        liked: !hasLiked,
        totalLikes: updatedLikes.length
    });

    const ownerSocketId = userSockets.get(post.createdBy);
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
                });
        })
        .catch(err => {
            console.log('Erreur MongoDB like:', err);
            res.json({ success: false, error: err.message });
        });
});

// Route catch-all pour Angular
app.get('/{*path}', (req, res) => {
    res.sendFile(__dirname + '/frontend/dist/frontend/browser/index.html');
});


// ✅ Serveur HTTPS + Socket.IO sur le même port
const server = https.createServer(options, app);
const io = new Server(server, {
    cors: { 
        origin: "*", 
        methods: ["GET", "POST"],
        credentials: true
    }
});

const connectedUsers = new Map();
const userSockets = new Map();
io.on('connection', (socket) => {
    console.log(' Utilisateur connecté via WebSocket');

    socket.on('userConnected', (userData) => {
        connectedUsers.set(socket.id, userData);
        userSockets.set(userData.userId, socket.id);
        console.log(' Utilisateur en ligne:', userData.pseudo);

        socket.broadcast.emit('userStatusUpdate', {
            userId: userData.userId,
            pseudo: userData.pseudo,
            status: 'online'
        });

        io.emit('onlineUsersList', Array.from(connectedUsers.values()));
    });

    socket.on('disconnect', () => {
        const userData = connectedUsers.get(socket.id);
        if (userData) {
            userSockets.delete(userData.userId);
            console.log(' Utilisateur déconnecté:', userData.pseudo);
            connectedUsers.delete(socket.id);

            socket.broadcast.emit('userStatusUpdate', {
                userId: userData.userId,
                pseudo: userData.pseudo,
                status: 'offline'
            });

            io.emit('onlineUsersList', Array.from(connectedUsers.values()));
        }
    });

    socket.on('newComment', (commentData) => {
        console.log('💬 Nouveau commentaire notifié:', commentData);
        socket.broadcast.emit('commentAdded', commentData);
    });

    socket.on('postLiked', (likeData) => {
        console.log('❤️ Like notifié:', likeData);
        socket.broadcast.emit('postLikeUpdate', likeData);
    });
});

server.listen(port, () => {
    console.log(`Serveur HTTPS démarré sur https://pedago.univ-avignon.fr:${port}`);
});