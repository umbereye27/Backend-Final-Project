const Result = require("../models/Result");
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const User = require('../models/Users');

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

// Get results by date range
const getResultsByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;

        if (!startDate) {
            return res.status(400).json({
                success: false,
                message: "Start date is required."
            });
        }

        // Create date filter
        const dateFilter = {};
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.createdAt = { $gte: start };

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter.createdAt.$lte = end;
        } else {
            // If no end date, use the same day as end date
            const sameDay = new Date(startDate);
            sameDay.setHours(23, 59, 59, 999);
            dateFilter.createdAt.$lte = sameDay;
        }

        const results = await Result.find(dateFilter)
            .populate('user', 'username email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Result.countDocuments(dateFilter);

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No results found for the specified date range."
            });
        }

        res.status(200).json({
            success: true,
            message: "Results for date range retrieved successfully.",
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
        console.error('Error fetching results by date range:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch results by date range',
            error: error.message
        });
    }
};
const generatePDFReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const userId = req.user.id;

        if (!startDate) {
            return res.status(400).json({
                success: false,
                message: "Start date is required."
            });
        }

        // Create date filter
        const dateFilter = {};
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.createdAt = { $gte: start };

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter.createdAt.$lte = end;
        } else {
            // If no end date, use the same day as end date
            const sameDay = new Date(startDate);
            sameDay.setHours(23, 59, 59, 999);
            dateFilter.createdAt.$lte = sameDay;
        }

        // Get results for the date range
        const results = await Result.find(dateFilter)
            .populate('user', 'username email role')
            .sort({ createdAt: -1 })
            .limit(1000); // Limit to 1000 results for PDF

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No results found for the specified date range."
            });
        }

        // Get user stats
        const totalUsers = await User.countDocuments();
        const adminCount = await User.countDocuments({ role: 'admin' });
        const userCount = await User.countDocuments({ role: 'user' });
        const adminPercentage = Math.round((adminCount / totalUsers) * 100) || 0;
        const userPercentage = Math.round((userCount / totalUsers) * 100) || 0;

        // Get user info for sending email
        const user = await User.findById(userId);
        if (!user || !user.email) {
            return res.status(404).json({
                success: false,
                message: "User email not found."
            });
        }

        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });
        const filename = `results-report-${startDate}-to-${endDate || startDate}.pdf`;
        const filePath = path.join(__dirname, '../../temp', filename);
        
        // Ensure temp directory exists
        if (!fs.existsSync(path.join(__dirname, '../../temp'))) {
            fs.mkdirSync(path.join(__dirname, '../../temp'), { recursive: true });
        }
        
        // Pipe PDF to file
        doc.pipe(fs.createWriteStream(filePath));

        // Add title
        doc.fontSize(25).text('Skin Lesion Detection Results Report', { align: 'center' });
        doc.moveDown();

        // Add date range
        doc.fontSize(14).text(`Date Range: ${new Date(startDate).toLocaleDateString()} to ${endDate ? new Date(endDate).toLocaleDateString() : new Date(startDate).toLocaleDateString()}`);
        doc.moveDown();

        // Add timestamp
        doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
        doc.moveDown();

        // Add user stats
        doc.fontSize(16).text('User Statistics:');
        doc.fontSize(12).text(`Total Users: ${totalUsers}`);
        doc.text(`Admin Users: ${adminCount} (${adminPercentage}%)`);
        doc.text(`Regular Users: ${userCount} (${userPercentage}%)`);
        doc.moveDown();

        // Add results summary
        doc.fontSize(16).text('Results Summary:');
        doc.fontSize(12).text(`Total Results: ${results.length}`);
        
        // Group by prediction
        const predictionGroups = {};
        results.forEach(result => {
            if (!predictionGroups[result.prediction]) {
                predictionGroups[result.prediction] = 0;
            }
            predictionGroups[result.prediction]++;
        });
        
        // Add prediction breakdown
        doc.moveDown();
        doc.fontSize(14).text('Prediction Breakdown:');
        Object.keys(predictionGroups).forEach(prediction => {
            const percentage = Math.round((predictionGroups[prediction] / results.length) * 100);
            doc.fontSize(12).text(`${prediction}: ${predictionGroups[prediction]} (${percentage}%)`);
        });
        doc.moveDown();

        // Add results table
        doc.fontSize(16).text('Detailed Results:');
        doc.moveDown();

        // Table headers
        const tableTop = doc.y;
        const tableHeaders = ['Date', 'Prediction', 'Confidence', 'User'];
        const columnWidth = (doc.page.width - 100) / tableHeaders.length;
        
        // Draw headers
        doc.fontSize(12);
        doc.font('Helvetica-Bold');
        tableHeaders.forEach((header, i) => {
            doc.text(header, 50 + (i * columnWidth), tableTop, { width: columnWidth, align: 'left' });
        });
        doc.moveDown();
        doc.font('Helvetica');

        // Draw rows
        let rowTop = doc.y;
        results.slice(0, 100).forEach((result, i) => { // Limit to first 100 for table display
            // Check if we need a new page
            if (rowTop > doc.page.height - 100) {
                doc.addPage();
                rowTop = 50;
                
                // Redraw headers on new page
                doc.font('Helvetica-Bold');
                tableHeaders.forEach((header, i) => {
                    doc.text(header, 50 + (i * columnWidth), rowTop, { width: columnWidth, align: 'left' });
                });
                doc.moveDown();
                doc.font('Helvetica');
                rowTop = doc.y;
            }
            
            // Format date
            const date = new Date(result.createdAt).toLocaleDateString();
            
            // Draw row
            doc.text(date, 50, rowTop, { width: columnWidth, align: 'left' });
            doc.text(result.prediction, 50 + columnWidth, rowTop, { width: columnWidth, align: 'left' });
            doc.text(`${result.confidence.toFixed(2)}%`, 50 + (2 * columnWidth), rowTop, { width: columnWidth, align: 'left' });
            doc.text(result.user ? result.user.username : 'Unknown', 50 + (3 * columnWidth), rowTop, { width: columnWidth, align: 'left' });
            
            doc.moveDown();
            rowTop = doc.y;
        });

        // Add note if there are more results
        if (results.length > 100) {
            doc.moveDown();
            doc.fontSize(10).text(`Note: This report shows only the first 100 of ${results.length} total results.`, { italic: true });
        }

        // Finalize PDF
        doc.end();

        // Wait for PDF to be created
        setTimeout(async () => {
            try {
                // Create email transporter
                const transporter = nodemailer.createTransport({
                    service: 'gmail', // or your email service
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                });

                // Send email with PDF attachment
                await transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: user.email,
                    subject: 'Skin Lesion Detection Results Report',
                    text: `Please find attached your results report for the period ${new Date(startDate).toLocaleDateString()} to ${endDate ? new Date(endDate).toLocaleDateString() : new Date(startDate).toLocaleDateString()}.`,
                    attachments: [
                        {
                            filename: filename,
                            path: filePath
                        }
                    ]
                });

                // Clean up file after sending
                fs.unlinkSync(filePath);

                res.status(200).json({
                    success: true,
                    message: `PDF report generated and sent to ${user.email}`
                });
            } catch (emailError) {
                console.error('Error sending email:', emailError);
                res.status(500).json({
                    success: false,
                    message: 'Failed to send PDF report email',
                    error: emailError.message
                });
            }
        }, 2000); // Wait 2 seconds for PDF to be created

    } catch (error) {
        console.error('Error generating PDF report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate PDF report',
            error: error.message
        });
    }
};

