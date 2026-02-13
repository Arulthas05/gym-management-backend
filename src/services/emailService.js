const transporter = require('../config/email');
const logger = require('../utils/logger');

const emailService = {
    // Send welcome email
    sendWelcomeEmail: async (email, firstName) => {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: 'Welcome to Gym Management System',
                html: `
                    <! DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background:  linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                            .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>Welcome to Our Gym!</h1>
                            </div>
                            <div class="content">
                                <h2>Hello ${firstName},</h2>
                                <p>Thank you for joining our gym community!  We're excited to have you on board.</p>
                                <p>Your account has been successfully created. You can now: </p>
                                <ul>
                                    <li>Book training sessions with our expert trainers</li>
                                    <li>Track your attendance and progress</li>
                                    <li>Purchase supplements online</li>
                                    <li>Manage your membership</li>
                                </ul>
                                <p>Get started by logging into your account: </p>
                                <a href="${process.env.CLIENT_URL}/login" class="button">Login Now</a>
                                <p style="margin-top: 30px;">If you have any questions, feel free to contact our support team.</p>
                            </div>
                            <div class="footer">
                                <p>&copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            await transporter.sendMail(mailOptions);
            logger.info(`Welcome email sent to ${email}`);
            return true;
        } catch (error) {
            logger.error('Error sending welcome email:', error);
            return false;
        }
    },

    // Send password reset email
    sendPasswordResetEmail: async (email, resetUrl) => {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: 'Password Reset Request',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: #f44336; color: white; padding:  30px; text-align:  center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                            .button { display: inline-block; padding: 12px 30px; background: #f44336; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                            .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin:  20px 0; }
                            .footer { text-align: center; margin-top:  20px; color: #777; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>Password Reset</h1>
                            </div>
                            <div class="content">
                                <h2>Reset Your Password</h2>
                                <p>You requested to reset your password. Click the button below to create a new password: </p>
                                <a href="${resetUrl}" class="button">Reset Password</a>
                                <div class="warning">
                                    <strong>⚠️ Security Notice:</strong>
                                    <p>This link will expire in 1 hour. If you didn't request this reset, please ignore this email.</p>
                                </div>
                                <p style="margin-top:  20px;">Or copy and paste this link into your browser:</p>
                                <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
                            </div>
                            <div class="footer">
                                <p>&copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            await transporter.sendMail(mailOptions);
            logger.info(`Password reset email sent to ${email}`);
            return true;
        } catch (error) {
            logger.error('Error sending password reset email:', error);
            return false;
        }
    },

    // Send session confirmation email
    sendSessionConfirmation: async (email, memberName, trainerName, sessionDate, startTime) => {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: 'Training Session Confirmed',
                html:  `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin:  0 auto; padding: 20px; }
                            . header { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                            .session-details { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #11998e; }
                            . detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
                            . button { display: inline-block; padding: 12px 30px; background: #11998e; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                            .footer { text-align: center; margin-top: 20px; color:  #777; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>✅ Session Confirmed</h1>
                            </div>
                            <div class="content">
                                <h2>Hello ${memberName},</h2>
                                <p>Your training session has been successfully booked!</p>
                                <div class="session-details">
                                    <h3>Session Details:</h3>
                                    <div class="detail-row">
                                        <strong>Trainer:</strong>
                                        <span>${trainerName}</span>
                                    </div>
                                    <div class="detail-row">
                                        <strong>Date:</strong>
                                        <span>${new Date(sessionDate).toLocaleDateString()}</span>
                                    </div>
                                    <div class="detail-row">
                                        <strong>Time:</strong>
                                        <span>${startTime}</span>
                                    </div>
                                </div>
                                <p>Please arrive 10 minutes early for your session. If you need to reschedule or cancel, please do so at least 24 hours in advance.</p>
                                <a href="${process.env.CLIENT_URL}/sessions" class="button">View My Sessions</a>
                            </div>
                            <div class="footer">
                                <p>&copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            await transporter.sendMail(mailOptions);
            logger.info(`Session confirmation email sent to ${email}`);
            return true;
        } catch (error) {
            logger.error('Error sending session confirmation email:', error);
            return false;
        }
    },

    // Send payment confirmation email
    sendPaymentConfirmation: async (email, memberName, amount, invoiceNumber, invoicePath) => {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: `Payment Receipt - Invoice #${invoiceNumber}`,
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius:  10px 10px 0 0; }
                            . content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                            .payment-summary { background: white; padding:  20px; border-radius:  5px; margin: 20px 0; }
                            .amount { font-size: 32px; color: #667eea; font-weight: bold; text-align: center; margin: 20px 0; }
                            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                            .footer { text-align: center; margin-top: 20px; color:  #777; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>💳 Payment Received</h1>
                            </div>
                            <div class="content">
                                <h2>Hello ${memberName},</h2>
                                <p>Thank you for your payment!  Your transaction has been completed successfully.</p>
                                <div class="payment-summary">
                                    <h3>Payment Summary:</h3>
                                    <p><strong>Invoice Number:</strong> ${invoiceNumber}</p>
                                    <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
                                    <div class="amount">$${parseFloat(amount).toFixed(2)}</div>
                                    <p style="text-align: center; color: #4caf50;">✓ Payment Successful</p>
                                </div>
                                <p>Your invoice is attached to this email. You can also download it from your account dashboard.</p>
                                <a href="${process.env.CLIENT_URL}/payments" class="button">View Payment History</a>
                            </div>
                            <div class="footer">
                                <p>&copy; ${new Date().getFullYear()} Gym Management System.  All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
                attachments: invoicePath ?  [{
                    filename: `Invoice-${invoiceNumber}.pdf`,
                    path: invoicePath
                }] : []
            };

            await transporter.sendMail(mailOptions);
            logger.info(`Payment confirmation email sent to ${email}`);
            return true;
        } catch (error) {
            logger.error('Error sending payment confirmation email:', error);
            return false;
        }
    },

    // Send membership expiry reminder
    sendMembershipExpiryReminder: async (email, memberName, expiryDate, daysLeft) => {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: 'Membership Expiring Soon',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                            .alert { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
                            . expiry-box { background: white; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0; }
                            .days-left { font-size: 48px; color: #f5576c; font-weight: bold; }
                            .button { display: inline-block; padding: 12px 30px; background: #f5576c; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                            .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>⏰ Membership Expiring Soon</h1>
                            </div>
                            <div class="content">
                                <h2>Hello ${memberName},</h2>
                                <div class="alert">
                                    <strong>⚠️ Important Notice:</strong>
                                    <p>Your gym membership is expiring soon! </p>
                                </div>
                                <div class="expiry-box">
                                    <div class="days-left">${daysLeft}</div>
                                    <p style="font-size: 18px; margin:  0;">Days Remaining</p>
                                    <p style="margin-top: 20px;"><strong>Expiry Date:</strong> ${new Date(expiryDate).toLocaleDateString()}</p>
                                </div>
                                <p>Don't let your fitness journey pause! Renew your membership today to continue enjoying: </p>
                                <ul>
                                    <li>Full gym access</li>
                                    <li>Training sessions with expert trainers</li>
                                    <li>Exclusive member benefits</li>
                                    <li>Progress tracking and support</li>
                                </ul>
                                <a href="${process.env.CLIENT_URL}/memberships/renew" class="button">Renew Membership</a>
                            </div>
                            <div class="footer">
                                <p>&copy; ${new Date().getFullYear()} Gym Management System. All rights reserved. </p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            await transporter.sendMail(mailOptions);
            logger.info(`Membership expiry reminder sent to ${email}`);
            return true;
        } catch (error) {
            logger.error('Error sending membership expiry reminder:', error);
            return false;
        }
    },

    // Send session reminder
    sendSessionReminder: async (email, memberName, trainerName, sessionDate, startTime) => {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: 'Upcoming Training Session Reminder',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                            .reminder-box { background: white; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea; }
                            .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin-top: 20px; }
                            .footer { text-align: center; margin-top: 20px; color:  #777; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>🔔 Session Reminder</h1>
                            </div>
                            <div class="content">
                                <h2>Hello ${memberName},</h2>
                                <p>This is a friendly reminder about your upcoming training session!</p>
                                <div class="reminder-box">
                                    <h3>Session Details:</h3>
                                    <p><strong>Trainer:</strong> ${trainerName}</p>
                                    <p><strong>Date:</strong> ${new Date(sessionDate).toLocaleDateString()}</p>
                                    <p><strong>Time:</strong> ${startTime}</p>
                                    <p><strong>📍 Location:</strong> Main Gym Floor</p>
                                </div>
                                <p><strong>Preparation Tips:</strong></p>
                                <ul>
                                    <li>Arrive 10 minutes early</li>
                                    <li>Bring a water bottle</li>
                                    <li>Wear comfortable workout clothes</li>
                                    <li>Bring a towel</li>
                                </ul>
                                <p>Looking forward to seeing you there!</p>
                                <a href="${process.env.CLIENT_URL}/sessions" class="button">View Session Details</a>
                            </div>
                            <div class="footer">
                                <p>&copy; ${new Date().getFullYear()} Gym Management System.  All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            await transporter.sendMail(mailOptions);
            logger.info(`Session reminder sent to ${email}`);
            return true;
        } catch (error) {
            logger. error('Error sending session reminder:', error);
            return false;
        }
    },

    // Send payment reminder
    sendPaymentReminder: async (email, memberName, amount, dueDate) => {
        try {
            const mailOptions = {
                from: process.env.EMAIL_FROM,
                to: email,
                subject: 'Payment Reminder',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: linear-gradient(135deg, #f5576c 0%, #f093fb 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                            .payment-box { background: white; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0; }
                            .amount { font-size: 36px; color: #f5576c; font-weight: bold; margin: 20px 0; }
                            .button { display: inline-block; padding: 12px 30px; background: #f5576c; color: white; text-decoration:  none; border-radius: 5px; margin-top: 20px; }
                            .footer { text-align: center; margin-top: 20px; color: #777; font-size:  12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>💰 Payment Reminder</h1>
                            </div>
                            <div class="content">
                                <h2>Hello ${memberName},</h2>
                                <p>This is a friendly reminder about your upcoming payment.</p>
                                <div class="payment-box">
                                    <p><strong>Amount Due:</strong></p>
                                    <div class="amount">$${parseFloat(amount).toFixed(2)}</div>
                                    <p><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString()}</p>
                                </div>
                                <p>To avoid any interruption to your membership, please make your payment before the due date.</p>
                                <a href="${process.env.CLIENT_URL}/payments/make-payment" class="button">Make Payment</a>
                            </div>
                            <div class="footer">
                                <p>&copy; ${new Date().getFullYear()} Gym Management System. All rights reserved.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            await transporter.sendMail(mailOptions);
            logger.info(`Payment reminder sent to ${email}`);
            return true;
        } catch (error) {
            logger.error('Error sending payment reminder:', error);
            return false;
        }
    }
};

module.exports = emailService;