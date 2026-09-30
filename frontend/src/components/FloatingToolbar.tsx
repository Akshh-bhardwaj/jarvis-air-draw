import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Paintbrush, 
  MousePointer, 
  Square, 
  StickyNote, 
  Type, 
  Camera, 
  CameraOff, 
  Settings, 
  Box, 
  Palette,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import type { BrushType, ToolType, ShapeType } from '../types';

export const FloatingToolbar: React.FC = () => {
  // Zustand State
  const activeTool = useAppStore((state) => state.activeTool);
  const setActiveTool = useAppStore((state) => state.setActiveTool);
  const activeBrush = useAppStore((state) => state.activeBrush);
  const setActiveBrush = useAppStore((state) => state.setActiveBrush);
  const brushColor = useAppStore((state) => state.brushColor);
  const setBrushColor = useAppStore((state) => state.setBrushColor);
  const brushSize = useAppStore((state) => state.brushSize);
  const setBrushSize = useAppStore((state) => state.setBrushSize);
  const activeShape = useAppStore((state) => state.activeShape);
  const setActiveShape = useAppStore((state) => state.setActiveShape);
  
  const is3DMode = useAppStore((state) => state.is3DMode);
  const set3DMode = useAppStore((state) => state.set3DMode);
  const isCameraOn = useAppStore((state) => state.isCameraOn);
  const setCameraOn = useAppStore((state) => state.setCameraOn);
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const showLandmarks = useAppStore((state) => state.showLandmarks);
  const setShowLandmarks = useAppStore((state) => state.setShowLandmarks);
  
  // Local dropdown toggle states
  const [showBrushSelector, setShowBrushSelector] = useState(false);
  const [showShapeSelector, setShowShapeSelector] = useState(false);
  const [showColorSelector, setShowColorSelector] = useState(false);

  // Predefined gorgeous colors
  const colorsList = [
    '#00F0FF', // Cyan
    '#FF007A', // Pink
    '#39FF14', // Green
    '#FFEF00', // Yellow
    '#AA3BFF', // Purple
    '#FF5E00', // Orange
    '#FFFFFF', // White
  ];

  // Brushes listing
  const brushesList: { type: BrushType; label: string; icon: string }[] = [
    { type: 'pencil', label: 'Sketch Pencil', icon: '✏️' },
    { type: 'marker', label: 'Solid Marker', icon: '🖊️' },
    { type: 'neon', label: 'Neon Glow', icon: '✨' },
    { type: 'highlighter', label: 'Highlighter', icon: '🖍️' },
    { type: 'spray', label: 'Spray Paint', icon: '💨' },
    { type: 'calligraphy', label: 'Calligraphy', icon: '🖋️' },
    { type: 'eraser', label: 'Standard Eraser', icon: '🧽' },
  ];

  const shapesList: { type: ShapeType; label: string }[] = [
    { type: 'circle', label: 'Circle' },
    { type: 'rectangle', label: 'Rectangle' },
    { type: 'triangle', label: 'Triangle' },
  ];

  const handleToolClick = (tool: ToolType) => {
    setActiveTool(tool);
    setShowBrushSelector(tool === 'draw');
    setShowShapeSelector(tool === 'shape');
    setShowColorSelector(false);
  };

  return (
    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-30 flex flex-col items-center gap-2 select-none">
      {/* Primary Floating Card */}
      <div className="flex items-center gap-3 px-5 py-3 rounded-2xl glass-panel shadow-2xl border-white/10">
        
        {/* Core Draw Tool */}
        <button
          onClick={() => handleToolClick('draw')}
          className={`p-2.5 rounded-xl cursor-pointer ${
            activeTool === 'draw' 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-inner' 
              : 'text-slate-400 hover:text-slate-200 glass-button'
          }`}
          title="Air Draw"
        >
          <Paintbrush size={18} className={activeTool === 'draw' ? 'animate-pulse' : ''} />
        </button>

        {/* Fabric.js Select / Pointer Tool */}
        <button
          onClick={() => handleToolClick('select')}
          className={`p-2.5 rounded-xl cursor-pointer ${
            activeTool === 'select' 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 shadow-inner' 
              : 'text-slate-400 hover:text-slate-200 glass-button'
          }`}
          title="Select Objects"
        >
          <MousePointer size={18} />
        </button>

        {/* Whiteboard Elements: Shape, Sticky, Text */}
        <div className="h-6 w-px bg-white/10" />

        <button
          onClick={() => handleToolClick('shape')}
          className={`p-2.5 rounded-xl cursor-pointer ${
            activeTool === 'shape' 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' 
              : 'text-slate-400 hover:text-slate-200 glass-button'
          }`}
          title="Insert Shape"
        >
          <Square size={18} />
        </button>

        <button
          onClick={() => handleToolClick('sticky')}
          className={`p-2.5 rounded-xl cursor-pointer ${
            activeTool === 'sticky' 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' 
              : 'text-slate-400 hover:text-slate-200 glass-button'
          }`}
          title="Sticky Note"
        >
          <StickyNote size={18} />
        </button>

        <button
          onClick={() => handleToolClick('text')}
          className={`p-2.5 rounded-xl cursor-pointer ${
            activeTool === 'text' 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' 
              : 'text-slate-400 hover:text-slate-200 glass-button'
          }`}
          title="Add Text"
        >
          <Type size={18} />
        </button>

        {/* Color Palette Toggle */}
        <div className="h-6 w-px bg-white/10" />

        <button
          onClick={() => {
            setShowColorSelector(!showColorSelector);
            setShowBrushSelector(false);
            setShowShapeSelector(false);
          }}
          className="p-2.5 rounded-xl text-slate-400 hover:text-slate-200 glass-button cursor-pointer relative"
          title="Brush Color"
        >
          <Palette size={18} style={{ color: brushColor }} />
        </button>

        {/* 3D Mode Toggle */}
        <div className="h-6 w-px bg-white/10" />

        <button
          onClick={() => set3DMode(!is3DMode)}
          className={`p-2.5 rounded-xl cursor-pointer ${
            is3DMode 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' 
              : 'text-slate-400 hover:text-slate-200 glass-button'
          }`}
          title="3D Canvas Sculpt"
        >
          <Box size={18} />
        </button>

        {/* Camera Toggle */}
        <button
          onClick={() => setCameraOn(!isCameraOn)}
          className={`p-2.5 rounded-xl cursor-pointer ${
            isCameraOn 
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' 
              : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
          }`}
          title={isCameraOn ? "Camera On" : "Camera Off"}
        >
          {isCameraOn ? <Camera size={18} /> : <CameraOff size={18} />}
        </button>

        {/* Landmarks Tracking Overlay Toggle */}
        <button
          onClick={() => setShowLandmarks(!showLandmarks)}
          className={`p-2.5 rounded-xl cursor-pointer ${
            showLandmarks 
              ? 'text-cyan-300 glass-button border border-cyan-400/20' 
              : 'text-slate-500 glass-button'
          }`}
          title={showLandmarks ? "Hide Joint Landmarks" : "Show Joint Landmarks"}
        >
          {showLandmarks ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>

        {/* Settings Toggle */}
        <div className="h-6 w-px bg-white/10" />

        <button
          onClick={() => setSettingsOpen(!isSettingsOpen)}
          className={`p-2.5 rounded-xl cursor-pointer ${
            isSettingsOpen 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40' 
              : 'text-slate-400 hover:text-slate-200 glass-button'
          }`}
          title="Settings"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Secondary Dynamic Submenu Dropdowns */}
      <AnimatePresence>
        {/* Brush Submenu */}
        {showBrushSelector && activeTool === 'draw' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col gap-2 p-3 mt-1 rounded-2xl glass-panel border-white/10 shadow-xl max-w-sm"
          >
            <div className="flex flex-wrap items-center gap-1.5 justify-center">
              {brushesList.map((b) => (
                <button
                  key={b.type}
                  onClick={() => setActiveBrush(b.type)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-display font-medium cursor-pointer ${
                    activeBrush === b.type 
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/30' 
                      : 'text-slate-300 hover:text-white glass-button'
                  }`}
                >
                  <span className="mr-1">{b.icon}</span> {b.label}
                </button>
              ))}
            </div>
            
            {/* Brush Size Slider */}
            <div className="flex items-center gap-3 px-2 mt-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Size:</span>
              <input
                type="range"
                min="2"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
              <span className="text-[10px] font-mono text-slate-300 font-bold min-w-[20px]">{brushSize}px</span>
            </div>
          </motion.div>
        )}

        {/* Shape Submenu */}
        {showShapeSelector && activeTool === 'shape' && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2 p-2.5 mt-1 rounded-2xl glass-panel border-white/10 shadow-xl"
          >
            {shapesList.map((s) => (
              <button
                key={s.type}
                onClick={() => setActiveShape(s.type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-display font-medium cursor-pointer ${
                  activeShape === s.type 
                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-400/30' 
                    : 'text-slate-300 hover:text-white glass-button'
                }`}
              >
                {s.label}
              </button>
            ))}
          </motion.div>
        )}

        {/* Color Submenu */}
        {showColorSelector && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-2.5 p-3 mt-1 rounded-2xl glass-panel border-white/10 shadow-xl"
          >
            {colorsList.map((c) => (
              <button
                key={c}
                onClick={() => {
                  setBrushColor(c);
                  setShowColorSelector(false);
                }}
                className={`w-6 h-6 rounded-full border-2 cursor-pointer shadow-md hover:scale-110 transition-transform ${
                  brushColor === c ? 'border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
