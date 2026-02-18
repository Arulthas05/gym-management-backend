const db = require('../config/database');
const pdfService = require('../services/pdfService');
const path = require('path');

// @desc    Get dashboard statistics
// @route   GET /api/reports/dashboard
// @access  Private (Admin)
const getDashboardStats = async (req, res) => {
    try {
        // Total members
        const [totalMembers] = await db.query(
            'SELECT COUNT(*) as total FROM members'
        );

        // Active members (with active membership)
        const [activeMembers] = await db.query(
            `SELECT COUNT(DISTINCT m.id) as total 
             FROM members m
             INNER JOIN member_memberships mm ON m.id = mm. member_id
             WHERE mm.status = 'active' AND mm.end_date >= CURDATE()`
        );

        // Total trainers
        const [totalTrainers] = await db. query(
            'SELECT COUNT(*) as total FROM trainers WHERE is_available = 1'
        );

        // Today's attendance
        const today = new Date().toISOString().split('T')[0];
        const [todayAttendance] = await db.query(
            'SELECT COUNT(*) as total FROM attendance WHERE attendance_date = ?',
            [today]
        );

        // This month's revenue
        const [monthRevenue] = await db.query(
            `SELECT COALESCE(SUM(amount), 0) as total 
             FROM payments 
             WHERE payment_status = 'completed' 
             AND MONTH(payment_date) = MONTH(CURDATE()) 
             AND YEAR(payment_date) = YEAR(CURDATE())`
        );

        // Pending payments
        const [pendingPayments] = await db.query(
            `SELECT COUNT(*) as total 
             FROM payments 
             WHERE payment_status = 'pending'`
        );

        // Upcoming sessions (next 7 days)
        const [upcomingSessions] = await db.query(
            `SELECT COUNT(*) as total 
             FROM training_sessions 
             WHERE session_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
             AND status = 'scheduled'`
        );

        // Expiring memberships (next 7 days)
        const [expiringMemberships] = await db.query(
            `SELECT COUNT(*) as total 
             FROM member_memberships 
             WHERE status = 'active' 
             AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`
        );

        res.json({
            success: true,
            data: {
                totalMembers:  totalMembers[0].total,
                activeMembers: activeMembers[0].total,
                totalTrainers: totalTrainers[0].total,
                todayAttendance: todayAttendance[0].total,
                monthRevenue: parseFloat(monthRevenue[0]. total),
                pendingPayments: pendingPayments[0].total,
                upcomingSessions: upcomingSessions[0].total,
                expiringMemberships: expiringMemberships[0].total
            }
        });

    } catch (error) {
        console.error('Get dashboard stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard statistics',
            error: error.message
        });
    }
};

// @desc    Get membership report
// @route   GET /api/reports/membership
// @access  Private (Admin)
const getMembershipReport = async (req, res) => {
    try {
        const { startDate = '', endDate = '' } = req.query;

        // Membership by plan
        const [membershipByPlan] = await db.query(
            `SELECT 
                mp.name as plan_name,
                mp.price,
                COUNT(mm.id) as total_subscriptions,
                COUNT(CASE WHEN mm.status = 'active' THEN 1 END) as active_subscriptions,
                SUM(mp.price) as total_revenue
            FROM membership_plans mp
            LEFT JOIN member_memberships mm ON mp.id = mm.membership_plan_id
            GROUP BY mp.id
            ORDER BY total_subscriptions DESC`
        );

        // New memberships trend
        let trendQuery = `
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month,
                COUNT(*) as count
            FROM member_memberships
            WHERE 1=1
        `;

        const trendParams = [];

        if (startDate && endDate) {
            trendQuery += ` AND created_at BETWEEN ? AND ?`;
            trendParams.push(startDate, endDate);
        }

        trendQuery += ` GROUP BY month ORDER BY month DESC LIMIT 12`;

        const [membershipTrend] = await db.query(trendQuery, trendParams);

        // Expiring soon
        const [expiringSoon] = await db.query(
            `SELECT 
                mm.*,
                m.first_name,
                m.last_name,
                u.email,
                mp.name as plan_name
            FROM member_memberships mm
            INNER JOIN members m ON mm. member_id = m.id
            INNER JOIN users u ON m. user_id = u.id
            INNER JOIN membership_plans mp ON mm.membership_plan_id = mp.id
            WHERE mm.status = 'active'
            AND mm.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            ORDER BY mm.end_date ASC`
        );

        // Membership status distribution
        const [statusDistribution] = await db.query(
            `SELECT 
                status,
                COUNT(*) as count
            FROM member_memberships
            GROUP BY status`
        );

        res.json({
            success: true,
            data: {
                membershipByPlan,
                membershipTrend,
                expiringSoon,
                statusDistribution
            }
        });

    } catch (error) {
        console.error('Get membership report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching membership report',
            error: error. message
        });
    }
};

