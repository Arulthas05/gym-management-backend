const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validation');
const upload = require('../middleware/uploads');

// @route   GET /api/users
// @desc    Get all users
// @access  Private (Admin)
router.get('/', auth, roleCheck('admin'), userController.getAllUsers);
// @route   GET /api/users/profile
// @desc    Get current user profile
// @access  Private
router.get('/profile', auth, userController.getProfile);

// @route   PUT /api/users/profile
// @desc    Update current user profile
// @access  Private
router.put('/profile', auth, userController.updateProfile);

// @route   POST /api/users/profile/upload-image
// @desc    Upload profile image for current user
// @access  Private
router.post('/profile/upload-image', auth, upload.single('profileImage'), userController.uploadProfileImage);

// @route   PUT /api/users/body-stats
// @desc    Update member body stats (height, weight)
// @access  Private (Member)
router.put(
    '/body-stats',
    auth,
    roleCheck('member'),
    [
        body('height').optional().isNumeric().withMessage('Height must be a number'),
        body('weight').optional().isNumeric().withMessage('Weight must be a number')
    ],
    validate,
    userController.updateBodyStats
);

// @route   GET /api/users/: id
// @desc    Get single user
// @access  Private
router.get('/:id', auth, userController.getUser);

// @route   POST /api/users
// @desc    Create user
// @access  Private (Admin)
router.post(
    '/',
    auth,
    roleCheck('admin'),
    [
        body('email').isEmail().withMessage('Please provide a valid email'),
        body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
        body('role').isIn(['admin', 'trainer', 'member']).withMessage('Invalid role')
    ],
    validate,
    userController.createUser
);

// @route   PUT /api/users/:id
// @desc    Update user
// @access  Private (Admin)
router.put(
    '/:id',
    auth,
    roleCheck('admin'),
    [
        body('email').optional().isEmail().withMessage('Please provide a valid email'),
        body('role').optional().isIn(['admin', 'trainer', 'member']).withMessage('Invalid role')
    ],
    validate,
    userController.updateUser
);

// @route   DELETE /api/users/:id
// @desc    Delete user
// @access  Private (Admin)
router.delete('/:id', auth, roleCheck('admin'), userController.deleteUser);

// @route   PUT /api/users/:id/toggle-status
// @desc    Activate/Deactivate user
// @access  Private (Admin)
router.put('/:id/toggle-status', auth, roleCheck('admin'), userController.toggleUserStatus);

// @route   PUT /api/users/:id/password
// @desc    Update user password
// @access  Private (Admin)
router.put(
    '/:id/password',
    auth,
    roleCheck('admin'),
    [
        body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    ],
    validate,
    userController.updateUserPassword
);

// @route   GET /api/users/: id/stats
// @desc    Get user statistics
// @access  Private
router.get('/:id/stats', auth, userController.getUserStats);

// @route   PUT /api/users/:id/profile-picture
// @desc    Update profile picture
// @access  Private
router.put('/:id/profile-picture', auth, upload.single('profileImage'), userController.updateProfilePicture);

module.exports = router;