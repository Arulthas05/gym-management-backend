const db = require('../config/database');

class User {
    // Find user by ID
    static async findById(id) {
        const [rows] = await db.query(
            'SELECT id, email, role, is_active, created_at, updated_at FROM users WHERE id = ? ',
            [id]
        );
        return rows[0];
    }

    // Find user by email
    static async findByEmail(email) {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );
        return rows[0];
    }

    // Create new user
    static async create(userData) {
        const { email, password, role } = userData;
        const [result] = await db.query(
            'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
            [email, password, role || 'member']
        );
        return result. insertId;
    }

    // Update user
    static async update(id, userData) {
        const fields = [];
        const values = [];

        Object.keys(userData).forEach(key => {
            if (userData[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(userData[key]);
            }
        });

        if (fields.length === 0) return false;

        values.push(id);
        const [result] = await db.query(
            `UPDATE users SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    // Delete user
    static async delete(id) {
        const [result] = await db.query('DELETE FROM users WHERE id = ?', [id]);
        return result. affectedRows > 0;
    }

    // Find all users
    static async findAll(filters = {}) {
        let query = 'SELECT id, email, role, is_active, created_at, updated_at FROM users WHERE 1=1';
        const params = [];

        if (filters.role) {
            query += ' AND role = ?';
            params. push(filters.role);
        }

        if (filters.isActive !== undefined) {
            query += ' AND is_active = ?';
            params.push(filters.isActive);
        }

        if (filters.search) {
            query += ' AND email LIKE ?';
            params.push(`%${filters.search}%`);
        }

        query += ' ORDER BY created_at DESC';

        if (filters.limit) {
            query += ' LIMIT ?  OFFSET ?';
            params. push(parseInt(filters.limit), parseInt(filters.offset || 0));
        }

        const [rows] = await db. query(query, params);
        return rows;
    }

    // Count users
    static async count(filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
        const params = [];

        if (filters.role) {
            query += ' AND role = ?';
            params.push(filters.role);
        }

        if (filters.isActive !== undefined) {
            query += ' AND is_active = ?';
            params.push(filters. isActive);
        }

        const [rows] = await db.query(query, params);
        return rows[0].total;
    }

    // Update password
    static async updatePassword(id, hashedPassword) {
        const [result] = await db.query(
            'UPDATE users SET password = ? WHERE id = ?',
            [hashedPassword, id]
        );
        return result.affectedRows > 0;
    }

    // Set reset token
    static async setResetToken(email, token, expiry) {
        const [result] = await db.query(
            'UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE email = ?',
            [token, expiry, email]
        );
        return result.affectedRows > 0;
    }

    // Find by reset token
    static async findByResetToken(token) {
        const [rows] = await db.query(
            'SELECT * FROM users WHERE reset_token = ?  AND reset_token_expiry > NOW()',
            [token]
        );
        return rows[0];
    }

    // Clear reset token
    static async clearResetToken(id) {
        const [result] = await db.query(
            'UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }

    // Toggle active status
    static async toggleStatus(id) {
        const [result] = await db.query(
            'UPDATE users SET is_active = NOT is_active WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = User;