// @desc    Get payment report
// @route   GET /api/reports/payments
// @access  Private (Admin)
const getPaymentReport = async (req, res) => {
    try {
        const { startDate = '', endDate = '', paymentType = '' } = req.query;

        // Revenue summary
        let summaryQuery = `
            SELECT 
                payment_type,
                payment_method,
                COUNT(*) as total_transactions,
                SUM(amount) as total_amount
            FROM payments
            WHERE payment_status = 'completed'
        `;

        const summaryParams = [];

        if (startDate && endDate) {
            summaryQuery += ` AND payment_date BETWEEN ? AND ?`;
            summaryParams.push(startDate, endDate);
        }

        if (paymentType) {
            summaryQuery += ` AND payment_type = ?`;
            summaryParams.push(paymentType);
        }

        summaryQuery += ` GROUP BY payment_type, payment_method`;

        const [revenueSummary] = await db.query(summaryQuery, summaryParams);

        // Revenue trend (monthly)
        let trendQuery = `
            SELECT 
                DATE_FORMAT(payment_date, '%Y-%m') as month,
                SUM(amount) as revenue,
                COUNT(*) as transactions
            FROM payments
            WHERE payment_status = 'completed'
        `;

        const trendParams = [];

        if (startDate && endDate) {
            trendQuery += ` AND payment_date BETWEEN ? AND ?`;
            trendParams.push(startDate, endDate);
        }

        trendQuery += ` GROUP BY month ORDER BY month DESC LIMIT 12`;

        const [revenueTrend] = await db.query(trendQuery, trendParams);

        // Top paying members
        const [topMembers] = await db.query(
            `SELECT 
                m.id,
                m.first_name,
                m.last_name,
                u.email,
                COUNT(p.id) as total_payments,
                SUM(p.amount) as total_spent
            FROM members m
            INNER JOIN users u ON m.user_id = u.id
            INNER JOIN payments p ON m.id = p.member_id
            WHERE p.payment_status = 'completed'
            GROUP BY m.id
            ORDER BY total_spent DESC
            LIMIT 10`
        );

        // Payment status distribution
        const [statusDistribution] = await db.query(
            `SELECT 
                payment_status,
                COUNT(*) as count,
                SUM(amount) as total_amount
            FROM payments
            GROUP BY payment_status`
        );

        res.json({
            success: true,
            data: {
                revenueSummary,
                revenueTrend,
                topMembers,
                statusDistribution
            }
        });

    } catch (error) {
        console.error('Get payment report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching payment report',
            error: error. message
        });
    }
};

