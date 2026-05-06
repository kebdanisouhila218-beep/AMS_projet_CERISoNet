const { Server } = require("socket.io");

// Maps pour suivre les utilisateurs connectés
const connectedUsers = new Map(); // socketId → userData
const userSockets = new Map();    // userId → socketId

const setupWebSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log('Utilisateur connecté via WebSocket:', socket.id);

        // Envoie immédiatement la liste courante au nouveau connecté
        socket.emit('onlineUsersList', Array.from(connectedUsers.values()));

        socket.on('userConnected', (userData) => {
            const { userId, pseudo } = userData;

            // ── Nettoyage : si ce userId avait déjà un socket, on le retire ──
            const oldSocketId = userSockets.get(userId);
            if (oldSocketId && oldSocketId !== socket.id) {
                console.log(`Nettoyage ancien socket pour ${pseudo} (${oldSocketId})`);
                connectedUsers.delete(oldSocketId);
            }

            // Enregistre le nouveau socket
            connectedUsers.set(socket.id, { userId, pseudo });
            userSockets.set(userId, socket.id);
            console.log('Utilisateur en ligne:', pseudo);

            // Notifie les autres
            socket.broadcast.emit('userStatusUpdate', {
                userId, pseudo, status: 'online'
            });

            // Envoie la liste complète à tout le monde
            io.emit('onlineUsersList', Array.from(connectedUsers.values()));
        });

        socket.on('disconnect', () => {
            const userData = connectedUsers.get(socket.id);
            if (userData) {
                const { userId, pseudo } = userData;

                // Ne supprime de userSockets que si c'est bien ce socket
                if (userSockets.get(userId) === socket.id) {
                    userSockets.delete(userId);
                }

                console.log('Utilisateur déconnecté:', pseudo);
                connectedUsers.delete(socket.id);

                socket.broadcast.emit('userStatusUpdate', {
                    userId, pseudo, status: 'offline'
                });

                io.emit('onlineUsersList', Array.from(connectedUsers.values()));
            }
        });

        socket.on('newComment', (commentData) => {
            console.log('Nouveau commentaire notifié:', commentData);
            socket.broadcast.emit('commentAdded', commentData);
        });

        socket.on('postLiked', (likeData) => {
            console.log('Like notifié:', likeData);
            socket.broadcast.emit('postLikeUpdate', likeData);
        });
    });

    return { io, userSockets };
};

module.exports = { setupWebSocket, userSockets };