const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String },
  googleId: { type: String },
  password: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Avoid model compilation error in hot-reloads
module.exports = mongoose.models.User || mongoose.model('User', UserSchema);