// @desc    Get attendance report
// @route   GET /api/reports/attendance
// @access  Private (Admin)
const getAttendanceReport = async (req, res) => {
    try {
        const { startDate = '', endDate = '' } = req.query;

        // Daily attendance trend
        let trendQuery = `
            SELECT 
                attendance_date,
                COUNT(*) as total_check_ins,
                COUNT(DISTINCT member_id) as unique_members
            FROM attendance
            WHERE 1=1
        `;

        const trendParams = [];

        if (startDate && endDate) {
            trendQuery += ` AND attendance_date BETWEEN ? AND ?`;
            trendParams.push(startDate, endDate);
        } else {
            trendQuery += ` AND attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`;
        }

        trendQuery += ` GROUP BY attendance_date ORDER BY attendance_date DESC`;

        const [attendanceTrend] = await db.query(trendQuery, trendParams);

        // Peak hours
        const [peakHours] = await db.query(
            `SELECT 
                HOUR(check_in_time) as hour,
                COUNT(*) as check_ins
            FROM attendance
            WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY hour
            ORDER BY check_ins DESC`
        );

        // Most active members
        let activeMembersQuery = `
            SELECT 
                m. id,
                m.first_name,
                m.last_name,
                COUNT(a.id) as total_visits,
                MAX(a.attendance_date) as last_visit
            FROM members m
            INNER JOIN attendance a ON m.id = a.member_id
        `;

        let activeParams = [];

        if (startDate && endDate) {
            activeMembersQuery += ` WHERE a.attendance_date BETWEEN ?  AND ?`;
            activeParams.push(startDate, endDate);
        }

        activeMembersQuery += ` GROUP BY m.id ORDER BY total_visits DESC LIMIT 10`;

        const [activeMembers] = await db.query(activeMembersQuery, activeParams);

        // Check-in method distribution
        const [checkInMethods] = await db.query(
            `SELECT 
                check_in_method,
                COUNT(*) as count
            FROM attendance
            WHERE attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
            GROUP BY check_in_method`
        );

        res.json({
            success: true,
            data: {
                attendanceTrend,
                peakHours,
                activeMembers,
                checkInMethods
            }
        });

    } catch (error) {
        console.error('Get attendance report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching attendance report',
            error: error.message
        });
    }
};

// @desc    Get trainer report
// @route   GET /api/reports/trainers
// @access  Private (Admin)
const getTrainerReport = async (req, res) => {
    try {
        const { startDate = '', endDate = '' } = req.query;

        // Trainer performance
        let performanceQuery = `
            SELECT 
                t.id,
                t.first_name,
                t.last_name,
                t.specialization,
                t.rating,
                COUNT(ts.id) as total_sessions,
                COUNT(CASE WHEN ts.status = 'completed' THEN 1 END) as completed_sessions,
                COUNT(CASE WHEN ts.status = 'cancelled' THEN 1 END) as cancelled_sessions,
                COUNT(DISTINCT ts.member_id) as unique_clients
            FROM trainers t
            LEFT JOIN training_sessions ts ON t. id = ts.trainer_id
            WHERE 1=1
        `;

        const performanceParams = [];

        if (startDate && endDate) {
            performanceQuery += ` AND ts.session_date BETWEEN ? AND ?`;
            performanceParams.push(startDate, endDate);
        }

        performanceQuery += ` GROUP BY t.id ORDER BY completed_sessions DESC`;

        const [trainerPerformance] = await db.query(performanceQuery, performanceParams);

        // Session status distribution
        const [sessionStatus] = await db.query(
            `SELECT 
                status,
                COUNT(*) as count
            FROM training_sessions
            GROUP BY status`
        );

        // Trainer utilization (sessions per month)
        const [utilization] = await db.query(
            `SELECT 
                t.first_name,
                t.last_name,
                DATE_FORMAT(ts.session_date, '%Y-%m') as month,
                COUNT(ts.id) as sessions
            FROM trainers t
            LEFT JOIN training_sessions ts ON t.id = ts. trainer_id
            WHERE ts.session_date >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY t.id, month
            ORDER BY month DESC`
        );

        res.json({
            success: true,
            data: {
                trainerPerformance,
                sessionStatus,
                utilization
            }
        });

    } catch (error) {
        console.error('Get trainer report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching trainer report',
            error: error.message
        });
    }
};

