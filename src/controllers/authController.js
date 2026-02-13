const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { generateRandomString } = require('../utils/helpers');
const emailService = require('../services/emailService');

// Generate JWT Token
const generateToken = (id, role) => {
    return jwt. sign({ id, role }, process. env.JWT_SECRET, {
        expiresIn: process. env.JWT_EXPIRE
    });
};

// @desc    Register new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
    try {
        const { email, password, role, firstName, lastName, phone, dateOfBirth, gender, address } = req.body;

        // Check if user already exists
        const [existingUsers] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Start transaction
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Insert user
            const [userResult] = await connection.query(
                'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
                [email, hashedPassword, role || 'member']
            );

            const userId = userResult.insertId;

            // Insert into respective role table
            if (role === 'trainer') {
                await connection.query(
                    `INSERT INTO trainers (user_id, first_name, last_name, phone) 
                     VALUES (?, ?, ?, ?)`,
                    [userId, firstName, lastName, phone]
                );
            } else {
                // Default to member
                const QRCode = require('qrcode');
                const qrData = `MEMBER-${userId}-${Date.now()}`;
                const qrCodePath = `uploads/qr/member-${userId}. png`;
                
                // Generate QR code
                await QRCode.toFile(qrCodePath, qrData);

                await connection.query(
                    `INSERT INTO members (user_id, first_name, last_name, phone, date_of_birth, gender, address, qr_code) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [userId, firstName, lastName, phone, dateOfBirth, gender, address, qrCodePath]
                );
            }

            await connection.commit();
            connection.release();

            // Generate token
            const token = generateToken(userId, role || 'member');

            // Send welcome email
            await emailService.sendWelcomeEmail(email, firstName);

            res.status(201).json({
                success: true,
                message: 'User registered successfully',
                // data: {
                    token,
                    user: {
                        id: userId,
                        email,
                        role:  role || 'member'
                    }
                // }
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message:  'Error registering user',
            error: error.message
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res. status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const user = users[0];

        // Check if account is active
        if (! user.is_active) {
            return res.status(401).json({
                success: false,
                message: 'Your account has been deactivated.  Please contact admin.'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Get user details based on role
        let userDetails = {};
        if (user.role === 'member') {
            const [members] = await db.query(
                'SELECT * FROM members WHERE user_id = ?',
                [user.id]
            );
            userDetails = members[0];
        } else if (user.role === 'trainer') {
            const [trainers] = await db.query(
                'SELECT * FROM trainers WHERE user_id = ?',
                [user.id]
            );
            userDetails = trainers[0];
        }

        // Generate token
        const token = generateToken(user.id, user.role);

        res.json({
            success: true,
            message: 'Login successful',
            // data: {
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    ... userDetails
                }
            // }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error logging in',
            error: error.message
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const userId = req.user.id;

        const [users] = await db.query(
            'SELECT id, email, role, is_active, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = users[0];

        // Get role-specific details
        let userDetails = {};
        if (user.role === 'member') {
            const [members] = await db.query(
                'SELECT * FROM members WHERE user_id = ?',
                [userId]
            );
            userDetails = members[0];
        } else if (user.role === 'trainer') {
            const [trainers] = await db.query(
                'SELECT * FROM trainers WHERE user_id = ?',
                [userId]
            );
            userDetails = trainers[0];
        }

        res. json({
            success: true,
            // data: {
                ... user,
                ...userDetails
            // }
        });

    } catch (error) {
        console.error('GetMe error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user data',
            error: error.message
        });
    }
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
    try {
        const { email } = req. body;

        const [users] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No user found with this email'
            });
        }

        const user = users[0];

        // Generate reset token
        const resetToken = generateRandomString(32);
        const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

        // Save reset token to database (you'll need to add these columns)
        await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?',
            [resetToken, resetTokenExpiry, user.id]
        );

        // Send reset email
        const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
        await emailService.sendPasswordResetEmail(email, resetUrl);

        res.json({
            success: true,
            message: 'Password reset link sent to your email'
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing request',
            error: error.message
        });
    }
};

// @desc    Reset password
// @route   POST /api/auth/reset-password/: token
// @access  Public
const resetPassword = async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        const [users] = await db.query(
            'SELECT * FROM users WHERE reset_token = ? AND reset_token_expiry > NOW()',
            [token]
        );

        if (users.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        const user = users[0];

        // Hash new password
        const salt = await bcrypt. genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Update password and clear reset token
        await db. query(
            'UPDATE users SET password = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
            [hashedPassword, user. id]
        );

        res.json({
            success: true,
            message: 'Password reset successful'
        });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting password',
            error: error.message
        });
    }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
    try {
        const userId = req.user.id;
        const { currentPassword, newPassword } = req. body;

        // Get user
        const [users] = await db.query(
            'SELECT * FROM users WHERE id = ?',
            [userId]
        );

        const user = users[0];

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await db.query(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, userId]
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message:  'Error changing password',
            error: error.message
        });
    }
};

module.exports = {
    register,
    login,
    getMe,
    forgotPassword,
    resetPassword,
    changePassword
};