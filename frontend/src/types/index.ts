export type BrushType = 'pencil' | 'marker' | 'neon' | 'highlighter' | 'spray' | 'calligraphy' | 'eraser';

export type ToolType = 'draw' | 'select' | 'shape' | 'sticky' | 'text' | 'laser';

export type GestureType =
  | 'DRAW'
  | 'CURSOR_MOVE'
  | 'ERASER'
  | 'PALETTE_CHANGE'
  | 'PAUSE'
  | 'CLEAR_CANVAS'
  | 'SAVE'
  | 'UNDO'
  | 'REDO'
  | 'PINCH'
  | 'DOUBLE_PINCH'
  | 'SWITCH_3D'
  | 'NONE';

export type ShapeType = 'circle' | 'rectangle' | 'triangle' | 'arrow' | 'line' | 'polygon';

export type ThemeType = 'dark' | 'light' | 'cyberpunk' | 'neon';

export interface Collaborator {
  socketId: string;
  username: string;
  color: string;
  cursorPosition: { x: number; y: number };
}

export interface DrawingPoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface StrokeData {
  type: string;
  points: DrawingPoint[];
  color: string;
  brushSize: number;
  brushType: BrushType;
  isFirstPoint: boolean;
  isLastPoint: boolean;
}

export interface DrawingVersion {
  imageUrl: string;
  canvasData: string;
  timestamp: string;
}

export interface SavedDrawing {
  _id: string;
  title: string;
  owner: string;
  imageUrl: string;
  canvasData: string;
  versionHistory: DrawingVersion[];
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface GestureSensitivity {
  pinchThreshold: number;
  motionSmoothing: number;
}
