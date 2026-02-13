const jwt = require('jsonwebtoken');
const db = require('../config/database');

// Verify JWT token
const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'No token provided, authorization denied' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Check if user exists and is active
        const [users] = await db.query(
            'SELECT id, email, role, is_active FROM users WHERE id = ? ',
            [decoded.id]
        );

        if (users.length === 0) {
            return res.status(401).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        const user = users[0];

        if (!user.is_active) {
            return res.status(401).json({ 
                success: false,
                message: 'Account is deactivated' 
            });
        }

        // Attach user to request
        req.user = {
            id: user.id,
            email: user.email,
            role: user.role
        };

        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid token' 
            });
        }
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token expired' 
            });
        }
        res.status(500).json({ 
            success: false,
            message: 'Authentication error' 
        });
    }
};

module.exports = auth;