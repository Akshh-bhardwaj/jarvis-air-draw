# AirCanvas AI - Spatial Creative Drawing & Whiteboard

AirCanvas AI is a production-quality, low-latency spatial drawing and whiteboard application that allows users to create art in 2D and 3D spaces using webcam hand gestures. The experience is designed to match the futuristic feel of Apple Vision Pro interactions.

## 🚀 Key Features

* **Real-time Webcam Hand Tracking**: Processes camera feed with less than 40ms latency to track 21 landmarks of up to two hands simultaneously.
* **Apple Vision Air Gestures**:
  * ☝️ **Index finger extended**: Draw on canvas.
  * ✌️ **Victory Sign (V-Shape)**: Trigger Undo.
  * 👌 **OK Sign**: Trigger Redo.
  * ✊ **Closed Fist**: Clear canvas (held for 1.5 seconds with visual progress indicator).
  * 👍 **Thumb Up**: Save / download sketch.
  * 🖐️ **Open Palm**: Pause canvas rendering.
  * 🎛️ **Four fingers extended**: Cycle color palettes.
* **Dynamic Brushes**: Support for Neon glow lines, variable speed-based Calligraphy strokes, Highlighter opacity blending, Spray paint dots, and Sketch pencils.
* **Whiteboard Mode (Fabric.js)**: Move, resize, rotate, duplicate, and delete shapes, sticky notes, and text boxes.
* **3D Mode (Three.js)**: Convert drawing paths with simulated hand depth into persistent 3D tubes. Supports OrbitControls and exporting the 3D sculpt to **GLTF meshes**.
* **Real-time Collaboration**: Multi-user rooms with Socket.io syncing drawing strokes, cursors, and whiteboard objects.
* **AI Drawings Classification**: TensorFlow.js predicts freehand sketches (e.g. Star, Heart, Cat, Tree) with confidence scores.
* **OCR Handwriting Scan**: Extract text from drawings using Tesseract.js client-side OCR.
* **Multiple Themes**: Eclipse Dark, Alabaster Light, Neon Cyberpunk, and Emerald Matrix.

## 🛠️ Project Structure

```
jarvis-air-draw/
├── backend/                  # Express API & Socket.io server
│   ├── config/               # DB, Cloudinary connection setups
│   ├── controllers/          # Business logic
│   ├── models/               # MongoDB user and drawing schemas
│   ├── routes/               # API endpoints
│   └── package.json
└── frontend/                 # Vite React-TS client
    ├── src/
    │   ├── components/       # Interface panels (toolbar, sidebar, 3D, webcam preview)
    │   ├── hooks/            # Custom hooks (hand tracking, webcam stream, socket updates)
    │   ├── store/            # Zustand state manager
    │   └── utils/            # Physics, shape correction, tfjs, ocr models
    └── package.json
```

## ⚙️ Running Locally

1. **Install Dependencies** (Installs root wrappers, frontend, and backend packages):
   ```bash
   npm install
   ```

2. **Configure Environment Variables** (Optional, falls back to mock/offline modes out-of-the-box):
   * Edit `backend/.env` to configure Port, MongoDB URI, JWT keys, Cloudinary tokens, and Google Client IDs.

3. **Start Development Servers** (Runs Express API and Vite Dev concurrently):
   ```bash
   npm run dev
   ```
   Open your browser at `http://localhost:5173`.
