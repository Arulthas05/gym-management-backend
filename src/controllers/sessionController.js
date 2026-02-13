const db = require('../config/database');
const emailService = require('../services/emailService');

// @desc    Get all sessions
// @route   GET /api/sessions
// @access  Private
const getAllSessions = async (req, res) => {
    try {
        const { page = 1, limit = 10, status = '', trainerId = '', memberId = '', startDate = '', endDate = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                ts.*,
                t.first_name as trainer_first_name,
                t.last_name as trainer_last_name,
                t.specialization,
                m.first_name as member_first_name,
                m.last_name as member_last_name,
                m. phone as member_phone
            FROM training_sessions ts
            INNER JOIN trainers t ON ts.trainer_id = t.id
            INNER JOIN members m ON ts.member_id = m. id
            WHERE 1=1
        `;

        const params = [];

        if (status) {
            query += ` AND ts.status = ?`;
            params.push(status);
        }

        if (trainerId) {
            query += ` AND ts.trainer_id = ?`;
            params.push(trainerId);
        }

        if (memberId) {
            query += ` AND ts.member_id = ?`;
            params.push(memberId);
        }

        if (startDate && endDate) {
            query += ` AND ts.session_date BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY ts.session_date DESC, ts.start_time DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [sessions] = await db.query(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total
            FROM training_sessions ts
            WHERE 1=1
        `;
        const countParams = [];

        if (status) {
            countQuery += ` AND ts.status = ?`;
            countParams.push(status);
        }

        if (trainerId) {
            countQuery += ` AND ts.trainer_id = ?`;
            countParams.push(trainerId);
        }

        if (memberId) {
            countQuery += ` AND ts.member_id = ?`;
            countParams.push(memberId);
        }

        if (startDate && endDate) {
            countQuery += ` AND ts.session_date BETWEEN ? AND ?`;
            countParams.push(startDate, endDate);
        }

        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            success: true,
            data: {
                sessions,
                pagination:  {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get all sessions error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching sessions',
            error: error.message
        });
    }
};

// @desc    Get single session
// @route   GET /api/sessions/: id
// @access  Private
const getSession = async (req, res) => {
    try {
        const { id } = req.params;

        const [sessions] = await db.query(
            `SELECT 
                ts.*,
                t.first_name as trainer_first_name,
                t.last_name as trainer_last_name,
                t.phone as trainer_phone,
                t.specialization,
                t.hourly_rate,
                m. first_name as member_first_name,
                m.last_name as member_last_name,
                m.phone as member_phone,
                m.email as member_email
            FROM training_sessions ts
            INNER JOIN trainers t ON ts.trainer_id = t.id
            INNER JOIN members m ON ts.member_id = m.id
            WHERE ts. id = ? `,
            [id]
        );

        if (sessions.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        res.json({
            success: true,
            data: sessions[0]
        });

    } catch (error) {
        console.error('Get session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching session',
            error: error.message
        });
    }
};

// @desc    Book a training session
// @route   POST /api/sessions
// @access  Private (Member)
const bookSession = async (req, res) => {
    try {
        const {
            trainerId,
            memberId,
            sessionDate,
            startTime,
            endTime,
            sessionType,
            notes
        } = req.body;

        // Check if trainer exists and is available
        const [trainers] = await db.query(
            'SELECT * FROM trainers WHERE id = ?  AND is_available = 1',
            [trainerId]
        );

        if (trainers. length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Trainer not found or not available'
            });
        }

        // Check if member exists
        const [members] = await db.query(
            'SELECT * FROM members WHERE id = ?',
            [memberId]
        );

        if (members.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        // Check if trainer is already booked for this time slot
        const [existingSessions] = await db.query(
            `SELECT * FROM training_sessions 
            WHERE trainer_id = ?  
            AND session_date = ?  
            AND status != 'cancelled'
            AND (
                (start_time <= ?  AND end_time > ?) OR
                (start_time < ? AND end_time >= ?) OR
                (start_time >= ? AND end_time <= ?)
            )`,
            [trainerId, sessionDate, startTime, startTime, endTime, endTime, startTime, endTime]
        );

        if (existingSessions.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Trainer is already booked for this time slot'
            });
        }

        // Create session
        const [result] = await db.query(
            `INSERT INTO training_sessions (
                trainer_id, member_id, session_date, start_time, 
                end_time, session_type, notes, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
            [trainerId, memberId, sessionDate, startTime, endTime, sessionType, notes]
        );

        // Get member email for confirmation
        const [memberUser] = await db.query(
            'SELECT u.email FROM users u INNER JOIN members m ON u.id = m.user_id WHERE m.id = ?',
            [memberId]
        );

        // Send confirmation email
        if (memberUser.length > 0) {
            await emailService.sendSessionConfirmation(
                memberUser[0].email,
                members[0].first_name,
                trainers[0].first_name + ' ' + trainers[0]. last_name,
                sessionDate,
                startTime
            );
        }

        res.status(201).json({
            success: true,
            message: 'Session booked successfully',
            data: {
                sessionId: result.insertId
            }
        });

    } catch (error) {
        console.error('Book session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error booking session',
            error: error.message
        });
    }
};

// @desc    Update session
// @route   PUT /api/sessions/:id
// @access  Private
const updateSession = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            sessionDate,
            startTime,
            endTime,
            sessionType,
            notes,
            status
        } = req.body;

        // Check if session exists
        const [sessions] = await db.query('SELECT * FROM training_sessions WHERE id = ?', [id]);

        if (sessions.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        const session = sessions[0];

        // If updating time, check for conflicts
        if (sessionDate || startTime || endTime) {
            const newDate = sessionDate || session.session_date;
            const newStartTime = startTime || session.start_time;
            const newEndTime = endTime || session.end_time;

            const [conflicts] = await db.query(
                `SELECT * FROM training_sessions 
                WHERE trainer_id = ? 
                AND session_date = ? 
                AND id != ? 
                AND status != 'cancelled'
                AND (
                    (start_time <= ? AND end_time > ?) OR
                    (start_time < ? AND end_time >= ?) OR
                    (start_time >= ? AND end_time <= ?)
                )`,
                [session.trainer_id, newDate, id, newStartTime, newStartTime, newEndTime, newEndTime, newStartTime, newEndTime]
            );

            if (conflicts.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Trainer is already booked for this time slot'
                });
            }
        }

        // Update session
        await db.query(
            `UPDATE training_sessions SET
                session_date = COALESCE(?, session_date),
                start_time = COALESCE(?, start_time),
                end_time = COALESCE(?, end_time),
                session_type = COALESCE(?, session_type),
                notes = COALESCE(?, notes),
                status = COALESCE(?, status)
            WHERE id = ?`,
            [sessionDate, startTime, endTime, sessionType, notes, status, id]
        );

        res.json({
            success: true,
            message: 'Session updated successfully'
        });

    } catch (error) {
        console.error('Update session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating session',
            error: error.message
        });
    }
};

