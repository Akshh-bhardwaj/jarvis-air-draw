import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { useAppStore } from '../store/AppStore';
import { useSocket } from '../hooks/useSocket';
import { drawStrokeOnCanvas } from '../utils/drawingPhysics';
import { detectAndCorrectShape } from '../utils/shapeCorrector';
import { classifyDrawing, initTFClassifier } from '../utils/drawingClassifier';
import { jarvis } from '../utils/voiceFeedback';
import { drawShapeFromVoice } from '../utils/shapeGenerator';
import type { DrawingPoint, StrokeData, BrushType, GestureType } from '../types';

interface DrawingCanvasProps {
  videoWidth: number;
  videoHeight: number;
}

// Human-readable labels shown in the HUD when a gesture is detected
const GESTURE_LABELS: Partial<Record<GestureType, string>> = {
  DRAW:           '☝️  Drawing',
  ERASER:         '✋  Eraser',
  CURSOR_MOVE:    '✌️  Moving',
  UNDO:           '↩️  Undo',
  REDO:           '↪️  Redo',
  SAVE:           '👍  Saving',
  CLEAR_CANVAS:   '✊  Hold to Clear',
  PALETTE_CHANGE: '🖐️  Palette',
  PAUSE:          '🤚  Pause',
};

// Cursor dot style per gesture
const CURSOR_STYLES: Record<string, { color: string; scale: number; glow: boolean }> = {
  DRAW:           { color: '',        scale: 1.0, glow: true  }, // overridden with brushColor
  ERASER:         { color: '#FF4444', scale: 1.5, glow: false },
  CURSOR_MOVE:    { color: '#FFFFFF', scale: 0.8, glow: false },
  UNDO:           { color: '#FFD700', scale: 1.2, glow: true  },
  REDO:           { color: '#FFD700', scale: 1.2, glow: true  },
  SAVE:           { color: '#00FF88', scale: 1.3, glow: true  },
  CLEAR_CANVAS:   { color: '#FF3333', scale: 1.6, glow: true  },
  PALETTE_CHANGE: { color: '#A855F7', scale: 1.2, glow: true  },
  PAUSE:          { color: '#64748B', scale: 0.7, glow: false },
  NONE:           { color: '#64748B', scale: 0.5, glow: false },
};

