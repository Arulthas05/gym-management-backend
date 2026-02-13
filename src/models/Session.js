const db = require('../config/database');

class Session {
    // Find session by ID
    static async findById(id) {
        const [rows] = await db.query(
            `SELECT 
                ts.*,
                t.first_name as trainer_first_name,
                t.last_name as trainer_last_name,
                t.specialization,
                m.first_name as member_first_name,
                m.last_name as member_last_name
            FROM training_sessions ts
            INNER JOIN trainers t ON ts.trainer_id = t.id
            INNER JOIN members m ON ts.member_id = m. id
            WHERE ts.id = ?`,
            [id]
        );
        return rows[0];
    }

    // Create new session
    static async create(sessionData) {
        const {
            trainerId,
            memberId,
            sessionDate,
            startTime,
            endTime,
            sessionType,
            notes
        } = sessionData;

        const [result] = await db. query(
            `INSERT INTO training_sessions (
                trainer_id, member_id, session_date, start_time,
                end_time, session_type, notes, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
            [trainerId, memberId, sessionDate, startTime, endTime, sessionType, notes]
        );

        return result.insertId;
    }

    // Update session
    static async update(id, sessionData) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'session_date', 'start_time', 'end_time', 'session_type', 'notes', 'status'
        ];

        Object.keys(sessionData).forEach(key => {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (allowedFields.includes(snakeKey) && sessionData[key] !== undefined) {
                fields.push(`${snakeKey} = ?`);
                values.push(sessionData[key]);
            }
        });

        if (fields. length === 0) return false;

        values.push(id);
        const [result] = await db.query(
            `UPDATE training_sessions SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    // Delete session
    static async delete(id) {
        const [result] = await db.query('DELETE FROM training_sessions WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    // Find all sessions
    static async findAll(filters = {}) {
        let query = `
            SELECT 
                ts.*,
                t.first_name as trainer_first_name,
                t.last_name as trainer_last_name,
                m.first_name as member_first_name,
                m.last_name as member_last_name
            FROM training_sessions ts
            INNER JOIN trainers t ON ts.trainer_id = t. id
            INNER JOIN members m ON ts.member_id = m.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.status) {
            query += ' AND ts.status = ?';
            params.push(filters.status);
        }

        if (filters. trainerId) {
            query += ' AND ts.trainer_id = ? ';
            params.push(filters.trainerId);
        }

        if (filters.memberId) {
            query += ' AND ts.member_id = ?';
            params.push(filters.memberId);
        }

        if (filters.startDate && filters.endDate) {
            query += ' AND ts.session_date BETWEEN ? AND ?';
            params.push(filters.startDate, filters.endDate);
        }

        query += ' ORDER BY ts.session_date DESC, ts.start_time DESC';

        if (filters.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(parseInt(filters. limit), parseInt(filters.offset || 0));
        }

        const [rows] = await db. query(query, params);
        return rows;
    }

    // Count sessions
    static async count(filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM training_sessions ts WHERE 1=1';
        const params = [];

        if (filters.status) {
            query += ' AND ts.status = ? ';
            params.push(filters.status);
        }

        if (filters.trainerId) {
            query += ' AND ts. trainer_id = ?';
            params.push(filters.trainerId);
        }

        if (filters.memberId) {
            query += ' AND ts.member_id = ?';
            params. push(filters.memberId);
        }

        const [rows] = await db.query(query, params);
        return rows[0].total;
    }

    // Check for conflicts
    static async checkConflict(trainerId, sessionDate, startTime, endTime, excludeId = null) {
        let query = `
            SELECT * FROM training_sessions 
            WHERE trainer_id = ? 
            AND session_date = ?  
            AND status != 'cancelled'
            AND (
                (start_time <= ? AND end_time > ?) OR
                (start_time < ? AND end_time >= ?) OR
                (start_time >= ? AND end_time <= ?)
            )
        `;
        const params = [trainerId, sessionDate, startTime, startTime, endTime, endTime, startTime, endTime];

        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }

        const [rows] = await db.query(query, params);
        return rows. length > 0;
    }

    // Update status
    static async updateStatus(id, status) {
        const [result] = await db.query(
            'UPDATE training_sessions SET status = ? WHERE id = ? ',
            [status, id]
        );
        return result. affectedRows > 0;
    }
}

module.exports = Session;