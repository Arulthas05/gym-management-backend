const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const sessionController = require('../controllers/sessionController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validation');

// @route   GET /api/sessions
// @desc    Get all sessions
// @access  Private
router.get('/', auth, sessionController.getAllSessions);

// @route   GET /api/sessions/:id
// @desc    Get single session
// @access  Private
router.get('/:id', auth, sessionController.getSession);

// @route   POST /api/sessions
// @desc    Book a training session
// @access  Private (Member)
router.post(
    '/',
    auth,
    roleCheck('member', 'admin'),
    [
        body('trainerId').isNumeric().withMessage('Trainer ID must be a number'),
        body('memberId').isNumeric().withMessage('Member ID must be a number'),
        body('sessionDate').isDate().withMessage('Invalid session date'),
        body('startTime').notEmpty().withMessage('Start time is required'),
        body('endTime').notEmpty().withMessage('End time is required')
    ],
    validate,
    sessionController. bookSession
);

// @route   PUT /api/sessions/:id
// @desc    Update session
// @access  Private
router.put('/:id', auth, sessionController.updateSession);

// @route   PUT /api/sessions/:id/cancel
// @desc    Cancel session
// @access  Private
router. put('/:id/cancel', auth, sessionController.cancelSession);

// @route   DELETE /api/sessions/: id
// @desc    Delete session
// @access  Private (Admin)
router.delete('/:id', auth, roleCheck('admin'), sessionController.deleteSession);

// @route   PUT /api/sessions/:id/complete
// @desc    Complete session
// @access  Private (Trainer)
router.put('/:id/complete', auth, roleCheck('trainer', 'admin'), sessionController.completeSession);

module.exports = router;