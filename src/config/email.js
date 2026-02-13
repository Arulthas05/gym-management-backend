let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (error) {
    console.error('❌ nodemailer module not found.  Installing...');
    console.error('Run: npm install nodemailer');
}

require('dotenv').config();

let transporter;

if (nodemailer && nodemailer.createTransporter) {
    try {
        // Create transporter
        transporter = nodemailer.createTransporter({
            host: process.env. EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: process.env.EMAIL_SECURE === 'true',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env. EMAIL_PASS
            }
        });

        // Verify transporter
        transporter.verify((error, success) => {
            if (error) {
                console.error('❌ Email configuration error:', error.message);
                console.log('💡 Tip: Update EMAIL_USER and EMAIL_PASS in .env file');
            } else {
                console.log('✅ Email server is ready');
            }
        });
    } catch (error) {
        console.error('❌ Failed to initialize email transporter:', error.message);
    }
} else {
    console.warn('⚠️  nodemailer not available. Email functionality disabled.');
}

// Create dummy transporter if real one fails
if (!transporter) {
    transporter = {
        sendMail: async (mailOptions) => {
            console.log('📧 [MOCK EMAIL] To:', mailOptions.to);
            console.log('📧 [MOCK EMAIL] Subject:', mailOptions.subject);
            return { messageId: 'mock-' + Date.now() };
        },
        verify: (callback) => callback(null, true)
    };
}

module.exports = transporter;