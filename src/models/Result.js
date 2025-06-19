const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    confidence: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    prediction: {
        type: String,
        required: true,
        trim: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true // This adds createdAt and updatedAt automatically
});

// Index for better query performance
resultSchema.index({ prediction: 1 });
resultSchema.index({ createdAt: -1 });
resultSchema.index({ confidence: -1 });

module.exports = mongoose.model('Result', resultSchema);