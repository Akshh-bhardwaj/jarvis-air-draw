import React, { useEffect, useRef } from 'react';
// @ts-ignore
import * as fabric from 'fabric';
import { useAppStore } from '../store/AppStore';
import { useSocket } from '../hooks/useSocket';

export const Whiteboard: React.FC = () => {
  const canvasContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const fabricCanvasRef = useRef<any>(null);
  
  // Zustand State
  const activeTool = useAppStore((state) => state.activeTool);
  const brushColor = useAppStore((state) => state.brushColor);
  const activeShape = useAppStore((state) => state.activeShape);
  const isCollaborating = useAppStore((state) => state.isCollaborating);

  // WebSockets collaboration
  const { sendWhiteboardUpdate, registerWhiteboardHandler } = useSocket();

  // Initialize Fabric.js Canvas
  useEffect(() => {
    if (!canvasElRef.current || !canvasContainerRef.current) return;

    // Create Fabric.js instance (casted to any to allow cross-version support)
    const canvas = new (fabric as any).Canvas(canvasElRef.current, {
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 'transparent',
      selection: true, // Allow multi-object selection
    }) as any;

    fabricCanvasRef.current = canvas;

    // Configure selection style
    if ((fabric as any).Object) {
      (fabric as any).Object.prototype.transparentCorners = false;
      (fabric as any).Object.prototype.cornerColor = '#00F0FF';
      (fabric as any).Object.prototype.cornerStrokeColor = '#00F0FF';
      (fabric as any).Object.prototype.cornerStyle = 'circle';
      (fabric as any).Object.prototype.borderColor = '#00F0FF';
    } else if ((fabric as any).FabricObject) {
      // Fabric v6 compatibility
      (fabric as any).FabricObject.prototype.transparentCorners = false;
      (fabric as any).FabricObject.prototype.cornerColor = '#00F0FF';
      (fabric as any).FabricObject.prototype.cornerStrokeColor = '#00F0FF';
      (fabric as any).FabricObject.prototype.cornerStyle = 'circle';
      (fabric as any).FabricObject.prototype.borderColor = '#00F0FF';
    }

    // Canvas panning state
    let isPanning = false;
    let lastX = 0;
    let lastY = 0;

    // Canvas event listeners for panning and selections
    canvas.on('mouse:down', (opt: any) => {
      const evt = opt.e;
      // Pan when Spacebar or Middle mouse button is pressed
      if (activeTool === 'select' && (evt.altKey || evt.shiftKey || opt.button === 2)) {
        isPanning = true;
        canvas.selection = false;
        lastX = evt.clientX || (evt as TouchEvent).touches?.[0]?.clientX;
        lastY = evt.clientY || (evt as TouchEvent).touches?.[0]?.clientY;
      }
    });

    canvas.on('mouse:move', (opt: any) => {
      if (isPanning) {
        const e = opt.e;
        const clientX = e.clientX || (e as TouchEvent).touches?.[0]?.clientX;
        const clientY = e.clientY || (e as TouchEvent).touches?.[0]?.clientY;
        const vpt = canvas.viewportTransform;
        if (vpt) {
          vpt[4] += clientX - lastX;
          vpt[5] += clientY - lastY;
          canvas.requestRenderAll();
        }
        lastX = clientX;
        lastY = clientY;
      }
    });

    canvas.on('mouse:up', () => {
      isPanning = false;
      canvas.selection = true;
    });

    // Zoom listener
    canvas.on('mouse:wheel', (opt: any) => {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.05) zoom = 0.05;
      canvas.zoomToPoint(new (fabric as any).Point(opt.e.offsetX, opt.e.offsetY), zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
    });

    // Object modification listeners (Sync changes via WebSockets)
    const onObjectModified = (e: any) => {
      const obj = e.target;
      if (!obj || !isCollaborating) return;

      const objId = obj.get('id');
      if (objId) {
        sendWhiteboardUpdate({
          action: 'modify',
          id: objId,
          transform: {
            left: obj.left,
            top: obj.top,
            scaleX: obj.scaleX,
            scaleY: obj.scaleY,
            angle: obj.angle,
            text: (obj as any).text // For IText
          }
        });
      }
    };

    const onObjectAdded = (e: any) => {
      const obj = e.target;
      if (!obj || !isCollaborating) return;

      // Check if the object was created locally or synced from remote
      if (obj.get('isRemote')) return;

      // Assign a unique ID if not already present
      if (!obj.get('id')) {
        const uniqueId = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        obj.set('id', uniqueId);
      }

      sendWhiteboardUpdate({
        action: 'add',
        id: obj.get('id'),
        data: obj.toObject(['id', 'isRemote'])
      });
    };

    const onObjectRemoved = (e: any) => {
      const obj = e.target;
      if (!obj || !isCollaborating) return;
      if (obj.get('isRemote')) return;

      const objId = obj.get('id');
      if (objId) {
        sendWhiteboardUpdate({
          action: 'remove',
          id: objId
        });
      }
    };

    canvas.on('object:modified', onObjectModified);
    canvas.on('object:added', onObjectAdded);
    canvas.on('object:removed', onObjectRemoved);

    // Keyboard event listeners (Backspace / Delete to remove objects, Cmd/Ctrl + D to duplicate)
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeObject = canvas.getActiveObject();
      if (!activeObject) return;

      // Avoid deleting objects when editing text
      if (activeObject.type === 'i-text' && (activeObject as any).isEditing) {
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        canvas.remove(activeObject);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault();
        duplicateObject(activeObject);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Resize handler
    const handleResize = () => {
      if (typeof canvas.setDimensions === 'function') {
        canvas.setDimensions({ width: window.innerWidth, height: window.innerHeight });
      } else {
        canvas.setWidth(window.innerWidth);
        canvas.setHeight(window.innerHeight);
      }
      canvas.requestRenderAll();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [activeTool, isCollaborating]);

  // Duplicate an object on the canvas
  const duplicateObject = (target: any) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const performClone = (cloned: any) => {
      canvas.discardActiveObject();
      cloned.set({
        left: (cloned.left || 0) + 20,
        top: (cloned.top || 0) + 20,
        id: `obj_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`
      });
      if (cloned.type === 'activeSelection') {
        cloned.canvas = canvas;
        cloned.forEachObject((obj: any) => {
          canvas.add(obj);
        });
        cloned.setCoords();
      } else {
        canvas.add(cloned);
      }
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
    };

    // Fabric v6 clone returns a Promise, while v5 takes a callback
    const cloneResult = target.clone(performClone, ['id']);
    if (cloneResult && typeof cloneResult.then === 'function') {
      cloneResult.then((cloned: any) => performClone(cloned));
    }
  };

  // Sync Remote updates
  useEffect(() => {
    registerWhiteboardHandler((whiteboardData: any) => {
      const canvas = fabricCanvasRef.current;
      if (!canvas) return;

      const { action, id, data, transform } = whiteboardData;

      if (action === 'add') {
        const handler = (enlivenedObjects: any[]) => {
          enlivenedObjects.forEach((obj) => {
            obj.set({
              id,
              isRemote: true
            });
            canvas.add(obj);
            canvas.requestRenderAll();
          });
        };

        // Fabric v6 vs v5 enlivenObjects
        const enlivenResult = (fabric.util as any).enlivenObjects([data], handler, 'fabric');
        if (enlivenResult && typeof enlivenResult.then === 'function') {
          enlivenResult.then((objects: any[]) => handler(objects));
        }
      } 
      
      else if (action === 'modify') {
        const objToModify = canvas.getObjects().find((o: any) => o.get('id') === id);
        if (objToModify) {
          objToModify.set({
            ...transform,
            isRemote: true
          });
          objToModify.setCoords();
          canvas.requestRenderAll();
          setTimeout(() => objToModify.set('isRemote', false), 50);
        }
      } 
      
      else if (action === 'remove') {
        const objToRemove = canvas.getObjects().find((o: any) => o.get('id') === id);
        if (objToRemove) {
          objToRemove.set('isRemote', true);
          canvas.remove(objToRemove);
          canvas.requestRenderAll();
        }
      }
    });
  }, [registerWhiteboardHandler]);

  // Handle Adding Shapes, Text, Sticky notes from toolbar
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const center = typeof canvas.getVpCenter === 'function' 
      ? canvas.getVpCenter() 
      : canvas.getCenter();

    // Handle tool clicks from store
    if (activeTool === 'shape') {
      let shapeObj: any = null;

      if (activeShape === 'circle') {
        shapeObj = new (fabric as any).Circle({
          radius: 50,
          fill: 'transparent',
          stroke: brushColor,
          strokeWidth: 4,
          left: center.left - 50,
          top: center.top - 50
        });
      } else if (activeShape === 'rectangle') {
        shapeObj = new (fabric as any).Rect({
          width: 120,
          height: 80,
          fill: 'transparent',
          stroke: brushColor,
          strokeWidth: 4,
          left: center.left - 60,
          top: center.top - 40
        });
      } else if (activeShape === 'triangle') {
        shapeObj = new (fabric as any).Triangle({
          width: 100,
          height: 100,
          fill: 'transparent',
          stroke: brushColor,
          strokeWidth: 4,
          left: center.left - 50,
          top: center.top - 50
        });
      }

      if (shapeObj) {
        canvas.add(shapeObj);
        canvas.setActiveObject(shapeObj);
        canvas.requestRenderAll();
        useAppStore.getState().setActiveTool('select');
      }
    } 
    
    else if (activeTool === 'text') {
      const textObj = new (fabric as any).IText('Type something...', {
        fontFamily: 'Inter',
        fill: brushColor,
        fontSize: 32,
        left: center.left - 100,
        top: center.top - 20
      });
      canvas.add(textObj);
      canvas.setActiveObject(textObj);
      canvas.requestRenderAll();
      useAppStore.getState().setActiveTool('select');
    } 
    
    else if (activeTool === 'sticky') {
      const rect = new (fabric as any).Rect({
        width: 160,
        height: 160,
        fill: '#FFF8B2',
        rx: 8,
        ry: 8,
        shadow: new (fabric as any).Shadow({
          color: 'rgba(0, 0, 0, 0.15)',
          blur: 10,
          offsetX: 5,
          offsetY: 5
        })
      });

      const text = new (fabric as any).IText('Notes...', {
        fontFamily: 'Inter',
        fontSize: 16,
        fill: '#333333',
        width: 140,
        textAlign: 'center',
        left: 20,
        top: 20
      });

      const group = new (fabric as any).Group([rect, text], {
        left: center.left - 80,
        top: center.top - 80,
        subTargetCheck: true
      });

      canvas.add(group);
      canvas.setActiveObject(group);
      canvas.requestRenderAll();
      useAppStore.getState().setActiveTool('select');
    }
  }, [activeTool, activeShape, brushColor]);

  return (
    <div 
      ref={canvasContainerRef} 
      className={`absolute inset-0 z-20 ${
        activeTool === 'select' ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
      }`}
    >
      <canvas ref={canvasElRef} />
    </div>
  );
};
