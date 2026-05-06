const express = require("express");
const https = require("https");
const fs = require("fs");
const cors = require('cors');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);

// Connexions aux bases de données
const { pgClient } = require('./config/db');

// Routes
const authRoutes = require('./routes/auth');
const postsRoutes = require('./routes/posts');
const likesRoutes = require('./routes/likes');
const commentsRoutes = require('./routes/comments');
const uploadRoutes = require('./routes/upload');

// WebSocket
const { setupWebSocket } = require('./socket/websocket');

const app = express();

// Autoriser les requêtes cross-origin avec cookies
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

const dsnMongoDB = "mongodb://127.0.0.1:27017/db-CERI";

// Stockage des sessions dans MongoDB
const sessionStore = new MongoDBStore({ uri: dsnMongoDB, collection: 'MySession3170' });
app.use(session({
    secret: 'mon_secret_super_securise_2026',
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: { maxAge: 1000 * 60 * 60 } // Session valide 1 heure
}));

// Fichiers statiques Angular et images uploadées
app.use(express.static(__dirname + '/frontend/dist/frontend/browser'));
app.use('/uploads', express.static(__dirname + '/uploads'));

// Page d'accueil → application Angular
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/frontend/dist/frontend/browser/index.html');
});

// Déclaration des routes
app.use('/', authRoutes);
app.use('/posts', postsRoutes);
app.use('/posts', likesRoutes);
app.use('/posts', commentsRoutes);
app.use('/', uploadRoutes);

// Route catch-all pour Angular
app.get('/{*path}', (req, res) => {
    res.sendFile(__dirname + '/frontend/dist/frontend/browser/index.html');
});

// Serveur HTTPS
const port = 3170;
const options = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};
const server = https.createServer(options, app);

// Initialisation du WebSocket et récupération de io et userSockets
const { io, userSockets } = setupWebSocket(server);

// Middleware pour rendre io et userSockets disponibles dans toutes les routes
app.use((req, res, next) => {
    req.io = io;
    req.userSockets = userSockets;
    next();
});

server.listen(port, () => {
    console.log(`Serveur HTTPS démarré sur https://pedago.univ-avignon.fr:${port}`);
});