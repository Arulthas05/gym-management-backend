const db = require('../config/database');

// @desc    Get all supplements
// @route   GET /api/supplements
// @access  Public
const getAllSupplements = async (req, res) => {
    try {
        const { page = 1, limit = 10, search = '', category = '' } = req.query;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM supplements WHERE is_active = 1';
        const params = [];

        if (search) {
            query += ` AND (name LIKE ? OR description LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            query += ` AND category = ?`;
            params.push(category);
        }

        query += ` ORDER BY name ASC LIMIT ? OFFSET ?`;
        params.push(parseInt(limit), parseInt(offset));

        const [supplements] = await db. query(query, params);

        // Get total count
        let countQuery = 'SELECT COUNT(*) as total FROM supplements WHERE is_active = 1';
        const countParams = [];

        if (search) {
            countQuery += ` AND (name LIKE ? OR description LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`);
        }

        if (category) {
            countQuery += ` AND category = ?`;
            countParams.push(category);
        }

        const [countResult] = await db.query(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            success: true,
            data: {
                supplements,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / limit),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });

    } catch (error) {
        console.error('Get all supplements error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching supplements',
            error:  error.message
        });
    }
};

// @desc    Get single supplement
// @route   GET /api/supplements/:id
// @access  Public
const getSupplement = async (req, res) => {
    try {
        const { id } = req.params;

        const [supplements] = await db.query(
            'SELECT * FROM supplements WHERE id = ? ',
            [id]
        );

        if (supplements.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Supplement not found'
            });
        }

        res.json({
            success: true,
            data: supplements[0]
        });

    } catch (error) {
        console.error('Get supplement error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching supplement',
            error: error.message
        });
    }
};

// @desc    Create supplement
// @route   POST /api/supplements
// @access  Private (Admin)
const createSupplement = async (req, res) => {
    try {
        const { name, description, category, price } = req.body;
        // prefer uploaded file over imageUrl from body
        const stockQuantity = req.body.stockQuantity || req.body.stock || 0;
        const imageUrl = req.file ? `/uploads/supplements/${req.file.filename}` : (req.body.imageUrl || null);

        const [result] = await db.query(
            `INSERT INTO supplements (name, description, category, price, stock_quantity, image_url)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, description, category, price, stockQuantity, imageUrl]
        );

        res.status(201).json({
            success: true,
            message: 'Supplement created successfully',
            data: {
                id: result.insertId
            }
        });

    } catch (error) {
        console.error('Create supplement error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating supplement',
            error: error.message
        });
    }
};

// @desc    Update supplement
// @route   PUT /api/supplements/:id
// @access  Private (Admin)
const updateSupplement = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, category, price, isActive } = req.body;
        const stockQuantity = req.body.stockQuantity || req.body.stock || null;
        const imageUrl = req.file ? `/uploads/supplements/${req.file.filename}` : (req.body.imageUrl || null);

        const [supplements] = await db.query('SELECT * FROM supplements WHERE id = ? ', [id]);

        if (supplements.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Supplement not found'
            });
        }

        await db.query(
            `UPDATE supplements SET
                name = COALESCE(?, name),
                description = COALESCE(?, description),
                category = COALESCE(?, category),
                price = COALESCE(?, price),
                stock_quantity = COALESCE(?, stock_quantity),
                image_url = COALESCE(?, image_url),
                is_active = COALESCE(?, is_active)
            WHERE id = ?`,
            [name, description, category, price, stockQuantity, imageUrl, isActive, id]
        );

        res.json({
            success: true,
            message: 'Supplement updated successfully'
        });

    } catch (error) {
        console.error('Update supplement error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating supplement',
            error:  error.message
        });
    }
};

// @desc    Delete supplement
// @route   DELETE /api/supplements/:id
// @access  Private (Admin)
const deleteSupplement = async (req, res) => {
    try {
        const { id } = req.params;

        const [supplements] = await db.query('SELECT * FROM supplements WHERE id = ?', [id]);

        if (supplements.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Supplement not found'
            });
        }

        await db. query('DELETE FROM supplements WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Supplement deleted successfully'
        });

    } catch (error) {
        console.error('Delete supplement error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting supplement',
            error: error.message
        });
    }
};

