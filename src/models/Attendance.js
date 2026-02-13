const db = require('../config/database');

class Attendance {
    // Create attendance record
    static async create(attendanceData) {
        const { memberId, attendanceDate, checkInMethod } = attendanceData;

        const [result] = await db.query(
            'INSERT INTO attendance (member_id, attendance_date, check_in_method) VALUES (?, ?, ?)',
            [memberId, attendanceDate, checkInMethod || 'manual']
        );

        return result.insertId;
    }

    // Check-out
    static async checkOut(attendanceId) {
        const [result] = await db.query(
            'UPDATE attendance SET check_out_time = NOW() WHERE id = ?',
            [attendanceId]
        );
        return result.affectedRows > 0;
    }

    // Find today's check-in
    static async findTodayCheckIn(memberId, date) {
        const [rows] = await db.query(
            'SELECT * FROM attendance WHERE member_id = ? AND attendance_date = ?  AND check_out_time IS NULL',
            [memberId, date]
        );
        return rows[0];
    }

    // Find all attendance
    static async findAll(filters = {}) {
        let query = `
            SELECT 
                a.*,
                m.first_name,
                m.last_name,
                u.email
            FROM attendance a
            INNER JOIN members m ON a.member_id = m.id
            INNER JOIN users u ON m.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.memberId) {
            query += ' AND a.member_id = ?';
            params.push(filters.memberId);
        }

        if (filters.startDate && filters.endDate) {
            query += ' AND a.attendance_date BETWEEN ? AND ?';
            params.push(filters.startDate, filters.endDate);
        }

        query += ' ORDER BY a.check_in_time DESC';

        if (filters.limit) {
            query += ' LIMIT ?  OFFSET ?';
            params.push(parseInt(filters.limit), parseInt(filters.offset || 0));
        }

        const [rows] = await db.query(query, params);
        return rows;
    }

    // Count member visits
    static async countMemberVisits(memberId) {
        const [rows] = await db. query(
            'SELECT COUNT(*) as total FROM attendance WHERE member_id = ?',
            [memberId]
        );
        return rows[0].total;
    }
}

module.exports = Attendance;