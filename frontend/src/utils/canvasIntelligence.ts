/**
 * JARVIS Canvas Intelligence Module
 * 
 * What it does:
 * 1. Analyzes the drawing canvas and describes what's on it
 * 2. Finds and manipulates specific shapes (recolor, delete, move)
 * 3. Counts shapes, calculates statistics
 * 4. Maintains command memory
 */

import type { DrawingPoint, BrushType, ShapeType } from '../types';
import { detectAndCorrectShape } from './shapeCorrector';
import { jarvis } from './voiceFeedback';

// ──────────────────────────────────────────────────────────────────────────────
// Memory System (Jarvis remembers your last commands)
// ──────────────────────────────────────────────────────────────────────────────

const MEMORY_KEY = 'jarvis_memory';
const MAX_MEMORY = 5;

interface MemoryEntry {
  time: number;
  command: string;
  action: string;  // 'drew circle', 'changed color to red', 'saved drawing'
}

export const rememberCommand = (command: string, action: string) => {
  const memory: MemoryEntry[] = JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]');
  memory.unshift({ time: Date.now(), command, action });
  if (memory.length > MAX_MEMORY) memory.pop();
  localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
};

export const getRecentCommands = (): MemoryEntry[] => {
  return JSON.parse(localStorage.getItem(MEMORY_KEY) || '[]');
};

// ──────────────────────────────────────────────────────────────────────────────
// Canvas Analysis
// ──────────────────────────────────────────────────────────────────────────────

export interface CanvasAnalysis {
  totalStrokes: number;
  totalPoints: number;
  shapes: Array<{
    type: ShapeType;
    count: number;
    colors: string[];
    totalArea?: number;
  }>;
  colors: Map<string, number>; // color -> stroke count
  boundingBox: { minX: number; maxX: number; minY: number; width: number; height: number } | null;
  drawingTimeMs: number; // estimated
  complexity: 'simple' | 'moderate' | 'complex';
}

/**
 * Analyzes the current stroke history and returns a detailed description
 */
