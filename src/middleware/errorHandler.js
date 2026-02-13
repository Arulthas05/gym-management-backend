const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);

    // Mongoose/MySQL duplicate key error
    if (err. code === 'ER_DUP_ENTRY') {
        return res. status(400).json({
            success: false,
            message:  'Duplicate entry.  This record already exists.'
        });
    }

    // MySQL foreign key constraint error
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res. status(400).json({
            success: false,
            message:  'Referenced record does not exist.'
        });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired'
        });
    }

    // Default error
    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;