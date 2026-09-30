import type { BrushType, DrawingPoint } from '../types';

export const drawStrokeOnCanvas = (
  ctx: CanvasRenderingContext2D,
  points: DrawingPoint[],
  color: string,
  brushSize: number,
  brushType: BrushType
) => {
  if (points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (points.length === 1) {
    const p = points[0];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }

  // 1. NEON GLOW BRUSH
  if (brushType === 'neon') {
    // Outer glow (blur)
    ctx.shadowBlur = brushSize * 1.5;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    drawBezierPath(ctx, points);
    ctx.stroke();

    // Inner core (white)
    ctx.shadowBlur = 0; // Reset blur
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = brushSize * 0.35;
    ctx.beginPath();
    drawBezierPath(ctx, points);
    ctx.stroke();
  } 
  // 2. HIGHLIGHTER BRUSH
  else if (brushType === 'highlighter') {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize * 2.5;
    ctx.lineCap = 'square'; // highlighter style
    ctx.beginPath();
    drawBezierPath(ctx, points);
    ctx.stroke();
  } 
  // 3. SPRAY BRUSH
  else if (brushType === 'spray') {
    ctx.fillStyle = color;
    // Spray dots along the path
    const density = brushSize * 1.5;
    
    // Process points
    points.forEach((p) => {
      // Draw random dots around this point
      for (let i = 0; i < density; i++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.random() * brushSize * 1.8;
        const dotX = p.x + radius * Math.cos(angle);
        const dotY = p.y + radius * Math.sin(angle);
        
        ctx.beginPath();
        // Dot size depends on pressure or randomly between 0.5 and 1.5
        ctx.arc(dotX, dotY, Math.random() * 1.2 + 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  } 
  // 4. CALLIGRAPHY BRUSH (Width changes based on velocity/pressure)
  else if (brushType === 'calligraphy') {
    ctx.strokeStyle = color;
    ctx.lineCap = 'butt';
    
    // Draw segment-by-segment to vary width
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      
      // Calculate velocity (distance between adjacent points)
      const dist = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      
      // Faster drawing -> thinner stroke (calligraphy style)
      // Base width is brushSize. Thins out up to 80% or thickens up to 150%.
      const speedFactor = Math.max(0.2, Math.min(2.0, 15 / (dist || 1)));
      const segmentWidth = brushSize * speedFactor;
      
      ctx.lineWidth = segmentWidth;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  } 
  // 5. PENCIL BRUSH
  else if (brushType === 'pencil') {
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, brushSize * 0.35);
    ctx.beginPath();
    drawBezierPath(ctx, points);
    ctx.stroke();
  } 
  // 6. ERASER (destroys drawing pixels)
  else if (brushType === 'eraser') {
    ctx.strokeStyle = '#000000'; // Will be drawn with composite 'destination-out'
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = brushSize * 3; // Eraser is typically larger
    ctx.beginPath();
    drawBezierPath(ctx, points);
    ctx.stroke();
  } 
  // 7. STANDARD MARKER BRUSH (Lucent glowing lines)
  else {
    ctx.globalAlpha = 0.85;
    ctx.shadowBlur = brushSize * 0.85;
    ctx.shadowColor = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.beginPath();
    drawBezierPath(ctx, points);
    ctx.stroke();
  }

  ctx.restore();
};

// Quadratic Bezier interpolation for smooth paths
const drawBezierPath = (ctx: CanvasRenderingContext2D, points: DrawingPoint[]) => {
  ctx.moveTo(points[0].x, points[0].y);
  
  if (points.length === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }
  
  for (let i = 1; i < points.length - 2; i++) {
    const xc = (points[i].x + points[i + 1].x) / 2;
    const yc = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
  }
  
  // Curve through the last two points
  const len = points.length;
  ctx.quadraticCurveTo(
    points[len - 2].x,
    points[len - 2].y,
    points[len - 1].x,
    points[len - 1].y
  );
};
