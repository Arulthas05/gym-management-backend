const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// @route   GET /api/reports/dashboard
// @desc    Get dashboard statistics
// @access  Private (Admin)
router.get('/dashboard', auth, roleCheck('admin'), reportController.getDashboardStats);

// @route   GET /api/reports/membership
// @desc    Get membership report
// @access  Private (Admin)
router.get('/membership', auth, roleCheck('admin'), reportController.getMembershipReport);

// @route   GET /api/reports/payments
// @desc    Get payment report
// @access  Private (Admin)
router.get('/payments', auth, roleCheck('admin'), reportController.getPaymentReport);

// @route   GET /api/reports/attendance
// @desc    Get attendance report
// @access  Private (Admin)
router.get('/attendance', auth, roleCheck('admin'), reportController.getAttendanceReport);

// @route   GET /api/reports/trainers
// @desc    Get trainer report
// @access  Private (Admin)
router.get('/trainers', auth, roleCheck('admin'), reportController.getTrainerReport);

// @route   GET /api/reports/supplements
// @desc    Get supplement sales report
// @access  Private (Admin)
router.get('/supplements', auth, roleCheck('admin'), reportController.getSupplementReport);

// @route   GET /api/reports/export/: reportType
// @desc    Export report to CSV
// @access  Private (Admin)
router.get('/export/:reportType', auth, roleCheck('admin'), reportController.exportReport);

module.exports = router;