const cron = require('node-cron');
const db = require('../config/database');
const emailService = require('./emailService');
const logger = require('../utils/logger');

const cronJobs = {
    // Initialize all cron jobs
    initializeCronJobs: () => {
        logger.info('Initializing cron jobs...');

        // Run membership expiry check daily at 9:00 AM
        cron. schedule('0 9 * * *', async () => {
            logger.info('Running membership expiry check...');
            await cronJobs.checkMembershipExpiry();
        });

        // Run session reminders daily at 8:00 AM
        cron.schedule('0 8 * * *', async () => {
            logger.info('Running session reminders...');
            await cronJobs.sendSessionReminders();
        });

        // Run payment reminders daily at 10:00 AM
        cron.schedule('0 10 * * *', async () => {
            logger.info('Running payment reminders...');
            await cronJobs.sendPaymentReminders();
        });

        // Update expired memberships every day at midnight
        cron.schedule('0 0 * * *', async () => {
            logger.info('Updating expired memberships...');
            await cronJobs.updateExpiredMemberships();
        });

        // Mark no-show sessions every day at 11:00 PM
        cron.schedule('0 23 * * *', async () => {
            logger.info('Marking no-show sessions.. .');
            await cronJobs. markNoShowSessions();
        });

        // Generate monthly reports on the 1st of each month at 6:00 AM
        cron.schedule('0 6 1 * *', async () => {
            logger.info('Generating monthly reports...');
            await cronJobs.generateMonthlyReports();
        });

        logger.info('✅ All cron jobs initialized successfully');
    },

    // Check and notify members about expiring memberships
    checkMembershipExpiry: async () => {
        try {
            // Get memberships expiring in 7 days
            const [expiringIn7Days] = await db.query(
                `SELECT 
                    mm.*,
                    m.first_name,
                    m. last_name,
                    u.email
                FROM member_memberships mm
                INNER JOIN members m ON mm.member_id = m.id
                INNER JOIN users u ON m. user_id = u.id
                WHERE mm.status = 'active'
                AND mm.end_date = DATE_ADD(CURDATE(), INTERVAL 7 DAY)`
            );

            for (const membership of expiringIn7Days) {
                await emailService.sendMembershipExpiryReminder(
                    membership.email,
                    membership.first_name,
                    membership.end_date,
                    7
                );
                logger.info(`Expiry reminder (7 days) sent to ${membership.email}`);
            }

            // Get memberships expiring in 3 days
            const [expiringIn3Days] = await db.query(
                `SELECT 
                    mm.*,
                    m.first_name,
                    m.last_name,
                    u.email
                FROM member_memberships mm
                INNER JOIN members m ON mm. member_id = m.id
                INNER JOIN users u ON m.user_id = u.id
                WHERE mm.status = 'active'
                AND mm. end_date = DATE_ADD(CURDATE(), INTERVAL 3 DAY)`
            );

            for (const membership of expiringIn3Days) {
                await emailService.sendMembershipExpiryReminder(
                    membership.email,
                    membership.first_name,
                    membership.end_date,
                    3
                );
                logger.info(`Expiry reminder (3 days) sent to ${membership.email}`);
            }

            // Get memberships expiring tomorrow
            const [expiringTomorrow] = await db.query(
                `SELECT 
                    mm.*,
                    m.first_name,
                    m.last_name,
                    u.email
                FROM member_memberships mm
                INNER JOIN members m ON mm.member_id = m.id
                INNER JOIN users u ON m.user_id = u.id
                WHERE mm.status = 'active'
                AND mm.end_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
            );

            for (const membership of expiringTomorrow) {
                await emailService.sendMembershipExpiryReminder(
                    membership.email,
                    membership. first_name,
                    membership.end_date,
                    1
                );
                logger. info(`Expiry reminder (1 day) sent to ${membership. email}`);
            }

            logger.info(`Membership expiry check completed.  Total reminders sent: ${expiringIn7Days.length + expiringIn3Days.length + expiringTomorrow.length}`);

        } catch (error) {
            logger.error('Error checking membership expiry:', error);
        }
    },

    // Send session reminders for upcoming sessions
    sendSessionReminders: async () => {
        try {
            // Get sessions scheduled for tomorrow
            const [upcomingSessions] = await db.query(
                `SELECT 
                    ts.*,
                    m.first_name as member_first_name,
                    m. last_name as member_last_name,
                    u.email as member_email,
                    t.first_name as trainer_first_name,
                    t.last_name as trainer_last_name
                FROM training_sessions ts
                INNER JOIN members m ON ts.member_id = m.id
                INNER JOIN users u ON m.user_id = u.id
                INNER JOIN trainers t ON ts. trainer_id = t.id
                WHERE ts.session_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
                AND ts.status = 'scheduled'`
            );

            for (const session of upcomingSessions) {
                await emailService.sendSessionReminder(
                    session.member_email,
                    session.member_first_name,
                    `${session.trainer_first_name} ${session.trainer_last_name}`,
                    session.session_date,
                    session.start_time
                );
                logger.info(`Session reminder sent to ${session.member_email}`);
            }

            logger. info(`Session reminders completed.  Total reminders sent: ${upcomingSessions.length}`);

        } catch (error) {
            logger. error('Error sending session reminders:', error);
        }
    },

    // Send payment reminders for pending payments
    sendPaymentReminders: async () => {
        try {
            // Get pending payments older than 3 days
            const [pendingPayments] = await db.query(
                `SELECT 
                    p.*,
                    m.first_name,
                    m.last_name,
                    u.email
                FROM payments p
                INNER JOIN members m ON p.member_id = m.id
                INNER JOIN users u ON m.user_id = u.id
                WHERE p.payment_status = 'pending'
                AND p.created_at <= DATE_SUB(NOW(), INTERVAL 3 DAY)`
            );

            for (const payment of pendingPayments) {
                const dueDate = new Date(payment.created_at);
                dueDate.setDate(dueDate. getDate() + 7); // 7 days from creation

                await emailService.sendPaymentReminder(
                    payment.email,
                    payment. first_name,
                    payment.amount,
                    dueDate
                );
                logger.info(`Payment reminder sent to ${payment.email}`);
            }

            logger.info(`Payment reminders completed. Total reminders sent: ${pendingPayments.length}`);

        } catch (error) {
            logger.error('Error sending payment reminders:', error);
        }
    },

    // Update expired memberships
    updateExpiredMemberships: async () => {
        try {
            const [result] = await db.query(
                `UPDATE member_memberships 
                SET status = 'expired' 
                WHERE status = 'active' 
                AND end_date < CURDATE()`
            );

            logger.info(`Updated ${result.affectedRows} expired memberships`);

        } catch (error) {
            logger. error('Error updating expired memberships:', error);
        }
    },

    // Mark sessions as no-show
    markNoShowSessions: async () => {
        try {
            const [result] = await db.query(
                `UPDATE training_sessions 
                SET status = 'no-show' 
                WHERE status = 'scheduled' 
                AND session_date < CURDATE()`
            );

            logger.info(`Marked ${result.affectedRows} sessions as no-show`);

        } catch (error) {
            logger.error('Error marking no-show sessions:', error);
        }
    },

    // Generate monthly reports
    generateMonthlyReports: async () => {
        try {
            const lastMonth = new Date();
            lastMonth.setMonth(lastMonth.getMonth() - 1);
            const year = lastMonth.getFullYear();
            const month = lastMonth. getMonth() + 1;

            // Get monthly statistics
            const [revenue] = await db.query(
                `SELECT 
                    COUNT(*) as total_transactions,
                    SUM(amount) as total_revenue
                FROM payments
                WHERE payment_status = 'completed'
                AND YEAR(payment_date) = ?
                AND MONTH(payment_date) = ?`,
                [year, month]
            );

            const [newMembers] = await db.query(
                `SELECT COUNT(*) as total
                FROM members
                WHERE YEAR(created_at) = ?
                AND MONTH(created_at) = ?`,
                [year, month]
            );

            const [totalSessions] = await db.query(
                `SELECT COUNT(*) as total
                FROM training_sessions
                WHERE YEAR(session_date) = ?
                AND MONTH(session_date) = ?`,
                [year, month]
            );

            const [avgAttendance] = await db.query(
                `SELECT COUNT(*) / DAY(LAST_DAY(DATE(CONCAT(?, '-', ?, '-01')))) as avg_daily
                FROM attendance
                WHERE YEAR(attendance_date) = ?
                AND MONTH(attendance_date) = ?`,
                [year, month, year, month]
            );

            logger.info(`
                Monthly Report Generated for ${year}-${month}:
                - Total Revenue: $${revenue[0].total_revenue || 0}
                - Total Transactions: ${revenue[0].total_transactions || 0}
                - New Members: ${newMembers[0].total || 0}
                - Total Sessions: ${totalSessions[0].total || 0}
                - Avg Daily Attendance: ${Math.round(avgAttendance[0].avg_daily || 0)}
            `);

            // You can extend this to send reports to admin via email
            // or save to a reports table in database

        } catch (error) {
            logger.error('Error generating monthly reports:', error);
        }
    },

    // Auto-renew memberships (if auto_renewal is enabled)
    autoRenewMemberships: async () => {
        try {
            // Get memberships that expired yesterday with auto-renewal enabled
            const [autoRenewMemberships] = await db.query(
                `SELECT 
                    mm.*,
                    mp.duration_months,
                    mp.price,
                    m.first_name,
                    m.last_name,
                    u.email
                FROM member_memberships mm
                INNER JOIN membership_plans mp ON mm.membership_plan_id = mp.id
                INNER JOIN members m ON mm.member_id = m.id
                INNER JOIN users u ON m.user_id = u. id
                WHERE mm.auto_renewal = 1
                AND mm.end_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
                AND mm.status = 'expired'`
            );

            for (const membership of autoRenewMemberships) {
                const connection = await db.getConnection();
                await connection.beginTransaction();

                try {
                    // Calculate new dates
                    const startDate = new Date();
                    const endDate = new Date();
                    endDate.setMonth(endDate.getMonth() + membership.duration_months);

                    // Create new membership
                    const [newMembership] = await connection.query(
                        `INSERT INTO member_memberships 
                        (member_id, membership_plan_id, start_date, end_date, status, auto_renewal)
                        VALUES (?, ?, ?, ?, 'active', 1)`,
                        [membership.member_id, membership.membership_plan_id, startDate, endDate]
                    );

                    // Create payment record
                    const invoiceNumber = `INV-${Date.now()}-${membership.member_id}`;
                    await connection.query(
                        `INSERT INTO payments 
                        (member_id, amount, payment_type, payment_method, payment_status, invoice_number, description)
                        VALUES (?, ?, 'membership', 'auto-renewal', 'completed', ?, 'Auto-renewed membership')`,
                        [membership.member_id, membership.price, invoiceNumber]
                    );

                    await connection.commit();
                    connection.release();

                    // Send confirmation email
                    await emailService. sendPaymentConfirmation(
                        membership.email,
                        membership.first_name,
                        membership.price,
                        invoiceNumber,
                        null
                    );

                    logger. info(`Auto-renewed membership for ${membership.email}`);

                } catch (error) {
                    await connection.rollback();
                    connection.release();
                    logger.error(`Error auto-renewing membership for member ${membership.member_id}: `, error);
                }
            }

            logger.info(`Auto-renewal completed.  Total renewals: ${autoRenewMemberships.length}`);

        } catch (error) {
            logger.error('Error in auto-renew memberships:', error);
        }
    },

    // Clean up old data (optional)
    cleanupOldData: async () => {
        try {
            // Delete old attendance records (older than 2 years)
            const [attendanceResult] = await db.query(
                `DELETE FROM attendance 
                WHERE attendance_date < DATE_SUB(CURDATE(), INTERVAL 2 YEAR)`
            );

            // Delete old email reminders (older than 6 months)
            const [remindersResult] = await db. query(
                `DELETE FROM email_reminders 
                WHERE created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)
                AND is_sent = 1`
            );

            // Delete old workout suggestions (older than 1 year)
            const [workoutResult] = await db.query(
                `DELETE FROM workout_suggestions 
                WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 YEAR)`
            );

            logger.info(`
                Cleanup completed: 
                - Deleted ${attendanceResult.affectedRows} old attendance records
                - Deleted ${remindersResult.affectedRows} old email reminders
                - Deleted ${workoutResult.affectedRows} old workout suggestions
            `);

        } catch (error) {
            logger.error('Error cleaning up old data:', error);
        }
    }
};

module. exports = cronJobs;