const db = require('../config/database');

// @desc    Get all memberships
// @route   GET /api/memberships
// @access  Private
exports.getAllMemberships = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, search = '', memberId, status } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        mm.*,
        m.first_name,
        m.last_name,
        u.email,
        m.phone,
        mp.name as plan_name,
        mp.price,
        mp.duration_months,
        mp.description as plan_description
      FROM member_memberships mm
      INNER JOIN members m ON mm.member_id = m.id
      INNER JOIN users u ON m.user_id = u.id
      INNER JOIN membership_plans mp ON mm.membership_plan_id = mp.id
      WHERE 1=1
    `;

    const queryParams = [];

    // Filter by member
    if (memberId) {
      query += ` AND mm.member_id = ?`;
      queryParams.push(memberId);
    }

    // Filter by status
    if (status) {
      query += ` AND mm.status = ?`;
      queryParams.push(status);
    }

    // Search
    if (search) {
      query += ` AND (m.first_name LIKE ? OR m.last_name LIKE ? OR mp.name LIKE ?)`;
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM (${query}) as filtered`;
    const [countResult] = await db.query(countQuery, queryParams);
    const total = countResult[0].total;

    // Add pagination
    query += ` ORDER BY mm.created_at DESC LIMIT ? OFFSET ?`;
    queryParams.push(parseInt(limit), parseInt(offset));

    const [result] = await db.query(query, queryParams);

    // Format response
    const memberships = result.map(row => ({
      id: row.id,
      memberId: row.member_id,
      membershipPlanId: row.membership_plan_id,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      autoRenewal: row.auto_renewal,
      planName: row.plan_name,
      amount: parseFloat(row.price),
      member: {
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));

    res.json({
      success: true,
      data: memberships,
      total: total,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single membership
// @route   GET /api/memberships/:id
// @access  Private
exports.getMembership = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        mm.*,
        m.first_name,
        m.last_name,
        u.email,
        m.phone,
        m.date_of_birth,
        m.gender,
        mp.name as plan_name,
        mp.price,
        mp.duration_months,
        mp.description as plan_description,
        mp.features
      FROM member_memberships mm
      INNER JOIN members m ON mm.member_id = m.id
      INNER JOIN users u ON m.user_id = u.id
      INNER JOIN membership_plans mp ON mm.membership_plan_id = mp.id
      WHERE mm.id = ?
    `;

    const [result] = await db.query(query, [id]);

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found',
      });
    }

    const row = result[0];
    
    // ✅ FIXED: Parse features safely
    let features = [];
    if (row.features) {
      try {
        if (typeof row.features === 'string') {
          if (row.features.startsWith('[') || row.features.startsWith('{')) {
            features = JSON.parse(row.features);
          } else {
            features = row.features.split(',').map(f => f.trim());
          }
        } else if (Array.isArray(row.features)) {
          features = row.features;
        } else if (typeof row.features === 'object') {
          features = Object.values(row.features);
        }
      } catch (err) {
        console.error('Error parsing features:', err);
        features = [];
      }
    }

    const membership = {
      id: row.id,
      memberId: row.member_id,
      membershipPlanId: row.membership_plan_id,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      autoRenewal: row.auto_renewal,
      planName: row.plan_name,
      planPrice: parseFloat(row.price),
      duration: row.duration_months,
      features: features,
      member: {
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        dateOfBirth: row.date_of_birth,
        gender: row.gender
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };

    res.json({
      success: true,
      data: membership,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get all membership plans
// @route   GET /api/memberships/plans
// @access  Public
exports.getMembershipPlans = async (req, res, next) => {
  try {
    const query = `
      SELECT 
        id,
        name,
        description,
        price,
        duration_months,
        features,
        is_active,
        created_at,
        updated_at
      FROM membership_plans 
      WHERE is_active = true 
      ORDER BY price ASC
    `;

    const [result] = await db.query(query);

    const plans = result.map(row => {
      let features = [];
      
      // ✅ FIXED: Handle different feature formats
      if (row.features) {
        try {
          // If it's already a string that looks like JSON
          if (typeof row.features === 'string') {
            // Check if it starts with [ or {
            if (row.features.startsWith('[') || row.features.startsWith('{')) {
              features = JSON.parse(row.features);
            } else {
              // It's a plain string, split by comma or keep as single item
              features = row.features.split(',').map(f => f.trim());
            }
          } else if (Array.isArray(row.features)) {
            // Already an array
            features = row.features;
          } else if (typeof row.features === 'object') {
            // It's an object, convert to array
            features = Object.values(row.features);
          }
        } catch (err) {
          console.error('Error parsing features:', err);
          // Fallback: treat as comma-separated string
          features = row.features.toString().split(',').map(f => f.trim());
        }
      }

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        price: parseFloat(row.price),
        duration: row.duration_months,
        durationType: 'months',
        features: features,
        popular: row.duration_months >= 6,
        isActive: row.is_active,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    });

    res.json({
      success: true,
      data: plans,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create membership
// @route   POST /api/memberships
// @access  Private (Admin)
exports.createMembership = async (req, res, next) => {
  try {
    const { memberId, planId, startDate, endDate, status = 'active', autoRenewal = false } = req.body;

    // Validate required fields
    if (!memberId || !planId || !startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: memberId, planId, startDate, endDate',
      });
    }

    // Check if member exists
    const [memberCheck] = await db.query('SELECT id FROM members WHERE id = ?', [memberId]);
    if (memberCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member not found',
      });
    }

    // Get plan details
    const [planResult] = await db.query('SELECT * FROM membership_plans WHERE id = ?', [planId]);

    if (planResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Membership plan not found',
      });
    }

    // Insert membership
    const insertQuery = `
      INSERT INTO member_memberships 
        (member_id, membership_plan_id, start_date, end_date, status, auto_renewal)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    const [result] = await db.query(insertQuery, [
      memberId,
      planId,
      startDate,
      endDate,
      status,
      autoRenewal
    ]);

    // Get the created membership
    const [newMembership] = await db.query(
      'SELECT * FROM member_memberships WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Membership created successfully',
      data: newMembership[0],
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update membership
// @route   PUT /api/memberships/:id
// @access  Private (Admin)
exports.updateMembership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { startDate, endDate, status, membershipPlanId, autoRenewal } = req.body;

    // Check if membership exists
    const [checkResult] = await db.query('SELECT * FROM member_memberships WHERE id = ?', [id]);

    if (checkResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found',
      });
    }

    const updateFields = [];
    const updateValues = [];

    if (startDate) {
      updateFields.push('start_date = ?');
      updateValues.push(startDate);
    }
    if (endDate) {
      updateFields.push('end_date = ?');
      updateValues.push(endDate);
    }
    if (status) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    if (membershipPlanId) {
      updateFields.push('membership_plan_id = ?');
      updateValues.push(membershipPlanId);
    }
    if (autoRenewal !== undefined) {
      updateFields.push('auto_renewal = ?');
      updateValues.push(autoRenewal);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(id);

    const updateQuery = `
      UPDATE member_memberships 
      SET ${updateFields.join(', ')}
      WHERE id = ?
    `;

    await db.query(updateQuery, updateValues);

    // Get updated membership
    const [updatedMembership] = await db.query(
      'SELECT * FROM member_memberships WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Membership updated successfully',
      data: updatedMembership[0],
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete membership
// @route   DELETE /api/memberships/:id
// @access  Private (Admin)
exports.deleteMembership = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [result] = await db.query('DELETE FROM member_memberships WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Membership not found',
      });
    }

    res.json({
      success: true,
      message: 'Membership deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Purchase membership (with payment)
// @route   POST /api/memberships/purchase
// @access  Private (Member)
exports.purchaseMembership = async (req, res, next) => {
  const connection = await db.getConnection();
  
  try {
    const { planId, paymentIntentId } = req.body;
    const memberId = req.user.id;

    if (!planId || !paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Plan ID and Payment Intent ID are required',
      });
    }

    // Get member ID from user_id
    const [memberResult] = await connection.query(
      'SELECT id FROM members WHERE user_id = ?',
      [memberId]
    );

    if (memberResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Member profile not found',
      });
    }

    const actualMemberId = memberResult[0].id;

    // Get plan details
    const [planResult] = await connection.query(
      'SELECT * FROM membership_plans WHERE id = ? AND is_active = true',
      [planId]
    );

    if (planResult.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Membership plan not found or inactive',
      });
    }

    const plan = planResult[0];

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + plan.duration_months);

    // Start transaction
    await connection.beginTransaction();

    try {
      // Create membership
      const [membershipResult] = await connection.query(
        `INSERT INTO member_memberships 
          (member_id, membership_plan_id, start_date, end_date, status, auto_renewal)
        VALUES (?, ?, ?, ?, 'active', false)`,
        [actualMemberId, planId, startDate, endDate]
      );

      // Generate invoice number
      const invoiceNumber = `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(membershipResult.insertId).padStart(5, '0')}`;

      // Create payment record
      await connection.query(
        `INSERT INTO payments 
          (member_id, amount, payment_type, payment_method, payment_status, transaction_id, invoice_number, description)
        VALUES (?, ?, 'membership', 'stripe', 'completed', ?, ?, ?)`,
        [
          actualMemberId,
          plan.price,
          paymentIntentId,
          invoiceNumber,
          `${plan.name} Membership Purchase`
        ]
      );

      await connection.commit();

      // Get created membership
      const [newMembership] = await connection.query(
        'SELECT * FROM member_memberships WHERE id = ?',
        [membershipResult.insertId]
      );

      res.status(201).json({
        success: true,
        message: 'Membership purchased successfully',
        data: newMembership[0],
      });
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  } finally {
    connection.release();
  }
};

