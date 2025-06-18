const User = require("../models/Users");


const getAllUsers = async (req, res) => {
    try {
        // Fetch all users from database, excluding password field
        const users = await User.find({}, '-password');

        if (!users || users.length === 0) {
            return res.status(404).json({ message: "No users found." });
        }

        res.status(200).json({
            message: "Users retrieved successfully.",
            count: users.length,
            users: users
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Controller to filter users by role
const getUsersByRole = async (req, res) => {
    const { role } = req.params; // or req.query depending on your route setup

    // Validate role parameter
    if (!role) {
        return res.status(400).json({ message: "Role parameter is required." });
    }

    // Validate role value
    const validRoles = ['admin', 'user'];
    if (!validRoles.includes(role.toLowerCase())) {
        return res.status(400).json({
            message: "Invalid role. Role must be either 'admin' or 'user'."
        });
    }

    try {
        // Find users by role, excluding password field
        const users = await User.find({ role: role.toLowerCase() }, '-password');

        if (!users || users.length === 0) {
            return res.status(404).json({
                message: `No users found with role '${role}'.`
            });
        }

        res.status(200).json({
            message: `Users with role '${role}' retrieved successfully.`,
            count: users.length,
            role: role.toLowerCase(),
            users: users
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Alternative version if you want to use query parameters instead of route parameters
const getUsersByRoleQuery = async (req, res) => {
    const { role } = req.query;

    // If no role specified, return all users
    if (!role) {
        return getAllUsers(req, res);
    }

    // Validate role value
    const validRoles = ['admin', 'user'];
    if (!validRoles.includes(role.toLowerCase())) {
        return res.status(400).json({
            message: "Invalid role. Role must be either 'admin' or 'user'."
        });
    }

    try {
        // Find users by role, excluding password field
        const users = await User.find({ role: role.toLowerCase() }, '-password');

        if (!users || users.length === 0) {
            return res.status(404).json({
                message: `No users found with role '${role}'.`
            });
        }

        res.status(200).json({
            message: `Users with role '${role}' retrieved successfully.`,
            count: users.length,
            role: role.toLowerCase(),
            users: users
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = {
    getAllUsers,
    getUsersByRole,
    getUsersByRoleQuery
};