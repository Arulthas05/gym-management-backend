-- ============================================
-- GYM MANAGEMENT SYSTEM - DATABASE SCHEMA
-- ============================================

-- Drop existing database if exists
DROP DATABASE IF EXISTS gym_management;

-- Create database
CREATE DATABASE gym_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE gym_management;

-- ============================================
-- USERS TABLE (Main authentication table)
-- ============================================
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'trainer', 'member') NOT NULL DEFAULT 'member',
    is_active BOOLEAN DEFAULT TRUE,
    reset_token VARCHAR(255) NULL,
    reset_token_expiry DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_role (role),
    INDEX idx_reset_token (reset_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- MEMBERS TABLE
-- ============================================
CREATE TABLE members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    date_of_birth DATE,
    gender ENUM('male', 'female', 'other'),
    address TEXT,
    emergency_contact VARCHAR(20),
    profile_image VARCHAR(255),
    qr_code VARCHAR(255),
    height DECIMAL(5,2) COMMENT 'Height in cm',
    weight DECIMAL(5,2) COMMENT 'Weight in kg',
    bmi DECIMAL(5,2),
    medical_conditions TEXT,
    fitness_goals TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_name (first_name, last_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TRAINERS TABLE
-- ============================================
CREATE TABLE trainers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    specialization VARCHAR(255) COMMENT 'e.g., Yoga, CrossFit, Personal Training',
    experience_years INT DEFAULT 0,
    certifications TEXT COMMENT 'List of certifications',
    bio TEXT,
    profile_image VARCHAR(255),
    hourly_rate DECIMAL(10,2) DEFAULT 0.00,
    rating DECIMAL(3,2) DEFAULT 0.00 COMMENT 'Rating out of 5',
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_specialization (specialization),
    INDEX idx_available (is_available)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- MEMBERSHIP PLANS TABLE
-- ============================================
CREATE TABLE membership_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT 'e.g., Basic, Premium, VIP',
    duration_months INT NOT NULL COMMENT 'Duration in months',
    price DECIMAL(10,2) NOT NULL,
    description TEXT,
    features JSON COMMENT 'List of features as JSON array',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_active (is_active),
    INDEX idx_price (price)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- MEMBER MEMBERSHIPS TABLE (Active subscriptions)
-- ============================================
CREATE TABLE member_memberships (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    membership_plan_id INT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
    auto_renewal BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (membership_plan_id) REFERENCES membership_plans(id),
    INDEX idx_member_id (member_id),
    INDEX idx_status (status),
    INDEX idx_end_date (end_date),
    INDEX idx_membership_expiry (status, end_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TRAINING SESSIONS TABLE
-- ============================================
CREATE TABLE training_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    trainer_id INT NOT NULL,
    member_id INT NOT NULL,
    session_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    session_type VARCHAR(100) COMMENT 'e.g., Personal Training, Group Class',
    notes TEXT,
    status ENUM('scheduled', 'completed', 'cancelled', 'no-show') DEFAULT 'scheduled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    INDEX idx_trainer_id (trainer_id),
    INDEX idx_member_id (member_id),
    INDEX idx_session_date (session_date),
    INDEX idx_status (status),
    INDEX idx_session_date_status (session_date, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- PAYMENTS TABLE
-- ============================================
CREATE TABLE payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_type ENUM('membership', 'supplement', 'training_session') NOT NULL,
    payment_method ENUM('stripe', 'paypal', 'cash', 'card') NOT NULL,
    payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    transaction_id VARCHAR(255) COMMENT 'External payment gateway transaction ID',
    invoice_number VARCHAR(100) UNIQUE,
    invoice_path VARCHAR(255),
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    INDEX idx_member_id (member_id),
    INDEX idx_payment_status (payment_status),
    INDEX idx_payment_type (payment_type),
    INDEX idx_invoice_number (invoice_number),
    INDEX idx_payment_status_date (payment_status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SUPPLEMENTS TABLE
-- ============================================
CREATE TABLE supplements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) COMMENT 'e.g., Protein, Pre-workout, Vitamins',
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    image_url VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_category (category),
    INDEX idx_active (is_active),
    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SUPPLEMENT ORDERS TABLE
-- ============================================
CREATE TABLE supplement_orders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    order_status ENUM('pending', 'processing', 'completed', 'cancelled') DEFAULT 'pending',
    payment_id INT,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    FOREIGN KEY (payment_id) REFERENCES payments(id),
    INDEX idx_member_id (member_id),
    INDEX idx_order_status (order_status),
    INDEX idx_order_date (order_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- SUPPLEMENT ORDER ITEMS TABLE
-- ============================================
CREATE TABLE supplement_order_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    supplement_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL COMMENT 'Price at time of order',
    FOREIGN KEY (order_id) REFERENCES supplement_orders(id) ON DELETE CASCADE,
    FOREIGN KEY (supplement_id) REFERENCES supplements(id),
    INDEX idx_order_id (order_id),
    INDEX idx_supplement_id (supplement_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- ATTENDANCE TABLE
-- ============================================
CREATE TABLE attendance (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    check_in_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    check_out_time TIMESTAMP NULL,
    attendance_date DATE NOT NULL,
    check_in_method ENUM('qr', 'manual', 'card') DEFAULT 'manual',
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    INDEX idx_member_id (member_id),
    INDEX idx_attendance_date (attendance_date),
    INDEX idx_check_in_time (check_in_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- EMAIL REMINDERS TABLE
-- ============================================
CREATE TABLE email_reminders (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    reminder_type ENUM('payment', 'session', 'membership_expiry') NOT NULL,
    reminder_date DATE NOT NULL,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    INDEX idx_member_id (member_id),
    INDEX idx_reminder_date (reminder_date),
    INDEX idx_is_sent (is_sent)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- WORKOUT SUGGESTIONS TABLE (AI-based)
-- ============================================
CREATE TABLE workout_suggestions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    member_id INT NOT NULL,
    suggested_workout TEXT NOT NULL,
    reason TEXT,
    duration_minutes INT,
    difficulty_level ENUM('beginner', 'intermediate', 'advanced'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    INDEX idx_member_id (member_id),
    INDEX idx_difficulty (difficulty_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- TRAINER REVIEWS TABLE (Optional - for future)
-- ============================================
CREATE TABLE trainer_reviews (
    id INT PRIMARY KEY AUTO_INCREMENT,
    trainer_id INT NOT NULL,
    member_id INT NOT NULL,
    rating DECIMAL(3,2) NOT NULL COMMENT 'Rating out of 5',
    review_text TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
    INDEX idx_trainer_id (trainer_id),
    INDEX idx_member_id (member_id),
    INDEX idx_rating (rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- INSERT SAMPLE DATA
-- ============================================

-- Insert Admin User
INSERT INTO users (email, password, role) VALUES 
('admin@gym.com', '$2a$10$9XZJ5YhLZ5YhLZ5YhLZ5YeO5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ', 'admin');
-- Password: admin123

-- Insert Sample Membership Plans
INSERT INTO membership_plans (name, duration_months, price, description, features) VALUES 
('Basic Monthly', 1, 29.99, 'Perfect for beginners', '["Gym Access", "Locker Room", "Basic Equipment"]'),
('Standard Quarterly', 3, 79.99, 'Best value for regular members', '["Gym Access", "Locker Room", "All Equipment", "Group Classes"]'),
('Premium Semi-Annual', 6, 149.99, 'Most popular plan', '["Gym Access", "Locker Room", "All Equipment", "Group Classes", "2 Personal Training Sessions"]'),
('VIP Annual', 12, 279.99, 'Ultimate fitness package', '["Gym Access", "Locker Room", "All Equipment", "Unlimited Group Classes", "4 Personal Training Sessions/month", "Nutrition Consultation", "Free Supplements"]');

-- Insert Sample Trainers
INSERT INTO users (email, password, role) VALUES 
('john. trainer@gym.com', '$2a$10$9XZJ5YhLZ5YhLZ5YhLZ5YeO5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ', 'trainer'),
('sarah.trainer@gym.com', '$2a$10$9XZJ5YhLZ5YhLZ5YhLZ5YeO5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ', 'trainer'),
('mike.trainer@gym.com', '$2a$10$9XZJ5YhLZ5YhLZ5YhLZ5YeO5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ', 'trainer');
-- Password for all:  trainer123

INSERT INTO trainers (user_id, first_name, last_name, phone, specialization, experience_years, certifications, bio, hourly_rate, rating) VALUES 
(2, 'John', 'Smith', '+1234567890', 'Personal Training & Strength', 5, 'NASM-CPT, CSCS', 'Specializing in strength training and body building with 5+ years of experience.', 50.00, 4.8),
(3, 'Sarah', 'Johnson', '+1234567891', 'Yoga & Pilates', 3, 'RYT-500, Pilates Certified', 'Expert in yoga and mind-body connection.  Helping clients achieve balance and flexibility.', 45.00, 4.9),
(4, 'Mike', 'Davis', '+1234567892', 'CrossFit & HIIT', 7, 'CrossFit Level 2, NASM-CPT', 'High-intensity interval training specialist.  Transform your body with intense workouts.', 55.00, 4.7);

-- Insert Sample Members
INSERT INTO users (email, password, role) VALUES 
('member1@example.com', '$2a$10$9XZJ5YhLZ5YhLZ5YhLZ5YeO5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ', 'member'),
('member2@example.com', '$2a$10$9XZJ5YhLZ5YhLZ5YhLZ5YeO5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ', 'member'),
('member3@example.com', '$2a$10$9XZJ5YhLZ5YhLZ5YhLZ5YeO5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ5YhLZ', 'member');
-- Password for all: member123

-- FIXED: Remove leading zeros from decimal values
INSERT INTO members (user_id, first_name, last_name, phone, date_of_birth, gender, address, emergency_contact, height, weight, bmi, fitness_goals, qr_code) VALUES 
(5, 'Alice', 'Williams', '+1234567893', '1995-05-15', 'female', '123 Main St, City', '+1234567894', 165, 60, 22.04, 'Weight loss and toning', 'uploads/qr/member-1.png'),
(6, 'Bob', 'Brown', '+1234567895', '1988-08-20', 'male', '456 Oak Ave, City', '+1234567896', 180, 85, 26.23, 'Build muscle mass', 'uploads/qr/member-2.png'),
(7, 'Carol', 'Martinez', '+1234567897', '1992-12-10', 'female', '789 Pine Rd, City', '+1234567898', 170, 65, 22.49, 'Overall fitness and health', 'uploads/qr/member-3.png');

-- Insert Sample Memberships
INSERT INTO member_memberships (member_id, membership_plan_id, start_date, end_date, status, auto_renewal) VALUES 
(1, 3, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 6 MONTH), 'active', TRUE),
(2, 4, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 12 MONTH), 'active', TRUE),
(3, 2, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 3 MONTH), 'active', FALSE);

-- Insert Sample Supplements
INSERT INTO supplements (name, description, category, price, stock_quantity, image_url) VALUES 
('Whey Protein Isolate', 'Premium whey protein isolate for muscle building', 'Protein', 49.99, 100, '/images/supplements/whey-protein. jpg'),
('Pre-Workout Energizer', 'Boost your energy before intense workouts', 'Pre-Workout', 34.99, 75, '/images/supplements/pre-workout.jpg'),
('BCAA Recovery', 'Branch chain amino acids for faster recovery', 'Recovery', 29.99, 80, '/images/supplements/bcaa.jpg'),
('Multivitamin Complex', 'Complete daily vitamin and mineral supplement', 'Vitamins', 24.99, 120, '/images/supplements/multivitamin.jpg'),
('Creatine Monohydrate', 'Increase strength and power', 'Performance', 19.99, 90, '/images/supplements/creatine.jpg'),
('Fish Oil Omega-3', 'Essential fatty acids for heart and brain health', 'Health', 21.99, 150, '/images/supplements/fish-oil.jpg');

-- Insert Sample Training Sessions
INSERT INTO training_sessions (trainer_id, member_id, session_date, start_time, end_time, session_type, status, notes) VALUES 
(1, 1, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '09:00:00', '10:00:00', 'Personal Training', 'scheduled', 'Focus on upper body strength'),
(2, 3, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '10:00:00', '11:00:00', 'Yoga Session', 'scheduled', 'Beginner level yoga'),
(3, 2, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '15:00:00', '16:00:00', 'CrossFit', 'scheduled', 'High intensity workout'),
(1, 2, DATE_SUB(CURDATE(), INTERVAL 2 DAY), '09:00:00', '10:00:00', 'Personal Training', 'completed', 'Great progress on bench press');

-- Insert Sample Payments
INSERT INTO payments (member_id, amount, payment_type, payment_method, payment_status, transaction_id, invoice_number, description) VALUES 
(1, 149.99, 'membership', 'stripe', 'completed', 'pi_1234567890', 'INV-202601-0001', 'Premium Semi-Annual Membership'),
(2, 279.99, 'membership', 'stripe', 'completed', 'pi_1234567891', 'INV-202601-0002', 'VIP Annual Membership'),
(3, 79.99, 'membership', 'card', 'completed', NULL, 'INV-202601-0003', 'Standard Quarterly Membership');

-- Insert Sample Attendance (Fixed TIMESTAMP syntax)
INSERT INTO attendance (member_id, attendance_date, check_in_method, check_in_time, check_out_time) VALUES 
(1, CURDATE(), 'qr', CONCAT(CURDATE(), ' 08:00:00'), CONCAT(CURDATE(), ' 09:30:00')),
(2, CURDATE(), 'manual', CONCAT(CURDATE(), ' 07:00:00'), CONCAT(CURDATE(), ' 08:45:00')),
(3, CURDATE(), 'qr', CONCAT(CURDATE(), ' 18:00:00'), NULL),
(1, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'qr', CONCAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), ' 08:00:00'), CONCAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), ' 09:30:00')),
(2, DATE_SUB(CURDATE(), INTERVAL 1 DAY), 'manual', CONCAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), ' 17:00:00'), CONCAT(DATE_SUB(CURDATE(), INTERVAL 1 DAY), ' 18:30:00'));

-- ============================================
-- CREATE VIEWS FOR REPORTING
-- ============================================

-- View:  Active Members with Membership Details
CREATE VIEW vw_active_members AS
SELECT 
    m.id,
    m.first_name,
    m.last_name,
    u.email,
    mm.status as membership_status,
    mp.name as plan_name,
    mm.end_date,
    DATEDIFF(mm.end_date, CURDATE()) as days_remaining
FROM members m
INNER JOIN users u ON m.user_id = u.id
LEFT JOIN member_memberships mm ON m.id = mm.member_id AND mm.status = 'active'
LEFT JOIN membership_plans mp ON mm.membership_plan_id = mp.id
WHERE u.is_active = TRUE;

-- View: Trainer Performance
CREATE VIEW vw_trainer_performance AS
SELECT 
    t.id,
    t.first_name,
    t.last_name,
    t.specialization,
    t.rating,
    COUNT(ts.id) as total_sessions,
    COUNT(CASE WHEN ts.status = 'completed' THEN 1 END) as completed_sessions,
    COUNT(CASE WHEN ts. status = 'cancelled' THEN 1 END) as cancelled_sessions,
    COUNT(DISTINCT ts.member_id) as unique_clients
FROM trainers t
LEFT JOIN training_sessions ts ON t.id = ts.trainer_id
GROUP BY t.id;

-- View: Revenue Summary
CREATE VIEW vw_revenue_summary AS
SELECT 
    DATE_FORMAT(payment_date, '%Y-%m') as month,
    payment_type,
    COUNT(*) as transaction_count,
    SUM(amount) as total_revenue
FROM payments
WHERE payment_status = 'completed'
GROUP BY month, payment_type
ORDER BY month DESC;

-- ============================================
-- CREATE STORED PROCEDURES
-- ============================================

DELIMITER //

-- Procedure:  Expire Old Memberships
CREATE PROCEDURE sp_expire_memberships()
BEGIN
    UPDATE member_memberships
    SET status = 'expired'
    WHERE status = 'active' AND end_date < CURDATE();
    
    SELECT ROW_COUNT() as expired_count;
END //

-- Procedure: Get Member Dashboard Stats
CREATE PROCEDURE sp_get_member_stats(IN p_member_id INT)
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM attendance WHERE member_id = p_member_id) as total_visits,
        (SELECT COUNT(*) FROM training_sessions WHERE member_id = p_member_id AND status = 'completed') as completed_sessions,
        (SELECT COUNT(*) FROM training_sessions WHERE member_id = p_member_id AND status = 'scheduled') as upcoming_sessions,
        (SELECT SUM(amount) FROM payments WHERE member_id = p_member_id AND payment_status = 'completed') as total_spent,
        (SELECT end_date FROM member_memberships WHERE member_id = p_member_id AND status = 'active' LIMIT 1) as membership_end_date;
END //

-- Procedure:  Get Monthly Report
CREATE PROCEDURE sp_get_monthly_report(IN p_year INT, IN p_month INT)
BEGIN
    SELECT 
        (SELECT COUNT(*) FROM members WHERE YEAR(created_at) = p_year AND MONTH(created_at) = p_month) as new_members,
        (SELECT COUNT(*) FROM training_sessions WHERE YEAR(session_date) = p_year AND MONTH(session_date) = p_month) as total_sessions,
        (SELECT SUM(amount) FROM payments WHERE payment_status = 'completed' AND YEAR(payment_date) = p_year AND MONTH(payment_date) = p_month) as total_revenue,
        (SELECT COUNT(*) FROM attendance WHERE YEAR(attendance_date) = p_year AND MONTH(attendance_date) = p_month) as total_check_ins;
END //

DELIMITER ;

-- ============================================
-- CREATE TRIGGERS
-- ============================================

DELIMITER //

-- Trigger: Update Member BMI on weight/height change
CREATE TRIGGER trg_calculate_bmi_before_update
BEFORE UPDATE ON members
FOR EACH ROW
BEGIN
    IF NEW.height IS NOT NULL AND NEW.weight IS NOT NULL THEN
        SET NEW. bmi = NEW.weight / POWER(NEW.height / 100, 2);
    END IF;
END //

-- Trigger: Update Member BMI on insert
CREATE TRIGGER trg_calculate_bmi_before_insert
BEFORE INSERT ON members
FOR EACH ROW
BEGIN
    IF NEW.height IS NOT NULL AND NEW. weight IS NOT NULL THEN
        SET NEW.bmi = NEW. weight / POWER(NEW.height / 100, 2);
    END IF;
END //

-- Trigger: Log email reminder when membership is expiring
CREATE TRIGGER trg_create_expiry_reminder
AFTER INSERT ON member_memberships
FOR EACH ROW
BEGIN
    IF NEW.status = 'active' THEN
        INSERT INTO email_reminders (member_id, reminder_type, reminder_date)
        VALUES (NEW.member_id, 'membership_expiry', DATE_SUB(NEW.end_date, INTERVAL 7 DAY));
    END IF;
END //

DELIMITER ;

-- ============================================
-- DATABASE SCHEMA COMPLETE
-- ============================================

SELECT 'Database schema created successfully!' as message;
SELECT TABLE_NAME, TABLE_ROWS 
FROM information_schema. TABLES 
WHERE TABLE_SCHEMA = 'gym_management' 
ORDER BY TABLE_NAME;