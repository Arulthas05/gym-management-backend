const db = require('../config/database');
const stripe = require('../config/stripe');
const { generateInvoiceNumber } = require('../utils/helpers');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');

// @desc    Create payment intent (Stripe)
// @route   POST /api/payments/create-intent
// @access  Private
const createPaymentIntent = async (req, res) => {
    try {
        const { amount, memberId, paymentType, description } = req.body;

        // Create payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount: Math.round(amount * 100), // Convert to cents
            currency:  'usd',
            metadata: {
                memberId:  memberId. toString(),
                paymentType,
                description
            }
        });

        res.json({
            success: true,
            data: {
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id
            }
        });

    } catch (error) {
        console.error('Create payment intent error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating payment intent',
            error: error. message
        });
    }
};

// @desc    Process payment
// @route   POST /api/payments/process
// @access  Private
const processPayment = async (req, res) => {
    try {
        const {
            memberId,
            amount,
            paymentType,
            paymentMethod,
            transactionId,
            description,
            membershipPlanId,
            supplementOrderId
        } = req.body;

        // Generate invoice number
        const invoiceNumber = generateInvoiceNumber();

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Create payment record
            const [paymentResult] = await connection.query(
                `INSERT INTO payments (
                    member_id, amount, payment_type, payment_method,
                    payment_status, transaction_id, invoice_number, description
                ) VALUES (?, ?, ?, ?, 'completed', ?, ?, ?)`,
                [memberId, amount, paymentType, paymentMethod, transactionId, invoiceNumber, description]
            );

            const paymentId = paymentResult.insertId;

            // If membership payment, assign membership
            if (paymentType === 'membership' && membershipPlanId) {
                const [plans] = await connection.query(
                    'SELECT * FROM membership_plans WHERE id = ?',
                    [membershipPlanId]
                );

                if (plans.length > 0) {
                    const plan = plans[0];
                    const startDate = new Date();
                    const endDate = new Date();
                    endDate.setMonth(endDate.getMonth() + plan.duration_months);

                    // Deactivate existing memberships
                    await connection.query(
                        'UPDATE member_memberships SET status = ? WHERE member_id = ? AND status = ?',
                        ['expired', memberId, 'active']
                    );

                    // Create new membership
                    await connection.query(
                        `INSERT INTO member_memberships (
                            member_id, membership_plan_id, start_date, end_date, status
                        ) VALUES (?, ?, ?, ?, 'active')`,
                        [memberId, membershipPlanId, startDate, endDate]
                    );
                }
            }

            // If supplement payment, update order
            if (paymentType === 'supplement' && supplementOrderId) {
                await connection.query(
                    'UPDATE supplement_orders SET payment_id = ?, order_status = ? WHERE id = ? ',
                    [paymentId, 'completed', supplementOrderId]
                );
            }

            await connection.commit();
            connection.release();

            // Generate invoice PDF
            const invoicePath = await pdfService.generateInvoice({
                invoiceNumber,
                memberId,
                amount,
                paymentType,
                description,
                date: new Date()
            });

            // Update payment with invoice path
            await db.query(
                'UPDATE payments SET invoice_path = ? WHERE id = ?',
                [invoicePath, paymentId]
            );

            // Get member email
            const [members] = await db.query(
                `SELECT m.first_name, u.email 
                 FROM members m 
                 INNER JOIN users u ON m.user_id = u.id 
                 WHERE m.id = ? `,
                [memberId]
            );

            // Send payment confirmation email
            if (members.length > 0) {
                await emailService.sendPaymentConfirmation(
                    members[0].email,
                    members[0]. first_name,
                    amount,
                    invoiceNumber,
                    invoicePath
                );
            }

            res.status(201).json({
                success: true,
                message: 'Payment processed successfully',
                data: {
                    paymentId,
                    invoiceNumber,
                    invoicePath
                }
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Process payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing payment',
            error: error.message
        });
    }
};

