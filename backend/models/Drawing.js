const mongoose = require('mongoose');

const DrawingSchema = new mongoose.Schema({
  title: { type: String, default: 'Untitled Drawing' },
  owner: { type: String, required: true }, // user id or 'guest'
  imageUrl: { type: String, required: true }, // Cloudinary or base64
  canvasData: { type: String }, // JSON representation of the Fabric.js canvas
  versionHistory: [
    {
      imageUrl: String,
      canvasData: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  isPublic: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Drawing || mongoose.model('Drawing', DrawingSchema);
