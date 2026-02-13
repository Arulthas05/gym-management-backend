const db = require('../config/database');

class Trainer {
    // Find trainer by ID
    static async findById(id) {
        const [rows] = await db.query(
            `SELECT t.*, u.email, u. is_active 
             FROM trainers t 
             INNER JOIN users u ON t.user_id = u.id 
             WHERE t.id = ?`,
            [id]
        );
        return rows[0];
    }

    // Find trainer by user ID
    static async findByUserId(userId) {
        const [rows] = await db.query(
            'SELECT * FROM trainers WHERE user_id = ?',
            [userId]
        );
        return rows[0];
    }

    // Create new trainer
    static async create(trainerData) {
        const {
            userId,
            firstName,
            lastName,
            phone,
            specialization,
            experienceYears,
            certifications,
            bio,
            profileImage,
            hourlyRate
        } = trainerData;

        const [result] = await db.query(
            `INSERT INTO trainers (
                user_id, first_name, last_name, phone, specialization,
                experience_years, certifications, bio, profile_image, hourly_rate
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, firstName, lastName, phone, specialization,
                experienceYears, certifications, bio, profileImage, hourlyRate
            ]
        );

        return result.insertId;
    }

    // Update trainer
    static async update(id, trainerData) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'first_name', 'last_name', 'phone', 'specialization',
            'experience_years', 'certifications', 'bio', 'profile_image',
            'hourly_rate', 'rating', 'is_available'
        ];

        Object.keys(trainerData).forEach(key => {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (allowedFields.includes(snakeKey) && trainerData[key] !== undefined) {
                fields.push(`${snakeKey} = ?`);
                values.push(trainerData[key]);
            }
        });

        if (fields.length === 0) return false;

        values.push(id);
        const [result] = await db.query(
            `UPDATE trainers SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    // Delete trainer
    static async delete(id) {
        const [result] = await db.query('DELETE FROM trainers WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    // Find all trainers
    static async findAll(filters = {}) {
        let query = `
            SELECT 
                t.*,
                u.email,
                u.is_active,
                COUNT(DISTINCT ts.id) as total_sessions
            FROM trainers t
            INNER JOIN users u ON t.user_id = u.id
            LEFT JOIN training_sessions ts ON t.id = ts.trainer_id
            WHERE 1=1
        `;
        const params = [];

        if (filters.search) {
            query += ' AND (t.first_name LIKE ? OR t.last_name LIKE ? OR t.specialization LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
        }

        if (filters. isAvailable !== undefined) {
            query += ' AND t.is_available = ?';
            params.push(filters.isAvailable);
        }

        query += ' GROUP BY t.id ORDER BY t.created_at DESC';

        if (filters.limit) {
            query += ' LIMIT ?  OFFSET ?';
            params. push(parseInt(filters.limit), parseInt(filters.offset || 0));
        }

        const [rows] = await db.query(query, params);
        return rows;
    }

    // Count trainers
    static async count(filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM trainers t WHERE 1=1';
        const params = [];

        if (filters.search) {
            query += ' AND (t.first_name LIKE ? OR t.last_name LIKE ? OR t. specialization LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
        }

        if (filters.isAvailable !== undefined) {
            query += ' AND t. is_available = ?';
            params.push(filters.isAvailable);
        }

        const [rows] = await db.query(query, params);
        return rows[0].total;
    }

    // Get trainer schedule
    static async getSchedule(trainerId, startDate, endDate) {
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
        const params = [trainerId];

        if (startDate && endDate) {
            query += ' AND ts.session_date BETWEEN ? AND ?';
            params.push(startDate, endDate);
        }

        query += ' ORDER BY ts.session_date ASC, ts.start_time ASC';

        const [rows] = await db.query(query, params);
        return rows;
    }

    // Update rating
    static async updateRating(id, rating) {
        const [result] = await db.query(
            'UPDATE trainers SET rating = ? WHERE id = ?',
            [rating, id]
        );
        return result.affectedRows > 0;
    }

    // Toggle availability
    static async toggleAvailability(id) {
        const [result] = await db.query(
            'UPDATE trainers SET is_available = NOT is_available WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = Trainer;