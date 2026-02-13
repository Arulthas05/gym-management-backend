const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const memberController = require('../controllers/memberController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validation');

// @route   GET /api/members
// @desc    Get all members
// @access  Private (Admin, Trainer)
router.get('/', auth, roleCheck('admin', 'trainer'), memberController.getAllMembers);

// @route   GET /api/members/:id
// @desc    Get single member
// @access  Private
router. get('/:id', auth, memberController.getMember);

// @route   POST /api/members
// @desc    Create member
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
        body('phone').optional().isMobilePhone().withMessage('Invalid phone number')
    ],
    validate,
    memberController.createMember
);

// @route   PUT /api/members/:id
// @desc    Update member
// @access  Private
router.put(
    '/:id',
    auth,
    [
        body('firstName').optional().notEmpty().withMessage('First name cannot be empty'),
        body('lastName').optional().notEmpty().withMessage('Last name cannot be empty'),
        body('phone').optional().isMobilePhone().withMessage('Invalid phone number'),
        body('email').optional().isEmail().withMessage('Invalid email')
    ],
    validate,
    memberController.updateMember
);

// @route   DELETE /api/members/:id
// @desc    Delete member
// @access  Private (Admin)
router.delete('/:id', auth, roleCheck('admin'), memberController.deleteMember);

// @route   POST /api/members/:id/calculate-bmi
// @desc    Calculate BMI for member
// @access  Private
router.post(
    '/:id/calculate-bmi',
    auth,
    [
        body('height').isNumeric().withMessage('Height must be a number'),
        body('weight').isNumeric().withMessage('Weight must be a number')
    ],
    validate,
    memberController.calculateMemberBMI
);

module.exports = router;