export const DrawingCanvas: React.FC<DrawingCanvasProps> = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // ── Zustand state ──────────────────────────────────────────────────────────
  const brushColor    = useAppStore((s) => s.brushColor);
  const brushSize     = useAppStore((s) => s.brushSize);
  const activeBrush   = useAppStore((s) => s.activeBrush);
  const activeTool    = useAppStore((s) => s.activeTool);
  const is3DMode      = useAppStore((s) => s.is3DMode);
  const cursorLeft    = useAppStore((s) => s.cursorLeft);
  const cursorRight   = useAppStore((s) => s.cursorRight);
  const gestureLeft   = useAppStore((s) => s.gestureLeft);
  const gestureRight  = useAppStore((s) => s.gestureRight);
  const isCollaborating = useAppStore((s) => s.isCollaborating);
  const token         = useAppStore((s) => s.token);
  const currentDrawingId   = useAppStore((s) => s.currentDrawingId);
  const setCurrentDrawingId = useAppStore((s) => s.setCurrentDrawingId);

  // ── Collaboration ──────────────────────────────────────────────────────────
  const { sendStroke, sendCursorMove, registerStrokeHandler } = useSocket();

  // ── Drawing state ──────────────────────────────────────────────────────────
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeRef  = useRef<DrawingPoint[]>([]);
  const strokeHistoryRef  = useRef<{ stroke: DrawingPoint[]; color: string; size: number; brush: BrushType }[]>([]);
  const redoStackRef      = useRef<{ stroke: DrawingPoint[]; color: string; size: number; brush: BrushType }[]>([]);

  // ── Gesture / timer refs ───────────────────────────────────────────────────
  const [clearProgress, setClearProgress] = useState(0);
  const fistTimerRef                  = useRef<any>(null);
  const lastSaveTimeRef               = useRef<number>(0);
  const lastUndoTimeRef               = useRef<number>(0);
  const lastRedoTimeRef               = useRef<number>(0);
  const consecutiveNonDrawFramesRef   = useRef<number>(0);

  // ── AI classification badge ────────────────────────────────────────────────
  const [classification, setClassification] = useState<{ className: string; confidence: number } | null>(null);

  // ── Gesture HUD ────────────────────────────────────────────────────────────
  const [gestureLabel, setGestureLabel] = useState<string>('');
  const gestureLabelTimerRef = useRef<any>(null);
  const prevGestureRef = useRef<GestureType>('NONE');

  // ── Init TF.js ─────────────────────────────────────────────────────────────
  useEffect(() => { initTFClassifier(); }, []);

  // ── Redraw full canvas from stroke history ─────────────────────────────────
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokeHistoryRef.current.forEach((item) =>
      drawStrokeOnCanvas(ctx, item.stroke, item.color, item.size, item.brush)
    );
    if (isDrawing && currentStrokeRef.current.length > 0) {
      drawStrokeOnCanvas(ctx, currentStrokeRef.current, brushColor, brushSize, activeBrush);
    }
  }, [isDrawing, brushColor, brushSize, activeBrush]);

  // ── Voice "clear" event fix ────────────────────────────────────────────────
  // App.tsx dispatches this CustomEvent but nothing was listening — fixed here.
  useEffect(() => {
    const handleVoiceClear = () => {
      strokeHistoryRef.current = [];
      redoStackRef.current = [];
      redrawCanvas();
      jarvis.clear();
    };
    window.addEventListener('aircanvas:clear', handleVoiceClear);
    return () => window.removeEventListener('aircanvas:clear', handleVoiceClear);
  }, [redrawCanvas]);

  // ── Voice shape drawing ───────────────────────────────────────────────────
  useEffect(() => {
    const handleVoiceShape = (event: CustomEvent<{ command: string }>) => {
      // Helper to add a shape stroke to the canvas
      const addShape = (points: DrawingPoint[], color: string, size: number, brush: string) => {
        // Convert normalized points to actual screen coordinates
        const canvas = canvasRef.current;
        if (!canvas) return;
        const scaledPoints = points.map(p => ({
          x: p.x * canvas.width,
          y: p.y * canvas.height,
          pressure: 1
        }));
        strokeHistoryRef.current.push({
          stroke: scaledPoints,
          color,
          size,
          brush: brush as BrushType
        });
        redrawCanvas();

        // Trigger shape-correction confetti (because we drew a perfect shape)
        confetti({
          particleCount: 40,
          angle: 60,
          spread: 55,
          origin: { x: 0 }
        });
        confetti({
          particleCount: 40,
          angle: 120,
          spread: 55,
          origin: { x: 1 }
        });
      };

      drawShapeFromVoice(
        event.detail.command,
        addShape,
        brushColor,
        brushSize
      );
    };

    // @ts-ignore — custom event detail
    window.addEventListener('aircanvas:shape', handleVoiceShape);
    // @ts-ignore
    return () => window.removeEventListener('aircanvas:shape', handleVoiceShape);
  }, [brushColor, brushSize, redrawCanvas]);

  // ── Gesture HUD: flash label when gesture changes ──────────────────────────
  useEffect(() => {
    const activeGesture = (cursorRight ? gestureRight : gestureLeft) as GestureType;
    if (activeGesture !== prevGestureRef.current && activeGesture !== 'NONE') {
      const label = GESTURE_LABELS[activeGesture];
      if (label) {
        setGestureLabel(label);
        if (gestureLabelTimerRef.current) clearTimeout(gestureLabelTimerRef.current);
        gestureLabelTimerRef.current = setTimeout(() => setGestureLabel(''), 1200);
      }
    }
    prevGestureRef.current = activeGesture;
  }, [gestureLeft, gestureRight, cursorRight]);

  // ── Resize handler ─────────────────────────────────────────────────────────
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      redrawCanvas();
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [redrawCanvas]);

  // ── Remote stroke sync (collaboration) ────────────────────────────────────
  useEffect(() => {
    registerStrokeHandler((strokeData: StrokeData) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const points = strokeData.points.map(p => ({
        x: p.x * canvas.width,
        y: p.y * canvas.height,
        pressure: p.pressure
      }));
      drawStrokeOnCanvas(ctx, points, strokeData.color, strokeData.brushSize, strokeData.brushType);
      if (strokeData.isLastPoint) {
        strokeHistoryRef.current.push({
          stroke: points,
          color:  strokeData.color,
          size:   strokeData.brushSize,
          brush:  strokeData.brushType
        });
      }
    });
  }, [registerStrokeHandler]);

  // ── Save drawing ───────────────────────────────────────────────────────────
  const saveDrawing = useCallback(async () => {
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 4000) return;
    lastSaveTimeRef.current = now;
    const canvas = canvasRef.current;
    if (!canvas) return;
    confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 } });
    try {
      const imageBase64 = canvas.toDataURL('image/png');
      const backendUrl  = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
      const response = await fetch(`${backendUrl}/api/drawings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          title: `Sketch_${new Date().toLocaleTimeString()}`,
          imageBase64,
          canvasData: JSON.stringify(strokeHistoryRef.current),
          drawingId: currentDrawingId || undefined
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.drawing?._id) setCurrentDrawingId(data.drawing._id);
        jarvis.saved();
      }
    } catch (e) {
      console.error('Error auto-saving:', e);
    }
  }, [token, currentDrawingId, setCurrentDrawingId]);

  // ── Undo ───────────────────────────────────────────────────────────────────
  const undo = useCallback(() => {
    const now = Date.now();
    if (now - lastUndoTimeRef.current < 400) return;
    lastUndoTimeRef.current = now;
    if (strokeHistoryRef.current.length > 0) {
      const undone = strokeHistoryRef.current.pop();
      if (undone) { redoStackRef.current.push(undone); redrawCanvas(); jarvis.undo(); }
    }
  }, [redrawCanvas]);

  // ── Redo ───────────────────────────────────────────────────────────────────
  const redo = useCallback(() => {
    const now = Date.now();
    if (now - lastRedoTimeRef.current < 400) return;
    lastRedoTimeRef.current = now;
    if (redoStackRef.current.length > 0) {
      const redone = redoStackRef.current.pop();
      if (redone) { strokeHistoryRef.current.push(redone); redrawCanvas(); jarvis.redo(); }
    }
  }, [redrawCanvas]);

  // ── Main gesture input loop ────────────────────────────────────────────────
  useEffect(() => {
    if (activeTool !== 'draw' && activeTool !== 'laser') return;
    if (is3DMode) return;

    const cursor  = cursorRight || cursorLeft;
    const gesture = cursorRight ? gestureRight : gestureLeft;
    const canvas  = canvasRef.current;

    if (!canvas || !cursor) {
      if (isDrawing) {
        setIsDrawing(false);
        if (currentStrokeRef.current.length > 0) handleStrokeEnd();
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const x = cursor.x * canvas.width;
    const y = cursor.y * canvas.height;

    if (isCollaborating) sendCursorMove({ x: cursor.x, y: cursor.y });

    // DRAW gesture
    if (gesture === 'DRAW') {
      consecutiveNonDrawFramesRef.current = 0;
      const pt = { x, y, pressure: cursor.z };
      if (!isDrawing) {
        setIsDrawing(true);
        currentStrokeRef.current = [pt];
        if (isCollaborating) sendStroke({ type: 'freehand', points: [{ x: cursor.x, y: cursor.y, pressure: cursor.z }], color: brushColor, brushSize, brushType: activeBrush, isFirstPoint: true, isLastPoint: false });
      } else {
        currentStrokeRef.current.push(pt);
        const len = currentStrokeRef.current.length;
        if (len > 1) drawStrokeOnCanvas(ctx, currentStrokeRef.current.slice(len - 2), brushColor, brushSize, activeBrush);
        if (isCollaborating) sendStroke({ type: 'freehand', points: [{ x: cursor.x, y: cursor.y, pressure: cursor.z }], color: brushColor, brushSize, brushType: activeBrush, isFirstPoint: false, isLastPoint: false });
      }
    }
    // ERASER gesture
    else if (gesture === 'ERASER') {
      consecutiveNonDrawFramesRef.current = 0;
      const pt = { x, y };
      if (!isDrawing) { setIsDrawing(true); currentStrokeRef.current = [pt]; }
      else {
        currentStrokeRef.current.push(pt);
        const len = currentStrokeRef.current.length;
        if (len > 1) drawStrokeOnCanvas(ctx, currentStrokeRef.current.slice(len - 2), '#000000', brushSize, 'eraser');
      }
    }
    // Any other gesture — end current stroke
    else {
      if (isDrawing) {
        consecutiveNonDrawFramesRef.current += 1;
        if (consecutiveNonDrawFramesRef.current >= 4) {
          setIsDrawing(false);
          handleStrokeEnd();
          consecutiveNonDrawFramesRef.current = 0;
        }
      }
    }

    // Fist hold → clear canvas
    if (gestureLeft === 'CLEAR_CANVAS' || gestureRight === 'CLEAR_CANVAS') {
      if (!fistTimerRef.current) {
        const startTime = Date.now();
        fistTimerRef.current = setInterval(() => {
          const elapsed  = Date.now() - startTime;
          const progress = Math.min(100, (elapsed / 1500) * 100);
          setClearProgress(progress);
          if (progress >= 100) {
            strokeHistoryRef.current = [];
            redoStackRef.current = [];
            redrawCanvas();
            jarvis.clear();
            clearInterval(fistTimerRef.current!);
            fistTimerRef.current = null;
            setClearProgress(0);
          }
        }, 50);
      }
    } else {
      if (fistTimerRef.current) { clearInterval(fistTimerRef.current); fistTimerRef.current = null; setClearProgress(0); }
    }

    if (gesture === 'UNDO')  undo();
    if (gesture === 'REDO')  redo();
    if (gesture === 'SAVE')  saveDrawing();
  }, [cursorRight, cursorLeft, gestureRight, gestureLeft, isDrawing, brushColor, brushSize, activeBrush, activeTool, is3DMode, isCollaborating, saveDrawing, undo, redo, redrawCanvas]);

  // ── Stroke end: shape correction + AI classification ──────────────────────
  const handleStrokeEnd = async () => {
    if (currentStrokeRef.current.length === 0) return;
    const finalPoints = [...currentStrokeRef.current];
    currentStrokeRef.current = [];
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isEraser = activeBrush === 'eraser' || gestureRight === 'ERASER' || gestureLeft === 'ERASER';

    if (!isEraser) {
      const corrected = detectAndCorrectShape(finalPoints);
      strokeHistoryRef.current.push(
        corrected
          ? { stroke: corrected.points, color: brushColor, size: brushSize, brush: activeBrush }
          : { stroke: finalPoints,       color: brushColor, size: brushSize, brush: activeBrush }
      );
      if (corrected) {
        confetti({ particleCount: 40, angle: 60,  spread: 55, origin: { x: 0 } });
        confetti({ particleCount: 40, angle: 120, spread: 55, origin: { x: 1 } });
      }
      // AI classification
      try {
        const prediction  = await classifyDrawing(finalPoints, canvas);
        const confidence  = Math.round(prediction.probability * 100);
        setClassification({ className: prediction.className, confidence });
        jarvis.classified(prediction.className, confidence);
        setTimeout(() => setClassification(null), 3500);
      } catch (err) { console.error(err); }
    } else {
      strokeHistoryRef.current.push({ stroke: finalPoints, color: '#000000', size: brushSize * 3, brush: 'eraser' });
    }

    redoStackRef.current = [];

    if (isCollaborating) {
      const normalizedPoints = finalPoints.map(p => ({ x: p.x / canvas.width, y: p.y / canvas.height, pressure: p.pressure }));
      sendStroke({ type: isEraser ? 'eraser' : 'freehand', points: normalizedPoints, color: isEraser ? '#000000' : brushColor, brushSize: isEraser ? brushSize * 3 : brushSize, brushType: isEraser ? 'eraser' : activeBrush, isFirstPoint: false, isLastPoint: true });
    }

    redrawCanvas();
  };

  // ── Active cursor + gesture for rendering ─────────────────────────────────
  const activeCursor  = cursorRight || cursorLeft;
  const activeGesture = ((cursorRight ? gestureRight : gestureLeft) || 'NONE') as GestureType;
  const cursorStyle   = CURSOR_STYLES[activeGesture] ?? CURSOR_STYLES['NONE'];
  const cursorColor   = activeGesture === 'DRAW' ? brushColor : cursorStyle.color;

  return (
    <div className="absolute inset-0 select-none overflow-hidden">

      {/* ── Drawing canvas ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 block z-10 touch-none pointer-events-none"
      />

      {/* ── Animated hand cursor dot ─────────────────────────────────────────
           Follows the index finger tip in real-time, changes colour + scale
           based on the current gesture so the user knows what mode they're in. */}
      {activeCursor && (
        <motion.div
          className="pointer-events-none absolute z-20 rounded-full"
          style={{
            left:      `${activeCursor.x * 100}%`,
            top:       `${activeCursor.y * 100}%`,
            width:     20,
            height:    20,
            marginLeft: -10,
            marginTop:  -10,
            background: cursorColor,
            boxShadow:  cursorStyle.glow
              ? `0 0 14px ${cursorColor}, 0 0 28px ${cursorColor}66`
              : 'none',
          }}
          animate={{
            scale:   cursorStyle.scale,
            opacity: activeGesture === 'NONE' ? 0.25 : 1,
          }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      )}

      {/* ── Gesture HUD label ─────────────────────────────────────────────────
           Flashes the human-readable gesture name just below the cursor
           whenever the gesture changes, so the user can see what was detected. */}
      <AnimatePresence>
        {gestureLabel && activeCursor && (
          <motion.div
            key={gestureLabel}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute z-30"
            style={{
              left:      `${activeCursor.x * 100}%`,
              top:       `calc(${activeCursor.y * 100}% + 22px)`,
              transform: 'translateX(-50%)',
            }}
          >
            <div className="px-3 py-1 rounded-full bg-slate-900/85 border border-white/10 text-white text-xs font-semibold font-display shadow-lg backdrop-blur-sm whitespace-nowrap">
              {gestureLabel}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Fist hold → clear progress ring ──────────────────────────────────── */}
      {clearProgress > 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 flex flex-col items-center justify-center p-6 rounded-2xl glass-panel text-white">
          <div className="relative w-24 h-24 flex items-center justify-center">
            <svg className="absolute w-full h-full -rotate-90">
              <circle cx="48" cy="48" r="38" className="stroke-white/10" strokeWidth="6" fill="transparent" />
              <circle cx="48" cy="48" r="38" className="stroke-red-500 transition-all duration-75" strokeWidth="6" fill="transparent"
                strokeDasharray="239" strokeDashoffset={239 - (239 * clearProgress) / 100} />
            </svg>
            <span className="text-xl font-bold font-display text-red-400">✊</span>
          </div>
          <span className="text-sm mt-3 text-slate-300 font-medium">Hold to clear canvas…</span>
        </div>
      )}

      {/* ── AI classification badge ───────────────────────────────────────────── */}
      {classification && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3 rounded-full glass-panel border-cyan-500/20 shadow-lg text-white accent-glow-effect animate-bounce">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
          <span className="text-sm font-semibold tracking-wide font-display text-cyan-300">
            Detected: {classification.className} ({classification.confidence}%)
          </span>
        </div>
      )}
    </div>
  );
};