// @desc    Get supplement sales report
// @route   GET /api/reports/supplements
// @access  Private (Admin)
const getSupplementReport = async (req, res) => {
    try {
        const { startDate = '', endDate = '' } = req.query;

        // Top selling supplements
        let topSellingQuery = `
            SELECT 
                s.id,
                s.name,
                s.category,
                s.price,
                s.stock_quantity,
                COUNT(soi.id) as times_ordered,
                SUM(soi.quantity) as total_quantity_sold,
                SUM(soi. price * soi.quantity) as total_revenue
            FROM supplements s
            LEFT JOIN supplement_order_items soi ON s.id = soi.supplement_id
            LEFT JOIN supplement_orders so ON soi.order_id = so.id
            WHERE so.order_status = 'completed'
        `;

        const topSellingParams = [];

        if (startDate && endDate) {
            topSellingQuery += ` AND so.order_date BETWEEN ? AND ?`;
            topSellingParams.push(startDate, endDate);
        }

        topSellingQuery += ` GROUP BY s.id ORDER BY total_quantity_sold DESC LIMIT 10`;

        const [topSelling] = await db.query(topSellingQuery, topSellingParams);

        // Sales by category
        const [categorySales] = await db.query(
            `SELECT 
                s.category,
                COUNT(DISTINCT soi.order_id) as total_orders,
                SUM(soi.quantity) as total_quantity,
                SUM(soi. price * soi.quantity) as total_revenue
            FROM supplements s
            INNER JOIN supplement_order_items soi ON s.id = soi.supplement_id
            INNER JOIN supplement_orders so ON soi.order_id = so. id
            WHERE so.order_status = 'completed'
            GROUP BY s.category
            ORDER BY total_revenue DESC`
        );

        // Low stock alerts
        const [lowStock] = await db.query(
            `SELECT 
                id,
                name,
                category,
                stock_quantity,
                price
            FROM supplements
            WHERE stock_quantity < 10 AND is_active = 1
            ORDER BY stock_quantity ASC`
        );

        // Order trend
        const [orderTrend] = await db.query(
            `SELECT 
                DATE_FORMAT(order_date, '%Y-%m') as month,
                COUNT(*) as total_orders,
                SUM(total_amount) as revenue
            FROM supplement_orders
            WHERE order_status = 'completed'
            AND order_date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
            GROUP BY month
            ORDER BY month DESC`
        );

        res.json({
            success: true,
            data: {
                topSelling,
                categoryS:  categorySales,
                lowStock,
                orderTrend
            }
        });

    } catch (error) {
        console.error('Get supplement report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching supplement report',
            error:  error.message
        });
    }
};

// @desc    Export report to CSV
// @route   GET /api/reports/export/: reportType
// @access  Private (Admin)
const exportReport = async (req, res) => {
    try {
        const { reportType } = req.params;
        const { startDate = '', endDate = '' } = req.query;

        let query = '';
        let params = [];
        let filename = '';

        switch (reportType) {
            case 'members':
                query = `
                    SELECT 
                        m. id,
                        m.first_name,
                        m.last_name,
                        u. email,
                        m.phone,
                        m.date_of_birth,
                        m.gender,
                        mm.status as membership_status,
                        mp.name as membership_plan,
                        mm.end_date as membership_end_date
                    FROM members m
                    INNER JOIN users u ON m.user_id = u.id
                    LEFT JOIN member_memberships mm ON m.id = mm.member_id AND mm.status = 'active'
                    LEFT JOIN membership_plans mp ON mm.membership_plan_id = mp.id
                `;
                filename = 'members_report.csv';
                break;

            case 'payments': 
                query = `
                    SELECT 
                        p.id,
                        p.invoice_number,
                        m.first_name,
                        m.last_name,
                        u.email,
                        p.amount,
                        p.payment_type,
                        p.payment_method,
                        p.payment_status,
                        p.payment_date
                    FROM payments p
                    INNER JOIN members m ON p.member_id = m.id
                    INNER JOIN users u ON m.user_id = u.id
                    WHERE 1=1
                `;
                if (startDate && endDate) {
                    query += ` AND p.payment_date BETWEEN ?  AND ?`;
                    params.push(startDate, endDate);
                }
                filename = 'payments_report.csv';
                break;

            case 'attendance':
                query = `
                    SELECT 
                        a.id,
                        m.first_name,
                        m.last_name,
                        a.attendance_date,
                        a.check_in_time,
                        a.check_out_time,
                        a.check_in_method
                    FROM attendance a
                    INNER JOIN members m ON a. member_id = m.id
                    WHERE 1=1
                `;
                if (startDate && endDate) {
                    query += ` AND a.attendance_date BETWEEN ? AND ? `;
                    params.push(startDate, endDate);
                }
                filename = 'attendance_report.csv';
                break;

            default:
                return res.status(400).json({
                    success: false,
                    message:  'Invalid report type'
                });
        }

        const [data] = await db.query(query, params);

        if (data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No data found for export'
            });
        }

        // Convert to CSV
        const fields = Object.keys(data[0]);
        const csv = [
            fields.join(','),
            ...data.map(row => fields.map(field => `"${row[field] || ''}"`).join(','))
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);

    } catch (error) {
        console.error('Export report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error exporting report',
            error: error.message
        });
    }
};

