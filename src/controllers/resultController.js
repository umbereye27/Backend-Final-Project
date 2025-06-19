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
            user: req.user.userId // Get user ID from authenticated token
        };

        const savedResult = await Result.create(newResult);

        // Populate user information in response
        await savedResult.populate('user', 'username email role');

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
};

// Get user's own results with pagination
const getUserResults = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const results = await Result.find({ user: req.user.userId })
            .populate('user', 'username email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Result.countDocuments({ user: req.user.userId });

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No results found for this user."
            });
        }

        res.status(200).json({
            success: true,
            message: "User results retrieved successfully.",
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
        console.error('Error fetching user results:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user results',
            error: error.message
        });
    }
};

// Get results by user ID (Admin only)
const getResultsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: "User ID is required."
            });
        }

        const results = await Result.find({ user: userId })
            .populate('user', 'username email role')
            .sort({ createdAt: -1 });

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No results found for this user."
            });
        }

        res.status(200).json({
            success: true,
            message: "Results retrieved successfully.",
            count: results.length,
            data: results
        });
    } catch (error) {
        console.error('Error fetching results by user ID:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch results',
            error: error.message
        });
    }
};

// Get all results with pagination (Admin only)
const getAllResults = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const results = await Result.find()
            .populate('user', 'username email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Result.countDocuments();

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No results found."
            });
        }

        res.status(200).json({
            success: true,
            message: "Results retrieved successfully.",
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

// Get comprehensive statistics (Admin only)
const getStatistics = async (req, res) => {
    try {
        // Total predictions count
        const totalPredictions = await Result.countDocuments();

        // Predictions by type with user data
        const predictionCounts = await Result.aggregate([
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userInfo"
                }
            },
            {
                $group: {
                    _id: '$prediction',
                    count: { $sum: 1 },
                    avgConfidence: { $avg: '$confidence' },
                    maxConfidence: { $max: '$confidence' },
                    minConfidence: { $min: '$confidence' },
                    uniqueUsers: { $addToSet: '$user' }
                }
            },
            {
                $addFields: {
                    uniqueUserCount: { $size: '$uniqueUsers' }
                }
            },
            {
                $project: {
                    count: 1,
                    avgConfidence: 1,
                    maxConfidence: 1,
                    minConfidence: 1,
                    uniqueUserCount: 1
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

        // Top users by prediction count
        const topUsers = await Result.aggregate([
            { $group: { _id: "$user", count: { $sum: 1 }, avgConfidence: { $avg: "$confidence" } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "userInfo"
                }
            },
            { $unwind: "$userInfo" },
            {
                $project: {
                    count: 1,
                    avgConfidence: 1,
                    username: "$userInfo.username",
                    email: "$userInfo.email",
                    role: "$userInfo.role"
                }
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
            topUsers: topUsers
        };

        res.status(200).json({
            success: true,
            message: "Statistics retrieved successfully.",
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

// Get time-based statistics (daily, weekly, monthly, yearly)
const getTimeBasedStats = async (req, res) => {
    try {
        const { period } = req.params; // daily, weekly, monthly, yearly
        const validPeriods = ['daily', 'weekly', 'monthly', 'yearly'];

        if (!validPeriods.includes(period)) {
            return res.status(400).json({
                success: false,
                message: "Invalid period. Use: daily, weekly, monthly, or yearly"
            });
        }

        let dateRange, groupBy, sortBy;
        const now = new Date();

        switch (period) {
            case 'daily':
                // Last 30 days
                dateRange = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                groupBy = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
                sortBy = { '_id.year': 1, '_id.month': 1, '_id.day': 1 };
                break;

            case 'weekly':
                // Last 12 weeks
                dateRange = new Date(now.getTime() - 84 * 24 * 60 * 60 * 1000);
                groupBy = {
                    year: { $year: '$createdAt' },
                    week: { $week: '$createdAt' }
                };
                sortBy = { '_id.year': 1, '_id.week': 1 };
                break;

            case 'monthly':
                // Last 12 months
                dateRange = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
                groupBy = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                };
                sortBy = { '_id.year': 1, '_id.month': 1 };
                break;

            case 'yearly':
                // Last 5 years
                dateRange = new Date(now.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
                groupBy = {
                    year: { $year: '$createdAt' }
                };
                sortBy = { '_id.year': 1 };
                break;
        }

        const timeStats = await Result.aggregate([
            {
                $match: {
                    createdAt: { $gte: dateRange }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "user",
                    foreignField: "_id",
                    as: "userInfo"
                }
            },
            {
                $group: {
                    _id: groupBy,
                    count: { $sum: 1 },
                    avgConfidence: { $avg: '$confidence' },
                    maxConfidence: { $max: '$confidence' },
                    minConfidence: { $min: '$confidence' },
                    uniqueUsers: { $addToSet: '$user' },
                    predictions: { $push: '$prediction' }
                }
            },
            {
                $addFields: {
                    uniqueUserCount: { $size: '$uniqueUsers' }
                }
            },
            {
                $project: {
                    count: 1,
                    avgConfidence: { $round: ['$avgConfidence', 2] },
                    maxConfidence: 1,
                    minConfidence: 1,
                    uniqueUserCount: 1,
                    predictions: 1
                }
            },
            {
                $sort: sortBy
            }
        ]);

        // Get prediction breakdown for the period
        const predictionBreakdown = await Result.aggregate([
            {
                $match: {
                    createdAt: { $gte: dateRange }
                }
            },
            {
                $group: {
                    _id: '$prediction',
                    count: { $sum: 1 },
                    avgConfidence: { $avg: '$confidence' }
                }
            },
            {
                $project: {
                    prediction: '$_id',
                    count: 1,
                    avgConfidence: { $round: ['$avgConfidence', 2] }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        // Get total stats for the period
        const totalStats = await Result.aggregate([
            {
                $match: {
                    createdAt: { $gte: dateRange }
                }
            },
            {
                $group: {
                    _id: null,
                    totalCount: { $sum: 1 },
                    avgConfidence: { $avg: '$confidence' },
                    uniqueUsers: { $addToSet: '$user' }
                }
            },
            {
                $addFields: {
                    uniqueUserCount: { $size: '$uniqueUsers' }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            message: `${period.charAt(0).toUpperCase() + period.slice(1)} statistics retrieved successfully.`,
            data: {
                period: period,
                dateRange: {
                    from: dateRange,
                    to: now
                },
                summary: totalStats[0] || {
                    totalCount: 0,
                    avgConfidence: 0,
                    uniqueUserCount: 0
                },
                timeSeriesData: timeStats,
                predictionBreakdown: predictionBreakdown
            }
        });

    } catch (error) {
        console.error(`Error generating ${period} statistics:`, error);
        res.status(500).json({
            success: false,
            message: `Failed to generate ${period} statistics`,
            error: error.message
        });
    }
};

// Get results by prediction type with user info
const getResultsByPrediction = async (req, res) => {
    try {
        const { prediction } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const results = await Result.find({
            prediction: { $regex: prediction, $options: 'i' }
        })
            .populate('user', 'username email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Result.countDocuments({
            prediction: { $regex: prediction, $options: 'i' }
        });

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: `No results found for prediction: ${prediction}`
            });
        }

        res.status(200).json({
            success: true,
            message: `Results for prediction '${prediction}' retrieved successfully.`,
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
    getUserResults,
    getResultsByUserId,
    getStatistics,
    getTimeBasedStats,
    getResultsByPrediction
};
