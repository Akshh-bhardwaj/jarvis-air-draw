import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAppStore } from '../store/AppStore';
import type { StrokeData } from '../types';

let socketInstance: Socket | null = null;

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);
  
  const roomId = useAppStore((state) => state.roomId);
  const isCollaborating = useAppStore((state) => state.isCollaborating);
  const user = useAppStore((state) => state.user);

  const removeCollaborator = useAppStore((state) => state.removeCollaborator);
  const setCollaborators = useAppStore((state) => state.setCollaborators);
  const updateCollaboratorCursor = useAppStore((state) => state.updateCollaboratorCursor);

  // Callback handlers for drawing updates (will be populated by the drawing canvas component)
  const onRemoteStrokeRef = useRef<((data: StrokeData) => void) | null>(null);
  const onRemoteWhiteboardRef = useRef<((data: any) => void) | null>(null);

  const registerStrokeHandler = useCallback((handler: (data: StrokeData) => void) => {
    onRemoteStrokeRef.current = handler;
  }, []);

  const registerWhiteboardHandler = useCallback((handler: (data: any) => void) => {
    onRemoteWhiteboardRef.current = handler;
  }, []);

  // Connect to WebSocket Server
  useEffect(() => {
    if (!isCollaborating || !roomId) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        socketInstance = null;
      }
      return;
    }

    const serverUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5001';
    console.log(`Connecting to collaboration server: ${serverUrl}`);

    const socket = io(serverUrl, {
      transports: ['websocket'],
      upgrade: false
    });

    socketRef.current = socket;
    socketInstance = socket;

    // Join room on connection
    socket.on('connect', () => {
      console.log('Connected to socket server. Joining room:', roomId);
      const username = user?.name || `Painter_${Math.floor(Math.random() * 1000)}`;
      const colors = ['#FF007A', '#00F0FF', '#39FF14', '#FFEF00', '#FF5E00', '#FF00F0'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      socket.emit('join_room', {
        roomId,
        username,
        color: randomColor
      });
    });

    // Room members update
    socket.on('room_users', (users: any[]) => {
      const filteredUsers = users.filter(u => u.socketId !== socket.id);
      setCollaborators(filteredUsers);
    });

    // Handle new member joining
    socket.on('user_joined', ({ username, users }) => {
      console.log(`${username} joined room`);
      const filteredUsers = users.filter((u: any) => u.socketId !== socket.id);
      setCollaborators(filteredUsers);
    });

    // Handle member leaving
    socket.on('user_left', ({ socketId, username }) => {
      console.log(`${username} left room`);
      removeCollaborator(socketId);
    });

    // Handle cursor tracking from other users
    socket.on('cursor_update', ({ socketId, position }) => {
      updateCollaboratorCursor(socketId, position);
    });

    // Handle incoming drawing paths
    socket.on('stroke_update', ({ strokeData }) => {
      if (onRemoteStrokeRef.current) {
        onRemoteStrokeRef.current(strokeData);
      }
    });

    // Handle incoming Fabric.js whiteboard synchronizations
    socket.on('whiteboard_sync', (whiteboardData) => {
      if (onRemoteWhiteboardRef.current) {
        onRemoteWhiteboardRef.current(whiteboardData);
      }
    });

    return () => {
      console.log('Disconnecting from socket server');
      socket.disconnect();
      socketRef.current = null;
      socketInstance = null;
    };
  }, [isCollaborating, roomId, user, setCollaborators, removeCollaborator, updateCollaboratorCursor]);

  // Transmit cursor coordinates
  const sendCursorMove = useCallback((position: { x: number; y: number }) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('cursor_move', position);
    }
  }, []);

  // Transmit brush stroke
  const sendStroke = useCallback((strokeData: StrokeData) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('draw_stroke', strokeData);
    }
  }, []);

  // Transmit Fabric whiteboard object updates
  const sendWhiteboardUpdate = useCallback((whiteboardData: any) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit('whiteboard_update', whiteboardData);
    }
  }, []);

  return {
    socket: socketRef.current,
    sendCursorMove,
    sendStroke,
    sendWhiteboardUpdate,
    registerStrokeHandler,
    registerWhiteboardHandler
  };
};

// Global accessor to emit events from components outside hook context
export const getActiveSocket = () => socketInstance;
