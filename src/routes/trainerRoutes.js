const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const trainerController = require('../controllers/trainerController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validation');

// @route   GET /api/trainers
// @desc    Get all trainers
// @access  Public
router.get('/', trainerController.getAllTrainers);

// @route   GET /api/trainers/:id
// @desc    Get single trainer
// @access  Public
router.get('/:id', trainerController.getTrainer);

// @route   POST /api/trainers
// @desc    Create trainer
// @access  Private (Admin)
router.post(
    '/',
    auth,
    roleCheck('admin'),
    [
        body('email').isEmail().withMessage('Please provide a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('firstName').notEmpty().withMessage('First name is required'),
        body('lastName').notEmpty().withMessage('Last name is required'),
        body('specialization').optional().notEmpty().withMessage('Specialization cannot be empty')
    ],
    validate,
    trainerController.createTrainer
);

// @route   PUT /api/trainers/:id
// @desc    Update trainer
// @access  Private (Admin, Trainer)
router.put(
    '/:id',
    auth,
    roleCheck('admin', 'trainer'),
    [
        body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
        body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
        body('hourlyRate').optional().isNumeric().withMessage('Hourly rate must be a number')
    ],
    validate,
    trainerController.updateTrainer
);

// @route   DELETE /api/trainers/:id
// @desc    Delete trainer
// @access  Private (Admin)
router.delete('/:id', auth, roleCheck('admin'), trainerController.deleteTrainer);

// @route   GET /api/trainers/: id/schedule
// @desc    Get trainer schedule
// @access  Private
router.get('/:id/schedule', auth, trainerController.getTrainerSchedule);

module.exports = router;