export const analyzeCanvas = (
  strokeHistory: Array<{ stroke: DrawingPoint[]; color: string; size: number; brush: BrushType }>
): CanvasAnalysis => {
  if (strokeHistory.length === 0) {
    return {
      totalStrokes: 0,
      totalPoints: 0,
      shapes: [],
      colors: new Map(),
      boundingBox: null,
      drawingTimeMs: 0,
      complexity: 'simple',
    };
  }

  const colorMap = new Map<string, number>();
  const shapeMap = new Map<ShapeType, { count: number; colors: Set<string>; areaSum: number }>();

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let totalPoints = 0;

  strokeHistory.forEach(({ stroke, color, size }) => {
    // Count colors
    colorMap.set(color, (colorMap.get(color) || 0) + 1);

    // Detect shape
    const corrected = detectAndCorrectShape(stroke);
    const shapeType = corrected?.type || 'freeform';

    const entry = shapeMap.get(shapeType) || { count: 0, colors: new Set<string>(), areaSum: 0 };
    entry.count++;
    entry.colors.add(color);
    
    // Approximate area: for circles πr², for rectangles w×h, else bounding box area
    if (corrected && corrected.type !== 'freeform') {
      const xs = stroke.map(p => p.x);
      const ys = stroke.map(p => p.y);
      const width = Math.max(...xs) - Math.min(...xs);
      const height = Math.max(...ys) - Math.min(...ys);
      if (corrected.type === 'circle') {
        const radius = Math.max(width, height) / 2;
        entry.areaSum += Math.PI * radius * radius;
      } else {
        entry.areaSum += width * height;
      }
    }

    shapeMap.set(shapeType, entry);

    // Update bounding box
    stroke.forEach(p => {
      totalPoints++;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
  });

  const shapes = Array.from(shapeMap.entries()).map(([type, data]) => ({
    type,
    count: data.count,
    colors: Array.from(data.colors),
    totalArea: data.areaSum,
  }));

  const boundingBox = minX !== Infinity ? {
    minX, maxX, minY, maxY,
    width: maxX - minX,
    height: maxY - minY,
  } : null;

  // Estimate drawing time: ~100ms per stroke + 10ms per point
  const drawingTimeMs = strokeHistory.length * 100 + totalPoints * 10;

  let complexity: CanvasAnalysis['complexity'] = 'simple';
  if (strokeHistory.length > 10) complexity = 'moderate';
  if (strokeHistory.length > 25 || shapeMap.size > 3) complexity = 'complex';

  return {
    totalStrokes: strokeHistory.length,
    totalPoints,
    shapes,
    colors: colorMap,
    boundingBox,
    drawingTimeMs,
    complexity,
  };
};

/**
 * Generates a human-readable description of the canvas
 */
export const describeCanvas = (analysis: CanvasAnalysis): string => {
  if (analysis.totalStrokes === 0) return 'The canvas is empty.';

  const parts: string[] = [];

  // Overall summary
  parts.push(`You have drawn ${analysis.totalStrokes} stroke${analysis.totalStrokes === 1 ? '' : 's'}`);

  // Shapes breakdown
  if (analysis.shapes.length > 0) {
    const shapeDesc = analysis.shapes.map(s => `${s.count} ${s.type}${s.count > 1 ? 's' : ''}`).join(', ');
    parts.push(`including ${shapeDesc}`);
  }

  // Colors
  if (analysis.colors.size > 0) {
    const colors = Array.from(analysis.colors.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([color]) => colorNameFromHex(color));
    if (colors.length > 0) {
      parts.push(`mainly in ${colors.join(', ')}`);
    }
  }

  // Size hint
  if (analysis.boundingBox) {
    const { width, height } = analysis.boundingBox;
    const area = width * height;
    if (area < 10000) parts.push('It’s quite small');
    else if (area > 100000) parts.push('It covers most of the canvas');
  }

  // Complexity
  if (analysis.complexity === 'complex') parts.push('It looks detailed');
  else if (analysis.complexity === 'moderate') parts.push('It’s moderately complex');

  return parts.join('. ') + '.';
};

const colorNameFromHex = (hex: string): string => {
  const map: Record<string, string> = {
    '#FF003C': 'red',
    '#00F0FF': 'cyan',
    '#39FF14': 'green',
    '#FFEF00': 'yellow',
    '#FFFFFF': 'white',
    '#A855F7': 'purple',
    '#F97316': 'orange',
    '#EC4899': 'pink',
    '#000000': 'black',
  };
  return map[hex] || `color ${hex}`;
};

// ──────────────────────────────────────────────────────────────────────────────
// Smart Editing
// ──────────────────────────────────────────────────────────────────────────────

interface StrokeWithIndex {
  index: number;
  stroke: DrawingPoint[];
  color: string;
  size: number;
  brush: BrushType;
}

/**
 * Finds the last stroke that matches criteria
 */
export const findLastShape = (
  strokeHistory: Array<{ stroke: DrawingPoint[]; color: string; size: number; brush: BrushType }>,
  shapeType?: ShapeType,
  color?: string
): StrokeWithIndex | null => {
  for (let i = strokeHistory.length - 1; i >= 0; i--) {
    const item = strokeHistory[i];
    const corrected = detectAndCorrectShape(item.stroke);
    const itemShape = corrected?.type || 'freeform';

    if (shapeType && itemShape !== shapeType) continue;
    if (color && item.color !== color) continue;

    return { index: i, ...item };
  }
  return null;
};

/**
 * Changes color of a specific stroke
 */
export const recolorStroke = (
  strokeHistory: Array<{ stroke: DrawingPoint[]; color: string; size: number; brush: BrushType }>,
  index: number,
  newColor: string
): typeof strokeHistory => {
  const newHistory = [...strokeHistory];
  if (index >= 0 && index < newHistory.length) {
    newHistory[index] = { ...newHistory[index], color: newColor };
  }
  return newHistory;
};

/**
 * Deletes strokes matching criteria
 */
export const deleteShapes = (
  strokeHistory: Array<{ stroke: DrawingPoint[]; color: string; size: number; brush: BrushType }>,
  shapeType?: ShapeType
): { newHistory: typeof strokeHistory; deletedCount: number } => {
  const newHistory: typeof strokeHistory = [];
  let deletedCount = 0;

  strokeHistory.forEach(item => {
    const corrected = detectAndCorrectShape(item.stroke);
    const itemShape = corrected?.type || 'freeform';

    if (shapeType && itemShape === shapeType) {
      deletedCount++;
    } else {
      newHistory.push(item);
    }
  });

  return { newHistory, deletedCount };
};

// ──────────────────────────────────────────────────────────────────────────────
// Voice Command Processing
// ──────────────────────────────────────────────────────────────────────────────

export const processCanvasCommand = (
  command: string,
  strokeHistory: Array<{ stroke: DrawingPoint[]; color: string; size: number; brush: BrushType }>,
  setStrokeHistory: (history: typeof strokeHistory) => void,
  setBrushColor: (color: string) => void
): { response: string; actionTaken: boolean } => {
  const cmd = command.toLowerCase();
  const analysis = analyzeCanvas(strokeHistory);

  // "What's on the canvas?"
  if (cmd.includes('what') && (cmd.includes('canvas') || cmd.includes('draw') || cmd.includes('see'))) {
    const description = describeCanvas(analysis);
    jarvis.speak(description);
    rememberCommand(command, 'described canvas');
    return { response: description, actionTaken: false };
  }

  // "How many circles?"
  if (cmd.includes('how many')) {
    const shapeMatch = cmd.match(/circle|square|triangle|rectangle|line|arrow|polygon/);
    if (shapeMatch) {
      const shape = shapeMatch[0] as ShapeType;
      const count = analysis.shapes.find(s => s.type === shape)?.count || 0;
      const response = `There ${count === 1 ? 'is' : 'are'} ${count} ${shape}${count !== 1 ? 's' : ''}.`;
      jarvis.speak(response);
      rememberCommand(command, `counted ${shape}s`);
      return { response, actionTaken: false };
    }
  }

  // "Make the last circle blue"
  if (cmd.includes('make') || cmd.includes('change') || cmd.includes('recolor')) {
    const colorMatch = cmd.match(/red|blue|cyan|green|yellow|white|purple|orange|pink|black/);
    const shapeMatch = cmd.match(/circle|square|triangle|rectangle|line|arrow|polygon/);

    if (colorMatch) {
      const colorName = colorMatch[0];
      const colorHex: Record<string, string> = {
        red: '#FF003C', blue: '#00F0FF', cyan: '#00F0FF', green: '#39FF14',
        yellow: '#FFEF00', white: '#FFFFFF', purple: '#A855F7',
        orange: '#F97316', pink: '#EC4899', black: '#000000',
      };
      const hex = colorHex[colorName];

      if (shapeMatch) {
        const shape = shapeMatch[0] as ShapeType;
        const found = findLastShape(strokeHistory, shape);
        if (found) {
          const newHistory = recolorStroke(strokeHistory, found.index, hex);
          setStrokeHistory(newHistory);
          jarvis.speak(`Changed the last ${shape} to ${colorName}`);
          rememberCommand(command, `recolored ${shape} to ${colorName}`);
          return { response: `Changed last ${shape} to ${colorName}`, actionTaken: true };
        } else {
          jarvis.speak(`I couldn't find a ${shape} to recolor`);
          return { response: `No ${shape} found`, actionTaken: false };
        }
      } else {
        // Just change brush color
        setBrushColor(hex);
        jarvis.speak(`Brush color set to ${colorName}`);
        rememberCommand(command, `set color to ${colorName}`);
        return { response: `Brush color changed to ${colorName}`, actionTaken: true };
      }
    }
  }

  // "Delete the last triangle"
  if (cmd.includes('delete') || cmd.includes('remove') || cmd.includes('erase')) {
    const shapeMatch = cmd.match(/circle|square|triangle|rectangle|line|arrow|polygon/);
    if (shapeMatch) {
      const shape = shapeMatch[0] as ShapeType;
      const { newHistory, deletedCount } = deleteShapes(strokeHistory, shape);
      if (deletedCount > 0) {
        setStrokeHistory(newHistory);
        jarvis.speak(`Deleted ${deletedCount} ${shape}${deletedCount > 1 ? 's' : ''}`);
        rememberCommand(command, `deleted ${shape}s`);
        return { response: `Deleted ${deletedCount} ${shape}${deletedCount > 1 ? 's' : ''}`, actionTaken: true };
      } else {
        jarvis.speak(`No ${shape}s found to delete`);
        return { response: `No ${shape}s found`, actionTaken: false };
      }
    }
  }

  // "Undo the last circle"
  if (cmd.includes('undo')) {
    const shapeMatch = cmd.match(/circle|square|triangle|rectangle|line|arrow|polygon/);
    if (shapeMatch) {
      const shape = shapeMatch[0] as ShapeType;
      const found = findLastShape(strokeHistory, shape);
      if (found) {
        const newHistory = strokeHistory.filter((_, i) => i !== found.index);
        setStrokeHistory(newHistory);
        jarvis.speak(`Undid the last ${shape}`);
        rememberCommand(command, `undid ${shape}`);
        return { response: `Undid last ${shape}`, actionTaken: true };
      }
    }
  }

  // Default: describe if canvas isn't empty
  if (analysis.totalStrokes > 0) {
    const description = describeCanvas(analysis);
    jarvis.speak(description);
    return { response: description, actionTaken: false };
  }

  jarvis.speak("I didn't understand that command");
  return { response: "Command not recognized", actionTaken: false };
};