// @desc    Get revenue report
// @route   GET /api/reports/revenue
// @access  Private (Admin)
const getRevenueReport = async (req, res) => {
    try {
        const { period = 'month', startDate = '', endDate = '' } = req.query;

        let dateFilter = '';
        let params = [];

        // Build date filter based on period
        switch (period) {
            case 'today':
                dateFilter = 'AND DATE(payment_date) = CURDATE()';
                break;
            case 'week':
                dateFilter = 'AND YEARWEEK(payment_date) = YEARWEEK(NOW())';
                break;
            case 'month':
                dateFilter = 'AND YEAR(payment_date) = YEAR(NOW()) AND MONTH(payment_date) = MONTH(NOW())';
                break;
            case 'year':
                dateFilter = 'AND YEAR(payment_date) = YEAR(NOW())';
                break;
            case 'custom':
                if (startDate && endDate) {
                    dateFilter = 'AND payment_date BETWEEN ? AND ?';
                    params.push(startDate, endDate);
                }
                break;
            default:
                dateFilter = 'AND YEAR(payment_date) = YEAR(NOW()) AND MONTH(payment_date) = MONTH(NOW())';
        }

        // Total revenue
        const [totalRevenue] = await db.query(
            `SELECT 
                COALESCE(SUM(amount), 0) as total,
                COUNT(*) as transaction_count,
                AVG(amount) as average_transaction
            FROM payments 
            WHERE payment_status = 'completed' ${dateFilter}`,
            params
        );

        // Revenue by payment type
        const [revenueByType] = await db.query(
            `SELECT 
                payment_type,
                COALESCE(SUM(amount), 0) as total,
                COUNT(*) as count
            FROM payments 
            WHERE payment_status = 'completed' ${dateFilter}
            GROUP BY payment_type
            ORDER BY total DESC`,
            params
        );

        // Revenue by payment method
        const [revenueByMethod] = await db.query(
            `SELECT 
                payment_method,
                COALESCE(SUM(amount), 0) as total,
                COUNT(*) as count
            FROM payments 
            WHERE payment_status = 'completed' ${dateFilter}
            GROUP BY payment_method
            ORDER BY total DESC`,
            params
        );

        // Revenue trend (daily for week/month, monthly for year)
        let trendGrouping = '';
        let trendLabel = '';
        
        if (period === 'today' || period === 'week') {
            trendGrouping = 'DATE(payment_date)';
            trendLabel = 'date';
        } else if (period === 'month' || period === 'custom') {
            trendGrouping = 'DATE(payment_date)';
            trendLabel = 'date';
        } else {
            trendGrouping = 'DATE_FORMAT(payment_date, "%Y-%m")';
            trendLabel = 'month';
        }

        const [revenueTrend] = await db.query(
            `SELECT 
                ${trendGrouping} as period,
                COALESCE(SUM(amount), 0) as revenue,
                COUNT(*) as transactions
            FROM payments 
            WHERE payment_status = 'completed' ${dateFilter}
            GROUP BY ${trendGrouping}
            ORDER BY ${trendGrouping} ASC`,
            params
        );

        // Top revenue generating members
        const [topMembers] = await db.query(
            `SELECT 
                m.id,
                m.first_name,
                m.last_name,
                COALESCE(SUM(p.amount), 0) as total_spent,
                COUNT(p.id) as transaction_count
            FROM members m
            INNER JOIN payments p ON m.id = p.member_id
            WHERE p.payment_status = 'completed' ${dateFilter}
            GROUP BY m.id
            ORDER BY total_spent DESC
            LIMIT 10`,
            params
        );

        res.json({
            success: true,
            data: {
                summary: {
                    totalRevenue: parseFloat(totalRevenue[0].total || 0),
                    transactionCount: parseInt(totalRevenue[0].transaction_count || 0),
                    averageTransaction: parseFloat(totalRevenue[0].average_transaction || 0)
                },
                revenueByType,
                revenueByMethod,
                revenueTrend,
                topMembers,
                period,
                dateRange: period === 'custom' ? { startDate, endDate } : null
            }
        });

    } catch (error) {
        console.error('Get revenue report error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching revenue report',
            error: error.message
        });
    }
};

