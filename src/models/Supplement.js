const db = require('../config/database');

class Supplement {
    // Find supplement by ID
    static async findById(id) {
        const [rows] = await db.query(
            'SELECT * FROM supplements WHERE id = ?',
            [id]
        );
        return rows[0];
    }

    // Create new supplement
    static async create(supplementData) {
        const { name, description, category, price, stockQuantity, imageUrl } = supplementData;

        const [result] = await db. query(
            `INSERT INTO supplements (name, description, category, price, stock_quantity, image_url)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, description, category, price, stockQuantity, imageUrl]
        );

        return result.insertId;
    }

    // Update supplement
    static async update(id, supplementData) {
        const fields = [];
        const values = [];

        Object.keys(supplementData).forEach(key => {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (supplementData[key] !== undefined) {
                fields.push(`${snakeKey} = ?`);
                values.push(supplementData[key]);
            }
        });

        if (fields.length === 0) return false;

        values. push(id);
        const [result] = await db.query(
            `UPDATE supplements SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    // Delete supplement
    static async delete(id) {
        const [result] = await db.query('DELETE FROM supplements WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    // Find all supplements
    static async findAll(filters = {}) {
        let query = 'SELECT * FROM supplements WHERE is_active = 1';
        const params = [];

        if (filters.search) {
            query += ' AND (name LIKE ? OR description LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`);
        }

        if (filters.category) {
            query += ' AND category = ?';
            params.push(filters. category);
        }

        query += ' ORDER BY name ASC';

        if (filters.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(parseInt(filters.limit), parseInt(filters.offset || 0));
        }

        const [rows] = await db.query(query, params);
        return rows;
    }

    // Update stock
    static async updateStock(id, quantity, operation = 'decrease') {
        const operator = operation === 'decrease' ? '-' : '+';
        const [result] = await db.query(
            `UPDATE supplements SET stock_quantity = stock_quantity ${operator} ?  WHERE id = ?`,
            [quantity, id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = Supplement;