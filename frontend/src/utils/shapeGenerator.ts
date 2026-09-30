import type { DrawingPoint, ShapeType } from '../types';
import { jarvis } from './voiceFeedback';

/**
 * Generates perfect geometric shape points from a natural language description.
 * Example: generateShape('circle', 0.5, 0.5, 100) → 60-point circle centered at (0.5, 0.5) with radius 100
 */
export const generateShape = (
  shapeType: ShapeType,
  centerX: number,      // normalized 0-1 canvas coordinates
  centerY: number,
  size: number          // radius for circle, side length for square, etc.
): DrawingPoint[] => {
  const steps = 60; // smoothness
  const cx = centerX;
  const cy = centerY;

  switch (shapeType) {
    case 'circle': {
      const points: DrawingPoint[] = [];
      const radius = size;
      for (let i = 0; i <= steps; i++) {
        const angle = (i * 2 * Math.PI) / steps;
        points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
      }
      return points;
    }

    case 'rectangle': {
      const width  = size * 2.0;
      const height = size * 1.5;
      return [
        { x: cx - width / 2, y: cy - height / 2 },
        { x: cx + width / 2, y: cy - height / 2 },
        { x: cx + width / 2, y: cy + height / 2 },
        { x: cx - width / 2, y: cy + height / 2 },
        { x: cx - width / 2, y: cy - height / 2 }, // close path
      ];
    }

    case 'square': {
      const side = size * 1.8;
      return [
        { x: cx - side / 2, y: cy - side / 2 },
        { x: cx + side / 2, y: cy - side / 2 },
        { x: cx + side / 2, y: cy + side / 2 },
        { x: cx - side / 2, y: cy + side / 2 },
        { x: cx - side / 2, y: cy - side / 2 },
      ];
    }

    case 'triangle': {
      const radius = size;
      const points: DrawingPoint[] = [];
      for (let i = 0; i <= 3; i++) {
        const angle = (i * 2 * Math.PI) / 3 - Math.PI / 2; // rotated so one point points up
        points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
      }
      points.push(points[0]); // close
      return points;
    }

    case 'line': {
      return [
        { x: cx - size, y: cy },
        { x: cx + size, y: cy },
      ];
    }

    case 'arrow': {
      const length = size * 2;
      const headLength = size * 0.5;
      const dx = length;
      const dy = 0; // horizontal arrow for now
      const angle = Math.atan2(dy, dx);
      const endX = cx + dx;
      const endY = cy + dy;
      const head1 = {
        x: endX - headLength * Math.cos(angle - Math.PI / 6),
        y: endY - headLength * Math.sin(angle - Math.PI / 6),
      };
      const head2 = {
        x: endX - headLength * Math.cos(angle + Math.PI / 6),
        y: endY - headLength * Math.sin(angle + Math.PI / 6),
      };
      return [
        { x: cx, y: cy },
        { x: endX, y: endY },
        head1,
        { x: endX, y: endY },
        head2,
      ];
    }

    case 'polygon': { // 6-sided hexagon
      const radius = size;
      const sides = 6;
      const points: DrawingPoint[] = [];
      for (let i = 0; i <= sides; i++) {
        const angle = (i * 2 * Math.PI) / sides - Math.PI / 2;
        points.push({ x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) });
      }
      points.push(points[0]); // close
      return points;
    }

    default:
      return [];
  }
};

/**
 * Understands natural language shape descriptions and calls generateShape.
 * Returns { shapeType, centerX, centerY, size } or null if not recognized.
 */
export const parseShapeCommand = (command: string): { shapeType: ShapeType; centerX: number; centerY: number; size: number } | null => {
  const cmd = command.toLowerCase();
  
  // Determine shape type
  let shapeType: ShapeType = 'circle';
  if      (cmd.includes('square'))               shapeType = 'square';
  else if (cmd.includes('rect') || cmd.includes('box')) shapeType = 'rectangle';
  else if (cmd.includes('triangle'))             shapeType = 'triangle';
  else if (cmd.includes('line'))                 shapeType = 'line';
  else if (cmd.includes('arrow'))                shapeType = 'arrow';
  else if (cmd.includes('polygon') || cmd.includes('hexagon')) shapeType = 'polygon';
  else if (cmd.includes('circle'))               shapeType = 'circle';
  else return null; // no shape mentioned

  // Determine position
  let centerX = 0.5; // default center
  let centerY = 0.5;
  const size = 80; // default size in pixels

  if (cmd.includes('left'))     centerX = 0.25;
  if (cmd.includes('right'))    centerX = 0.75;
  if (cmd.includes('top') || cmd.includes('upper'))  centerY = 0.25;
  if (cmd.includes('bottom') || cmd.includes('lower')) centerY = 0.75;
  if (cmd.includes('center') || cmd.includes('middle')) { centerX = 0.5; centerY = 0.5; }

  // Determine size adjectives
  let finalSize = size;
  if (cmd.includes('small') || cmd.includes('tiny'))   finalSize = 40;
  if (cmd.includes('big') || cmd.includes('large') || cmd.includes('huge')) finalSize = 120;

  return { shapeType, centerX, centerY, size: finalSize };
};

/**
 * Main entry point — called from App.tsx voice handler.
 * Parses command like "draw a circle on the left" and immediately adds the shape
 * to the drawing canvas.
 */
export const drawShapeFromVoice = (
  command: string,
  addShapeToCanvas: (points: DrawingPoint[], brushColor: string, brushSize: number, brushType: string) => void,
  brushColor: string,
  brushSize: number
): void => {
  const parsed = parseShapeCommand(command);
  if (!parsed) return;

  const { shapeType, centerX, centerY, size } = parsed;
  const points = generateShape(shapeType, centerX, centerY, size);

  addShapeToCanvas(points, brushColor, brushSize, 'marker');

  const positionText =
    centerX === 0.25 && centerY === 0.5 ? ' on the left' :
    centerX === 0.75 && centerY === 0.5 ? ' on the right' :
    centerY === 0.25 ? ' at the top' :
    centerY === 0.75 ? ' at the bottom' :
    '';

  jarvis.brushChange(`${shapeType} ${positionText}`);
};