// @desc    Get attendance report as PDF
// @route   GET /api/reports/attendance/pdf
// @access  Private (Admin)
const getAttendanceReportPDF = async (req, res) => {
    try {
        const { period = 'month', startDate = '', endDate = '' } = req.query;

        let dateFilter = '';
        let params = [];

        // Determine date range based on period
        if (period === 'today') {
            dateFilter = 'AND attendance_date = CURDATE()';
        } else if (period === 'week') {
            dateFilter = 'AND attendance_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)';
        } else if (period === 'month') {
            dateFilter = 'AND attendance_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)';
        } else if (period === 'year') {
            dateFilter = 'AND attendance_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR)';
        } else if (period === 'custom' && startDate && endDate) {
            dateFilter = 'AND attendance_date BETWEEN ? AND ?';
            params = [startDate, endDate];
        }

        // Daily attendance trend
        const trendQuery = `
            SELECT 
                attendance_date,
                COUNT(*) as total_check_ins,
                COUNT(DISTINCT member_id) as unique_members
            FROM attendance
            WHERE 1=1 ${dateFilter}
            GROUP BY attendance_date
            ORDER BY attendance_date DESC
        `;

        const [attendanceTrend] = await db.query(trendQuery, params);

        // Peak hours
        const [peakHours] = await db.query(
            `SELECT 
                HOUR(check_in_time) as hour,
                COUNT(*) as check_ins
            FROM attendance
            WHERE 1=1 ${dateFilter}
            GROUP BY hour
            ORDER BY check_ins DESC`,
            params
        );

        // Most active members
        let activeMembersQuery = `
            SELECT 
                m.id,
                m.first_name,
                m.last_name,
                COUNT(a.id) as total_visits,
                MAX(a.attendance_date) as last_visit
            FROM members m
            INNER JOIN attendance a ON m.id = a.member_id
            WHERE 1=1 ${dateFilter}
            GROUP BY m.id
            ORDER BY total_visits DESC
            LIMIT 10
        `;

        const [activeMembers] = await db.query(activeMembersQuery, params);

        // Check-in method distribution
        const [checkInMethods] = await db.query(
            `SELECT 
                check_in_method,
                COUNT(*) as count
            FROM attendance
            WHERE 1=1 ${dateFilter}
            GROUP BY check_in_method`,
            params
        );

        // Generate PDF
        const reportData = {
            period,
            attendanceTrend,
            peakHours,
            activeMembers,
            checkInMethods,
            dateRange: period === 'custom' ? { startDate, endDate } : null
        };

        const pdfPath = await pdfService.generateAttendanceReport(reportData);

        // Send PDF file
        res.download(pdfPath, path.basename(pdfPath), (err) => {
            if (err) {
                console.error('Error sending PDF:', err);
                res.status(500).json({
                    success: false,
                    message: 'Error sending PDF report'
                });
            }
        });

    } catch (error) {
        console.error('Get attendance report PDF error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating attendance report PDF',
            error: error.message
        });
    }
};

