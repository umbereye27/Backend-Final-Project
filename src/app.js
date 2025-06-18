const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const authRoutes = require('../src/routes/authRoutes');
const resultRoutes = require('../src/routes/resultRoutes');
const userRoutes = require('../src/routes/userRoutes');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001; // Changed to 5000 to avoid conflict with typical frontend ports

// Comprehensive CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000',   // React default
    'http://localhost:5173',   // Vite default
    'http:// 172.20.10.4',   // Localhost alternative
    'http://localhost:8080'    // Another common port
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/users', userRoutes);
// MongoDB Connection with improved error handling
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => {
    console.log('✅ Connected to MongoDB');

    // Start server only after database connection
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch(err => {
    console.error('❌ MongoDB Connection Failed:', err);
    process.exit(1); // Exit process with failure
  });
app.get('/', (req, res) => {
  res.json({ message: "Your Welcome to POX Api" })
})
// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'production' ? {} : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

module.exports = app;