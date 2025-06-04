const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const User = require("../models/Users");
require("dotenv").config();

// Configure Nodemailer

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: `${process.env.EMAIL_USER}`,
    pass: `${process.env.EMAIL_PASS}`,
  },
});

// Send Signup Email
const sendSignupEmail = (userEmail, username) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: userEmail,
    subject: "Signup Successful - Welcome!",
    text: `Hi ${username},\n\nYou have successfully signed up!\n\nPlease log in to your account.\n\nKeep your credentials safe.\n`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) console.log("Error sending email: ", error);
    else console.log("Email sent: " + info.response);
  });
};

// SignUp Function
const signUp = async (req, res) => {
  const { username, password, confirmPassword, email, role } = req.body;
  console.log(req.body);
  // Validate input fields
  if (!username || !password || !confirmPassword || !email) {
    return res.status(400).json({ message: "All fields are required." });
  }

  // Check password confirmation
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match." });
  }

  // Validate password strength
  const passwordRegex =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  if (!passwordRegex.test(password)) {
    return res.status(400).json({
      message:
        "Password must be at least 8 characters long and include uppercase, lowercase, number, and special character.",
    });
  }

  try {
    // Check for existing user by username or email
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    console.log("User", existingUser);

    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Username or email already exists." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new User({
      username,
      password: hashedPassword,
      email,
      role: role || "user",
    });

    await newUser.save();

    // Send signup email
    sendSignupEmail(email, username);

    res.status(201).json({ message: "User signed up successfully." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// SignIn Function (Corrected to use email)
const signIn = async (req, res) => {
  const { email, password } = req.body;
  console.log(req.body);

  // Validate input fields
  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required.",
      fields: {
        email: email ? "Provided" : "Missing",
        password: password ? "Provided" : "Missing",
      },
    });
  }

  try {
    // Find user by email
    const user = await User.findOne({ email });

    // Check if user exists
    if (!user) {
      return res.status(404).json({
        message: "User not found.",
        details: "No account associated with this email exists.",
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);

    // Check password match
    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid credentials.",
        details: "The password you entered is incorrect.",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Successful login response
    res.status(200).json({
      message: "User signed in successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Signin error:", err);
    res.status(500).json({
      message: "Internal server error",
      details: err.message,
    });
  }
};
// Password Reset Request Function
const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    const user = await User.findOne({ email });
    if (!user)
      return res
        .status(404)
        .json({ message: "No account found with this email." });

    // Generate reset token
    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });

    // Send password reset email
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Password Reset Request",
      html: `
        <p>You requested a password reset.</p>
        <p>Click the link below to reset your password (valid for 15 minutes):</p>
        <a href="${resetLink}">Reset Password</a>
      `,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("Error sending reset email: ", error);
        return res.status(500).json({ message: "Error sending reset email." });
      }
      res
        .status(200)
        .json({ message: "Password reset link sent to your email." });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Reset Password Function
const resetPassword = async (req, res) => {
  const { token, newPassword, confirmNewPassword } = req.body;

  if (!token || !newPassword || !confirmNewPassword) {
    return res.status(400).json({ message: "All fields are required." });
  }

  if (newPassword !== confirmNewPassword) {
    return res.status(400).json({ message: "Passwords do not match." });
  }

  try {
    // Verify reset token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) return res.status(404).json({ message: "User not found." });

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ message: "Password reset successfully." });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(400).json({ message: "Reset token has expired." });
    }
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  signUp,
  signIn,
  forgotPassword,
  resetPassword,
};