// @desc    Cancel session
// @route   PUT /api/sessions/:id/cancel
// @access  Private
const cancelSession = async (req, res) => {
    try {
        const { id } = req. params;

        const [sessions] = await db.query('SELECT * FROM training_sessions WHERE id = ?', [id]);

        if (sessions.length === 0) {
            return res. status(404).json({
                success: false,
                message:  'Session not found'
            });
        }

        await db.query(
            'UPDATE training_sessions SET status = ? WHERE id = ?',
            ['cancelled', id]
        );

        res.json({
            success: true,
            message: 'Session cancelled successfully'
        });

    } catch (error) {
        console.error('Cancel session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling session',
            error: error. message
        });
    }
};

// @desc    Delete session
// @route   DELETE /api/sessions/:id
// @access  Private (Admin)
const deleteSession = async (req, res) => {
    try {
        const { id } = req.params;

        const [sessions] = await db. query('SELECT * FROM training_sessions WHERE id = ?', [id]);

        if (sessions.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        await db.query('DELETE FROM training_sessions WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Session deleted successfully'
        });

    } catch (error) {
        console.error('Delete session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting session',
            error: error.message
        });
    }
};

// @desc    Complete session
// @route   PUT /api/sessions/:id/complete
// @access  Private (Trainer)
const completeSession = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const [sessions] = await db.query('SELECT * FROM training_sessions WHERE id = ?', [id]);

        if (sessions.length === 0) {
            return res. status(404).json({
                success: false,
                message:  'Session not found'
            });
        }

        await db.query(
            'UPDATE training_sessions SET status = ?, notes = ? WHERE id = ? ',
            ['completed', notes, id]
        );

        res.json({
            success: true,
            message: 'Session marked as completed'
        });

    } catch (error) {
        console.error('Complete session error:', error);
        res.status(500).json({
            success: false,
            message: 'Error completing session',
            error: error. message
        });
    }
};

module.exports = {
    getAllSessions,
    getSession,
    bookSession,
    updateSession,
    cancelSession,
    deleteSession,
    completeSession
};