// @desc    Check membership expiry
// @route   GET /api/memberships/check-expiry
// @access  Private (Admin)
exports.checkExpiringMemberships = async (req, res, next) => {
  try {
    const { days = 7 } = req.query;

    const query = `
      SELECT 
        mm.*,
        m.first_name,
        m.last_name,
        u.email,
        m.phone,
        mp.name as plan_name,
        DATEDIFF(mm.end_date, CURDATE()) as days_remaining
      FROM member_memberships mm
      INNER JOIN members m ON mm.member_id = m.id
      INNER JOIN users u ON m.user_id = u.id
      INNER JOIN membership_plans mp ON mm.membership_plan_id = mp.id
      WHERE mm.status = 'active'
      AND mm.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY mm.end_date ASC
    `;

    const [result] = await db.query(query, [parseInt(days)]);

    const expiringMemberships = result.map(row => ({
      id: row.id,
      memberId: row.member_id,
      memberName: `${row.first_name} ${row.last_name}`,
      email: row.email,
      phone: row.phone,
      planName: row.plan_name,
      startDate: row.start_date,
      endDate: row.end_date,
      daysRemaining: row.days_remaining,
      status: row.status
    }));

    res.json({
      success: true,
      data: expiringMemberships,
      count: expiringMemberships.length,
    });
  } catch (error) {
    next(error);
  }
};