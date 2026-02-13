const db = require('../config/database');
const bcrypt = require('bcryptjs');

// @desc    Get all trainers
// @route   GET /api/trainers
// @access  Public
const getAllTrainers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', available = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                t.*,
                u.email,
                u.is_active,
                COUNT(DISTINCT ts.id) as total_sessions,
                AVG(t.rating) as avg_rating
            FROM trainers t
            INNER JOIN users u ON t.user_id = u. id
            LEFT JOIN training_sessions ts ON t.id = ts. trainer_id
            WHERE 1=1
        `;

        const params = [];

        if (search) {
            query += ` AND (t.first_name LIKE ? OR t.last_name LIKE ?  OR t.specialization LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (available !== '') {
            query += ` AND t.is_available = ?`;
            params.push(available === 'true' ? 1 : 0);
        }

        query += ` GROUP BY t.id ORDER BY t.created_at DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [trainers] = await db.query(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total
            FROM trainers t
            INNER JOIN users u ON t.user_id = u.id
            WHERE 1=1
        `;
        const countParams = [];

        if (search) {
            countQuery += ` AND (t.first_name LIKE ? OR t.last_name LIKE ?  OR t.specialization LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (available !== '') {
            countQuery += ` AND t.is_available = ? `;
            countParams.push(available === 'true' ? 1 : 0);
        }

        const [countResult] = await db. query(countQuery, countParams);
        const total = countResult[0].total;

        res. json({
            success: true,
            data: {
                trainers,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get all trainers error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching trainers',
            error: error.message
        });
    }
};

// @desc    Get single trainer
// @route   GET /api/trainers/:id
// @access  Public
const getTrainer = async (req, res) => {
    try {
        const { id } = req.params;

        const [trainers] = await db. query(
            `SELECT 
                t.*,
                u. email,
                u.is_active,
                COUNT(DISTINCT ts.id) as total_sessions,
                COUNT(DISTINCT ts.member_id) as total_clients
            FROM trainers t
            INNER JOIN users u ON t.user_id = u.id
            LEFT JOIN training_sessions ts ON t.id = ts.trainer_id
            WHERE t.id = ? 
            GROUP BY t.id`,
            [id]
        );

        if (trainers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Trainer not found'
            });
        }

        const trainer = trainers[0];

        // Get upcoming sessions
        const [upcomingSessions] = await db.query(
            `SELECT 
                ts.*,
                m.first_name as member_first_name,
                m.last_name as member_last_name
            FROM training_sessions ts
            INNER JOIN members m ON ts. member_id = m.id
            WHERE ts.trainer_id = ? AND ts.session_date >= CURDATE() AND ts.status = 'scheduled'
            ORDER BY ts.session_date ASC, ts.start_time ASC
            LIMIT 10`,
            [id]
        );

        // Get reviews/ratings (if you implement this feature)
        const [reviews] = await db.query(
            `SELECT * FROM trainer_reviews WHERE trainer_id = ?  ORDER BY created_at DESC LIMIT 5`,
            [id]
        );

        res.json({
            success: true,
            data: {
                ... trainer,
                upcomingSessions,
                reviews
            }
        });

    } catch (error) {
        console.error('Get trainer error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching trainer',
            error: error.message
        });
    }
};

// @desc    Create trainer
// @route   POST /api/trainers
// @access  Private (Admin)
const createTrainer = async (req, res) => {
    try {
        const {
            email,
            password,
            firstName,
            lastName,
            phone,
            specialization,
            experienceYears,
            certifications,
            bio,
            hourlyRate
        } = req.body;

        // Check if email exists
        const [existingUsers] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers. length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Create user
            const [userResult] = await connection.query(
                'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
                [email, hashedPassword, 'trainer']
            );

            const userId = userResult.insertId;

            // Create trainer
            const [trainerResult] = await connection.query(
                `INSERT INTO trainers (
                    user_id, first_name, last_name, phone, specialization,
                    experience_years, certifications, bio, hourly_rate
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, firstName, lastName, phone, specialization,
                    experienceYears, certifications, bio, hourlyRate
                ]
            );

            await connection.commit();
            connection.release();

            res.status(201).json({
                success: true,
                message: 'Trainer created successfully',
                data: {
                    id: trainerResult.insertId,
                    userId,
                    email,
                    firstName,
                    lastName
                }
            });

        } catch (error) {
            await connection. rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Create trainer error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating trainer',
            error: error.message
        });
    }
};

// @desc    Update trainer
// @route   PUT /api/trainers/:id
// @access  Private (Admin/Trainer)
const updateTrainer = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            firstName,
            lastName,
            phone,
            specialization,
            experienceYears,
            certifications,
            bio,
            hourlyRate,
            isAvailable
        } = req. body;

        // Check if trainer exists
        const [trainers] = await db.query('SELECT * FROM trainers WHERE id = ?', [id]);

        if (trainers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Trainer not found'
            });
        }

        await db.query(
            `UPDATE trainers SET
                first_name = ?,
                last_name = ?,
                phone = ?,
                specialization = ?,
                experience_years = ?,
                certifications = ?,
                bio = ?,
                hourly_rate = ?,
                is_available = ?
            WHERE id = ?`,
            [
                firstName, lastName, phone, specialization, experienceYears,
                certifications, bio, hourlyRate, isAvailable, id
            ]
        );

        res.json({
            success: true,
            message: 'Trainer updated successfully'
        });

    } catch (error) {
        console.error('Update trainer error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating trainer',
            error: error.message
        });
    }
};

// @desc    Delete trainer
// @route   DELETE /api/trainers/:id
// @access  Private (Admin)
const deleteTrainer = async (req, res) => {
    try {
        const { id } = req.params;

        const [trainers] = await db.query('SELECT user_id FROM trainers WHERE id = ?', [id]);

        if (trainers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Trainer not found'
            });
        }

        // Delete user (will cascade delete trainer)
        await db.query('DELETE FROM users WHERE id = ? ', [trainers[0].user_id]);

        res.json({
            success: true,
            message: 'Trainer deleted successfully'
        });

    } catch (error) {
        console.error('Delete trainer error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting trainer',
            error:  error.message
        });
    }
};

// @desc    Get trainer schedule
// @route   GET /api/trainers/:id/schedule
// @access  Private
const getTrainerSchedule = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req. query;

        let query = `
            SELECT 
                ts.*,
                m.first_name as member_first_name,
                m.last_name as member_last_name,
                m.phone as member_phone
            FROM training_sessions ts
            INNER JOIN members m ON ts. member_id = m.id
            WHERE ts.trainer_id = ? 
        `;

        const params = [id];

        if (startDate && endDate) {
            query += ` AND ts.session_date BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY ts.session_date ASC, ts.start_time ASC`;

        const [schedule] = await db.query(query, params);

        res.json({
            success: true,
            data: schedule
        });

    } catch (error) {
        console.error('Get trainer schedule error:', error);
        res.status(500).json({
            success: false,
            message:  'Error fetching schedule',
            error: error.message
        });
    }
};

module.exports = {
    getAllTrainers,
    getTrainer,
    createTrainer,
    updateTrainer,
    deleteTrainer,
    getTrainerSchedule
};