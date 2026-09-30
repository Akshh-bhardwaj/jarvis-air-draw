import { create } from 'zustand';
import type { 
  BrushType, 
  ToolType, 
  GestureType, 
  ThemeType, 
  Collaborator, 
  User,
  ShapeType
} from '../types';

interface AppState {
  // Theme & UI Settings
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  fps: number;
  setFps: (fps: number) => void;

  // Drawing Settings
  activeTool: ToolType;
  setActiveTool: (tool: ToolType) => void;
  activeBrush: BrushType;
  setActiveBrush: (brush: BrushType) => void;
  brushColor: string;
  setBrushColor: (color: string) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  brushSmoothing: number; // 0 to 10
  setBrushSmoothing: (smoothing: number) => void;
  activeShape: ShapeType;
  setActiveShape: (shape: ShapeType) => void;
  is3DMode: boolean;
  set3DMode: (active: boolean) => void;
  showLandmarks: boolean;
  setShowLandmarks: (show: boolean) => void;

  // Camera Settings
  isCameraOn: boolean;
  setCameraOn: (on: boolean) => void;
  isCameraMirrored: boolean;
  setCameraMirrored: (mirrored: boolean) => void;
  cameraResolution: string; // '640x480' | '1280x720'
  setCameraResolution: (res: string) => void;

  // Hand Tracker State
  gestureLeft: GestureType;
  setGestureLeft: (gesture: GestureType) => void;
  gestureRight: GestureType;
  setGestureRight: (gesture: GestureType) => void;
  cursorLeft: { x: number; y: number; z: number } | null;
  setCursorLeft: (cursor: { x: number; y: number; z: number } | null) => void;
  cursorRight: { x: number; y: number; z: number } | null;
  setCursorRight: (cursor: { x: number; y: number; z: number } | null) => void;
  gestureSensitivity: number; // 0.1 to 1.0
  setGestureSensitivity: (sensitivity: number) => void;
  trackedLandmarks: any[];
  setTrackedLandmarks: (landmarks: any[]) => void;

  // Authentication State
  user: User | null;
  token: string | null;
  setUser: (user: User | null) => void;
  setToken: (token: string | null) => void;
  logout: () => void;

  // Collaboration State
  roomId: string | null;
  setRoomId: (roomId: string | null) => void;
  isCollaborating: boolean;
  setCollaborating: (collaborating: boolean) => void;
  collaborators: Collaborator[];
  setCollaborators: (collaborators: Collaborator[]) => void;
  addCollaborator: (collaborator: Collaborator) => void;
  removeCollaborator: (socketId: string) => void;
  updateCollaboratorCursor: (socketId: string, position: { x: number; y: number }) => void;

  // Drawing Saved File ID
  currentDrawingId: string | null;
  setCurrentDrawingId: (id: string | null) => void;
  currentDrawingTitle: string;
  setCurrentDrawingTitle: (title: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Theme & UI Settings
  theme: (localStorage.getItem('aircanvas_theme') as ThemeType) || 'dark',
  setTheme: (theme) => {
    localStorage.setItem('aircanvas_theme', theme);
    set({ theme });
  },
  isSettingsOpen: false,
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),
  fps: 0,
  setFps: (fps) => set({ fps }),

  // Drawing Settings
  activeTool: 'draw',
  setActiveTool: (activeTool) => set({ activeTool }),
  activeBrush: 'marker',
  setActiveBrush: (activeBrush) => set({ activeBrush }),
  brushColor: '#00F0FF', // Cyan default
  setBrushColor: (brushColor) => set({ brushColor }),
  brushSize: 8,
  setBrushSize: (brushSize) => set({ brushSize }),
  brushSmoothing: 5,
  setBrushSmoothing: (brushSmoothing) => set({ brushSmoothing }),
  activeShape: 'circle',
  setActiveShape: (activeShape) => set({ activeShape }),
  is3DMode: false,
  set3DMode: (is3DMode) => set({ is3DMode }),
  showLandmarks: true,
  setShowLandmarks: (showLandmarks) => set({ showLandmarks }),

  // Camera Settings
  isCameraOn: true,
  setCameraOn: (isCameraOn) => set({ isCameraOn }),
  isCameraMirrored: true,
  setCameraMirrored: (isCameraMirrored) => set({ isCameraMirrored }),
  cameraResolution: '640x480',
  setCameraResolution: (cameraResolution) => set({ cameraResolution }),

  // Hand Tracker State
  gestureLeft: 'NONE',
  setGestureLeft: (gestureLeft) => set({ gestureLeft }),
  gestureRight: 'NONE',
  setGestureRight: (gestureRight) => set({ gestureRight }),
  cursorLeft: null,
  setCursorLeft: (cursorLeft) => set({ cursorLeft }),
  cursorRight: null,
  setCursorRight: (cursorRight) => set({ cursorRight }),
  gestureSensitivity: 0.5,
  setGestureSensitivity: (gestureSensitivity) => set({ gestureSensitivity }),
  trackedLandmarks: [],
  setTrackedLandmarks: (trackedLandmarks) => set({ trackedLandmarks }),

  // Authentication State
  user: JSON.parse(localStorage.getItem('aircanvas_user') || 'null'),
  token: localStorage.getItem('aircanvas_token'),
  setUser: (user) => {
    localStorage.setItem('aircanvas_user', JSON.stringify(user));
    set({ user });
  },
  setToken: (token) => {
    if (token) {
      localStorage.setItem('aircanvas_token', token);
    } else {
      localStorage.removeItem('aircanvas_token');
    }
    set({ token });
  },
  logout: () => {
    localStorage.removeItem('aircanvas_token');
    localStorage.removeItem('aircanvas_user');
    set({ user: null, token: null, isCollaborating: false, roomId: null });
  },

  // Collaboration State
  roomId: null,
  setRoomId: (roomId) => set({ roomId }),
  isCollaborating: false,
  setCollaborating: (isCollaborating) => set({ isCollaborating }),
  collaborators: [],
  setCollaborators: (collaborators) => set({ collaborators }),
  addCollaborator: (collaborator) => 
    set((state) => ({ 
      collaborators: [...state.collaborators.filter(c => c.socketId !== collaborator.socketId), collaborator] 
    })),
  removeCollaborator: (socketId) => 
    set((state) => ({ 
      collaborators: state.collaborators.filter(c => c.socketId !== socketId) 
    })),
  updateCollaboratorCursor: (socketId, position) => 
    set((state) => ({
      collaborators: state.collaborators.map(c => 
        c.socketId === socketId ? { ...c, cursorPosition: position } : c
      )
    })),

  // Drawing Saved File ID
  currentDrawingId: null,
  setCurrentDrawingId: (currentDrawingId) => set({ currentDrawingId }),
  currentDrawingTitle: 'Untitled Drawing',
  setCurrentDrawingTitle: (currentDrawingTitle) => set({ currentDrawingTitle }),
}));
