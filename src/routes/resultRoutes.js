const express = require('express');
const router = express.Router();
const {
    createResult,
    getAllResults,
    getStatistics,
    getResultsByPrediction
} = require('../controllers/resultController');

// @route   POST /api/results
// @desc    Create a new prediction result
// @access  Public
router.post('/', createResult);

// @route   GET /api/results
// @desc    Get all prediction results with pagination
// @access  Public
router.get('/', getAllResults);

// @route   GET /api/results/statistics
// @desc    Get statistics report of all predictions
// @access  Public
router.get('/statistics', getStatistics);

// @route   GET /api/results/prediction/:prediction
// @desc    Get results by specific prediction type
// @access  Public
router.get('/prediction/:prediction', getResultsByPrediction);

module.exports = router;