import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
// @ts-ignore
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
// @ts-ignore
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter';
import { useAppStore } from '../store/AppStore';

export const ThreeCanvas: React.FC = () => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  
  // Zustand State
  const brushColor = useAppStore((state) => state.brushColor);
  const brushSize = useAppStore((state) => state.brushSize);
  const cursorRight = useAppStore((state) => state.cursorRight);
  const cursorLeft = useAppStore((state) => state.cursorLeft);
  const gestureRight = useAppStore((state) => state.gestureRight);
  const gestureLeft = useAppStore((state) => state.gestureLeft);

  const [exporter, setExporter] = useState<GLTFExporter | null>(null);

  // Dual-hand active strokes
  const activeStrokeRightRef = useRef<THREE.Vector3[]>([]);
  const activeStrokeLeftRef = useRef<THREE.Vector3[]>([]);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const drawingGroupRef = useRef<THREE.Group | null>(null);

  // Initialize Three.js scene with transparency
  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Setup Scene, Camera, and Renderer with Alpha
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      60,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3, 16);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // Transparent background to show video feed
    mountRef.current.appendChild(renderer.domElement);

    // 2. Setup Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // 3. Setup Lights
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight('#ffffff', 0.8);
    dirLight1.position.set(10, 20, 15);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight('#00F0FF', 0.6); // Sci-Fi cyan light
    dirLight2.position.set(-10, -10, -5);
    scene.add(dirLight2);

    // 4. Setup Grid Helper (3D spatial context)
    const gridHelper = new THREE.GridHelper(30, 30, '#00F0FF', '#334155');
    gridHelper.position.y = -5;
    scene.add(gridHelper);

    // Group to hold drawings (makes GLTF export easy)
    const drawingGroup = new THREE.Group();
    scene.add(drawingGroup);
    drawingGroupRef.current = drawingGroup;

    // 4.5 Setup J.A.R.V.I.S. Hologram Group
    const jarvisGroup = new THREE.Group();
    scene.add(jarvisGroup);

    // Create concentric rotating sci-fi HUD rings
    const ring1Geom = new THREE.RingGeometry(3.6, 3.7, 64);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: '#00F0FF',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    const ring1 = new THREE.Mesh(ring1Geom, ring1Mat);
    ring1.rotation.x = Math.PI / 2;
    jarvisGroup.add(ring1);

    const ring2Geom = new THREE.RingGeometry(4.2, 4.24, 64);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: '#FF007A',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending
    });
    const ring2 = new THREE.Mesh(ring2Geom, ring2Mat);
    ring2.rotation.x = Math.PI / 4;
    jarvisGroup.add(ring2);

    const ring3Geom = new THREE.RingGeometry(1.2, 1.25, 32);
    const ring3Mat = new THREE.MeshBasicMaterial({
      color: '#39FF14',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending
    });
    const ring3 = new THREE.Mesh(ring3Geom, ring3Mat);
    ring3.rotation.y = Math.PI / 3;
    jarvisGroup.add(ring3);

    // Dashed Outer HUD Ring
    const dashedRingGeom = new THREE.BufferGeometry();
    const dashedPoints = [];
    const dashedSegments = 120;
    const dashedRadius = 5.2;
    for (let i = 0; i <= dashedSegments; i++) {
      const theta = (i / dashedSegments) * Math.PI * 2;
      dashedPoints.push(new THREE.Vector3(Math.cos(theta) * dashedRadius, Math.sin(theta) * dashedRadius, 0));
    }
    dashedRingGeom.setFromPoints(dashedPoints);
    const dashedRingMat = new THREE.LineDashedMaterial({
      color: '#00F0FF',
      dashSize: 0.2,
      gapSize: 0.15,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    const dashedRing = new THREE.Line(dashedRingGeom, dashedRingMat);
    dashedRing.computeLineDistances();
    dashedRing.rotation.x = Math.PI / 2.5;
    jarvisGroup.add(dashedRing);

    // Inner wireframe Core Sphere
    const coreGeom = new THREE.IcosahedronGeometry(0.8, 2);
    const coreMat = new THREE.MeshBasicMaterial({
      color: '#00F0FF',
      wireframe: true,
      transparent: true,
      opacity: 0.2,
      blending: THREE.AdditiveBlending
    });
    const coreMesh = new THREE.Mesh(coreGeom, coreMat);
    jarvisGroup.add(coreMesh);

    // Interactive Locking HUD Crosshair
    const crosshairGroup = new THREE.Group();
    scene.add(crosshairGroup);
    
    const crosshairGeom = new THREE.BufferGeometry();
    const crosshairTicks = new Float32Array([
      -0.4, 0, 0,  0.4, 0, 0,
      0, -0.4, 0,  0, 0.4, 0,
      0, 0, -0.4,  0, 0, 0.4
    ]);
    crosshairGeom.setAttribute('position', new THREE.BufferAttribute(crosshairTicks, 3));
    const crosshairMat = new THREE.LineBasicMaterial({
      color: '#39FF14',
      transparent: true,
      opacity: 0.8,
      linewidth: 2,
      blending: THREE.AdditiveBlending
    });
    const crosshairLines = new THREE.LineSegments(crosshairGeom, crosshairMat);
    crosshairGroup.add(crosshairLines);

    const crosshairRingGeom = new THREE.RingGeometry(0.18, 0.2, 16);
    const crosshairRingMat = new THREE.MeshBasicMaterial({
      color: '#39FF14',
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });
    const crosshairRing = new THREE.Mesh(crosshairRingGeom, crosshairRingMat);
    crosshairGroup.add(crosshairRing);
    crosshairGroup.visible = false;

    // Background drifting dust particles (spatial ambient field)
    const dustCount = 150;
    const dustGeometry = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSpeeds: number[] = [];
    
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 25;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 20;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
      dustSpeeds.push(0.01 + Math.random() * 0.02);
    }
    
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMaterial = new THREE.PointsMaterial({
      size: 0.12,
      color: '#00F0FF',
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    
    const dustMesh = new THREE.Points(dustGeometry, dustMaterial);
    scene.add(dustMesh);

    // Number of neural network nodes
    const NODE_COUNT = 60;
    const nodes: {
      pos: THREE.Vector3;
      basePos: THREE.Vector3;
      phase: number;
    }[] = [];

    // Initialize node positions inside a sphere
    for (let i = 0; i < NODE_COUNT; i++) {
      const u = Math.random();
      const v = Math.random();
      const theta = u * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * v - 1.0);
      const r = 1.6 + Math.random() * 1.8; // radius between 1.6 and 3.4
      
      const x = r * Math.sin(phi) * Math.cos(theta);
      const y = r * Math.sin(phi) * Math.sin(theta);
      const z = r * Math.cos(phi);
      
      nodes.push({
        pos: new THREE.Vector3(x, y, z),
        basePos: new THREE.Vector3(x, y, z),
        phase: Math.random() * Math.PI * 2
      });
    }

    // Points buffer geometry
    const pointsGeometry = new THREE.BufferGeometry();
    const pointsPositions = new Float32Array(NODE_COUNT * 3);
    const pointsColors = new Float32Array(NODE_COUNT * 3);

    nodes.forEach((node, i) => {
      pointsPositions[i * 3] = node.pos.x;
      pointsPositions[i * 3 + 1] = node.pos.y;
      pointsPositions[i * 3 + 2] = node.pos.z;
      pointsColors[i * 3] = 0.0;
      pointsColors[i * 3 + 1] = 0.94;
      pointsColors[i * 3 + 2] = 1.0;
    });

    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(pointsPositions, 3));
    pointsGeometry.setAttribute('color', new THREE.BufferAttribute(pointsColors, 3));

    // Create canvas-based circular texture for glowing dots
    const createCircleTexture = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 16;
      canvas.height = 16;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const gradient = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.3, 'rgba(0,240,255,0.85)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 16, 16);
      }
      return new THREE.CanvasTexture(canvas);
    };

    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      map: createCircleTexture(),
      depthWrite: false
    });

    const pointsMesh = new THREE.Points(pointsGeometry, pointsMaterial);
    jarvisGroup.add(pointsMesh);

    // Line segments geometry for connections
    const lineGeometry = new THREE.BufferGeometry();
    const maxLines = 180;
    const linePositions = new Float32Array(maxLines * 2 * 3);
    const lineColors = new Float32Array(maxLines * 2 * 3);

    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      depthWrite: false
    });

    const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    jarvisGroup.add(lineMesh);

    setExporter(new GLTFExporter());

    // 5. Animation Loop
    let animationFrameId: number;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      
      // Update J.A.R.V.I.S. neural network
      const time = performance.now() * 0.001;
      
      // Get current 3D cursor position dynamically from Zustand state
      let cursor3D: THREE.Vector3 | null = null;
      const cRight = useAppStore.getState().cursorRight;
      const cLeft = useAppStore.getState().cursorLeft;
      
      if (cRight) {
        const x3D = (cRight.x - 0.5) * 26;
        const y3D = (0.5 - cRight.y) * 20;
        const z3D = (cRight.z - 1.0) * -15;
        cursor3D = new THREE.Vector3(x3D, y3D, z3D);
      } else if (cLeft) {
        const x3D = (cLeft.x - 0.5) * 26;
        const y3D = (0.5 - cLeft.y) * 20;
        const z3D = (cLeft.z - 1.0) * -15;
        cursor3D = new THREE.Vector3(x3D, y3D, z3D);
      }

      // Smooth HUD crosshair tracking target lock
      if (cursor3D) {
        crosshairGroup.visible = true;
        crosshairGroup.position.lerp(cursor3D, 0.18);
        crosshairGroup.rotation.z += 0.05;
        crosshairGroup.rotation.y += 0.02;
      } else {
        crosshairGroup.visible = false;
      }

      // Animate drifting dust particles (vertical rain)
      const dustPos = dustGeometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < dustCount; i++) {
        let yVal = dustPos.getY(i);
        yVal -= dustSpeeds[i];
        if (yVal < -10) {
          yVal = 10;
        }
        dustPos.setY(i, yVal);
      }
      dustPos.needsUpdate = true;

      // Pulsing holographic Grid scanner opacity
      if (gridHelper.material && !Array.isArray(gridHelper.material)) {
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.12 + Math.sin(time * 2.5) * 0.06;
      }

      // Pulsing central wireframe core sphere
      const coreScale = 1.0 + Math.sin(time * 3.0) * 0.08;
      coreMesh.scale.set(coreScale, coreScale, coreScale);
      coreMesh.rotation.y -= 0.005;
      coreMesh.rotation.x += 0.003;

      const posAttr = pointsGeometry.attributes.position as THREE.BufferAttribute;
      const colorAttr = pointsGeometry.attributes.color as THREE.BufferAttribute;
      
      nodes.forEach((node, i) => {
        // Wave movement
        const wave = Math.sin(time * 1.5 + node.phase) * 0.15;
        const targetPos = node.basePos.clone().addScaledVector(node.basePos.clone().normalize(), wave);
        
        node.pos.copy(targetPos);

        // Repulse from active hand cursor
        let isClose = false;
        if (cursor3D) {
          const distToCursor = node.pos.distanceTo(cursor3D);
          if (distToCursor < 3.2) {
            isClose = true;
            const pushDir = node.pos.clone().sub(cursor3D).normalize();
            const force = (3.2 - distToCursor) * 0.22;
            node.pos.addScaledVector(pushDir, force);
          }
        }

        posAttr.setXYZ(i, node.pos.x, node.pos.y, node.pos.z);

        // Set colors
        if (isClose) {
          colorAttr.setXYZ(i, 0.22, 1.0, 0.08); // neon green feedback
        } else {
          const pulseColor = Math.sin(time + node.phase) * 0.5 + 0.5;
          colorAttr.setXYZ(i, 0.0, 0.7 + pulseColor * 0.3, 1.0); // pulsing cyan
        }
      });
      posAttr.needsUpdate = true;
      colorAttr.needsUpdate = true;

      // Update line connections
      let lineIndex = 0;
      const linePosAttr = lineGeometry.attributes.position as THREE.BufferAttribute;
      const lineColorAttr = lineGeometry.attributes.color as THREE.BufferAttribute;

      for (let i = 0; i < NODE_COUNT; i++) {
        for (let j = i + 1; j < NODE_COUNT; j++) {
          if (lineIndex >= maxLines) break;

          const n1 = nodes[i];
          const n2 = nodes[j];
          const dist = n1.pos.distanceTo(n2.pos);

          if (dist < 2.2) {
            linePosAttr.setXYZ(lineIndex * 2, n1.pos.x, n1.pos.y, n1.pos.z);
            linePosAttr.setXYZ(lineIndex * 2 + 1, n2.pos.x, n2.pos.y, n2.pos.z);

            const opacity = 1.0 - (dist / 2.2);
            const isN1Close = cursor3D && n1.pos.distanceTo(cursor3D) < 3.2;
            const isN2Close = cursor3D && n2.pos.distanceTo(cursor3D) < 3.2;

            if (isN1Close || isN2Close) {
              lineColorAttr.setXYZ(lineIndex * 2, 0.22 * opacity, 1.0 * opacity, 0.08 * opacity);
              lineColorAttr.setXYZ(lineIndex * 2 + 1, 0.22 * opacity, 1.0 * opacity, 0.08 * opacity);
            } else {
              lineColorAttr.setXYZ(lineIndex * 2, 0.0, 0.7 * opacity, 1.0 * opacity);
              lineColorAttr.setXYZ(lineIndex * 2 + 1, 0.0, 0.7 * opacity, 1.0 * opacity);
            }

            lineIndex++;
          }
        }
      }

      // Hide unused line segments
      for (let k = lineIndex; k < maxLines; k++) {
        linePosAttr.setXYZ(k * 2, 0, 0, 0);
        linePosAttr.setXYZ(k * 2 + 1, 0, 0, 0);
        lineColorAttr.setXYZ(k * 2, 0, 0, 0);
        lineColorAttr.setXYZ(k * 2 + 1, 0, 0, 0);
      }
      linePosAttr.needsUpdate = true;
      lineColorAttr.needsUpdate = true;

      // Rotate HUD rings
      ring1.rotation.z = time * 0.2;
      ring2.rotation.z = -time * 0.45;
      ring2.rotation.y = Math.sin(time * 0.5) * 0.2;
      ring3.rotation.x = time * 0.8;
      ring3.rotation.y = time * 0.4;
      dashedRing.rotation.z = -time * 0.15;

      // Tilt the entire jarvisGroup towards the cursor position
      if (cursor3D) {
        const targetRotX = (cursor3D.y / 10) * 0.45;
        const targetRotY = (cursor3D.x / 13) * 0.45;
        jarvisGroup.rotation.x += (targetRotX - jarvisGroup.rotation.x) * 0.08;
        jarvisGroup.rotation.y += (targetRotY - jarvisGroup.rotation.y) * 0.08;
      } else {
        jarvisGroup.rotation.y += 0.003;
        jarvisGroup.rotation.x = Math.sin(time * 0.25) * 0.15;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 6. Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      
      // Clean up J.A.R.V.I.S. geometries & materials
      ring1Geom.dispose();
      ring1Mat.dispose();
      ring2Geom.dispose();
      ring2Mat.dispose();
      ring3Geom.dispose();
      ring3Mat.dispose();
      dashedRingGeom.dispose();
      dashedRingMat.dispose();
      coreGeom.dispose();
      coreMat.dispose();
      crosshairGeom.dispose();
      crosshairMat.dispose();
      crosshairRingGeom.dispose();
      crosshairRingMat.dispose();
      dustGeometry.dispose();
      dustMaterial.dispose();
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
      
      scene.remove(dustMesh);
      scene.remove(crosshairGroup);
      scene.clear();
    };
  }, []);

  // Sync hand coordinates to 3D points (Dual-Hand independent engine)
  useEffect(() => {
    if (!drawingGroupRef.current) return;

    // 1. Process Right Hand
    if (cursorRight) {
      const x3D = (cursorRight.x - 0.5) * 26;
      const y3D = (0.5 - cursorRight.y) * 20;
      const z3D = (cursorRight.z - 1.0) * -15; // In ThreeJS, negative Z is deeper
      const pt = new THREE.Vector3(x3D, y3D, z3D);

      if (gestureRight === 'DRAW') {
        const lastPt = activeStrokeRightRef.current[activeStrokeRightRef.current.length - 1];
        // Prevent duplicate adjacent coordinate crashes by requiring 2cm min distance
        if (!lastPt || lastPt.distanceTo(pt) > 0.02) {
          activeStrokeRightRef.current.push(pt);
          renderActive3DStroke('right', activeStrokeRightRef.current);
        }
      } else {
        if (activeStrokeRightRef.current.length > 0) {
          finalizeActive3DStroke('right', activeStrokeRightRef.current);
        }
      }
    } else {
      if (activeStrokeRightRef.current.length > 0) {
        finalizeActive3DStroke('right', activeStrokeRightRef.current);
      }
    }

    // 2. Process Left Hand
    if (cursorLeft) {
      const x3D = (cursorLeft.x - 0.5) * 26;
      const y3D = (0.5 - cursorLeft.y) * 20;
      const z3D = (cursorLeft.z - 1.0) * -15;
      const pt = new THREE.Vector3(x3D, y3D, z3D);

      if (gestureLeft === 'DRAW') {
        const lastPt = activeStrokeLeftRef.current[activeStrokeLeftRef.current.length - 1];
        // Prevent duplicate adjacent coordinate crashes by requiring 2cm min distance
        if (!lastPt || lastPt.distanceTo(pt) > 0.02) {
          activeStrokeLeftRef.current.push(pt);
          renderActive3DStroke('left', activeStrokeLeftRef.current);
        }
      } else {
        if (activeStrokeLeftRef.current.length > 0) {
          finalizeActive3DStroke('left', activeStrokeLeftRef.current);
        }
      }
    } else {
      if (activeStrokeLeftRef.current.length > 0) {
        finalizeActive3DStroke('left', activeStrokeLeftRef.current);
      }
    }
  }, [cursorRight, cursorLeft, gestureRight, gestureLeft, brushSize, brushColor]);

  // Render the current active stroke in 3D using TubeGeometry
  const renderActive3DStroke = (hand: 'left' | 'right', points: THREE.Vector3[]) => {
    const group = drawingGroupRef.current;
    if (!group || points.length < 2) return;

    const meshName = `active_${hand}`;

    // Remove old active mesh for this hand
    const oldActive = group.getObjectByName(meshName);
    if (oldActive) group.remove(oldActive);

    // Create curve and tube mesh
    const curve = new THREE.CatmullRomCurve3([...points]);
    const radius = 0.02 * brushSize;
    const geometry = new THREE.TubeGeometry(curve, Math.min(64, points.length * 4), radius, 8, false);
    
    // Glowing neon material
    const material = new THREE.MeshStandardMaterial({
      color: brushColor,
      roughness: 0.1,
      metalness: 0.8,
      emissive: brushColor,
      emissiveIntensity: 0.5
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = meshName;
    group.add(mesh);
  };

  // Convert active stroke to persistent mesh
  const finalizeActive3DStroke = (hand: 'left' | 'right', points: THREE.Vector3[]) => {
    const group = drawingGroupRef.current;
    if (!group) return;

    const meshName = `active_${hand}`;
    const oldActive = group.getObjectByName(meshName);
    if (oldActive) group.remove(oldActive);

    if (points.length < 2) {
      if (hand === 'right') activeStrokeRightRef.current = [];
      else activeStrokeLeftRef.current = [];
      return;
    }

    const curve = new THREE.CatmullRomCurve3([...points]);
    const radius = 0.02 * brushSize;
    const geometry = new THREE.TubeGeometry(curve, Math.min(64, points.length * 4), radius, 8, false);
    
    const material = new THREE.MeshStandardMaterial({
      color: brushColor,
      roughness: 0.2,
      metalness: 0.5,
      emissive: brushColor,
      emissiveIntensity: 0.3
    });

    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);

    if (hand === 'right') activeStrokeRightRef.current = [];
    else activeStrokeLeftRef.current = [];
  };

  // Export scene to GLTF format
  const export3DScene = () => {
    if (!exporter || !drawingGroupRef.current) return;

    exporter.parse(
      drawingGroupRef.current,
      (gltf: any) => {
        const output = JSON.stringify(gltf, null, 2);
        downloadFile(output, 'application/json', 'aircanvas_art.gltf');
      },
      (error: any) => {
        console.error('An error occurred during 3D export:', error);
      },
      { binary: false }
    );
  };

  // Helper download trigger
  const downloadFile = (content: string, type: string, filename: string) => {
    const blob = new Blob([content], { type });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  // Clear 3D model
  const clear3DModel = () => {
    const group = drawingGroupRef.current;
    if (!group) return;
    
    while(group.children.length > 0){
      group.remove(group.children[0]);
    }
  };

  return (
    <div className="absolute inset-0 z-10 w-full h-full bg-transparent">
      <div ref={mountRef} className="w-full h-full" />
      
      {/* 3D Action Overlay Panels */}
      <div className="absolute top-24 left-6 z-20 flex flex-col gap-3">
        <button
          onClick={export3DScene}
          className="px-4 py-2.5 rounded-xl font-display font-medium text-xs tracking-wider glass-button text-cyan-300 border-cyan-500/20 hover:border-cyan-400 cursor-pointer shadow-md"
        >
          EXPORT 3D (GLTF)
        </button>
        <button
          onClick={clear3DModel}
          className="px-4 py-2.5 rounded-xl font-display font-medium text-xs tracking-wider glass-button text-rose-300 border-rose-500/20 hover:border-rose-400 cursor-pointer shadow-md"
        >
          CLEAR 3D SPACE
        </button>
      </div>

      <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-20 px-5 py-2.5 rounded-full glass-panel text-slate-300 text-xs font-medium tracking-wide shadow-md select-none pointer-events-none text-center">
        💡 <span className="text-cyan-300 font-bold">Orbit Space:</span> Drag mouse/finger. <span className="text-cyan-300 font-bold">Zoom:</span> Scroll/Pinch. <span className="text-cyan-300 font-bold">Draw:</span> Extend index finger.
      </div>
    </div>
  );
};