// @desc    Get revenue report as PDF
// @route   GET /api/reports/revenue/pdf
// @access  Private (Admin)
const getRevenueReportPDF = async (req, res) => {
    try {
        const { period = 'month', startDate = '', endDate = '' } = req.query;

        let dateFilter = '';
        let params = [];

        // Build date filter based on period
        switch (period) {
            case 'today':
                dateFilter = 'AND DATE(payment_date) = CURDATE()';
                break;
            case 'week':
                dateFilter = 'AND YEARWEEK(payment_date) = YEARWEEK(NOW())';
                break;
            case 'month':
                dateFilter = 'AND YEAR(payment_date) = YEAR(NOW()) AND MONTH(payment_date) = MONTH(NOW())';
                break;
            case 'year':
                dateFilter = 'AND YEAR(payment_date) = YEAR(NOW())';
                break;
            case 'custom':
                if (startDate && endDate) {
                    dateFilter = 'AND payment_date BETWEEN ? AND ?';
                    params.push(startDate, endDate);
                }
                break;
            default:
                dateFilter = 'AND YEAR(payment_date) = YEAR(NOW()) AND MONTH(payment_date) = MONTH(NOW())';
        }

        // Total revenue
        const [totalRevenue] = await db.query(
            `SELECT 
                COALESCE(SUM(amount), 0) as total,
                COUNT(*) as transaction_count,
                AVG(amount) as average_transaction
            FROM payments 
            WHERE payment_status = 'completed' ${dateFilter}`,
            params
        );

        // Revenue by payment type
        const [revenueByType] = await db.query(
            `SELECT 
                payment_type,
                COALESCE(SUM(amount), 0) as total,
                COUNT(*) as count
            FROM payments 
            WHERE payment_status = 'completed' ${dateFilter}
            GROUP BY payment_type
            ORDER BY total DESC`,
            params
        );

        // Revenue by payment method
        const [revenueByMethod] = await db.query(
            `SELECT 
                payment_method,
                COALESCE(SUM(amount), 0) as total,
                COUNT(*) as count
            FROM payments 
            WHERE payment_status = 'completed' ${dateFilter}
            GROUP BY payment_method
            ORDER BY total DESC`,
            params
        );

        // Revenue trend (daily for week/month, monthly for year)
        let trendGrouping = '';
        
        if (period === 'today' || period === 'week') {
            trendGrouping = 'DATE(payment_date)';
        } else if (period === 'month' || period === 'custom') {
            trendGrouping = 'DATE(payment_date)';
        } else {
            trendGrouping = 'DATE_FORMAT(payment_date, "%Y-%m")';
        }

        const [revenueTrend] = await db.query(
            `SELECT 
                ${trendGrouping} as period,
                COALESCE(SUM(amount), 0) as revenue,
                COUNT(*) as transactions
            FROM payments 
            WHERE payment_status = 'completed' ${dateFilter}
            GROUP BY ${trendGrouping}
            ORDER BY ${trendGrouping} ASC`,
            params
        );

        // Top revenue generating members
        const [topMembers] = await db.query(
            `SELECT 
                m.id,
                m.first_name,
                m.last_name,
                COALESCE(SUM(p.amount), 0) as total_spent,
                COUNT(p.id) as transaction_count
            FROM members m
            INNER JOIN payments p ON m.id = p.member_id
            WHERE p.payment_status = 'completed' ${dateFilter}
            GROUP BY m.id
            ORDER BY total_spent DESC
            LIMIT 10`,
            params
        );

        // Generate PDF
        const reportData = {
            period,
            summary: {
                totalRevenue: parseFloat(totalRevenue[0].total || 0),
                transactionCount: parseInt(totalRevenue[0].transaction_count || 0),
                averageTransaction: parseFloat(totalRevenue[0].average_transaction || 0)
            },
            revenueByType,
            revenueByMethod,
            revenueTrend,
            topMembers,
            dateRange: period === 'custom' ? { startDate, endDate } : null
        };

        const pdfPath = await pdfService.generateRevenueReport(reportData);

        // Send PDF file
        res.download(pdfPath, path.basename(pdfPath), (err) => {
            if (err) {
                console.error('Error sending PDF:', err);
                res.status(500).json({
                    success: false,
                    message: 'Error sending PDF report'
                });
            }
        });

    } catch (error) {
        console.error('Get revenue report PDF error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating revenue report PDF',
            error: error.message
        });
    }
};

