const Result = require("../models/Result");

const createResult = async (req, res) => {
    try {
        const { confidence, prediction } = req.body;

        if (!confidence || !prediction) {
            return res.status(400).json({
                success: false,
                message: "Confidence and prediction are required."
            });
        }
        if (confidence < 0 || confidence > 100) {
            return res.status(400).json({
                success: false,
                message: "Confidence must be between 0 and 100."
            });
        }
        const newResult = {
            confidence,
            prediction,
        };
        const savedResult = await Result.create(newResult);
        res.status(201).json({
            success: true,
            message: "Result created successfully.",
            data: savedResult
        });

    } catch (error) {
        console.error('Error creating result:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save result',
            error: error.message
        });
    }
}

const getAllResults = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const results = await Result.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Result.countDocuments();

        res.status(200).json({
            success: true,
            data: results,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalResults: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching results:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch results',
            error: error.message
        });
    }
};

// Get statistics report
const getStatistics = async (req, res) => {
    try {
        // Total predictions count
        const totalPredictions = await Result.countDocuments();

        // Predictions by type
        const predictionCounts = await Result.aggregate([
            {
                $group: {
                    _id: '$prediction',
                    count: { $sum: 1 },
                    avgConfidence: { $avg: '$confidence' },
                    maxConfidence: { $max: '$confidence' },
                    minConfidence: { $min: '$confidence' }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        // Overall confidence statistics
        const confidenceStats = await Result.aggregate([
            {
                $group: {
                    _id: null,
                    avgConfidence: { $avg: '$confidence' },
                    maxConfidence: { $max: '$confidence' },
                    minConfidence: { $min: '$confidence' },
                    totalPredictions: { $sum: 1 }
                }
            }
        ]);

        // High confidence predictions (>90%)
        const highConfidencePredictions = await Result.countDocuments({
            confidence: { $gt: 90 }
        });

        // Recent predictions (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentPredictions = await Result.countDocuments({
            createdAt: { $gte: sevenDaysAgo }
        });

        // Predictions by date (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const predictionsByDate = await Result.aggregate([
            {
                $match: {
                    createdAt: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    count: { $sum: 1 },
                    avgConfidence: { $avg: '$confidence' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        const statistics = {
            overview: {
                totalPredictions,
                highConfidencePredictions,
                recentPredictions: recentPredictions,
                highConfidencePercentage: totalPredictions > 0 ?
                    ((highConfidencePredictions / totalPredictions) * 100).toFixed(2) : 0
            },
            confidenceStats: confidenceStats[0] || {
                avgConfidence: 0,
                maxConfidence: 0,
                minConfidence: 0,
                totalPredictions: 0
            },
            predictionBreakdown: predictionCounts,
            dailyTrends: predictionsByDate
        };

        res.status(200).json({
            success: true,
            data: statistics
        });

    } catch (error) {
        console.error('Error generating statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate statistics',
            error: error.message
        });
    }
};

// Get results by prediction type
const getResultsByPrediction = async (req, res) => {
    try {
        const { prediction } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const results = await Result.find({
            prediction: { $regex: prediction, $options: 'i' }
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Result.countDocuments({
            prediction: { $regex: prediction, $options: 'i' }
        });

        res.status(200).json({
            success: true,
            data: results,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalResults: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });

    } catch (error) {
        console.error('Error fetching results by prediction:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch results by prediction',
            error: error.message
        });
    }
};

module.exports = {
    createResult,
    getAllResults,
    getStatistics,
    getResultsByPrediction
};