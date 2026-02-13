const db = require('../config/database');
const QRCode = require('qrcode');

// @desc    Check-in member
// @route   POST /api/attendance/check-in
// @access  Private
const checkIn = async (req, res) => {
    try {
        const { memberId, checkInMethod } = req.body;

        // Check if member exists and has active membership
        const [members] = await db.query(
            `SELECT 
                m.*,
                mm.status as membership_status,
                mm.end_date as membership_end_date
            FROM members m
            LEFT JOIN member_memberships mm ON m.id = mm.member_id AND mm.status = 'active'
            WHERE m.id = ? `,
            [memberId]
        );

        if (members. length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        const member = members[0];

        // Check if member has active membership
        if (! member.membership_status || member. membership_status !== 'active') {
            return res.status(400).json({
                success: false,
                message: 'No active membership found.  Please renew your membership.'
            });
        }

        // Check if membership is expired
        if (new Date(member.membership_end_date) < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Your membership has expired. Please renew to continue.'
            });
        }

        // Check if already checked in today
        const today = new Date().toISOString().split('T')[0];
        const [existingCheckIn] = await db.query(
            'SELECT * FROM attendance WHERE member_id = ? AND attendance_date = ?  AND check_out_time IS NULL',
            [memberId, today]
        );

        if (existingCheckIn.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'You are already checked in.  Please check out first.'
            });
        }

        // Create attendance record
        const [result] = await db.query(
            'INSERT INTO attendance (member_id, attendance_date, check_in_method) VALUES (?, ?, ?)',
            [memberId, today, checkInMethod || 'manual']
        );

        res.status(201).json({
            success: true,
            message:  `Welcome ${member.first_name}! Check-in successful.`,
            data: {
                attendanceId: result.insertId,
                checkInTime: new Date(),
                memberName: `${member.first_name} ${member.last_name}`
            }
        });

    } catch (error) {
        console.error('Check-in error:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking in',
            error: error.message
        });
    }
};

// @desc    Check-out member
// @route   POST /api/attendance/check-out
// @access  Private
const checkOut = async (req, res) => {
    try {
        const { memberId } = req.body;

        const today = new Date().toISOString().split('T')[0];

        // Find today's check-in record
        const [attendance] = await db.query(
            'SELECT * FROM attendance WHERE member_id = ? AND attendance_date = ? AND check_out_time IS NULL',
            [memberId, today]
        );

        if (attendance.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No active check-in found for today'
            });
        }

        // Update with check-out time
        await db.query(
            'UPDATE attendance SET check_out_time = NOW() WHERE id = ?',
            [attendance[0].id]
        );

        // Get member name
        const [members] = await db.query(
            'SELECT first_name, last_name FROM members WHERE id = ? ',
            [memberId]
        );

        res.json({
            success: true,
            message: `Goodbye ${members[0].first_name}! Check-out successful.`,
            data: {
                attendanceId: attendance[0].id,
                checkOutTime: new Date()
            }
        });

    } catch (error) {
        console.error('Check-out error:', error);
        res.status(500).json({
            success: false,
            message: 'Error checking out',
            error: error.message
        });
    }
};

// @desc    QR Code check-in
// @route   POST /api/attendance/qr-check-in
// @access  Public
const qrCheckIn = async (req, res) => {
    try {
        const { qrData } = req.body;

        // Parse QR data (format:  MEMBER-{userId}-{timestamp})
        const parts = qrData.split('-');
        if (parts.length < 2 || parts[0] !== 'MEMBER') {
            return res.status(400).json({
                success: false,
                message: 'Invalid QR code'
            });
        }

        const userId = parseInt(parts[1]);

        // Find member by user_id
        const [members] = await db.query(
            'SELECT * FROM members WHERE user_id = ?',
            [userId]
        );

        if (members.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Member not found'
            });
        }

        const memberId = members[0].id;

        // Use regular check-in logic
        req.body.memberId = memberId;
        req.body.checkInMethod = 'qr';
        
        return checkIn(req, res);

    } catch (error) {
        console.error('QR check-in error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing QR check-in',
            error: error.message
        });
    }
};

