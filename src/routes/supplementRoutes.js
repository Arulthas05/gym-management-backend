const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const supplementController = require('../controllers/supplementController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validation');
const upload = require('../middleware/uploads');

// Supplement Routes

// @route   GET /api/supplements
// @desc    Get all supplements
// @access  Public
router.get('/', supplementController.getAllSupplements);

// @route   GET /api/supplements/:id
// @desc    Get single supplement
// @access  Public
router.get('/:id', supplementController.getSupplement);

// @route   POST /api/supplements/purchase
// @desc    Purchase supplement (with payment)
// @access  Private (Member)
router.post(
    '/purchase',
    auth,
    roleCheck('member', 'admin'),
    [
        body('supplementId').isNumeric().withMessage('Supplement ID must be a number'),
        body('quantity').isNumeric().withMessage('Quantity must be a number'),
        body('paymentIntentId').notEmpty().withMessage('Payment intent ID is required')
    ],
    validate,
    supplementController.purchaseSupplement
);

// @route   POST /api/supplements
// @desc    Create supplement
// @access  Private (Admin)
router.post(
    '/',
    auth,
    roleCheck('admin'),
    upload.single('supplementImage'),
    [
        body('name').notEmpty().withMessage('Supplement name is required'),
        body('price').isNumeric().withMessage('Price must be a number'),
        body('stockQuantity').isNumeric().withMessage('Stock quantity must be a number')
    ],
    validate,
    supplementController.createSupplement
);

// @route   PUT /api/supplements/:id
// @desc    Update supplement
// @access  Private (Admin)
router.put('/:id', auth, roleCheck('admin'), upload.single('supplementImage'), supplementController.updateSupplement);

// @route   DELETE /api/supplements/:id
// @desc    Delete supplement
// @access  Private (Admin)
router.delete('/:id', auth, roleCheck('admin'), supplementController. deleteSupplement);

// Order Routes

// @route   POST /api/supplements/orders
// @desc    Create supplement order
// @access  Private (Member)
router.post(
    '/orders',
    auth,
    roleCheck('member', 'admin'),
    [
        body('memberId').isNumeric().withMessage('Member ID must be a number'),
        body('items').isArray({ min: 1 }).withMessage('Items must be an array with at least one item')
    ],
    validate,
    supplementController.createOrder
);

// @route   GET /api/supplements/orders/member/:memberId
// @desc    Get member orders
// @access  Private
router.get('/orders/member/:memberId', auth, supplementController.getMemberOrders);

module.exports = router;