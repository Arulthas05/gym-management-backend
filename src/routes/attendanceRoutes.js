const express = require('express');
const router = express. Router();
const { body } = require('express-validator');
const attendanceController = require('../controllers/attendanceController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validation');

// @route   POST /api/attendance/check-in
// @desc    Check-in member
// @access  Private
router.post(
    '/check-in',
    auth,
    [
        body('memberId').isNumeric().withMessage('Member ID must be a number')
    ],
    validate,
    attendanceController.checkIn
);

// @route   POST /api/attendance/check-out
// @desc    Check-out member
// @access  Private
router.post(
    '/check-out',
    auth,
    [
        body('memberId').isNumeric().withMessage('Member ID must be a number')
    ],
    validate,
    attendanceController.checkOut
);

// @route   POST /api/attendance/qr-check-in
// @desc    QR Code check-in
// @access  Public
router.post(
    '/qr-check-in',
    [
        body('qrData').notEmpty().withMessage('QR data is required')
    ],
    validate,
    attendanceController. qrCheckIn
);

// @route   GET /api/attendance/qr-code/: memberId
// @desc    Get member's QR code
// @access  Private
router.get('/qr-code/:memberId', auth, attendanceController.getMemberQRCode);

// @route   GET /api/attendance
// @desc    Get all attendance records
// @access  Private (Admin)
router.get('/', auth, roleCheck('admin'), attendanceController.getAllAttendance);

// @route   GET /api/attendance/member/:memberId
// @desc    Get member attendance history
// @access  Private
router.get('/member/:memberId', auth, attendanceController.getMemberAttendance);

// @route   GET /api/attendance/today
// @desc    Get today's attendance
// @access  Private (Admin)
router.get('/today', auth, roleCheck('admin'), attendanceController.getTodayAttendance);

module.exports = router;