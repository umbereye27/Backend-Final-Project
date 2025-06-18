const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/authMiddleware'); // Adjust path as needed
const {
    getAllUsers,
    getUsersByRole,
    getUsersByRoleQuery
} = require('../controllers/userController'); // Adjust path as needed

// Route to get all users - Only accessible by admins
router.get('/all',
    authenticate,
    authorize('admin'),
    getAllUsers
);

// Route to get users by role using route parameters - Only accessible by admins
// GET /api/users/role/admin or /api/users/role/user
router.get('/role/:role',
    authenticate,
    authorize('admin'),
    getUsersByRole
);

// Route to get users with optional role filtering using query parameters
// GET /api/users?role=admin or /api/users (for all users)
// Only accessible by admins
router.get('/',
    authenticate,
    authorize('admin'),
    getUsersByRoleQuery
);

// Alternative: If you want regular users to see only their own profile
// and admins to see all users
router.get('/profile',
    authenticate,
    (req, res, next) => {
        // If user is admin, they can see all users
        if (req.user.role === 'admin') {
            return getAllUsers(req, res);
        }

        // Regular users can only see their own profile
        const User = require('../models/Users'); // Adjust path as needed

        User.findById(req.user.id, '-password')
            .then(user => {
                if (!user) {
                    return res.status(404).json({ message: 'User not found.' });
                }
                res.status(200).json({
                    message: 'User profile retrieved successfully.',
                    user: user
                });
            })
            .catch(err => {
                console.error(err);
                res.status(500).json({ message: 'Internal server error' });
            });
    }
);

// Route for admins to get user statistics
router.get('/stats',
    authenticate,
    authorize('admin'),
    async (req, res) => {
        try {
            const User = require('../models/Users'); // Adjust path as needed

            const totalUsers = await User.countDocuments();
            const adminCount = await User.countDocuments({ role: 'admin' });
            const userCount = await User.countDocuments({ role: 'user' });

            res.status(200).json({
                message: 'User statistics retrieved successfully.',
                stats: {
                    totalUsers,
                    adminCount,
                    userCount,
                    userPercentage: totalUsers > 0 ? Math.round((userCount / totalUsers) * 100) : 0,
                    adminPercentage: totalUsers > 0 ? Math.round((adminCount / totalUsers) * 100) : 0
                }
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ message: 'Internal server error' });
        }
    }
);

module.exports = router;