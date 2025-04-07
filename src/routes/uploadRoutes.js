// routes/uploadRoutes.js
const express = require('express');
const { upload, uploadImage } = require('../controllers/imageUploadController');
const router = express.Router();

// Route to handle image upload
router.post('/image', upload.single('image'), uploadImage);

module.exports = router;