// @desc    Get member's QR code
// @route   GET /api/attendance/qr-code/:memberId
// @access  Private
const getMemberQRCode = async (req, res) => {
    try {
        const { memberId } = req.params;

        const [members] = await db.query(
            'SELECT qr_code, user_id FROM members WHERE id = ?',
            [memberId]
        );

        if (members.length === 0) {
            return res. status(404).json({
                success: false,
                message:  'Member not found'
            });
        }

        const member = members[0];

        // If QR code doesn't exist, generate it
        if (!member.qr_code) {
            const qrData = `MEMBER-${member.user_id}-${Date.now()}`;
            const qrCodePath = `uploads/qr/member-${memberId}. png`;
            
            await QRCode.toFile(qrCodePath, qrData);
            
            await db.query(
                'UPDATE members SET qr_code = ?  WHERE id = ?',
                [qrCodePath, memberId]
            );

            member.qr_code = qrCodePath;
        }

        // Generate QR code as base64 for frontend display
        const qrData = `MEMBER-${member.user_id}-${Date.now()}`;
        const qrCodeDataURL = await QRCode.toDataURL(qrData);

        res.json({
            success: true,
            data: {
                qrCodePath: member.qr_code,
                qrCodeDataURL,
                qrData
            }
        });

    } catch (error) {
        console.error('Get QR code error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating QR code',
            error:  error.message
        });
    }
};

// @desc    Get all attendance records
// @route   GET /api/attendance
// @access  Private (Admin)
const getAllAttendance = async (req, res) => {
    try {
        const { page = 1, limit = 10, memberId = '', startDate = '', endDate = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                a.*,
                m.first_name,
                m.last_name,
                u.email
            FROM attendance a
            INNER JOIN members m ON a.member_id = m.id
            INNER JOIN users u ON m. user_id = u.id
            WHERE 1=1
        `;

        const params = [];

        if (memberId) {
            query += ` AND a.member_id = ?`;
            params.push(memberId);
        }

        if (startDate && endDate) {
            query += ` AND a.attendance_date BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY a.check_in_time DESC LIMIT ?  OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [attendance] = await db.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM attendance a WHERE 1=1`;
        const countParams = [];

        if (memberId) {
            countQuery += ` AND a.member_id = ?`;
            countParams.push(memberId);
        }

        if (startDate && endDate) {
            countQuery += ` AND a.attendance_date BETWEEN ? AND ?`;
            countParams.push(startDate, endDate);
        }

        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0]. total;

        res.json({
            success: true,
            data: {
                attendance,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math. ceil(total / limit),
                    totalItems: total,
                    itemsPerPage:  parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get all attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance records',
            error: error.message
        });
    }
};

// @desc    Get member attendance history
// @route   GET /api/attendance/member/:memberId
// @access  Private
const getMemberAttendance = async (req, res) => {
    try {
        const { memberId } = req.params;
        const { startDate = '', endDate = '' } = req.query;

        let query = `
            SELECT * FROM attendance 
            WHERE member_id = ? 
        `;

        const params = [memberId];

        if (startDate && endDate) {
            query += ` AND attendance_date BETWEEN ? AND ?`;
            params.push(startDate, endDate);
        }

        query += ` ORDER BY attendance_date DESC, check_in_time DESC`;

        const [attendance] = await db.query(query, params);

        // Get statistics
        const [stats] = await db.query(
            `SELECT 
                COUNT(*) as total_visits,
                COUNT(CASE WHEN MONTH(attendance_date) = MONTH(CURDATE()) THEN 1 END) as this_month_visits,
                COUNT(CASE WHEN WEEK(attendance_date) = WEEK(CURDATE()) THEN 1 END) as this_week_visits
            FROM attendance
            WHERE member_id = ?`,
            [memberId]
        );

        res.json({
            success: true,
            data: {
                attendance,
                statistics: stats[0]
            }
        });

    } catch (error) {
        console.error('Get member attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching member attendance',
            error: error. message
        });
    }
};

// @desc    Get today's attendance
// @route   GET /api/attendance/today
// @access  Private (Admin)
const getTodayAttendance = async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const [attendance] = await db.query(
            `SELECT 
                a.*,
                m.first_name,
                m.last_name,
                m.profile_image,
                u.email
            FROM attendance a
            INNER JOIN members m ON a.member_id = m.id
            INNER JOIN users u ON m.user_id = u.id
            WHERE a.attendance_date = ?
            ORDER BY a.check_in_time DESC`,
            [today]
        );

        // Get statistics
        const [stats] = await db.query(
            `SELECT 
                COUNT(*) as total_check_ins,
                COUNT(CASE WHEN check_out_time IS NULL THEN 1 END) as currently_in_gym,
                COUNT(CASE WHEN check_out_time IS NOT NULL THEN 1 END) as checked_out
            FROM attendance
            WHERE attendance_date = ?`,
            [today]
        );

        res.json({
            success: true,
            data: {
                attendance,
                statistics:  stats[0]
            }
        });

    } catch (error) {
        console.error('Get today attendance error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching today\'s attendance',
            error:  error.message
        });
    }
};

module.exports = {
    checkIn,
    checkOut,
    qrCheckIn,
    getMemberQRCode,
    getAllAttendance,
    getMemberAttendance,
    getTodayAttendance
};