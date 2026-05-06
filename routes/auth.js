const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pgClient } = require('../config/db');

// ============================================================
// ROUTE LOGIN : vérifie les credentials dans PostgreSQL
// ============================================================
router.get('/login', (req, res) => {
    const email = req.query.email;
    const password = req.query.password;

    console.log('Tentative de connexion:', { email, hasPassword: !!password });

    if (!email || !password) {
        return res.json({ success: false, message: 'Email et mot de passe requis' });
    }

    // Recherche de l'utilisateur dans PostgreSQL
    pgClient.query('SELECT * FROM fredouil.compte WHERE mail = $1', [email])
        .then(result => {
            const user = result.rows[0];

            if (!user) {
                return res.json({ success: false, message: 'Email ou mot de passe incorrect' });
            }

            // Vérification du mot de passe hashé en SHA1
            const hash = crypto.createHash('sha1').update(password).digest('hex');

            if (hash !== user.motpasse) {
                return res.json({ success: false, message: 'Email ou mot de passe incorrect' });
            }

            // Stockage des informations dans la session serveur
            req.session.isConnected = true;
            req.session.userId = user.id;
            req.session.userPseudo = user.pseudo;
            req.session.userEmail = user.mail;

            console.log('Connexion réussie pour:', user.pseudo);

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
            console.log('Erreur base de données:', err);
            res.json({ success: false, message: 'Erreur serveur' });
        });
});

// ============================================================
// ROUTE LOGOUT : détruit la session
// ============================================================
router.get('/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

// ============================================================
// ROUTE TEST-SESSION : vérifie si l'utilisateur est connecté
// ============================================================
router.get('/test-session', (req, res) => {
    res.json({
        success: true,
        isConnected: req.session.isConnected || false,
        userId: req.session.userId || null,
        userPseudo: req.session.userPseudo || null
    });
});

module.exports = router;