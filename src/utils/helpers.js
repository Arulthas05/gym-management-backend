const crypto = require('crypto');

const helpers = {
    // Generate random string
    generateRandomString: (length = 32) => {
        return crypto. randomBytes(length).toString('hex');
    },

    // Format date to MySQL format
    formatDateToMySQL: (date) => {
        return new Date(date).toISOString().slice(0, 19).replace('T', ' ');
    },

    // Calculate BMI
    calculateBMI: (weight, height) => {
        // weight in kg, height in cm
        const heightInMeters = height / 100;
        const bmi = weight / (heightInMeters * heightInMeters);
        return parseFloat(bmi.toFixed(2));
    },

    // Get BMI category
    getBMICategory: (bmi) => {
        if (bmi < 18.5) return 'Underweight';
        if (bmi < 25) return 'Normal weight';
        if (bmi < 30) return 'Overweight';
        return 'Obese';
    },

    // Generate invoice number
    generateInvoiceNumber: () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date. getMonth() + 1).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `INV-${year}${month}-${random}`;
    },

    // Paginate results
    paginate: (page = 1, limit = 10) => {
        const offset = (page - 1) * limit;
        return { limit:  parseInt(limit), offset: parseInt(offset) };
    },

    // Success response
    successResponse: (res, data, message = 'Success', statusCode = 200) => {
        return res.status(statusCode).json({
            success: true,
            message,
            data
        });
    },

    // Error response
    errorResponse: (res, message = 'Error occurred', statusCode = 500) => {
        return res.status(statusCode).json({
            success: false,
            message
        });
    }
};

module.exports = helpers;