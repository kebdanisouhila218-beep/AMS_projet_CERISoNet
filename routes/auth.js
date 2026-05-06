const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { pgClient } = require('../config/db');

router.get('/login', (req, res) => {
    const email = req.query.email;
    const password = req.query.password;

    console.log('Tentative de connexion:', { email, hasPassword: !!password });

    if (!email || !password) {
        return res.json({ success: false, message: 'Email et mot de passe requis' });
    }

    // 1. D'abord le SELECT pour vérifier l'utilisateur
    pgClient.query('SELECT * FROM fredouil.compte WHERE mail = $1', [email])
        .then(result => {
            const user = result.rows[0];

            if (!user) {
                return res.json({ success: false, message: 'Email ou mot de passe incorrect' });
            }

            const hash = crypto.createHash('sha1').update(password).digest('hex');
            if (hash !== user.motpasse) {
                return res.json({ success: false, message: 'Email ou mot de passe incorrect' });
            }

            // 2. Ensuite l'UPDATE seulement si le mot de passe est bon
            return pgClient.query('UPDATE fredouil.compte SET statut_connexion = 1 WHERE mail = $1', [email])
                .then(() => {
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
                });
        })
        .catch(err => {
            console.log('Erreur base de données:', err);
            res.json({ success: false, message: 'Erreur serveur' });
        });
});

router.get('/logout', (req, res) => {
    const userId = req.session.userId;

    if (userId) {
        pgClient.query('UPDATE fredouil.compte SET statut_connexion = 0 WHERE id = $1', [userId])
            .then(() => {
                req.session.destroy(() => res.json({ success: true }));
            })
            .catch(err => {
                console.log('Erreur lors de la mise à jour du statut:', err);
                req.session.destroy(() => res.json({ success: true }));
            });
    } else {
        req.session.destroy(() => res.json({ success: true }));
    }
});

router.get('/test-session', (req, res) => {
    res.json({
        success: true,
        isConnected: req.session.isConnected || false,
        userId: req.session.userId || null,
        userPseudo: req.session.userPseudo || null
    });
});

module.exports = router;