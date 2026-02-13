const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validation');

// @route   POST /api/payments/create-intent
// @desc    Create payment intent (Stripe)
// @access  Private
router.post(
    '/create-intent',
    auth,
    [
        body('amount').isNumeric().withMessage('Amount must be a number'),
        body('memberId').isNumeric().withMessage('Member ID must be a number'),
        body('paymentType').isIn(['membership', 'supplement', 'training_session']).withMessage('Invalid payment type')
    ],
    validate,
    paymentController.createPaymentIntent
);

// ✅ ADD THIS ROUTE - Confirm payment after Stripe success
router.post(
    '/confirm',
    auth,
    [
        body('memberId').isNumeric().withMessage('Member ID must be a number'),
        body('paymentIntentId').notEmpty().withMessage('Payment Intent ID is required'),
        body('amount').isNumeric().withMessage('Amount must be a number'),
        body('paymentType').isIn(['membership', 'supplement', 'training_session']).withMessage('Invalid payment type')
    ],
    validate,
    paymentController.confirmPayment
);

// @route   POST /api/payments/process
// @desc    Process payment
// @access  Private
router.post(
    '/process',
    auth,
    [
        body('memberId').isNumeric().withMessage('Member ID must be a number'),
        body('amount').isNumeric().withMessage('Amount must be a number'),
        body('paymentType').isIn(['membership', 'supplement', 'training_session']).withMessage('Invalid payment type'),
        body('paymentMethod').isIn(['stripe', 'paypal', 'cash', 'card']).withMessage('Invalid payment method')
    ],
    validate,
    paymentController.processPayment
);

// @route   GET /api/payments
// @desc    Get all payments
// @access  Private (Admin)
router.get('/', auth, roleCheck('admin'), paymentController.getAllPayments);

// @route   GET /api/payments/:id
// @desc    Get single payment
// @access  Private
router.get('/:id', auth, paymentController.getPayment);

// @route   GET /api/payments/:id/invoice
// @desc    Download invoice
// @access  Private
router.get('/:id/invoice', auth, paymentController.downloadInvoice);

// @route   POST /api/payments/:id/refund
// @desc    Refund payment
// @access  Private (Admin)
router.post('/:id/refund', auth, roleCheck('admin'), paymentController.refundPayment);

module.exports = router;