const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');
const cronJobs = require('./src/services/cronJobs');

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials:  true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
    windowMs:  15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Serve static files
app.use('/uploads', express.static('uploads'));

// API Routes
app.use('/api/auth', require('./src/routes/authRoutes'));
app.use('/api/users', require('./src/routes/userRoutes'));
app.use('/api/members', require('./src/routes/memberRoutes'));
app.use('/api/trainers', require('./src/routes/trainerRoutes'));
app.use('/api/sessions', require('./src/routes/sessionRoutes'));
app.use('/api/memberships', require('./src/routes/membershipRoutes'));
app.use('/api/payments', require('./src/routes/paymentRoutes'));
app.use('/api/supplements', require('./src/routes/supplementRoutes'));
app.use('/api/attendance', require('./src/routes/attendanceRoutes'));
app.use('/api/reports', require('./src/routes/reportRoutes'));

// Health check route
app.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Gym Management System API',
        version: '1.0.0',
        documentation: '/api/docs'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Initialize cron jobs
if (process.env.NODE_ENV !== 'test') {
    cronJobs.initializeCronJobs();
}

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    console.log(`
    ╔════════════════════════════════════════════╗
    ║                                            ║
    ║   🏋️  GYM MANAGEMENT SYSTEM API 🏋️        ║
    ║                                            ║
    ║   Server:  http://localhost:${PORT}         ║
    ║   Environment: ${process.env.NODE_ENV}                ║
    ║                                            ║
    ╚════════════════════════════════════════════╝
    `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Promise Rejection:', err);
    // Close server & exit process
    process.exit(1);
});

module.exports = app;