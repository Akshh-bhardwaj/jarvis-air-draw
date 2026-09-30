const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Drawing = require('../models/Drawing');
const { uploadToCloudinary } = require('../config/cloudinary');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_aircanvas_jwt_token_key_12345';

// In-memory fallback if MongoDB is not connected
const mockDrawings = [];

// Middleware to protect routes & extract user ID
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.userId = 'guest';
    return next();
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (error) {
    req.userId = 'guest';
    next();
  }
};

// Save a new drawing or a new version of an existing drawing
router.post('/', authenticate, async (req, res) => {
  const { title, imageBase64, canvasData, drawingId } = req.body;

  if (!imageBase64) {
    return res.status(400).json({ message: 'Image content is required' });
  }

  try {
    // Upload image to Cloudinary (or mock fallback)
    const filename = `drawing_${Date.now()}`;
    const uploadRes = await uploadToCloudinary(imageBase64, filename);
    const imageUrl = uploadRes.secure_url;

    if (mongoose.connection.readyState === 1) {
      if (drawingId && mongoose.Types.ObjectId.isValid(drawingId)) {
        // Update existing drawing version history
        const drawing = await Drawing.findById(drawingId);
        if (drawing) {
          // Push old version
          drawing.versionHistory.push({
            imageUrl: drawing.imageUrl,
            canvasData: drawing.canvasData,
            timestamp: new Date()
          });
          // Update current state
          drawing.imageUrl = imageUrl;
          drawing.canvasData = canvasData ? JSON.stringify(canvasData) : drawing.canvasData;
          drawing.title = title || drawing.title;
          await drawing.save();
          return res.status(200).json({ message: 'Drawing updated successfully', drawing });
        }
      }

      // Create new drawing
      const newDrawing = new Drawing({
        title: title || 'Untitled Drawing',
        owner: req.userId,
        imageUrl,
        canvasData: canvasData ? JSON.stringify(canvasData) : '',
        versionHistory: []
      });
      await newDrawing.save();
      return res.status(201).json({ message: 'Drawing saved successfully', drawing: newDrawing });
    } else {
      // In-memory fallback
      if (drawingId) {
        const drawingIdx = mockDrawings.findIndex(d => d._id === drawingId);
        if (drawingIdx !== -1) {
          const drawing = mockDrawings[drawingIdx];
          drawing.versionHistory.push({
            imageUrl: drawing.imageUrl,
            canvasData: drawing.canvasData,
            timestamp: new Date()
          });
          drawing.imageUrl = imageUrl;
          drawing.canvasData = canvasData ? JSON.stringify(canvasData) : drawing.canvasData;
          drawing.title = title || drawing.title;
          return res.status(200).json({ message: 'Drawing updated successfully (in-memory)', drawing });
        }
      }

      const newDrawing = {
        _id: `mock_draw_${Date.now()}`,
        title: title || 'Untitled Drawing',
        owner: req.userId,
        imageUrl,
        canvasData: canvasData ? JSON.stringify(canvasData) : '',
        versionHistory: [],
        createdAt: new Date()
      };
      mockDrawings.push(newDrawing);
      return res.status(201).json({ message: 'Drawing saved successfully (in-memory)', drawing: newDrawing });
    }
  } catch (error) {
    console.error('Error saving drawing:', error);
    return res.status(500).json({ message: 'Server error saving drawing' });
  }
});

// Get user's drawings
router.get('/', authenticate, async (req, res) => {
  if (req.userId === 'guest') {
    return res.json([]);
  }

  if (mongoose.connection.readyState === 1) {
    try {
      const drawings = await Drawing.find({ owner: req.userId }).sort({ createdAt: -1 });
      return res.json(drawings);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error fetching drawings' });
    }
  } else {
    // In-memory list
    const drawings = mockDrawings
      .filter(d => d.owner === req.userId)
      .sort((a, b) => b.createdAt - a.createdAt);
    return res.json(drawings);
  }
});

// Delete a drawing
router.delete('/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  if (mongoose.connection.readyState === 1) {
    try {
      const drawing = await Drawing.findById(id);
      if (!drawing) {
        return res.status(404).json({ message: 'Drawing not found' });
      }
      if (drawing.owner !== req.userId && req.userId !== 'guest') {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      await Drawing.findByIdAndDelete(id);
      return res.json({ message: 'Drawing deleted successfully' });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error deleting drawing' });
    }
  } else {
    // In-memory delete
    const drawingIdx = mockDrawings.findIndex(d => d._id === id);
    if (drawingIdx === -1) {
      return res.status(404).json({ message: 'Drawing not found (in-memory)' });
    }
    const drawing = mockDrawings[drawingIdx];
    if (drawing.owner !== req.userId && req.userId !== 'guest') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    mockDrawings.splice(drawingIdx, 1);
    return res.json({ message: 'Drawing deleted successfully (in-memory)' });
  }
});

module.exports = router;
