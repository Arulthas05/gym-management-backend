const mysql = require('mysql2');
require('dotenv').config();

// Create connection pool
const pool = mysql. createPool({
    host: process.env.DB_HOST || 'localhost',
    user:  process.env.DB_USER || 'root',
    password:  process.env.DB_PASSWORD || '',
    database: process.env. DB_NAME || 'gym_management',
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Get promise-based pool
const promisePool = pool.promise();

// Test database connection
const testConnection = async () => {
    try {
        const connection = await promisePool.getConnection();
        console.log('✅ Database connected successfully');
        connection.release();
    } catch (error) {
        console.error('❌ Database connection failed:', error. message);
        process.exit(1);
    }
};

testConnection();

module.exports = promisePool;