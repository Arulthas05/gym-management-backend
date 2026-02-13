const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const membershipController = require('../controllers/membershipController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
const validate = require('../middleware/validation');

// Public routes
router.get('/plans', membershipController.getMembershipPlans);

// Protected routes
router.get('/check-expiry', auth, roleCheck('admin'), membershipController.checkExpiringMemberships);
router.get('/', auth, membershipController.getAllMemberships);
router.get('/:id', auth, membershipController.getMembership);

router.post(
  '/',
  auth,
  roleCheck('admin'),
  [
    body('memberId').isNumeric().withMessage('Member ID must be a number'),
    body('planId').isNumeric().withMessage('Plan ID must be a number'),
    body('startDate').isDate().withMessage('Start date is required'),
    body('endDate').isDate().withMessage('End date is required'),
  ],
  validate,
  membershipController.createMembership
);

router.post(
  '/purchase',
  auth,
  roleCheck('member', 'admin'),
  [
    body('planId').isNumeric().withMessage('Plan ID is required'),
    body('paymentIntentId').notEmpty().withMessage('Payment Intent ID is required'),
  ],
  validate,
  membershipController.purchaseMembership
);

router.put('/:id', auth, roleCheck('admin'), membershipController.updateMembership);
router.delete('/:id', auth, roleCheck('admin'), membershipController.deleteMembership);

module.exports = router;