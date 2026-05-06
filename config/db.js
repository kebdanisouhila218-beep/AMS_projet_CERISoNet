const { Pool } = require('pg');
const { MongoClient } = require('mongodb');

// Connexion PostgreSQL pour les comptes utilisateurs
const pgClient = new Pool({
    user: 'uapv2600478',
    host: '127.0.0.1',
    database: 'etd',
    password: 'ftdv7h',
    port: 5432
});

// Test de la connexion PostgreSQL au démarrage
pgClient.query('SELECT 1 as test')
    .then(result => console.log('Connexion PostgreSQL réussie:', result.rows))
    .catch(err => console.log('Erreur connexion PostgreSQL:', err));

// URL de connexion MongoDB
const dsnMongoDB = "mongodb://127.0.0.1:27017/db-CERI";

// Fonction utilitaire pour se connecter à MongoDB
const connectMongo = () => MongoClient.connect(dsnMongoDB);

module.exports = { pgClient, dsnMongoDB, connectMongo };