const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const logger = require('../utils/logger');

const pdfService = {
    // Generate invoice PDF
    generateInvoice: async (invoiceData) => {
        try {
            const { invoiceNumber, memberId, amount, paymentType, description, date } = invoiceData;

            // Get member details
            const [members] = await db.query(
                `SELECT m.*, u.email 
                 FROM members m 
                 INNER JOIN users u ON m.user_id = u.id 
                 WHERE m.id = ?`,
                [memberId]
            );

            if (members.length === 0) {
                throw new Error('Member not found');
            }

            const member = members[0];

            // Create invoices directory if it doesn't exist
            const invoicesDir = path.join(__dirname, '../../uploads/invoices');
            if (!fs.existsSync(invoicesDir)) {
                fs. mkdirSync(invoicesDir, { recursive: true });
            }

            const invoicePath = path.join(invoicesDir, `${invoiceNumber}.pdf`);

            // Create PDF document
            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(invoicePath);

            doc.pipe(stream);

            // Add header
            doc.fontSize(20)
                .text('GYM MANAGEMENT SYSTEM', { align: 'center' })
                .fontSize(10)
                .text('123 Fitness Street, Gym City, GC 12345', { align: 'center' })
                .text('Phone: (123) 456-7890 | Email: info@gym.com', { align: 'center' })
                .moveDown(2);

            // Add invoice title
            doc.fontSize(24)
                .fillColor('#667eea')
                .text('INVOICE', { align: 'center' })
                .fillColor('#000000')
                .moveDown();

            // Add invoice details
            doc.fontSize(10)
                .text(`Invoice Number: ${invoiceNumber}`, 50, 180)
                .text(`Date: ${new Date(date).toLocaleDateString()}`, 50, 195)
                .text(`Payment Type: ${paymentType. toUpperCase()}`, 50, 210);

            // Add member details
            doc.text('BILL TO:', 50, 240)
                .fontSize(12)
                .text(`${member.first_name} ${member.last_name}`, 50, 255)
                .fontSize(10)
                .text(`${member.email}`, 50, 270)
                .text(`${member.phone || 'N/A'}`, 50, 285)
                .text(`${member.address || 'N/A'}`, 50, 300);

            // Draw line
            doc.moveTo(50, 330)
                .lineTo(550, 330)
                .stroke();

            // Add table header
            doc.fontSize(10)
                .fillColor('#667eea')
                .text('DESCRIPTION', 50, 350)
                .text('AMOUNT', 450, 350, { width: 100, align: 'right' })
                .fillColor('#000000');

            // Draw line
            doc.moveTo(50, 365)
                .lineTo(550, 365)
                .stroke();

            // Add items
            doc.fontSize(10)
                .text(description || `${paymentType} Payment`, 50, 380)
                .text(`$${parseFloat(amount).toFixed(2)}`, 450, 380, { width: 100, align: 'right' });

            // Draw line
            doc.moveTo(50, 400)
                .lineTo(550, 400)
                .stroke();

            // Add totals
            doc.fontSize(10)
                .text('Subtotal:', 350, 420)
                .text(`$${parseFloat(amount).toFixed(2)}`, 450, 420, { width: 100, align: 'right' })
                .text('Tax (0%):', 350, 440)
                .text('$0.00', 450, 440, { width: 100, align: 'right' });

            // Draw line
            doc.moveTo(350, 460)
                .lineTo(550, 460)
                .stroke();

            // Add total
            doc.fontSize(14)
                .fillColor('#667eea')
                .text('TOTAL:', 350, 470)
                .text(`$${parseFloat(amount).toFixed(2)}`, 450, 470, { width: 100, align: 'right' })
                .fillColor('#000000');

            // Add payment status
            doc.fontSize(12)
                .fillColor('#4caf50')
                .text('PAID', 50, 520, { align: 'center' })
                .fillColor('#000000');

            // Add footer
            doc.fontSize(10)
                .text('Thank you for your business!', 50, 700, { align: 'center' })
                .fontSize(8)
                .fillColor('#777777')
                .text('This is a computer-generated invoice and does not require a signature.', 50, 720, { align: 'center' });

            // Finalize PDF
            doc.end();

            // Wait for stream to finish
            await new Promise((resolve, reject) => {
                stream.on('finish', resolve);
                stream.on('error', reject);
            });

            logger.info(`Invoice generated: ${invoicePath}`);
            return invoicePath;

        } catch (error) {
            logger.error('Error generating invoice:', error);
            throw error;
        }
    },

    // Generate membership card PDF
    generateMembershipCard: async (memberId) => {
        try {
            const [members] = await db.query(
                `SELECT m.*, u.email, mm.end_date, mp.name as plan_name
                 FROM members m
                 INNER JOIN users u ON m.user_id = u.id
                 LEFT JOIN member_memberships mm ON m.id = mm.member_id AND mm.status = 'active'
                 LEFT JOIN membership_plans mp ON mm.membership_plan_id = mp.id
                 WHERE m.id = ?`,
                [memberId]
            );

            if (members.length === 0) {
                throw new Error('Member not found');
            }

            const member = members[0];

            const cardsDir = path.join(__dirname, '../../uploads/membership-cards');
            if (!fs. existsSync(cardsDir)) {
                fs.mkdirSync(cardsDir, { recursive: true });
            }

            const cardPath = path.join(cardsDir, `member-${memberId}-card.pdf`);

            const doc = new PDFDocument({ size: [350, 200], margin: 20 });
            const stream = fs.createWriteStream(cardPath);

            doc.pipe(stream);

            // Add background
            doc.rect(0, 0, 350, 200)
                .fillAndStroke('#667eea', '#764ba2');

            // Add title
            doc.fontSize(18)
                .fillColor('#ffffff')
                .text('GYM MEMBERSHIP CARD', 20, 20);

            // Add member details
            doc.fontSize(12)
                .text(`${member.first_name} ${member.last_name}`, 20, 60)
                .fontSize(10)
                .text(`Member ID: ${member.id}`, 20, 80)
                .text(`Plan: ${member.plan_name || 'N/A'}`, 20, 95)
                .text(`Valid Until: ${member.end_date ?  new Date(member.end_date).toLocaleDateString() : 'N/A'}`, 20, 110);

            // Add QR code placeholder
            doc.fontSize(8)
                .text('QR Code', 280, 150, { align: 'center' });

            doc.end();

            await new Promise((resolve, reject) => {
                stream.on('finish', resolve);
                stream.on('error', reject);
            });

            logger.info(`Membership card generated: ${cardPath}`);
            return cardPath;

        } catch (error) {
            logger. error('Error generating membership card:', error);
            throw error;
        }    },

    // Generate attendance report PDF
    generateAttendanceReport: async (reportData) => {
        try {
            const { period, attendanceTrend, peakHours, activeMembers, checkInMethods, dateRange } = reportData;

            // Create reports directory if it doesn't exist
            const reportsDir = path.join(__dirname, '../../uploads/reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            const reportName = `attendance-report-${period}-${Date.now()}.pdf`;
            const reportPath = path.join(reportsDir, reportName);

            // Create PDF document
            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(reportPath);

            doc.pipe(stream);

            // Add header
            doc.fontSize(20)
                .fillColor('#667eea')
                .text('ATTENDANCE REPORT', { align: 'center' })
                .fillColor('#000000')
                .fontSize(10)
                .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
                .moveDown();

            // Add period info
            doc.fontSize(12)
                .text(`Period: ${period.toUpperCase()}`, 50, doc.y)
                .moveDown();

            if (dateRange) {
                doc.fontSize(10)
                    .text(`Date Range: ${dateRange.startDate} to ${dateRange.endDate}`, 50, doc.y)
                    .moveDown();
            }

            // Add summary statistics
            const totalCheckIns = attendanceTrend.reduce((sum, day) => sum + parseInt(day.total_check_ins || 0), 0);
            const avgDailyCheckIns = attendanceTrend.length > 0 ? (totalCheckIns / attendanceTrend.length).toFixed(1) : 0;
            const uniqueMembers = [...new Set(activeMembers.map(m => m.id))].length;

            doc.fontSize(14)
                .fillColor('#667eea')
                .text('SUMMARY STATISTICS', 50, doc.y)
                .fillColor('#000000')
                .moveDown(0.5);

            doc.fontSize(10)
                .text(`Total Check-ins: ${totalCheckIns}`, 50, doc.y)
                .text(`Average Daily Check-ins: ${avgDailyCheckIns}`, 50, doc.y)
                .text(`Active Members: ${uniqueMembers}`, 50, doc.y)
                .moveDown();

            // Draw line
            doc.moveTo(50, doc.y)
                .lineTo(550, doc.y)
                .stroke()
                .moveDown();

            // Add peak hours section
            if (peakHours && peakHours.length > 0) {
                doc.fontSize(14)
                    .fillColor('#667eea')
                    .text('PEAK HOURS', 50, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.5);

                const topPeakHours = peakHours.slice(0, 5);
                topPeakHours.forEach((hour, index) => {
                    const hourLabel = `${hour.hour}:00 - ${hour.hour + 1}:00`;
                    doc.fontSize(10)
                        .text(`${index + 1}. ${hourLabel}: ${hour.check_ins} check-ins`, 50, doc.y);
                });
                doc.moveDown();
            }

            // Draw line
            doc.moveTo(50, doc.y)
                .lineTo(550, doc.y)
                .stroke()
                .moveDown();

            // Add most active members section
            if (activeMembers && activeMembers.length > 0) {
                doc.fontSize(14)
                    .fillColor('#667eea')
                    .text('MOST ACTIVE MEMBERS', 50, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.5);

                // Table header
                doc.fontSize(9)
                    .fillColor('#667eea')
                    .text('Rank', 50, doc.y)
                    .text('Member Name', 100, doc.y)
                    .text('Total Visits', 300, doc.y)
                    .text('Last Visit', 400, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.3);

                // Table rows
                activeMembers.forEach((member, index) => {
                    const y = doc.y;
                    doc.fontSize(9)
                        .text(`${index + 1}`, 50, y)
                        .text(`${member.first_name} ${member.last_name}`, 100, y)
                        .text(`${member.total_visits}`, 300, y)
                        .text(member.last_visit ? new Date(member.last_visit).toLocaleDateString() : 'N/A', 400, y);
                    doc.moveDown(0.5);
                });
                doc.moveDown();
            }

            // Draw line
            doc.moveTo(50, doc.y)
                .lineTo(550, doc.y)
                .stroke()
                .moveDown();

            // Add check-in methods
            if (checkInMethods && checkInMethods.length > 0) {
                doc.fontSize(14)
                    .fillColor('#667eea')
                    .text('CHECK-IN METHODS', 50, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.5);

                checkInMethods.forEach(method => {
                    const methodName = method.check_in_method || 'Unknown';
                    const percentage = totalCheckIns > 0 ? ((method.count / totalCheckIns) * 100).toFixed(1) : 0;
                    doc.fontSize(10)
                        .text(`${methodName}: ${method.count} (${percentage}%)`, 50, doc.y);
                });
                doc.moveDown();
            }

            // Add footer
            doc.fontSize(8)
                .fillColor('#777777')
                .text('This is a computer-generated report from Gym Management System', 50, 730, { align: 'center' });

            // Finalize PDF
            doc.end();

            // Wait for stream to finish
            await new Promise((resolve, reject) => {
                stream.on('finish', resolve);
                stream.on('error', reject);
            });

            logger.info(`Attendance report generated: ${reportPath}`);
            return reportPath;

        } catch (error) {
            logger.error('Error generating attendance report:', error);
            throw error;
        }
    },

    // Generate revenue report PDF
    generateRevenueReport: async (reportData) => {
        try {
            const { period, summary, revenueByType, revenueByMethod, revenueTrend, topMembers, dateRange } = reportData;

            // Create reports directory if it doesn't exist
            const reportsDir = path.join(__dirname, '../../uploads/reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            const reportName = `revenue-report-${period}-${Date.now()}.pdf`;
            const reportPath = path.join(reportsDir, reportName);

            // Create PDF document
            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(reportPath);

            doc.pipe(stream);

            // Add header
            doc.fontSize(20)
                .fillColor('#667eea')
                .text('REVENUE REPORT', { align: 'center' })
                .fillColor('#000000')
                .fontSize(10)
                .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
                .moveDown();

            // Add period info
            doc.fontSize(12)
                .text(`Period: ${period.toUpperCase()}`, 50, doc.y)
                .moveDown();

            if (dateRange) {
                doc.fontSize(10)
                    .text(`Date Range: ${dateRange.startDate} to ${dateRange.endDate}`, 50, doc.y)
                    .moveDown();
            }

            // Add summary statistics
            doc.fontSize(14)
                .fillColor('#667eea')
                .text('SUMMARY STATISTICS', 50, doc.y)
                .fillColor('#000000')
                .moveDown(0.5);

            doc.fontSize(12)
                .text(`Total Revenue: $${parseFloat(summary.totalRevenue).toFixed(2)}`, 50, doc.y)
                .text(`Total Transactions: ${summary.transactionCount}`, 50, doc.y)
                .text(`Average Transaction: $${parseFloat(summary.averageTransaction).toFixed(2)}`, 50, doc.y)
                .moveDown();

            // Draw line
            doc.moveTo(50, doc.y)
                .lineTo(550, doc.y)
                .stroke()
                .moveDown();

            // Add revenue by payment type section
            if (revenueByType && revenueByType.length > 0) {
                doc.fontSize(14)
                    .fillColor('#667eea')
                    .text('REVENUE BY PAYMENT TYPE', 50, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.5);

                revenueByType.forEach(type => {
                    const percentage = summary.totalRevenue > 0 
                        ? ((parseFloat(type.total) / parseFloat(summary.totalRevenue)) * 100).toFixed(1) 
                        : 0;
                    doc.fontSize(10)
                        .text(`${type.payment_type}: $${parseFloat(type.total).toFixed(2)} (${percentage}%) - ${type.count} transactions`, 50, doc.y);
                });
                doc.moveDown();
            }

            // Draw line
            doc.moveTo(50, doc.y)
                .lineTo(550, doc.y)
                .stroke()
                .moveDown();

            // Add revenue by payment method section
            if (revenueByMethod && revenueByMethod.length > 0) {
                doc.fontSize(14)
                    .fillColor('#667eea')
                    .text('REVENUE BY PAYMENT METHOD', 50, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.5);

                revenueByMethod.forEach(method => {
                    const percentage = summary.totalRevenue > 0 
                        ? ((parseFloat(method.total) / parseFloat(summary.totalRevenue)) * 100).toFixed(1) 
                        : 0;
                    doc.fontSize(10)
                        .text(`${method.payment_method}: $${parseFloat(method.total).toFixed(2)} (${percentage}%) - ${method.count} transactions`, 50, doc.y);
                });
                doc.moveDown();
            }

            // Draw line
            doc.moveTo(50, doc.y)
                .lineTo(550, doc.y)
                .stroke()
                .moveDown();

            // Add top revenue generating members section
            if (topMembers && topMembers.length > 0) {
                doc.fontSize(14)
                    .fillColor('#667eea')
                    .text('TOP REVENUE GENERATING MEMBERS', 50, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.5);

                // Table header
                doc.fontSize(9)
                    .fillColor('#667eea')
                    .text('Rank', 50, doc.y)
                    .text('Member Name', 100, doc.y)
                    .text('Total Spent', 300, doc.y)
                    .text('Transactions', 420, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.3);

                // Table rows
                topMembers.forEach((member, index) => {
                    const y = doc.y;
                    doc.fontSize(9)
                        .text(`${index + 1}`, 50, y)
                        .text(`${member.first_name} ${member.last_name}`, 100, y)
                        .text(`$${parseFloat(member.total_spent).toFixed(2)}`, 300, y)
                        .text(`${member.transaction_count}`, 420, y);
                    doc.moveDown(0.5);
                });
                doc.moveDown();
            }

            // Add footer
            doc.fontSize(8)
                .fillColor('#777777')
                .text('This is a computer-generated report from Gym Management System', 50, 730, { align: 'center' });

            // Finalize PDF
            doc.end();

            // Wait for stream to finish
            await new Promise((resolve, reject) => {
                stream.on('finish', resolve);
                stream.on('error', reject);
            });

            logger.info(`Revenue report generated: ${reportPath}`);
            return reportPath;

        } catch (error) {
            logger.error('Error generating revenue report:', error);
            throw error;
        }
    },

    // Generate membership report PDF
    generateMembershipReport: async (reportData) => {
        try {
            const { period, membershipByPlan, membershipTrend, expiringSoon, statusDistribution, dateRange } = reportData;

            // Create reports directory if it doesn't exist
            const reportsDir = path.join(__dirname, '../../uploads/reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            const reportName = `membership-report-${period}-${Date.now()}.pdf`;
            const reportPath = path.join(reportsDir, reportName);

            // Create PDF document
            const doc = new PDFDocument({ margin: 50 });
            const stream = fs.createWriteStream(reportPath);

            doc.pipe(stream);

            // Add header
            doc.fontSize(20)
                .fillColor('#667eea')
                .text('MEMBERSHIP REPORT', { align: 'center' })
                .fillColor('#000000')
                .fontSize(10)
                .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' })
                .moveDown();

            // Add period info
            if (period) {
                doc.fontSize(12)
                    .text(`Period: ${period.toUpperCase()}`, 50, doc.y)
                    .moveDown();
            }

            if (dateRange) {
                doc.fontSize(10)
                    .text(`Date Range: ${dateRange.startDate} to ${dateRange.endDate}`, 50, doc.y)
                    .moveDown();
            }

            // Add membership by plan section
            if (membershipByPlan && membershipByPlan.length > 0) {
                doc.fontSize(14)
                    .fillColor('#667eea')
                    .text('MEMBERSHIP BY PLAN', 50, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.5);

                // Table header
                doc.fontSize(9)
                    .fillColor('#667eea')
                    .text('Plan Name', 50, doc.y)
                    .text('Price', 200, doc.y)
                    .text('Total', 280, doc.y)
                    .text('Active', 340, doc.y)
                    .text('Revenue', 400, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.3);

                // Table rows
                membershipByPlan.forEach(plan => {
                    const y = doc.y;
                    doc.fontSize(9)
                        .text(plan.plan_name || 'N/A', 50, y, { width: 140, ellipsis: true })
                        .text(`$${parseFloat(plan.price || 0).toFixed(2)}`, 200, y)
                        .text(`${plan.total_subscriptions || 0}`, 280, y)
                        .text(`${plan.active_subscriptions || 0}`, 340, y)
                        .text(`$${parseFloat(plan.total_revenue || 0).toFixed(2)}`, 400, y);
                    doc.moveDown(0.5);
                });
                doc.moveDown();
            }

            // Draw line
            doc.moveTo(50, doc.y)
                .lineTo(550, doc.y)
                .stroke()
                .moveDown();

            // Add status distribution section
            if (statusDistribution && statusDistribution.length > 0) {
                doc.fontSize(14)
                    .fillColor('#667eea')
                    .text('MEMBERSHIP STATUS DISTRIBUTION', 50, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.5);

                const totalCount = statusDistribution.reduce((sum, status) => sum + parseInt(status.count || 0), 0);
                
                statusDistribution.forEach(status => {
                    const percentage = totalCount > 0 ? ((status.count / totalCount) * 100).toFixed(1) : 0;
                    doc.fontSize(10)
                        .text(`${status.status}: ${status.count} (${percentage}%)`, 50, doc.y);
                });
                doc.moveDown();
            }

            // Draw line
            doc.moveTo(50, doc.y)
                .lineTo(550, doc.y)
                .stroke()
                .moveDown();

            // Add expiring soon section
            if (expiringSoon && expiringSoon.length > 0) {
                doc.fontSize(14)
                    .fillColor('#667eea')
                    .text('MEMBERSHIPS EXPIRING SOON (30 DAYS)', 50, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.5);

                // Table header
                doc.fontSize(9)
                    .fillColor('#667eea')
                    .text('Member Name', 50, doc.y)
                    .text('Plan', 200, doc.y)
                    .text('End Date', 350, doc.y)
                    .text('Status', 450, doc.y)
                    .fillColor('#000000')
                    .moveDown(0.3);

                // Table rows (limit to first 15 to fit on page)
                const limitedExpiring = expiringSoon.slice(0, 15);
                limitedExpiring.forEach(membership => {
                    const y = doc.y;
                    const memberName = `${membership.first_name} ${membership.last_name}`;
                    doc.fontSize(8)
                        .text(memberName, 50, y, { width: 140, ellipsis: true })
                        .text(membership.plan_name || 'N/A', 200, y, { width: 140, ellipsis: true })
                        .text(membership.end_date ? new Date(membership.end_date).toLocaleDateString() : 'N/A', 350, y)
                        .text(membership.status || 'N/A', 450, y);
                    doc.moveDown(0.4);
                });
                
                if (expiringSoon.length > 15) {
                    doc.fontSize(8)
                        .fillColor('#777777')
                        .text(`... and ${expiringSoon.length - 15} more`, 50, doc.y)
                        .fillColor('#000000');
                }
                doc.moveDown();
            }

            // Add footer
            doc.fontSize(8)
                .fillColor('#777777')
                .text('This is a computer-generated report from Gym Management System', 50, 730, { align: 'center' });

            // Finalize PDF
            doc.end();

            // Wait for stream to finish
            await new Promise((resolve, reject) => {
                stream.on('finish', resolve);
                stream.on('error', reject);
            });

            logger.info(`Membership report generated: ${reportPath}`);
            return reportPath;

        } catch (error) {
            logger.error('Error generating membership report:', error);
            throw error;
        }
    }
};

module.exports = pdfService;