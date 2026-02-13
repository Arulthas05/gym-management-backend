const db = require('../config/database');

class Payment {
    // Find payment by ID
    static async findById(id) {
        const [rows] = await db.query(
            `SELECT 
                p.*,
                m.first_name,
                m.last_name,
                u.email
            FROM payments p
            INNER JOIN members m ON p.member_id = m.id
            INNER JOIN users u ON m.user_id = u.id
            WHERE p.id = ?`,
            [id]
        );
        return rows[0];
    }

    // Create new payment
    static async create(paymentData) {
        const {
            memberId,
            amount,
            paymentType,
            paymentMethod,
            paymentStatus,
            transactionId,
            invoiceNumber,
            invoicePath,
            description
        } = paymentData;

        const [result] = await db.query(
            `INSERT INTO payments (
                member_id, amount, payment_type, payment_method,
                payment_status, transaction_id, invoice_number, invoice_path, description
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                memberId, amount, paymentType, paymentMethod,
                paymentStatus || 'pending', transactionId, invoiceNumber, invoicePath, description
            ]
        );

        return result.insertId;
    }

    // Update payment
    static async update(id, paymentData) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'amount', 'payment_status', 'transaction_id', 'invoice_path', 'description'
        ];

        Object.keys(paymentData).forEach(key => {
            const snakeKey = key. replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (allowedFields.includes(snakeKey) && paymentData[key] !== undefined) {
                fields.push(`${snakeKey} = ?`);
                values.push(paymentData[key]);
            }
        });

        if (fields.length === 0) return false;

        values. push(id);
        const [result] = await db.query(
            `UPDATE payments SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    // Find all payments
    static async findAll(filters = {}) {
        let query = `
            SELECT 
                p.*,
                m.first_name,
                m.last_name,
                u.email
            FROM payments p
            INNER JOIN members m ON p.member_id = m.id
            INNER JOIN users u ON m.user_id = u. id
            WHERE 1=1
        `;
        const params = [];

        if (filters. memberId) {
            query += ' AND p.member_id = ?';
            params.push(filters.memberId);
        }

        if (filters.status) {
            query += ' AND p.payment_status = ?';
            params.push(filters. status);
        }

        if (filters.type) {
            query += ' AND p.payment_type = ?';
            params.push(filters. type);
        }

        query += ' ORDER BY p.payment_date DESC';

        if (filters.limit) {
            query += ' LIMIT ? OFFSET ? ';
            params.push(parseInt(filters.limit), parseInt(filters.offset || 0));
        }

        const [rows] = await db.query(query, params);
        return rows;
    }

    // Count payments
    static async count(filters = {}) {
        let query = 'SELECT COUNT(*) as total FROM payments p WHERE 1=1';
        const params = [];

        if (filters.memberId) {
            query += ' AND p.member_id = ?';
            params.push(filters.memberId);
        }

        if (filters.status) {
            query += ' AND p.payment_status = ?';
            params.push(filters.status);
        }

        const [rows] = await db.query(query, params);
        return rows[0].total;
    }

    // Update status
    static async updateStatus(id, status) {
        const [result] = await db.query(
            'UPDATE payments SET payment_status = ? WHERE id = ? ',
            [status, id]
        );
        return result. affectedRows > 0;
    }

    // Find by invoice number
    static async findByInvoiceNumber(invoiceNumber) {
        const [rows] = await db.query(
            'SELECT * FROM payments WHERE invoice_number = ?',
            [invoiceNumber]
        );
        return rows[0];
    }
}

module.exports = Payment;