// @desc    Get membership report as PDF
// @route   GET /api/reports/membership/pdf
// @access  Private (Admin)
const getMembershipReportPDF = async (req, res) => {
    try {
        const { period = 'all', startDate = '', endDate = '' } = req.query;

        // Membership by plan
        const [membershipByPlan] = await db.query(
            `SELECT 
                mp.name as plan_name,
                mp.price,
                COUNT(mm.id) as total_subscriptions,
                COUNT(CASE WHEN mm.status = 'active' THEN 1 END) as active_subscriptions,
                SUM(mp.price) as total_revenue
            FROM membership_plans mp
            LEFT JOIN member_memberships mm ON mp.id = mm.membership_plan_id
            GROUP BY mp.id
            ORDER BY total_subscriptions DESC`
        );

        // New memberships trend
        let trendQuery = `
            SELECT 
                DATE_FORMAT(created_at, '%Y-%m') as month,
                COUNT(*) as count
            FROM member_memberships
            WHERE 1=1
        `;

        const trendParams = [];

        if (startDate && endDate) {
            trendQuery += ` AND created_at BETWEEN ? AND ?`;
            trendParams.push(startDate, endDate);
        }

        trendQuery += ` GROUP BY month ORDER BY month DESC LIMIT 12`;

        const [membershipTrend] = await db.query(trendQuery, trendParams);

        // Expiring soon
        const [expiringSoon] = await db.query(
            `SELECT 
                mm.*,
                m.first_name,
                m.last_name,
                u.email,
                mp.name as plan_name
            FROM member_memberships mm
            INNER JOIN members m ON mm.member_id = m.id
            INNER JOIN users u ON m.user_id = u.id
            INNER JOIN membership_plans mp ON mm.membership_plan_id = mp.id
            WHERE mm.status = 'active'
            AND mm.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
            ORDER BY mm.end_date ASC`
        );

        // Membership status distribution
        const [statusDistribution] = await db.query(
            `SELECT 
                status,
                COUNT(*) as count
            FROM member_memberships
            GROUP BY status`
        );

        // Generate PDF
        const reportData = {
            period,
            membershipByPlan,
            membershipTrend,
            expiringSoon,
            statusDistribution,
            dateRange: period === 'custom' && startDate && endDate ? { startDate, endDate } : null
        };

        const pdfPath = await pdfService.generateMembershipReport(reportData);

        // Send PDF file
        res.download(pdfPath, path.basename(pdfPath), (err) => {
            if (err) {
                console.error('Error sending PDF:', err);
                res.status(500).json({
                    success: false,
                    message: 'Error sending PDF report'
                });
            }
        });

    } catch (error) {
        console.error('Get membership report PDF error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating membership report PDF',
            error: error.message
        });
    }
};

module.exports = {
    getDashboardStats,
    getMembershipReport,
    getPaymentReport,
    getAttendanceReport,
    getTrainerReport,
    getSupplementReport,
    exportReport,
    getRevenueReport,
    getAttendanceReportPDF,
    getRevenueReportPDF,
    getMembershipReportPDF
};