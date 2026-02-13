const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

const qrService = {
    // Generate QR code for member
    generateMemberQRCode: async (memberId, userId) => {
        try {
            const qrDir = path.join(__dirname, '../../uploads/qr');
            if (!fs.existsSync(qrDir)) {
                fs.mkdirSync(qrDir, { recursive: true });
            }

            const qrData = `MEMBER-${userId}-${Date.now()}`;
            const qrPath = path.join(qrDir, `member-${memberId}. png`);

            // Generate QR code as file
            await QRCode.toFile(qrPath, qrData, {
                errorCorrectionLevel: 'H',
                type: 'png',
                quality: 0.95,
                margin: 1,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            logger.info(`QR code generated for member ${memberId}`);
            return { qrPath, qrData };

        } catch (error) {
            logger.error('Error generating QR code:', error);
            throw error;
        }
    },

    // Generate QR code as Data URL (for frontend display)
    generateQRCodeDataURL: async (data) => {
        try {
            const dataURL = await QRCode.toDataURL(data, {
                errorCorrectionLevel: 'H',
                margin: 1,
                color:  {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });

            return dataURL;

        } catch (error) {
            logger.error('Error generating QR code data URL:', error);
            throw error;
        }
    },

    // Verify QR code data
    verifyQRCode: (qrData) => {
        try {
            const parts = qrData.split('-');
            
            if (parts.length < 3 || parts[0] !== 'MEMBER') {
                return { valid: false, message: 'Invalid QR code format' };
            }

            const userId = parseInt(parts[1]);
            const timestamp = parseInt(parts[2]);

            if (isNaN(userId) || isNaN(timestamp)) {
                return { valid: false, message: 'Invalid QR code data' };
            }

            return {
                valid: true,
                userId,
                timestamp
            };

        } catch (error) {
            logger.error('Error verifying QR code:', error);
            return { valid: false, message: 'Error verifying QR code' };
        }
    }
};

module.exports = qrService;