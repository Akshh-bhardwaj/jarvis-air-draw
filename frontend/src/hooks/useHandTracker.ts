import { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { useAppStore } from '../store/AppStore';
import { detectGesture } from '../utils/gestureEngine';

export const useHandTracker = (videoElement: HTMLVideoElement | null) => {
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isCameraOn = useAppStore((state) => state.isCameraOn);
  const isCameraMirrored = useAppStore((state) => state.isCameraMirrored);
  
  const requestRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastCursorRightRef = useRef<{ x: number; y: number; z: number } | null>(null);
  const lastCursorLeftRef = useRef<{ x: number; y: number; z: number } | null>(null);

  // Initialize MediaPipe HandLandmarker
  useEffect(() => {
    let active = true;
    
    const initTracker = async () => {
      try {
        setIsLoading(true);
        // Load vision tasks solver from official CDN
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
        );
        
        if (!active) return;

        const tracker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numHands: 2, // Always check both hands to allow two-hand gestures
          minHandDetectionConfidence: 0.35, // lower for responsive snap
          minHandPresenceConfidence: 0.35,
          minTrackingConfidence: 0.35
        });

        if (active) {
          setLandmarker(tracker);
          setIsLoading(false);
          setError(null);
          console.log('MediaPipe HandLandmarker loaded successfully.');
        }
      } catch (err: any) {
        console.error('Failed to initialize MediaPipe:', err);
        if (active) {
          setError('Failed to load Hand Landmarker models.');
          setIsLoading(false);
        }
      }
    };

    initTracker();

    return () => {
      active = false;
      if (landmarker) {
        landmarker.close();
      }
    };
  }, []);


  // Frame processing loop
  const processFrame = useCallback(() => {
    if (!landmarker || !videoElement || !isCameraOn) {
      requestRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const video = videoElement;
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const currentTime = video.currentTime;
      
      // Only process new frames
      if (currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = currentTime;
        
        try {
          const startTimeMs = performance.now();
          const results = landmarker.detectForVideo(video, startTimeMs);
          const endTimeMs = performance.now();
          
          // Calculate active tracking FPS & Latency
          const latency = endTimeMs - startTimeMs;
          const currentFps = 1000 / (latency || 1);
          useAppStore.getState().setFps(Math.round(currentFps > 60 ? 60 : currentFps));

          if (results.landmarks && results.landmarks.length > 0) {
            // Share tracked landmarks globally for overlays to draw (single-pass engine!)
            useAppStore.getState().setTrackedLandmarks(results.landmarks || []);

            // If both hands are active, check double-hand triggers for mode shifting
            if (results.landmarks.length === 2) {
              const gesture0 = detectGesture(results.worldLandmarks?.[0] || results.landmarks[0]);
              const gesture1 = detectGesture(results.worldLandmarks?.[1] || results.landmarks[1]);
              if (gesture0 === 'PAUSE' && gesture1 === 'PAUSE') {
                if (!useAppStore.getState().is3DMode) {
                  useAppStore.getState().set3DMode(true);
                }
              } else if (gesture0 === 'CLEAR_CANVAS' && gesture1 === 'CLEAR_CANVAS') {
                if (useAppStore.getState().is3DMode) {
                  useAppStore.getState().set3DMode(false);
                }
              }
            }

            // We have detected hand(s)
            let leftHandDetected = false;
            let rightHandDetected = false;

            results.landmarks.forEach((landmarks, index) => {
              const handedness = results.handednesses[index]?.[0];
              const isLeft = handedness?.categoryName === 'Left'; // Note: MediaPipe labels are mirrored relative to webcam view
              
              // Run gesture detection using metric 3D coordinates (worldLandmarks)
              const gesture = detectGesture(results.worldLandmarks?.[index] || landmarks);
              
              // Extract tip coordinate of index finger (landmark 8)
              const indexTip = landmarks[8];
              
              // Calculate coordinates relative to screen display aspect ratio
              // If camera is mirrored, flip X coordinate
              const displayX = isCameraMirrored ? (1 - indexTip.x) : indexTip.x;
              const displayY = indexTip.y; // Y is normal

              // Get video stream and container screen sizes to reconcile object-cover cropping offsets
              const vWidth = videoElement.videoWidth || 640;
              const vHeight = videoElement.videoHeight || 480;
              const cWidth = window.innerWidth;
              const cHeight = window.innerHeight;
              const scale = Math.max(cWidth / vWidth, cHeight / vHeight);

              // Perform aspect-ratio cover projection mapping
              const mappedX = (displayX - 0.5) * (vWidth * scale / cWidth) + 0.5;
              const mappedY = (displayY - 0.5) * (vHeight * scale / cHeight) + 0.5;
              
              // Depth calculation (distance between wrist landmark 0 and index knuckle landmark 5)
              const dx = indexTip.x - landmarks[0].x;
              const dy = indexTip.y - landmarks[0].y;
              const dz = indexTip.z - landmarks[0].z;
              const handSpan = Math.sqrt(dx*dx + dy*dy + dz*dz);
              // Z Depth: normalized relative scale where close hand = larger Z
              const depth = Math.max(0.1, Math.min(2.0, 0.08 / (handSpan || 0.08)));

              const smoothing = useAppStore.getState().brushSmoothing; // 0 to 10
              // Adjust smoothing response dynamically:
              // For smoothing=0, alpha=1.0 (raw coordinates)
              // For smoothing=10, alpha=0.04 (ultra-smooth interpolation)
              const alpha = smoothing === 0 ? 1.0 : Math.max(0.04, 1 - (smoothing / 10.5));
              
              const lastCursor = isLeft ? lastCursorLeftRef.current : lastCursorRightRef.current;
              let smoothedX = mappedX;
              let smoothedY = mappedY;
              let smoothedZ = depth;

              if (lastCursor) {
                // Ignore smoothing if there's a large jump (like hand teleportation / quick reset)
                const dist = Math.hypot(mappedX - lastCursor.x, mappedY - lastCursor.y);
                if (dist < 0.2) {
                  smoothedX = lastCursor.x + alpha * (mappedX - lastCursor.x);
                  smoothedY = lastCursor.y + alpha * (mappedY - lastCursor.y);
                  smoothedZ = lastCursor.z + alpha * (depth - lastCursor.z);
                }
              }

              const cursorPoint = { x: smoothedX, y: smoothedY, z: smoothedZ };

              if (isLeft) {
                lastCursorLeftRef.current = cursorPoint;
                // If mirrored, the user's left hand appears on the right side of the screen
                useAppStore.getState().setGestureLeft(gesture);
                useAppStore.getState().setCursorLeft(cursorPoint);
                leftHandDetected = true;
              } else {
                lastCursorRightRef.current = cursorPoint;
                useAppStore.getState().setGestureRight(gesture);
                useAppStore.getState().setCursorRight(cursorPoint);
                rightHandDetected = true;
              }
            });

            // Clear values for hands not detected
            if (!leftHandDetected) {
              useAppStore.getState().setGestureLeft('NONE');
              useAppStore.getState().setCursorLeft(null);
              lastCursorLeftRef.current = null;
            }
            if (!rightHandDetected) {
              useAppStore.getState().setGestureRight('NONE');
              useAppStore.getState().setCursorRight(null);
              lastCursorRightRef.current = null;
            }
          } else {
            // No hands detected
            useAppStore.getState().setTrackedLandmarks([]);
            useAppStore.getState().setGestureLeft('NONE');
            useAppStore.getState().setCursorLeft(null);
            useAppStore.getState().setGestureRight('NONE');
            useAppStore.getState().setCursorRight(null);
            lastCursorLeftRef.current = null;
            lastCursorRightRef.current = null;
          }
        } catch (err) {
          console.error('Detection loop error:', err);
        }
      }
    }

    requestRef.current = requestAnimationFrame(processFrame);
  }, [landmarker, videoElement, isCameraOn, isCameraMirrored]);

  // Start processing loop when landmarker and video element are ready
  useEffect(() => {
    if (landmarker && videoElement && isCameraOn) {
      requestRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [landmarker, videoElement, isCameraOn, processFrame]);

  return { landmarker, isLoading, error };
};
