const db = require('../config/database');
const bcrypt = require('bcryptjs');

// @desc    Get all users
// @route   GET /api/users
// @access  Private (Admin)
const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, role = '', search = '', isActive = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                u.id,
                u.email,
                u.role,
                u.is_active,
                u.created_at,
                u.updated_at
            FROM users u
            WHERE 1=1
        `;

        const params = [];

        if (role) {
            query += ` AND u.role = ?`;
            params.push(role);
        }

        if (search) {
            query += ` AND u.email LIKE ?`;
            params.push(`%${search}%`);
        }

        if (isActive !== '') {
            query += ` AND u.is_active = ? `;
            params.push(isActive === 'true' ? 1 : 0);
        }

        query += ` ORDER BY u.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [users] = await db.query(query, params);

        // Get role-specific details for each user
        for (let user of users) {
            if (user.role === 'member') {
                const [members] = await db.query(
                    'SELECT id, first_name, last_name, phone FROM members WHERE user_id = ?',
                    [user.id]
                );
                user.details = members[0] || null;
            } else if (user.role === 'trainer') {
                const [trainers] = await db.query(
                    'SELECT id, first_name, last_name, phone, specialization FROM trainers WHERE user_id = ?',
                    [user.id]
                );
                user.details = trainers[0] || null;
            }
        }

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM users u WHERE 1=1`;
        const countParams = [];

        if (role) {
            countQuery += ` AND u.role = ?`;
            countParams.push(role);
        }

        if (search) {
            countQuery += ` AND u.email LIKE ?`;
            countParams.push(`%${search}%`);
        }

        if (isActive !== '') {
            countQuery += ` AND u.is_active = ?`;
            countParams.push(isActive === 'true' ? 1 : 0);
        }

        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            success: true,
            data:  {
                users,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems:  total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get all users error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching users',
            error: error.message
        });
    }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private
const getUser = async (req, res) => {
    try {
        const { id } = req.params;

        const [users] = await db.query(
            'SELECT id, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
            [id]
        );

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = users[0];

        // Get role-specific details
        if (user.role === 'member') {
            const [members] = await db.query(
                'SELECT * FROM members WHERE user_id = ? ',
                [user.id]
            );
            user.details = members[0] || null;
        } else if (user.role === 'trainer') {
            const [trainers] = await db.query(
                'SELECT * FROM trainers WHERE user_id = ?',
                [user.id]
            );
            user.details = trainers[0] || null;
        }

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            success: false,
            message:  'Error fetching user',
            error: error.message
        });
    }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private (Admin)
const createUser = async (req, res) => {
    try {
        const { email, password, role } = req.body;

        // Check if email already exists
        const [existingUsers] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const [result] = await db.query(
            'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
            [email, hashedPassword, role]
        );

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                id:  result.insertId,
                email,
                role
            }
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating user',
            error: error.message
        });
    }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private (Admin)
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, role, isActive } = req.body;

        // Check if user exists
        const [users] = await db.query('SELECT * FROM users WHERE id = ? ', [id]);

        if (users.length === 0) {
            return res. status(404).json({
                success: false,
                message:  'User not found'
            });
        }

        // Check if email is being changed and already exists
        if (email && email !== users[0].email) {
            const [existingUsers] = await db. query(
                'SELECT * FROM users WHERE email = ?  AND id != ?',
                [email, id]
            );

            if (existingUsers.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already exists'
                });
            }
        }

        // Update user
        await db.query(
            `UPDATE users SET
                email = COALESCE(?, email),
                role = COALESCE(?, role),
                is_active = COALESCE(?, is_active)
            WHERE id = ?`,
            [email, role, isActive, id]
        );

        res.json({
            success: true,
            message: 'User updated successfully'
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user',
            error: error.message
        });
    }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private (Admin)
const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const [users] = await db. query('SELECT * FROM users WHERE id = ?', [id]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent deleting yourself
        if (req.user. id === parseInt(id)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot delete your own account'
            });
        }

        // Delete user (cascade will delete related records)
        await db.query('DELETE FROM users WHERE id = ? ', [id]);

        res.json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting user',
            error:  error.message
        });
    }
};

// @desc    Activate/Deactivate user
// @route   PUT /api/users/:id/toggle-status
// @access  Private (Admin)
const toggleUserStatus = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const [users] = await db. query('SELECT * FROM users WHERE id = ?', [id]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = users[0];
        const newStatus = ! user.is_active;

        // Update user status
        await db.query(
            'UPDATE users SET is_active = ?  WHERE id = ?',
            [newStatus, id]
        );

        res.json({
            success: true,
            message:  `User ${newStatus ? 'activated' : 'deactivated'} successfully`,
            data: {
                isActive: newStatus
            }
        });

    } catch (error) {
        console.error('Toggle user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Error toggling user status',
            error: error.message
        });
    }
};

// @desc    Update user password
// @route   PUT /api/users/:id/password
// @access  Private (Admin)
const updateUserPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        // Check if user exists
        const [users] = await db. query('SELECT * FROM users WHERE id = ?', [id]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        // Update password
        await db.query(
            'UPDATE users SET password = ?  WHERE id = ?',
            [hashedPassword, id]
        );

        res.json({
            success: true,
            message: 'Password updated successfully'
        });

    } catch (error) {
        console.error('Update user password error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating password',
            error: error.message
        });
    }
};

// @desc    Get user statistics
// @route   GET /api/users/: id/stats
// @access  Private
const getUserStats = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user exists
        const [users] = await db.query('SELECT role FROM users WHERE id = ?', [id]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const role = users[0].role;
        let stats = {};

        if (role === 'member') {
            // Get member ID
            const [members] = await db.query('SELECT id FROM members WHERE user_id = ? ', [id]);
            
            if (members.length > 0) {
                const memberId = members[0].id;

                // Total attendance
                const [attendance] = await db.query(
                    'SELECT COUNT(*) as total FROM attendance WHERE member_id = ?',
                    [memberId]
                );

                // Total sessions
                const [sessions] = await db.query(
                    'SELECT COUNT(*) as total FROM training_sessions WHERE member_id = ? ',
                    [memberId]
                );

                // Total payments
                const [payments] = await db.query(
                    'SELECT COUNT(*) as total, SUM(amount) as total_amount FROM payments WHERE member_id = ?  AND payment_status = "completed"',
                    [memberId]
                );

                // Active membership
                const [membership] = await db.query(
                    'SELECT * FROM member_memberships WHERE member_id = ? AND status = "active" LIMIT 1',
                    [memberId]
                );

                stats = {
                    totalAttendance: attendance[0].total,
                    totalSessions:  sessions[0].total,
                    totalPayments: payments[0].total,
                    totalSpent: parseFloat(payments[0].total_amount || 0),
                    hasActiveMembership: membership. length > 0,
                    membershipEndDate: membership. length > 0 ? membership[0].end_date : null
                };
            }

        } else if (role === 'trainer') {
            // Get trainer ID
            const [trainers] = await db.query('SELECT id FROM trainers WHERE user_id = ?', [id]);
            
            if (trainers.length > 0) {
                const trainerId = trainers[0]. id;

                // Total sessions
                const [sessions] = await db.query(
                    `SELECT 
                        COUNT(*) as total,
                        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
                        COUNT(CASE WHEN status = 'scheduled' THEN 1 END) as scheduled
                    FROM training_sessions WHERE trainer_id = ?`,
                    [trainerId]
                );

                // Total clients
                const [clients] = await db.query(
                    'SELECT COUNT(DISTINCT member_id) as total FROM training_sessions WHERE trainer_id = ? ',
                    [trainerId]
                );

                // Rating
                const [rating] = await db.query(
                    'SELECT rating FROM trainers WHERE id = ?',
                    [trainerId]
                );

                stats = {
                    totalSessions: sessions[0]. total,
                    completedSessions: sessions[0]. completed,
                    scheduledSessions: sessions[0].scheduled,
                    totalClients: clients[0].total,
                    rating: parseFloat(rating[0].rating || 0)
                };
            }

        } else if (role === 'admin') {
            // Get overall system stats for admin
            const [totalMembers] = await db.query('SELECT COUNT(*) as total FROM members');
            const [totalTrainers] = await db.query('SELECT COUNT(*) as total FROM trainers');
            const [totalRevenue] = await db.query(
                'SELECT SUM(amount) as total FROM payments WHERE payment_status = "completed"'
            );
            const [todayAttendance] = await db.query(
                'SELECT COUNT(*) as total FROM attendance WHERE attendance_date = CURDATE()'
            );

            stats = {
                totalMembers: totalMembers[0]. total,
                totalTrainers: totalTrainers[0]. total,
                totalRevenue:  parseFloat(totalRevenue[0].total || 0),
                todayAttendance: todayAttendance[0].total
            };
        }

        res.json({
            success: true,
            data: stats
        });

    } catch (error) {
        console.error('Get user stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching user statistics',
            error: error.message
        });
    }
};

// @desc    Update profile picture
// @route   PUT /api/users/:id/profile-picture
// @access  Private
const updateProfilePicture = async (req, res) => {
    try {
        const { id } = req.params;
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const profileImagePath = req.file.path;

        // Get user role
        const [users] = await db.query('SELECT role FROM users WHERE id = ?', [id]);

        if (users.length === 0) {
            return res. status(404).json({
                success: false,
                message:  'User not found'
            });
        }

        const role = users[0].role;

        // Update profile image based on role
        if (role === 'member') {
            await db.query(
                'UPDATE members SET profile_image = ? WHERE user_id = ?',
                [profileImagePath, id]
            );
        } else if (role === 'trainer') {
            await db.query(
                'UPDATE trainers SET profile_image = ? WHERE user_id = ?',
                [profileImagePath, id]
            );
        }

        res.json({
            success: true,
            message:  'Profile picture updated successfully',
            data: {
                profileImage: profileImagePath
            }
        });

    } catch (error) {
        console.error('Update profile picture error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile picture',
            error: error. message
        });
    }
};

// @desc    Get current user profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
    try {
        const userId = req.user.id;

        const [users] = await db.query(
            'SELECT id, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
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
        if (user.role === 'member') {
            const [members] = await db.query(
                'SELECT * FROM members WHERE user_id = ?',
                [user.id]
            );
            user.details = members[0] || null;
        } else if (user.role === 'trainer') {
            const [trainers] = await db.query(
                'SELECT * FROM trainers WHERE user_id = ?',
                [user.id]
            );
            user.details = trainers[0] || null;
        } else if (user.role === 'admin') {
            const [admins] = await db.query(
                'SELECT * FROM admins WHERE user_id = ?',
                [user.id]
            );
            user.details = admins[0] || null;
        } else {
            // For other roles, set details to null
            user.details = null;
        }

        res.json({
            success: true,
            data: user
        });

    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching profile',
            error: error.message
        });
    }
};

// @desc    Upload profile image for current user
// @route   POST /api/users/profile/upload-image
// @access  Private
const uploadProfileImage = async (req, res) => {
    try {
        const userId = req.user.id;
        
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const profileImagePath = `/uploads/profiles/${req.file.filename}`;

        // Get user role
        const [users] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const role = users[0].role;

        // Update profile image based on role
        if (role === 'admin') {
            await db.query(
                'UPDATE admins SET profile_image = ? WHERE user_id = ?',
                [profileImagePath, userId]
            );
        } else if (role === 'member') {
            await db.query(
                'UPDATE members SET profile_image = ? WHERE user_id = ?',
                [profileImagePath, userId]
            );
        } else if (role === 'trainer') {
            await db.query(
                'UPDATE trainers SET profile_image = ? WHERE user_id = ?',
                [profileImagePath, userId]
            );
        }

        res.json({
            success: true,
            message: 'Profile image uploaded successfully',
            data: {
                profileImage: profileImagePath
            }
        });

    } catch (error) {
        console.error('Upload profile image error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading profile image',
            error: error.message
        });
    }
};

// @desc    Update current user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const userId = req.user.id;
        const { email, firstName, lastName, phone, address, dateOfBirth, gender, emergencyContact, specialization, rating } = req.body;

        // Get user role
        const [users] = await db.query('SELECT role FROM users WHERE id = ?', [userId]);

        if (users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const role = users[0].role;

        // Update email if provided
        if (email) {
            // Check if email is already taken by another user
            const [existingUsers] = await db.query(
                'SELECT id FROM users WHERE email = ? AND id != ?',
                [email, userId]
            );

            if (existingUsers.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Email already in use'
                });
            }

            await db.query(
                'UPDATE users SET email = ? WHERE id = ?',
                [email, userId]
            );
        }

        // Update role-specific details
        if (role === 'admin') {
            const updateFields = [];
            const updateValues = [];

            if (firstName !== undefined) {
                updateFields.push('first_name = ?');
                updateValues.push(firstName);
            }
            if (lastName !== undefined) {
                updateFields.push('last_name = ?');
                updateValues.push(lastName);
            }
            if (phone !== undefined) {
                updateFields.push('phone = ?');
                updateValues.push(phone);
            }
            if (dateOfBirth !== undefined) {
                updateFields.push('date_of_birth = ?');
                updateValues.push(dateOfBirth);
            }
            if (gender !== undefined) {
                updateFields.push('gender = ?');
                updateValues.push(gender);
            }
            if (address !== undefined) {
                updateFields.push('address = ?');
                updateValues.push(address);
            }

            if (updateFields.length > 0) {
                updateValues.push(userId);
                await db.query(
                    `UPDATE admins SET ${updateFields.join(', ')} WHERE user_id = ?`,
                    updateValues
                );
            }
        } else if (role === 'member') {
            const updateFields = [];
            const updateValues = [];

            if (firstName !== undefined) {
                updateFields.push('first_name = ?');
                updateValues.push(firstName);
            }
            if (lastName !== undefined) {
                updateFields.push('last_name = ?');
                updateValues.push(lastName);
            }
            if (phone !== undefined) {
                updateFields.push('phone = ?');
                updateValues.push(phone);
            }
            if (address !== undefined) {
                updateFields.push('address = ?');
                updateValues.push(address);
            }
            if (dateOfBirth !== undefined) {
                updateFields.push('date_of_birth = ?');
                updateValues.push(dateOfBirth);
            }
            if (gender !== undefined) {
                updateFields.push('gender = ?');
                updateValues.push(gender);
            }
            if (emergencyContact !== undefined) {
                updateFields.push('emergency_contact = ?');
                updateValues.push(emergencyContact);
            }

            if (updateFields.length > 0) {
                updateValues.push(userId);
                await db.query(
                    `UPDATE members SET ${updateFields.join(', ')} WHERE user_id = ?`,
                    updateValues
                );
            }
        } else if (role === 'trainer') {
            const updateFields = [];
            const updateValues = [];

            if (firstName !== undefined) {
                updateFields.push('first_name = ?');
                updateValues.push(firstName);
            }
            if (lastName !== undefined) {
                updateFields.push('last_name = ?');
                updateValues.push(lastName);
            }
            if (phone !== undefined) {
                updateFields.push('phone = ?');
                updateValues.push(phone);
            }
            if (specialization !== undefined) {
                updateFields.push('specialization = ?');
                updateValues.push(specialization);
            }
            if (rating !== undefined) {
                updateFields.push('rating = ?');
                updateValues.push(rating);
            }

            if (updateFields.length > 0) {
                updateValues.push(userId);
                await db.query(
                    `UPDATE trainers SET ${updateFields.join(', ')} WHERE user_id = ?`,
                    updateValues
                );
            }
        }

        // Get updated profile
        const [updatedUsers] = await db.query(
            'SELECT id, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
            [userId]
        );

        const user = updatedUsers[0];

        // Get role-specific details
        if (user.role === 'admin') {
            const [admins] = await db.query(
                'SELECT * FROM admins WHERE user_id = ?',
                [user.id]
            );
            user.details = admins[0] || null;
        } else if (user.role === 'member') {
            const [members] = await db.query(
                'SELECT * FROM members WHERE user_id = ?',
                [user.id]
            );
            user.details = members[0] || null;
        } else if (user.role === 'trainer') {
            const [trainers] = await db.query(
                'SELECT * FROM trainers WHERE user_id = ?',
                [user.id]
            );
            user.details = trainers[0] || null;
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: user
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile',
            error: error.message
        });
    }
};

module.exports = {
    getAllUsers,
    getUser,
    createUser,
    updateUser,
    deleteUser,
    toggleUserStatus,
    updateUserPassword,
    getUserStats,
    updateProfilePicture,
    getProfile,
    uploadProfileImage,
    updateProfile
};