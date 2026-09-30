import type { GestureType } from '../types';

interface Point3D {
  x: number;
  y: number;
  z: number;
}

// Calculate 3D Euclidean distance
const getDistance = (p1: Point3D, p2: Point3D): number => {
  return Math.sqrt(
    Math.pow(p1.x - p2.x, 2) + 
    Math.pow(p1.y - p2.y, 2) + 
    Math.pow(p1.z - p2.z, 2)
  );
};

// Recognizes gesture from 21 MediaPipe hand landmarks using scaling-invariant palm lengths
export const detectGesture = (landmarks: Point3D[]): GestureType => {
  if (!landmarks || landmarks.length < 21) return 'NONE';
  
  // Hand landmark pointers
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleTip = landmarks[12];
  const ringTip = landmarks[16];
  const pinkyTip = landmarks[20];

  const indexKnuckle = landmarks[5];
  const middleKnuckle = landmarks[9];
  const ringKnuckle = landmarks[13];
  const pinkyKnuckle = landmarks[17];

  // Constant palm size scaling reference (Wrist to Middle Knuckle)
  const handSize = getDistance(wrist, middleKnuckle);
  if (handSize < 0.01) return 'NONE'; // Avoid division/scale issues on corrupted frames

  // Detect finger open state based on tip-to-knuckle distance normalized by hand size
  const isIndexOpen = getDistance(indexTip, indexKnuckle) > handSize * 0.65;
  const isMiddleOpen = getDistance(middleTip, middleKnuckle) > handSize * 0.65;
  const isRingOpen = getDistance(ringTip, ringKnuckle) > handSize * 0.65;
  const isPinkyOpen = getDistance(pinkyTip, pinkyKnuckle) > handSize * 0.60;
  
  // Thumb check: distance between thumb tip and index knuckle / pinky knuckle
  const isThumbOpen = getDistance(thumbTip, indexKnuckle) > handSize * 0.55;

  // Calculate pinch distance between thumb tip and index tip
  const pinchDist = getDistance(thumbTip, indexTip);

  // 1. PINCH (Thumb tip and Index tip touching, other fingers closed)
  if (pinchDist < handSize * 0.28 && !isMiddleOpen && !isRingOpen && !isPinkyOpen) {
    return 'PINCH';
  }

  // 2. OK Sign: Thumb and Index touching, Middle + Ring + Pinky open
  if (pinchDist < handSize * 0.32 && isMiddleOpen && isRingOpen && isPinkyOpen) {
    return 'REDO';
  }

  // 3. Victory / Cursor Move: Index + Middle open, Ring + Pinky + Thumb closed
  if (isIndexOpen && isMiddleOpen && !isRingOpen && !isPinkyOpen) {
    // Check distance between index and middle tips to confirm V shape
    const indexMiddleDist = getDistance(indexTip, middleTip);
    if (indexMiddleDist > handSize * 0.40) {
      return 'UNDO';
    }
    return 'CURSOR_MOVE';
  }

  // 4. Closed Fist (All closed including thumb)
  if (!isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen && !isThumbOpen) {
    return 'CLEAR_CANVAS';
  }

  // 5. Thumb Up (Thumb open, others closed, pointing upwards relative to wrist)
  if (isThumbOpen && !isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen) {
    if (thumbTip.y < landmarks[2].y) {
      return 'SAVE';
    }
  }

  // 6. Open Palm (All open)
  if (isIndexOpen && isMiddleOpen && isRingOpen && isPinkyOpen && isThumbOpen) {
    return 'PAUSE'; 
  }

  // 7. Four Fingers Open (Index, Middle, Ring, Pinky open, thumb closed)
  if (isIndexOpen && isMiddleOpen && isRingOpen && isPinkyOpen && !isThumbOpen) {
    return 'PALETTE_CHANGE';
  }

  // 8. Three Fingers Open (Index, Middle, Ring open, Pinky + Thumb closed)
  if (isIndexOpen && isMiddleOpen && isRingOpen && !isPinkyOpen && !isThumbOpen) {
    return 'ERASER';
  }

  // 9. Single Finger Open (Index open, middle/ring/pinky closed)
  if (isIndexOpen && !isMiddleOpen && !isRingOpen && !isPinkyOpen) {
    return 'DRAW';
  }

  return 'NONE';
};
