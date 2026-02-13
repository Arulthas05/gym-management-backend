module.exports = {
    ROLES: {
        ADMIN: 'admin',
        TRAINER: 'trainer',
        MEMBER: 'member'
    },

    MEMBERSHIP_STATUS: {
        ACTIVE: 'active',
        EXPIRED: 'expired',
        CANCELLED: 'cancelled'
    },

    SESSION_STATUS: {
        SCHEDULED: 'scheduled',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled',
        NO_SHOW: 'no-show'
    },

    PAYMENT_STATUS: {
        PENDING: 'pending',
        COMPLETED: 'completed',
        FAILED: 'failed',
        REFUNDED: 'refunded'
    },

    PAYMENT_TYPE: {
        MEMBERSHIP: 'membership',
        SUPPLEMENT: 'supplement',
        TRAINING_SESSION: 'training_session'
    },

    PAYMENT_METHOD: {
        STRIPE: 'stripe',
        PAYPAL: 'paypal',
        CASH: 'cash',
        CARD: 'card'
    },

    ORDER_STATUS: {
        PENDING: 'pending',
        PROCESSING: 'processing',
        COMPLETED: 'completed',
        CANCELLED: 'cancelled'
    },

    REMINDER_TYPE: {
        PAYMENT: 'payment',
        SESSION: 'session',
        MEMBERSHIP_EXPIRY: 'membership_expiry'
    },

    CHECK_IN_METHOD: {
        QR:  'qr',
        MANUAL: 'manual',
        CARD: 'card'
    }
};