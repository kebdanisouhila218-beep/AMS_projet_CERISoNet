const { Server } = require("socket.io");

// Maps pour suivre les utilisateurs connectés
const connectedUsers = new Map(); // socketId → userData
const userSockets = new Map();    // userId → socketId

// ============================================================
// SETUP WEBSOCKET : initialise Socket.IO sur le serveur HTTPS
// ============================================================
const setupWebSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log('Utilisateur connecté via WebSocket');

        // Envoie immédiatement la liste des connectés au nouveau socket
        socket.emit('onlineUsersList', Array.from(connectedUsers.values()));

        // Un utilisateur s'identifie après connexion
        socket.on('userConnected', (userData) => {
            connectedUsers.set(socket.id, userData);
            userSockets.set(userData.userId, socket.id);
            console.log('Utilisateur en ligne:', userData.pseudo);

            // Notifie les autres de la connexion
            socket.broadcast.emit('userStatusUpdate', {
                userId: userData.userId,
                pseudo: userData.pseudo,
                status: 'online'
            });

            // Envoie la liste complète des connectés à tout le monde
            io.emit('onlineUsersList', Array.from(connectedUsers.values()));
        });

        // Un utilisateur se déconnecte
        socket.on('disconnect', () => {
            const userData = connectedUsers.get(socket.id);
            if (userData) {
                userSockets.delete(userData.userId);
                console.log('Utilisateur déconnecté:', userData.pseudo);
                connectedUsers.delete(socket.id);

                // Notifie les autres de la déconnexion
                socket.broadcast.emit('userStatusUpdate', {
                    userId: userData.userId,
                    pseudo: userData.pseudo,
                    status: 'offline'
                });

                // Envoie la liste mise à jour
                io.emit('onlineUsersList', Array.from(connectedUsers.values()));
            }
        });

        // Reçoit un nouveau commentaire et le diffuse aux autres
        socket.on('newComment', (commentData) => {
            console.log('Nouveau commentaire notifié:', commentData);
            socket.broadcast.emit('commentAdded', commentData);
        });

        // Reçoit un like et le diffuse aux autres
        socket.on('postLiked', (likeData) => {
            console.log('Like notifié:', likeData);
            socket.broadcast.emit('postLikeUpdate', likeData);
        });
    });

    return { io, userSockets };
};

module.exports = { setupWebSocket, userSockets };