// @desc    Create supplement order
// @route   POST /api/supplements/orders
// @access  Private (Member)
const createOrder = async (req, res) => {
    try {
        const { memberId, items } = req.body; // items:  [{supplementId, quantity}]

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            let totalAmount = 0;

            // Validate items and calculate total
            for (const item of items) {
                const [supplements] = await connection.query(
                    'SELECT * FROM supplements WHERE id = ?  AND is_active = 1',
                    [item.supplementId]
                );

                if (supplements.length === 0) {
                    await connection.rollback();
                    connection.release();
                    return res.status(404).json({
                        success: false,
                        message: `Supplement with ID ${item.supplementId} not found`
                    });
                }

                const supplement = supplements[0];

                if (supplement.stock_quantity < item.quantity) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({
                        success: false,
                        message: `Insufficient stock for ${supplement.name}`
                    });
                }

                totalAmount += supplement.price * item. quantity;
            }

            // Create order
            const [orderResult] = await connection.query(
                'INSERT INTO supplement_orders (member_id, total_amount, order_status) VALUES (?, ?, ?)',
                [memberId, totalAmount, 'pending']
            );

            const orderId = orderResult.insertId;

            // Create order items and update stock
            for (const item of items) {
                const [supplements] = await connection.query(
                    'SELECT * FROM supplements WHERE id = ? ',
                    [item.supplementId]
                );

                const supplement = supplements[0];

                await connection.query(
                    'INSERT INTO supplement_order_items (order_id, supplement_id, quantity, price) VALUES (?, ?, ?, ?)',
                    [orderId, item.supplementId, item.quantity, supplement.price]
                );

                await connection.query(
                    'UPDATE supplements SET stock_quantity = stock_quantity - ? WHERE id = ? ',
                    [item.quantity, item.supplementId]
                );
            }

            await connection.commit();
            connection.release();

            res.status(201).json({
                success: true,
                message: 'Order created successfully',
                data: {
                    orderId,
                    totalAmount
                }
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating order',
            error: error.message
        });
    }
};

// @desc    Get member orders
// @route   GET /api/supplements/orders/member/: memberId
// @access  Private
const getMemberOrders = async (req, res) => {
    try {
        const { memberId } = req.params;

        const [orders] = await db. query(
            `SELECT 
                so.*,
                COUNT(soi.id) as total_items
            FROM supplement_orders so
            LEFT JOIN supplement_order_items soi ON so.id = soi. order_id
            WHERE so. member_id = ?
            GROUP BY so.id
            ORDER BY so.order_date DESC`,
            [memberId]
        );

        // Get order items for each order
        for (let order of orders) {
            const [items] = await db.query(
                `SELECT 
                    soi.*,
                    s.name,
                    s.image_url
                FROM supplement_order_items soi
                INNER JOIN supplements s ON soi. supplement_id = s.id
                WHERE soi.order_id = ?`,
                [order.id]
            );
            order.items = items;
        }

        res.json({
            success: true,
            data: orders
        });

    } catch (error) {
        console.error('Get member orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching orders',
            error: error.message
        });
    }
};

// @desc    Purchase supplement (with payment)
// @route   POST /api/supplements/purchase
// @access  Private (Member)
const purchaseSupplement = async (req, res) => {
    try {
        const { supplementId, quantity, paymentIntentId } = req.body;
        const userId = req.user.id;

        if (!supplementId || !quantity || !paymentIntentId) {
            return res.status(400).json({
                success: false,
                message: 'Supplement ID, quantity, and payment intent ID are required'
            });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Get member ID from user ID
            let memberId = null;
            if (req.user.role === 'member') {
                const [members] = await connection.query(
                    'SELECT id FROM members WHERE user_id = ?',
                    [userId]
                );
                if (members.length === 0) {
                    await connection.rollback();
                    connection.release();
                    return res.status(404).json({
                        success: false,
                        message: 'Member not found'
                    });
                }
                memberId = members[0].id;
            } else {
                // For admins, we might want to handle differently or reject
                await connection.rollback();
                connection.release();
                return res.status(403).json({
                    success: false,
                    message: 'Only members can purchase supplements'
                });
            }

            // Get supplement details
            const [supplements] = await connection.query(
                'SELECT * FROM supplements WHERE id = ?',
                [supplementId]
            );

            if (supplements.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({
                    success: false,
                    message: 'Supplement not found'
                });
            }

            const supplement = supplements[0];

            // Check stock
            if (supplement.stock_quantity < quantity) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    success: false,
                    message: `Insufficient stock. Only ${supplement.stock_quantity} available`
                });
            }

            const totalAmount = supplement.price * quantity;

            // Create order
            const [orderResult] = await connection.query(
                'INSERT INTO supplement_orders (member_id, total_amount, order_status) VALUES (?, ?, ?)',
                [memberId, totalAmount, 'completed']
            );

            const orderId = orderResult.insertId;

            // Create order item
            await connection.query(
                'INSERT INTO supplement_order_items (order_id, supplement_id, quantity, price) VALUES (?, ?, ?, ?)',
                [orderId, supplementId, quantity, supplement.price]
            );

            // Update stock
            await connection.query(
                'UPDATE supplements SET stock_quantity = stock_quantity - ? WHERE id = ?',
                [quantity, supplementId]
            );

            await connection.commit();
            connection.release();

            res.status(201).json({
                success: true,
                message: 'Purchase completed successfully',
                data: {
                    orderId,
                    totalAmount,
                    supplement: {
                        id: supplement.id,
                        name: supplement.name,
                        quantity
                    }
                }
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
            throw error;
        }

    } catch (error) {
        console.error('Purchase supplement error:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing purchase',
            error: error.message
        });
    }
};

module.exports = {
    getAllSupplements,
    getSupplement,
    createSupplement,
    updateSupplement,
    deleteSupplement,
    createOrder,
    getMemberOrders,
    purchaseSupplement
};