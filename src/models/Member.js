const db = require('../config/database');

class Member {
    // Find member by ID
    static async findById(id) {
        const [rows] = await db.query(
            `SELECT m.*, u.email, u.is_active 
             FROM members m 
             INNER JOIN users u ON m.user_id = u.id 
             WHERE m.id = ?`,
            [id]
        );
        return rows[0];
    }

    // Find member by user ID
    static async findByUserId(userId) {
        const [rows] = await db.query(
            'SELECT * FROM members WHERE user_id = ? ',
            [userId]
        );
        return rows[0];
    }

    // Create new member
    static async create(memberData) {
        const {
            userId,
            firstName,
            lastName,
            phone,
            dateOfBirth,
            gender,
            address,
            emergencyContact,
            height,
            weight,
            bmi,
            medicalConditions,
            fitnessGoals,
            profileImage,
            qrCode
        } = memberData;

        const [result] = await db. query(
            `INSERT INTO members (
                user_id, first_name, last_name, phone, date_of_birth,
                gender, address, emergency_contact, height, weight, bmi,
                medical_conditions, fitness_goals, profile_image, qr_code
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, firstName, lastName, phone, dateOfBirth,
                gender, address, emergencyContact, height, weight, bmi,
                medicalConditions, fitnessGoals, profileImage, qrCode
            ]
        );

        return result.insertId;
    }

    // Update member
    static async update(id, memberData) {
        const fields = [];
        const values = [];

        const allowedFields = [
            'first_name', 'last_name', 'phone', 'date_of_birth',
            'gender', 'address', 'emergency_contact', 'height', 'weight',
            'bmi', 'medical_conditions', 'fitness_goals', 'profile_image'
        ];

        Object.keys(memberData).forEach(key => {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (allowedFields.includes(snakeKey) && memberData[key] !== undefined) {
                fields.push(`${snakeKey} = ?`);
                values.push(memberData[key]);
            }
        });

        if (fields. length === 0) return false;

        values.push(id);
        const [result] = await db.query(
            `UPDATE members SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    // Delete member
    static async delete(id) {
        const [result] = await db.query('DELETE FROM members WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    // Find all members
    static async findAll(filters = {}) {
        let query = `
            SELECT 
                m.*,
                u.email,
                u.is_active,
                mm.status as membership_status,
                mm.end_date as membership_end_date,
                mp.name as membership_plan_name
            FROM members m
            INNER JOIN users u ON m.user_id = u.id
            LEFT JOIN member_memberships mm ON m.id = mm.member_id AND mm.status = 'active'
            LEFT JOIN membership_plans mp ON mm.membership_plan_id = mp.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.search) {
            query += ' AND (m.first_name LIKE ? OR m.last_name LIKE ?  OR u.email LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
        }

        if (filters.membershipStatus) {
            query += ' AND mm.status = ?';
            params.push(filters. membershipStatus);
        }

        query += ' ORDER BY m.created_at DESC';

        if (filters.limit) {
            query += ' LIMIT ? OFFSET ?';
            params.push(parseInt(filters.limit), parseInt(filters.offset || 0));
        }

        const [rows] = await db.query(query, params);
        return rows;
    }

    // Count members
    static async count(filters = {}) {
        let query = `
            SELECT COUNT(*) as total
            FROM members m
            INNER JOIN users u ON m.user_id = u.id
            LEFT JOIN member_memberships mm ON m.id = mm.member_id AND mm.status = 'active'
            WHERE 1=1
        `;
        const params = [];

        if (filters.search) {
            query += ' AND (m. first_name LIKE ? OR m.last_name LIKE ? OR u.email LIKE ?)';
            params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
        }

        if (filters.membershipStatus) {
            query += ' AND mm.status = ?';
            params.push(filters.membershipStatus);
        }

        const [rows] = await db.query(query, params);
        return rows[0].total;
    }

    // Update BMI
    static async updateBMI(id, height, weight, bmi) {
        const [result] = await db.query(
            'UPDATE members SET height = ?, weight = ?, bmi = ? WHERE id = ?',
            [height, weight, bmi, id]
        );
        return result.affectedRows > 0;
    }

    // Get member with full details
    static async getFullDetails(id) {
        const [rows] = await db.query(
            `SELECT 
                m.*,
                u.email,
                u.is_active,
                u.created_at as user_created_at
            FROM members m
            INNER JOIN users u ON m.user_id = u.id
            WHERE m.id = ?`,
            [id]
        );

        if (rows.length === 0) return null;

        const member = rows[0];

        // Get active membership
        const [memberships] = await db.query(
            `SELECT 
                mm.*,
                mp.name as plan_name,
                mp.price,
                mp.duration_months
            FROM member_memberships mm
            INNER JOIN membership_plans mp ON mm.membership_plan_id = mp.id
            WHERE mm.member_id = ? AND mm.status = 'active'
            ORDER BY mm.created_at DESC
            LIMIT 1`,
            [id]
        );

        member.membership = memberships[0] || null;

        // Get attendance count
        const [attendance] = await db.query(
            'SELECT COUNT(*) as total_visits FROM attendance WHERE member_id = ? ',
            [id]
        );

        member.total_visits = attendance[0].total_visits;

        return member;
    }
}

module.exports = Member;