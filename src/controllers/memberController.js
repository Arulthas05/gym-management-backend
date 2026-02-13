const db = require('../config/database');
const { calculateBMI, getBMICategory } = require('../utils/helpers');
const QRCode = require('qrcode');

// @desc    Get all members
// @route   GET /api/members
// @access  Private (Admin, Trainer)
const getAllMembers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', status = '' } = req.query;
        const offset = (page - 1) * limit;

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

        if (search) {
            query += ` AND (m.first_name LIKE ? OR m.last_name LIKE ?  OR u.email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (status) {
            query += ` AND mm.status = ?`;
            params.push(status);
        }

        query += ` ORDER BY m.created_at DESC LIMIT ?  OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [members] = await db.query(query, params);

        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total
            FROM members m
            INNER JOIN users u ON m.user_id = u.id
            LEFT JOIN member_memberships mm ON m.id = mm.member_id AND mm.status = 'active'
            WHERE 1=1
        `;
        const countParams = [];

        if (search) {
            countQuery += ` AND (m.first_name LIKE ? OR m.last_name LIKE ? OR u.email LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (status) {
            countQuery += ` AND mm.status = ?`;
            countParams.push(status);
        }

        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            success: true,
            data:  {
                members,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get all members error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching members',
            error: error.message
        });
    }
};

// @desc    Get single member
// @route   GET /api/members/:id
// @access  Private
const getMember = async (req, res) => {
    try {
        const { id } = req.params;

        const [members] = await db.query(
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

        if (members.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        const member = members[0];

        // Get active membership
        const [memberships] = await db.query(
            `SELECT 
                mm.*,
                mp.name as plan_name,
                mp.price,
                mp.duration_months
            FROM member_memberships mm
            INNER JOIN membership_plans mp ON mm.membership_plan_id = mp.id
            WHERE mm.member_id = ?  AND mm.status = 'active'
            ORDER BY mm.created_at DESC
            LIMIT 1`,
            [id]
        );

        // Get recent sessions
        const [sessions] = await db.query(
            `SELECT 
                ts.*,
                t.first_name as trainer_first_name,
                t.last_name as trainer_last_name
            FROM training_sessions ts
            INNER JOIN trainers t ON ts.trainer_id = t.id
            WHERE ts.member_id = ? 
            ORDER BY ts.session_date DESC, ts.start_time DESC
            LIMIT 5`,
            [id]
        );

        // Get attendance count
        const [attendanceCount] = await db.query(
            `SELECT COUNT(*) as total_visits
            FROM attendance
            WHERE member_id = ?`,
            [id]
        );

        res.json({
            success: true,
            data: {
                ... member,
                membership:  memberships[0] || null,
                recentSessions: sessions,
                totalVisits: attendanceCount[0]. total_visits
            }
        });

    } catch (error) {
        console.error('Get member error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching member',
            error:  error.message
        });
    }
};

// @desc    Create member
// @route   POST /api/members
// @access  Private (Admin)
const createMember = async (req, res) => {
    try {
        const {
            email,
            password,
            firstName,
            lastName,
            phone,
            dateOfBirth,
            gender,
            address,
            emergencyContact,
            height,
            weight,
            medicalConditions,
            fitnessGoals
        } = req.body;

        // Check if email exists
        const [existingUsers] = await db.query(
            'SELECT * FROM users WHERE email = ?',
            [email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Email already exists'
            });
        }

        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Create user
            const [userResult] = await connection.query(
                'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
                [email, hashedPassword, 'member']
            );

            const userId = userResult.insertId;

            // Calculate BMI
            const bmi = height && weight ? calculateBMI(weight, height) : null;

            // Generate QR code
            const qrData = `MEMBER-${userId}-${Date.now()}`;
            const qrCodePath = `uploads/qr/member-${userId}. png`;
            await QRCode.toFile(qrCodePath, qrData);

            // Create member
            const [memberResult] = await connection.query(
                `INSERT INTO members (
                    user_id, first_name, last_name, phone, date_of_birth, 
                    gender, address, emergency_contact, height, weight, bmi,
                    medical_conditions, fitness_goals, qr_code
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, firstName, lastName, phone, dateOfBirth,
                    gender, address, emergencyContact, height, weight, bmi,
                    medicalConditions, fitnessGoals, qrCodePath
                ]
            );

            await connection. commit();
            connection.release();

            res.status(201).json({
                success: true,
                message: 'Member created successfully',
                data: {
                    id: memberResult.insertId,
                    userId,
                    email,
                    firstName,
                    lastName
                }
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Create member error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating member',
            error: error.message
        });
    }
};

// @desc    Update member
// @route   PUT /api/members/:id
// @access  Private
const updateMember = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            firstName,
            lastName,
            phone,
            dateOfBirth,
            gender,
            address,
            emergencyContact,
            height,
            weight,
            medicalConditions,
            fitnessGoals
        } = req.body;

        // Check if member exists
        const [members] = await db.query('SELECT * FROM members WHERE id = ? ', [id]);

        if (members.length === 0) {
            return res. status(404).json({
                success: false,
                message:  'Member not found'
            });
        }

        // Calculate BMI if height and weight provided
        const bmi = height && weight ? calculateBMI(weight, height) : members[0].bmi;

        await db.query(
            `UPDATE members SET
                first_name = ?,
                last_name = ?,
                phone = ?,
                date_of_birth = ?,
                gender = ?,
                address = ?,
                emergency_contact = ?,
                height = ?,
                weight = ?,
                bmi = ?,
                medical_conditions = ?,
                fitness_goals = ? 
            WHERE id = ?`,
            [
                firstName, lastName, phone, dateOfBirth, gender, address,
                emergencyContact, height, weight, bmi, medicalConditions,
                fitnessGoals, id
            ]
        );

        res.json({
            success: true,
            message: 'Member updated successfully'
        });

    } catch (error) {
        console.error('Update member error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating member',
            error: error.message
        });
    }
};

// @desc    Delete member
// @route   DELETE /api/members/:id
// @access  Private (Admin)
const deleteMember = async (req, res) => {
    try {
        const { id } = req.params;

        const [members] = await db.query('SELECT user_id FROM members WHERE id = ? ', [id]);

        if (members.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        // Delete user (will cascade delete member)
        await db.query('DELETE FROM users WHERE id = ?', [members[0].user_id]);

        res.json({
            success: true,
            message: 'Member deleted successfully'
        });

    } catch (error) {
        console.error('Delete member error:', error);
        res.status(500).json({
            success: false,
            message:  'Error deleting member',
            error: error.message
        });
    }
};

// @desc    Calculate BMI for member
// @route   POST /api/members/: id/calculate-bmi
// @access  Private
const calculateMemberBMI = async (req, res) => {
    try {
        const { id } = req.params;
        const { height, weight } = req.body;

        const bmi = calculateBMI(weight, height);
        const category = getBMICategory(bmi);

        await db.query(
            'UPDATE members SET height = ?, weight = ?, bmi = ?  WHERE id = ?',
            [height, weight, bmi, id]
        );

        res.json({
            success: true,
            data: {
                bmi,
                category,
                height,
                weight
            }
        });

    } catch (error) {
        console.error('Calculate BMI error:', error);
        res.status(500).json({
            success: false,
            message: 'Error calculating BMI',
            error: error. message
        });
    }
};

module.exports = {
    getAllMembers,
    getMember,
    createMember,
    updateMember,
    deleteMember,
    calculateMemberBMI
};