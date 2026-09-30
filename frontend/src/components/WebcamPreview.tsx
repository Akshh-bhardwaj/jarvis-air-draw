import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store/AppStore';
import { useWebcam } from '../hooks/useWebcam';
import { useHandTracker } from '../hooks/useHandTracker';

export const WebcamPreview: React.FC = () => {
  const isCameraOn = useAppStore((state) => state.isCameraOn);
  const isCameraMirrored = useAppStore((state) => state.isCameraMirrored);
  const showLandmarks = useAppStore((state) => state.showLandmarks);
  const fps = useAppStore((state) => state.fps);
  const gestureLeft = useAppStore((state) => state.gestureLeft);
  const gestureRight = useAppStore((state) => state.gestureRight);
  const trackedLandmarks = useAppStore((state) => state.trackedLandmarks);

  // Custom Webcam and Hand Tracker Hooks
  const { videoRef, error } = useWebcam();
  const { isLoading } = useHandTracker(videoRef.current);
  const canvasOverlayRef = useRef<HTMLCanvasElement | null>(null);

  // Redraw hand landmarks overlay when trackedLandmarks updates
  useEffect(() => {
    if (!isCameraOn || !showLandmarks || !canvasOverlayRef.current || !videoRef.current) return;

    const canvas = canvasOverlayRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Make canvas dimensions exactly match video size/viewport
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (trackedLandmarks && trackedLandmarks.length > 0) {
      ctx.save();
      // Mirror coordinate rendering if mirror is enabled
      if (isCameraMirrored) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      // Calculate cover scale factor to reconcile object-cover cropped dimensions
      const vWidth = videoRef.current.videoWidth || 640;
      const vHeight = videoRef.current.videoHeight || 480;
      const cWidth = canvas.width;
      const cHeight = canvas.height;
      const scale = Math.max(cWidth / vWidth, cHeight / vHeight);

      const getScreenPoint = (lm: any) => {
        const screenX = ((lm.x - 0.5) * (vWidth * scale / cWidth) + 0.5) * cWidth;
        const screenY = ((lm.y - 0.5) * (vHeight * scale / cHeight) + 0.5) * cHeight;
        return { x: screenX, y: screenY };
      };

      trackedLandmarks.forEach((landmarks) => {
        // 1. Draw connections
        ctx.strokeStyle = '#00F0FF'; // Sci-fi cyan lines
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        
        const drawLine = (fromIdx: number, toIdx: number) => {
          const from = getScreenPoint(landmarks[fromIdx]);
          const to = getScreenPoint(landmarks[toIdx]);
          ctx.moveTo(from.x, from.y);
          ctx.lineTo(to.x, to.y);
        };

        // Thumb
        for (let i = 0; i < 4; i++) drawLine(i, i + 1);
        // Index
        drawLine(0, 5); for (let i = 5; i < 8; i++) drawLine(i, i + 1);
        // Middle
        drawLine(0, 9); for (let i = 9; i < 12; i++) drawLine(i, i + 1);
        // Ring
        drawLine(0, 13); for (let i = 13; i < 16; i++) drawLine(i, i + 1);
        // Pinky
        drawLine(0, 17); for (let i = 17; i < 20; i++) drawLine(i, i + 1);
        
        // Knuckles connections (Mcp joiners)
        drawLine(5, 9); drawLine(9, 13); drawLine(13, 17);
        ctx.stroke();

        // 2. Draw landmark dots
        landmarks.forEach((point: any, i: number) => {
          ctx.beginPath();
          const r = i === 4 || i === 8 || i === 12 || i === 16 || i === 20 ? 8 : 5; // Fingertips larger
          ctx.fillStyle = i === 8 ? '#39FF14' : '#FF007A'; // drawing index is green, others pink
          const screenPoint = getScreenPoint(point);
          ctx.arc(screenPoint.x, screenPoint.y, r, 0, Math.PI * 2);
          ctx.fill();
        });
      });

      ctx.restore();
    }
  }, [trackedLandmarks, isCameraOn, showLandmarks, isCameraMirrored]);

  if (!isCameraOn) return null;

  return (
    <div className="absolute inset-0 w-full h-full z-0 select-none overflow-hidden bg-slate-950 pointer-events-none">
      {/* Loading overlay for MediaPipe */}
      {isLoading && (
        <div className="absolute inset-0 bg-slate-950/80 z-20 flex flex-col items-center justify-center text-center px-4">
          <div className="w-8 h-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-xs font-display font-medium tracking-widest text-cyan-300">
            LOADING SPATIAL AI TRACKER...
          </span>
        </div>
      )}

      {/* Fullscreen Video Background */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover select-none pointer-events-none ${
          isCameraMirrored ? 'scale-x-[-1]' : ''
        }`}
      />

      {/* Fullscreen Hand Landmarks Canvas Overlay */}
      {showLandmarks && (
        <canvas
          ref={canvasOverlayRef}
          className="absolute inset-0 w-full h-full z-10 pointer-events-none"
        />
      )}

      {/* Small Floating Telemetry HUD card (bottom-right) */}
      <div className="absolute bottom-6 right-6 z-30 w-48 p-3 rounded-2xl glass-panel border-white/10 shadow-2xl flex flex-col gap-2 text-[10px] pointer-events-auto">
        <div className="flex items-center justify-between font-mono">
          <span className="text-slate-400">TELEMETRY</span>
          <span className="text-emerald-400 font-bold animate-pulse">● LIVE</span>
        </div>
        <div className="flex items-center justify-between font-mono border-t border-white/5 pt-1.5">
          <span className="text-slate-400">TRACKING FPS</span>
          <span className="text-cyan-300 font-bold">{fps} FPS</span>
        </div>
        <div className="flex items-center justify-between font-mono border-t border-white/5 pt-1.5">
          <span className="text-slate-400">LEFT GESTURE</span>
          <span className="text-pink-400 font-bold">{gestureLeft}</span>
        </div>
        <div className="flex items-center justify-between font-mono">
          <span className="text-slate-400">RIGHT GESTURE</span>
          <span className="text-pink-400 font-bold">{gestureRight}</span>
        </div>
        {error && (
          <div className="text-rose-400 text-center font-bold mt-1 text-[9px] bg-rose-500/10 py-1 rounded-lg">
            ⚠️ CAMERA RESOLUTION ERR
          </div>
        )}
      </div>
    </div>
  );
};
