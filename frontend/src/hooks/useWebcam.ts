import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/AppStore';

export const useWebcam = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  
  const isCameraOn = useAppStore((state) => state.isCameraOn);
  const cameraResolution = useAppStore((state) => state.cameraResolution);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  const startCamera = useCallback(async () => {
    stopCamera();
    if (!isCameraOn) return;

    const [width, height] = cameraResolution.split('x').map(Number);
    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: width || 640 },
        height: { ideal: height || 480 },
        facingMode: 'user',
        frameRate: { ideal: 60 }
      },
      audio: false
    };

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setError(null);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(err => {
            console.error("Video play failed:", err);
          });
        };
      }
    } catch (err: any) {
      console.error('Webcam Access Error:', err);
      setError(err.message || 'Could not access webcam');
      useAppStore.getState().setCameraOn(false);
    }
  }, [isCameraOn, cameraResolution, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [isCameraOn, cameraResolution]);

  return {
    videoRef,
    stream,
    error,
    refreshCamera: startCamera
  };
};