// Add this new function to your resultController.js file
const generateAndDownloadPDFReport = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        if (!startDate) {
            return res.status(400).json({
                success: false,
                message: "Start date is required."
            });
        }

        // Create date filter
        const dateFilter = {};
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.createdAt = { $gte: start };

        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            dateFilter.createdAt.$lte = end;
        } else {
            // If no end date, use the same day as end date
            const sameDay = new Date(startDate);
            sameDay.setHours(23, 59, 59, 999);
            dateFilter.createdAt.$lte = sameDay;
        }

        // Get results for the date range
        const results = await Result.find(dateFilter)
            .populate('user', 'username email role')
            .sort({ createdAt: -1 })
            .limit(1000); // Limit to 1000 results for PDF

        if (!results || results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No results found for the specified date range."
            });
        }

        // Get user stats
        const totalUsers = await User.countDocuments();
        const adminCount = await User.countDocuments({ role: 'admin' });
        const userCount = await User.countDocuments({ role: 'user' });
        const adminPercentage = Math.round((adminCount / totalUsers) * 100) || 0;
        const userPercentage = Math.round((userCount / totalUsers) * 100) || 0;

        // Create PDF document
        const doc = new PDFDocument({ margin: 50 });
        const filename = `results-report-${startDate}-to-${endDate || startDate}.pdf`;
        
        // Set HTTP headers for downloading the PDF
        res.setHeader('Content-disposition', `attachment; filename=${filename}`);
        res.setHeader('Content-type', 'application/pdf');
        
        // Pipe PDF directly to response
        doc.pipe(res);

        // Add title
        doc.fontSize(25).text('Skin Lesion Detection Results Report', { align: 'center' });
        doc.moveDown();

        // Add date range
        doc.fontSize(14).text(`Date Range: ${new Date(startDate).toLocaleDateString()} to ${endDate ? new Date(endDate).toLocaleDateString() : new Date(startDate).toLocaleDateString()}`);
        doc.moveDown();

        // Add timestamp
        doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`);
        doc.moveDown();

        // Add user stats
        doc.fontSize(16).text('User Statistics:');
        doc.fontSize(12).text(`Total Users: ${totalUsers}`);
        doc.text(`Admin Users: ${adminCount} (${adminPercentage}%)`);
        doc.text(`Regular Users: ${userCount} (${userPercentage}%)`);
        doc.moveDown();

        // Add results summary
        doc.fontSize(16).text('Results Summary:');
        doc.fontSize(12).text(`Total Results: ${results.length}`);
        
        // Group by prediction
        const predictionGroups = {};
        results.forEach(result => {
            if (!predictionGroups[result.prediction]) {
                predictionGroups[result.prediction] = 0;
            }
            predictionGroups[result.prediction]++;
        });
        
        // Add prediction breakdown
        doc.moveDown();
        doc.fontSize(14).text('Prediction Breakdown:');
        Object.keys(predictionGroups).forEach(prediction => {
            const percentage = Math.round((predictionGroups[prediction] / results.length) * 100);
            doc.fontSize(12).text(`${prediction}: ${predictionGroups[prediction]} (${percentage}%)`);
        });
        doc.moveDown();

        // Add results table
        doc.fontSize(16).text('Detailed Results:');
        doc.moveDown();

        // Table headers
        const tableTop = doc.y;
        const tableHeaders = ['Date', 'Prediction', 'Confidence', 'User'];
        const columnWidth = (doc.page.width - 100) / tableHeaders.length;
        
        // Draw headers
        doc.fontSize(12);
        doc.font('Helvetica-Bold');
        tableHeaders.forEach((header, i) => {
            doc.text(header, 50 + (i * columnWidth), tableTop, { width: columnWidth, align: 'left' });
        });
        doc.moveDown();
        doc.font('Helvetica');

        // Draw rows
        let rowTop = doc.y;
        results.slice(0, 100).forEach((result, i) => { // Limit to first 100 for table display
            // Check if we need a new page
            if (rowTop > doc.page.height - 100) {
                doc.addPage();
                rowTop = 50;
                
                // Redraw headers on new page
                doc.font('Helvetica-Bold');
                tableHeaders.forEach((header, i) => {
                    doc.text(header, 50 + (i * columnWidth), rowTop, { width: columnWidth, align: 'left' });
                });
                doc.moveDown();
                doc.font('Helvetica');
                rowTop = doc.y;
            }
            
            // Format date
            const date = new Date(result.createdAt).toLocaleDateString();
            
            // Draw row
            doc.text(date, 50, rowTop, { width: columnWidth, align: 'left' });
            doc.text(result.prediction, 50 + columnWidth, rowTop, { width: columnWidth, align: 'left' });
            doc.text(`${result.confidence.toFixed(2)}%`, 50 + (2 * columnWidth), rowTop, { width: columnWidth, align: 'left' });
            doc.text(result.user ? result.user.username : 'Unknown', 50 + (3 * columnWidth), rowTop, { width: columnWidth, align: 'left' });
            
            doc.moveDown();
            rowTop = doc.y;
        });

        // Add note if there are more results
        if (results.length > 100) {
            doc.moveDown();
            doc.fontSize(10).text(`Note: This report shows only the first 100 of ${results.length} total results.`, { italic: true });
        }

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Error generating PDF report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate PDF report',
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
    getResultsByPrediction,
    getResultsByDateRange,
    generatePDFReport,
    generateAndDownloadPDFReport // Add this new export
};
