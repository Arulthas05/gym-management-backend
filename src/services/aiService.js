const db = require('../config/database');
const logger = require('../utils/logger');

const aiService = {
    // Generate workout suggestions based on member profile
    generateWorkoutSuggestions: async (memberId) => {
        try {
            // Get member details
            const [members] = await db.query(
                `SELECT * FROM members WHERE id = ?`,
                [memberId]
            );

            if (members.length === 0) {
                throw new Error('Member not found');
            }

            const member = members[0];
            const bmi = member.bmi;
            const fitnessGoals = member.fitness_goals?. toLowerCase() || '';
            
            let suggestions = [];
            let difficultyLevel = 'beginner';

            // Get member's attendance to determine experience level
            const [attendance] = await db.query(
                'SELECT COUNT(*) as total FROM attendance WHERE member_id = ?',
                [memberId]
            );

            const totalVisits = attendance[0].total;

            if (totalVisits > 50) {
                difficultyLevel = 'advanced';
            } else if (totalVisits > 20) {
                difficultyLevel = 'intermediate';
            }

            // Generate suggestions based on BMI
            if (bmi < 18.5) {
                suggestions. push({
                    workout: 'Strength Training & Mass Building',
                    reason: 'Your BMI indicates you are underweight. Focus on building muscle mass.',
                    exercises: [
                        'Compound lifts (Squats, Deadlifts, Bench Press)',
                        'Progressive overload training',
                        'High-protein diet recommendation'
                    ],
                    duration: 60,
                    frequency: '4-5 times per week'
                });
            } else if (bmi >= 25) {
                suggestions.push({
                    workout: 'Cardio & Fat Loss Program',
                    reason: 'Your BMI indicates you are overweight. Focus on cardiovascular exercise and calorie deficit.',
                    exercises: [
                        'HIIT (High-Intensity Interval Training)',
                        'Running or cycling (30-45 mins)',
                        'Circuit training',
                        'Core strengthening exercises'
                    ],
                    duration: 45,
                    frequency: '5-6 times per week'
                });
            } else {
                suggestions.push({
                    workout: 'Balanced Fitness Program',
                    reason: 'Your BMI is in healthy range.  Maintain with balanced training.',
                    exercises: [
                        'Mix of cardio and strength training',
                        'Functional fitness exercises',
                        'Flexibility and mobility work'
                    ],
                    duration: 60,
                    frequency: '4-5 times per week'
                });
            }

            // Add goal-specific suggestions
            if (fitnessGoals.includes('weight loss') || fitnessGoals.includes('lose weight')) {
                suggestions.push({
                    workout: 'Weight Loss Accelerator',
                    reason: 'Aligned with your goal of weight loss',
                    exercises: [
                        'Morning fasted cardio',
                        'Metabolic resistance training',
                        'Active recovery walks'
                    ],
                    duration: 45,
                    frequency: 'Daily'
                });
            }

            if (fitnessGoals.includes('muscle') || fitnessGoals.includes('bulk')) {
                suggestions.push({
                    workout: 'Muscle Building Program',
                    reason: 'Aligned with your goal of building muscle',
                    exercises: [
                        'Heavy compound movements',
                        'Isolation exercises for target muscles',
                        'Progressive overload principles'
                    ],
                    duration: 75,
                    frequency: '4-5 times per week'
                });
            }

            if (fitnessGoals.includes('endurance') || fitnessGoals.includes('stamina')) {
                suggestions.push({
                    workout: 'Endurance Training',
                    reason: 'Aligned with your goal of improving endurance',
                    exercises: [
                        'Long-distance running or cycling',
                        'Swimming',
                        'Circuit training with minimal rest'
                    ],
                    duration: 60,
                    frequency: '5-6 times per week'
                });
            }

            // Save suggestions to database
            for (const suggestion of suggestions) {
                await db.query(
                    `INSERT INTO workout_suggestions (member_id, suggested_workout, reason, duration_minutes, difficulty_level)
                     VALUES (?, ?, ?, ?, ?)`,
                    [
                        memberId,
                        `${suggestion.workout}\n\nExercises:\n${suggestion.exercises. join('\n')}`,
                        suggestion.reason,
                        suggestion.duration,
                        difficultyLevel
                    ]
                );
            }

            logger.info(`Workout suggestions generated for member ${memberId}`);
            return {
                suggestions,
                difficultyLevel,
                memberProfile: {
                    bmi,
                    fitnessGoals,
                    totalVisits
                }
            };

        } catch (error) {
            logger.error('Error generating workout suggestions:', error);
            throw error;
        }
    },

    // Get member's workout history
    getWorkoutHistory: async (memberId) => {
        try {
            const [suggestions] = await db.query(
                `SELECT * FROM workout_suggestions 
                 WHERE member_id = ? 
                 ORDER BY created_at DESC 
                 LIMIT 10`,
                [memberId]
            );

            return suggestions;

        } catch (error) {
            logger.error('Error fetching workout history:', error);
            throw error;
        }
    }
};

module.exports = aiService;