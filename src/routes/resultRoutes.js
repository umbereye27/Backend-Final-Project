const express = require('express');
const router = express.Router();
const {
    createResult,
    getAllResults,
    getStatistics,
    getResultsByPrediction,
    getUserResults,
    getResultsByUserId,
    getTimeBasedStats,
    generateAndDownloadPDFReport,
    getResultsByDateRange
} = require('../controllers/resultController');
const { authenticate, authorize } = require('../middlewares/authMiddleware');

// @route   POST /api/results
// @desc    Create a new prediction result
// @access  Public
router.post('/', authenticate, createResult);

// @route   GET /api/results
// @desc    Get all prediction results with pagination
// @access  Public
router.get('/', authenticate, authorize('admin'), getAllResults);

// @route   GET /api/results/my-results
// @desc    Get current user's results
// @access  Private (authenticated user)
router.get('/my-results', authenticate, getUserResults);

// @route   GET /api/results/user/:userId
// @desc    Get results by specific user ID (admin only)
// @access  Private (admin only)
router.get('/user/:userId', authenticate, authorize('admin'), getResultsByUserId);

// @route   GET /api/results/statistics
// @desc    Get statistics report of all predictions
// @access  Public
router.get('/stats', authenticate, authorize('admin'), getStatistics);

// @route   GET /api/results/stats/:period
// @desc    Get time-based statistics (daily, weekly, monthly, yearly) (admin only)
// @access  Private (admin only)
router.get('/stats/:period', authenticate, authorize('admin'), getTimeBasedStats);

// @route   GET /api/results/prediction/:prediction
// @desc    Get results by specific prediction type
// @access  Public
router.get('/prediction/:prediction', authenticate, authorize('admin'), getResultsByPrediction);

// @route   GET /api/results/date
// @desc    Get results by date range
// @access  Private (admin only)
router.get('/date', authenticate, authorize('admin'), getResultsByDateRange);
router.get('/download-report', generateAndDownloadPDFReport);

module.exports = router;
