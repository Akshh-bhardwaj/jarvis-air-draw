import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Globe, Video, Sliders, LogOut } from 'lucide-react';
import { useAppStore } from '../store/AppStore';
import type { ThemeType } from '../types';

export const SettingsPanel: React.FC = () => {
  const isSettingsOpen = useAppStore((state) => state.isSettingsOpen);
  const setSettingsOpen = useAppStore((state) => state.setSettingsOpen);
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const cameraResolution = useAppStore((state) => state.cameraResolution);
  const setCameraResolution = useAppStore((state) => state.setCameraResolution);
  const gestureSensitivity = useAppStore((state) => state.gestureSensitivity);
  const setGestureSensitivity = useAppStore((state) => state.setGestureSensitivity);
  const isCameraMirrored = useAppStore((state) => state.isCameraMirrored);
  const setCameraMirrored = useAppStore((state) => state.setCameraMirrored);
  
  // Collaboration room parameters
  const roomId = useAppStore((state) => state.roomId);
  const setRoomId = useAppStore((state) => state.setRoomId);
  const isCollaborating = useAppStore((state) => state.isCollaborating);
  const setCollaborating = useAppStore((state) => state.setCollaborating);
  const collaborators = useAppStore((state) => state.collaborators);

  const [localRoomInput, setLocalRoomInput] = useState(roomId || '');

  const themesList: { value: ThemeType; label: string }[] = [
    { value: 'dark', label: 'Eclipse Dark' },
    { value: 'light', label: 'Alabaster Light' },
    { value: 'cyberpunk', label: 'Neon Cyberpunk' },
    { value: 'neon', label: 'Emerald Matrix' },
  ];

  const handleCollaborationJoin = () => {
    if (localRoomInput.trim() !== '') {
      setRoomId(localRoomInput.trim());
      setCollaborating(true);
    }
  };

  const handleCollaborationLeave = () => {
    setCollaborating(false);
    setRoomId(null);
    setLocalRoomInput('');
  };

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <div className="absolute inset-0 z-40 flex items-center justify-end bg-slate-950/20 backdrop-blur-sm select-none">
          {/* Side panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-96 h-full glass-panel border-l border-white/10 shadow-2xl flex flex-col justify-between overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
              <h2 className="text-lg font-bold font-display text-white tracking-wide">
                AirCanvas Settings
              </h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Scroll */}
            <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">
              
              {/* Theme Settings */}
              <div>
                <label className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-semibold flex items-center gap-1.5 mb-2.5">
                  <Sliders size={12} className="text-cyan-400" /> Styling & Appearance
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {themesList.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => setTheme(t.value)}
                      className={`px-3 py-2.5 rounded-xl text-left text-xs font-medium cursor-pointer transition-all ${
                        theme === t.value
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                          : 'text-slate-300 hover:bg-white/5 border border-white/5'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Resolution & Calibration */}
              <div>
                <label className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-semibold flex items-center gap-1.5 mb-2.5">
                  <Video size={12} className="text-cyan-400" /> Video & Capture Calibration
                </label>
                <div className="flex flex-col gap-3">
                  {/* Resolution Selector */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-300 font-medium">Capture Resolution</span>
                    <select
                      value={cameraResolution}
                      onChange={(e) => setCameraResolution(e.target.value)}
                      className="bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
                    >
                      <option value="640x480">Medium (640x480)</option>
                      <option value="1280x720">HD (1280x720)</option>
                    </select>
                  </div>

                  {/* Camera Mirrored */}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-slate-300 font-medium">Mirror Webcam Feed</span>
                    <input
                      type="checkbox"
                      checked={isCameraMirrored}
                      onChange={(e) => setCameraMirrored(e.target.checked)}
                      className="w-4 h-4 bg-slate-900 border-white/10 rounded focus:ring-cyan-500 focus:ring-2 focus:ring-offset-slate-900"
                    />
                  </div>

                  {/* Gesture Sensitivity */}
                  <div className="flex flex-col gap-1.5 mt-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-300 font-medium">Gesture Sensitivity</span>
                      <span className="font-mono text-cyan-400 font-bold">{Math.round(gestureSensitivity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={gestureSensitivity}
                      onChange={(e) => setGestureSensitivity(Number(e.target.value))}
                      className="w-full h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>
                </div>
              </div>

              {/* Collaboration room */}
              <div>
                <label className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-semibold flex items-center gap-1.5 mb-2.5">
                  <Globe size={12} className="text-cyan-400" /> Collaboration (Real-time)
                </label>
                <div className="flex flex-col gap-3">
                  {!isCollaborating ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Enter Room Code (e.g. lobby)"
                        value={localRoomInput}
                        onChange={(e) => setLocalRoomInput(e.target.value)}
                        className="flex-1 bg-slate-900/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      />
                      <button
                        onClick={handleCollaborationJoin}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-md"
                      >
                        JOIN
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 p-3 bg-cyan-500/5 border border-cyan-500/10 rounded-xl">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Room Status:</span>
                        <span className="font-mono text-emerald-400 font-bold">CONNECTED</span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b border-white/5 pb-2">
                        <span className="text-slate-400">Active Collaborators:</span>
                        <span className="font-mono text-white font-bold">{collaborators.length}</span>
                      </div>
                      <button
                        onClick={handleCollaborationLeave}
                        className="mt-1.5 w-full py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/20 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <LogOut size={12} /> LEAVE COLLABORATION
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Hand Gesture Map Legend */}
              <div className="border-t border-white/5 pt-4">
                <label className="text-[10px] font-mono tracking-widest text-slate-400 uppercase font-semibold flex items-center gap-1.5 mb-3">
                  🖐️ Apple Vision Air Gestures
                </label>
                <div className="flex flex-col gap-2.5 text-xs text-slate-300">
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span>1 Finger up</span>
                    <span className="text-cyan-400 font-bold font-mono">DRAW</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span>2 Fingers up</span>
                    <span className="text-cyan-400 font-bold font-mono">MOVE CURSOR</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span>3 Fingers up</span>
                    <span className="text-cyan-400 font-bold font-mono">ERASER</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span>4 Fingers up</span>
                    <span className="text-cyan-400 font-bold font-mono">SWAP PALETTE</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span>Open Palm</span>
                    <span className="text-cyan-400 font-bold font-mono">PAUSE CANVAS</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span>Closed Fist</span>
                    <span className="text-rose-400 font-bold font-mono">CLEAR CANVAS</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span>Thumb Up</span>
                    <span className="text-cyan-400 font-bold font-mono">SAVE / DOWNLOAD</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-1.5">
                    <span>Victory (V Shape)</span>
                    <span className="text-cyan-400 font-bold font-mono">UNDO</span>
                  </div>
                  <div className="flex justify-between pb-1">
                    <span>OK Sign</span>
                    <span className="text-cyan-400 font-bold font-mono">REDO</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/5 bg-slate-950/40 text-center text-[10px] text-slate-500 font-mono">
              AirCanvas AI v1.0.0
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