// @desc    Get all payments
// @route   GET /api/payments
// @access  Private (Admin)
const getAllPayments = async (req, res) => {
    try {
        const { page = 1, limit = 10, memberId = '', status = '', type = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT 
                p.*,
                m.first_name,
                m.last_name,
                u.email
            FROM payments p
            INNER JOIN members m ON p.member_id = m.id
            INNER JOIN users u ON m.user_id = u.id
            WHERE 1=1
        `;

        const params = [];

        if (memberId) {
            query += ` AND p.member_id = ?`;
            params.push(memberId);
        }

        if (status) {
            query += ` AND p.payment_status = ?`;
            params.push(status);
        }

        if (type) {
            query += ` AND p.payment_type = ?`;
            params.push(type);
        }

        query += ` ORDER BY p.payment_date DESC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [payments] = await db.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM payments p WHERE 1=1`;
        const countParams = [];

        if (memberId) {
            countQuery += ` AND p.member_id = ?`;
            countParams.push(memberId);
        }

        if (status) {
            countQuery += ` AND p.payment_status = ? `;
            countParams.push(status);
        }

        if (type) {
            countQuery += ` AND p.payment_type = ?`;
            countParams.push(type);
        }

        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            success: true,
            data:  {
                payments,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get all payments error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching payments',
            error: error.message
        });
    }
};

// @desc    Get single payment
// @route   GET /api/payments/:id
// @access  Private
const getPayment = async (req, res) => {
    try {
        const { id } = req.params;

        const [payments] = await db.query(
            `SELECT 
                p.*,
                m.first_name,
                m.last_name,
                m.phone,
                u.email
            FROM payments p
            INNER JOIN members m ON p.member_id = m.id
            INNER JOIN users u ON m.user_id = u.id
            WHERE p.id = ?`,
            [id]
        );

        if (payments.length === 0) {
            return res. status(404).json({
                success: false,
                message:  'Payment not found'
            });
        }

        res. json({
            success: true,
            data: payments[0]
        });

    } catch (error) {
        console.error('Get payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching payment',
            error: error. message
        });
    }
};

// @desc    Download invoice
// @route   GET /api/payments/: id/invoice
// @access  Private
const downloadInvoice = async (req, res) => {
    try {
        const { id } = req.params;

        const [payments] = await db.query(
            'SELECT invoice_path, invoice_number FROM payments WHERE id = ?',
            [id]
        );

        if (payments.length === 0 || ! payments[0].invoice_path) {
            return res.status(404).json({
                success: false,
                message: 'Invoice not found'
            });
        }

        const invoicePath = payments[0]. invoice_path;
        const invoiceNumber = payments[0].invoice_number;

        res.download(invoicePath, `Invoice-${invoiceNumber}.pdf`);

    } catch (error) {
        console.error('Download invoice error:', error);
        res.status(500).json({
            success: false,
            message: 'Error downloading invoice',
            error: error.message
        });
    }
};

// @desc    Refund payment
// @route   POST /api/payments/:id/refund
// @access  Private (Admin)
const refundPayment = async (req, res) => {
    try {
        const { id } = req.params;

        const [payments] = await db.query(
            'SELECT * FROM payments WHERE id = ?',
            [id]
        );

        if (payments.length === 0) {
            return res. status(404).json({
                success: false,
                message:  'Payment not found'
            });
        }

        const payment = payments[0];

        if (payment.payment_status === 'refunded') {
            return res. status(400).json({
                success: false,
                message:  'Payment already refunded'
            });
        }

        // Process Stripe refund if payment was made via Stripe
        if (payment. payment_method === 'stripe' && payment.transaction_id) {
            await stripe.refunds.create({
                payment_intent: payment.transaction_id
            });
        }

        // Update payment status
        await db. query(
            'UPDATE payments SET payment_status = ? WHERE id = ?',
            ['refunded', id]
        );

        res.json({
            success: true,
            message: 'Payment refunded successfully'
        });

    } catch (error) {
        console.error('Refund payment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error refunding payment',
            error: error.message
        });
    }
};

// @desc    Confirm payment
// @route   POST /api/payments/confirm
// @access  Private
const confirmPayment = async (req, res, next) => {
  try {
    console.log('=== CONFIRM PAYMENT START ===');
    console.log('Request body:', req.body);
    
    const { memberId, paymentIntentId, amount, paymentType, description } = req.body;

    // Validate member ID
    if (!memberId) {
      console.error('❌ Member ID missing');
      return res.status(400).json({
        success: false,
        message: 'Member ID is required',
      });
    }

    // Verify member exists
    console.log('Checking if member exists:', memberId);
    const [memberCheck] = await db.query('SELECT id, first_name, last_name FROM members WHERE id = ?', [memberId]);

    if (memberCheck.length === 0) {
      console.error('❌ Member not found:', memberId);
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    console.log('✅ Member found:', memberCheck[0]);

    // Generate invoice number
    const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${Date.now()}`;
    console.log('Generated invoice number:', invoiceNumber);

    // Insert payment record
    const insertQuery = `
      INSERT INTO payments 
        (member_id, amount, payment_type, payment_method, payment_status, transaction_id, invoice_number, description)
      VALUES (?, ?, ?, 'stripe', 'completed', ?, ?, ?)
    `;

    console.log('Inserting payment record...');
    const [result] = await db.query(insertQuery, [
      memberId,
      amount,
      paymentType,
      paymentIntentId,
      invoiceNumber,
      description || `${paymentType} payment`
    ]);

    console.log('✅ Payment inserted, ID:', result.insertId);

    // Get created payment with member details
    const [payment] = await db.query(`
      SELECT 
        p.*,
        m.first_name,
        m.last_name,
        u.email
      FROM payments p
      INNER JOIN members m ON p.member_id = m.id
      INNER JOIN users u ON m.user_id = u.id
      WHERE p.id = ?
    `, [result.insertId]);

    // Generate invoice PDF and update payment record
    try {
      console.log('Generating invoice PDF for payment ID:', result.insertId);
      const invoicePath = await pdfService.generateInvoice({
        invoiceNumber,
        memberId,
        amount,
        paymentType,
        description: description || `${paymentType} payment`,
        date: new Date()
      });

      // Save invoice path to DB
      await db.query('UPDATE payments SET invoice_path = ? WHERE id = ?', [invoicePath, result.insertId]);

      // Attach invoice path to the returned payment object
      if (payment.length > 0) payment[0].invoice_path = invoicePath;

      // Send payment confirmation email with invoice attachment
      try {
        console.log('Sending payment confirmation email to:', payment[0].email);
        await emailService.sendPaymentConfirmation(
          payment[0].email,
          payment[0].first_name,
          amount,
          invoiceNumber,
          invoicePath
        );
      } catch (emailErr) {
        console.error('Failed to send payment confirmation email:', emailErr);
      }

    } catch (pdfErr) {
      console.error('Failed to generate or save invoice PDF:', pdfErr);
      // Let this surface so the caller can see the issue (payment is recorded regardless)
      throw pdfErr;
    }

    console.log('✅ Payment confirmed successfully');
    console.log('=== CONFIRM PAYMENT END ===');

    res.json({
      success: true,
      message: 'Payment completed successfully',
      data: payment[0],
    });
  } catch (error) {
    console.error('=== CONFIRM PAYMENT ERROR ===');
    console.error('Error:', error);
    console.error('Error stack:', error.stack);
    next(error);
  }
};

module.exports = {
    createPaymentIntent,
    processPayment,
    getAllPayments,
    getPayment,
    downloadInvoice,
    refundPayment,
    confirmPayment,
};