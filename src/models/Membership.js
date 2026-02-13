const db = require('../config/database');

class Membership {
    // Find membership plan by ID
    static async findPlanById(id) {
        const [rows] = await db. query(
            'SELECT * FROM membership_plans WHERE id = ?',
            [id]
        );
        return rows[0];
    }

    // Find all membership plans
    static async findAllPlans(activeOnly = true) {
        let query = 'SELECT * FROM membership_plans';
        if (activeOnly) {
            query += ' WHERE is_active = 1';
        }
        query += ' ORDER BY price ASC';

        const [rows] = await db.query(query);
        return rows;
    }

    // Create membership plan
    static async createPlan(planData) {
        const { name, durationMonths, price, description, features } = planData;

        const [result] = await db.query(
            `INSERT INTO membership_plans (name, duration_months, price, description, features)
             VALUES (?, ?, ?, ?, ?)`,
            [name, durationMonths, price, description, JSON.stringify(features)]
        );

        return result.insertId;
    }

    // Update membership plan
    static async updatePlan(id, planData) {
        const fields = [];
        const values = [];

        Object.keys(planData).forEach(key => {
            const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
            if (planData[key] !== undefined) {
                fields.push(`${snakeKey} = ?`);
                values.push(key === 'features' ? JSON.stringify(planData[key]) : planData[key]);
            }
        });

        if (fields.length === 0) return false;

        values.push(id);
        const [result] = await db.query(
            `UPDATE membership_plans SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return result.affectedRows > 0;
    }

    // Delete membership plan
    static async deletePlan(id) {
        const [result] = await db.query('DELETE FROM membership_plans WHERE id = ?', [id]);
        return result.affectedRows > 0;
    }

    // Find member memberships
    static async findMemberMemberships(memberId) {
        const [rows] = await db.query(
            `SELECT 
                mm.*,
                mp.name as plan_name,
                mp.price,
                mp.duration_months,
                mp.features
            FROM member_memberships mm
            INNER JOIN membership_plans mp ON mm. membership_plan_id = mp.id
            WHERE mm.member_id = ? 
            ORDER BY mm.created_at DESC`,
            [memberId]
        );
        return rows;
    }

    // Find active membership
    static async findActiveMembership(memberId) {
        const [rows] = await db.query(
            `SELECT 
                mm.*,
                mp.name as plan_name,
                mp. price,
                mp.duration_months
            FROM member_memberships mm
            INNER JOIN membership_plans mp ON mm.membership_plan_id = mp.id
            WHERE mm.member_id = ? AND mm.status = 'active'
            ORDER BY mm.created_at DESC
            LIMIT 1`,
            [memberId]
        );
        return rows[0];
    }

    // Assign membership
    static async assignMembership(membershipData) {
        const { memberId, membershipPlanId, startDate, endDate, autoRenewal } = membershipData;

        const [result] = await db.query(
            `INSERT INTO member_memberships (
                member_id, membership_plan_id, start_date, end_date, status, auto_renewal
            ) VALUES (?, ?, ?, ?, 'active', ?)`,
            [memberId, membershipPlanId, startDate, endDate, autoRenewal || false]
        );

        return result.insertId;
    }

    // Update membership status
    static async updateStatus(id, status) {
        const [result] = await db. query(
            'UPDATE member_memberships SET status = ? WHERE id = ?',
            [status, id]
        );
        return result.affectedRows > 0;
    }

    // Renew membership
    static async renewMembership(id, newEndDate) {
        const [result] = await db.query(
            'UPDATE member_memberships SET end_date = ?, status = ?  WHERE id = ?',
            [newEndDate, 'active', id]
        );
        return result.affectedRows > 0;
    }

    // Deactivate all active memberships for member
    static async deactivateAllForMember(memberId) {
        const [result] = await db.query(
            'UPDATE member_memberships SET status = ? WHERE member_id = ?  AND status = ? ',
            ['expired', memberId, 'active']
        );
        return result.affectedRows;
    }
}

module.exports = Membership;