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
        }
    }
};

module.exports = pdfService;