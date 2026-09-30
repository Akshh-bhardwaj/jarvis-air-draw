const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const mongoose = require('mongoose');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret_aircanvas_jwt_token_key_12345';

// In-memory fallback if MongoDB is not connected
const mockUsers = [];

// Helper to hash password
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

// Register
router.post('/register', async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const hashedPassword = hashPassword(password);

  // If MongoDB is connected
  if (mongoose.connection.readyState === 1) {
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: 'User already exists' });
      }

      const user = new User({
        email,
        name: name || email.split('@')[0],
        password: hashedPassword
      });
      await user.save();

      const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      return res.status(201).json({
        token,
        user: { id: user._id, email: user.email, name: user.name }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error registering user' });
    }
  } else {
    // In-memory register
    const existingUser = mockUsers.find(u => u.email === email);
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists (in-memory)' });
    }

    const newUser = {
      _id: `mock_user_${Date.now()}`,
      email,
      name: name || email.split('@')[0],
      password: hashedPassword
    };
    mockUsers.push(newUser);

    const token = jwt.sign({ id: newUser._id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({
      token,
      user: { id: newUser._id, email: newUser.email, name: newUser.name }
    });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const hashedPassword = hashPassword(password);

  if (mongoose.connection.readyState === 1) {
    try {
      const user = await User.findOne({ email });
      if (!user || user.password !== hashedPassword) {
        return res.status(400).json({ message: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        token,
        user: { id: user._id, email: user.email, name: user.name }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error logging in' });
    }
  } else {
    // In-memory login
    const user = mockUsers.find(u => u.email === email && u.password === hashedPassword);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials (in-memory)' });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name }
    });
  }
});

// Google login mock/verify
router.post('/google', async (req, res) => {
  const { credential, name, email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Google Auth details incomplete' });
  }

  if (mongoose.connection.readyState === 1) {
    try {
      let user = await User.findOne({ email });
      if (!user) {
        user = new User({
          email,
          name: name || email.split('@')[0],
          googleId: credential || `google_${Date.now()}`
        });
        await user.save();
      }

      const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({
        token,
        user: { id: user._id, email: user.email, name: user.name }
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: 'Server error verifying Google Login' });
    }
  } else {
    // In-memory Google Auth
    let user = mockUsers.find(u => u.email === email);
    if (!user) {
      user = {
        _id: `mock_google_user_${Date.now()}`,
        email,
        name: name || email.split('@')[0],
        googleId: credential || `google_${Date.now()}`
      };
      mockUsers.push(user);
    }

    const token = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({
      token,
      user: { id: user._id, email: user.email, name: user.name }
    });
  }
});

// Verify token
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (mongoose.connection.readyState === 1) {
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.json({ user: { id: user._id, email: user.email, name: user.name } });
    } else {
      const user = mockUsers.find(u => u._id === decoded.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found (in-memory)' });
      }
      return res.json({ user: { id: user._id, email: user.email, name: user.name } });
    }
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
});

module.exports = router;
