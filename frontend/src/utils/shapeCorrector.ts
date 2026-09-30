import type { DrawingPoint, ShapeType } from '../types';

interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
}

// Compute distance between two 2D points
const getDist2D = (p1: DrawingPoint, p2: DrawingPoint): number => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

// Compute bounding box
const getBoundingBox = (points: DrawingPoint[]): BoundingBox => {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  points.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  const width = maxX - minX;
  const height = maxY - minY;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    cx: minX + width / 2,
    cy: minY + height / 2,
  };
};

// Douglas-Peucker Line Simplification Algorithm
export const douglasPeucker = (points: DrawingPoint[], epsilon: number): DrawingPoint[] => {
  if (points.length <= 2) return points;

  // Find the point with the maximum distance
  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  // If max distance is greater than epsilon, recursively simplify
  if (dmax > epsilon) {
    const results1 = douglasPeucker(points.slice(0, index + 1), epsilon);
    const results2 = douglasPeucker(points.slice(index), epsilon);

    // Build the result list (exclude the duplicate middle point)
    return results1.slice(0, results1.length - 1).concat(results2);
  } else {
    return [points[0], points[end]];
  }
};

// Helper for perpendicular distance of point p to line joining lineStart and lineEnd
const perpendicularDistance = (p: DrawingPoint, lineStart: DrawingPoint, lineEnd: DrawingPoint): number => {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  if (dx === 0 && dy === 0) {
    return getDist2D(p, lineStart);
  }

  // Standard line equation distance
  const numerator = Math.abs(dy * p.x - dx * p.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x);
  const denominator = Math.sqrt(dx * dx + dy * dy);
  return numerator / denominator;
};

export interface CorrectedShape {
  type: ShapeType;
  points: DrawingPoint[]; // Vertices representing the perfect shape
  confidence: number;
}

// Detect and correct rough drawing into perfect geometric shapes
export const detectAndCorrectShape = (points: DrawingPoint[]): CorrectedShape | null => {
  if (points.length < 8) return null;

  const box = getBoundingBox(points);
  
  // Calculate total path length
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    pathLength += getDist2D(points[i], points[i - 1]);
  }

  const startEndDist = getDist2D(points[0], points[points.length - 1]);
  
  // 1. Check for Line: start and end are far apart and path is very straight
  if (startEndDist / pathLength > 0.88) {
    return {
      type: 'line',
      points: [points[0], points[points.length - 1]],
      confidence: Math.min(100, Math.round((startEndDist / pathLength) * 100)),
    };
  }

  // 2. Check for Circle: points are roughly equidistant from the centroid
  const radii: number[] = [];
  points.forEach((p) => {
    radii.push(getDist2D(p, { x: box.cx, y: box.cy }));
  });

  const avgRadius = radii.reduce((sum, r) => sum + r, 0) / radii.length;
  const variance = radii.reduce((sum, r) => sum + Math.pow(r - avgRadius, 2), 0) / radii.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / avgRadius;

  const isClosed = startEndDist < avgRadius * 1.0;

  if (coefficientOfVariation < 0.18 && isClosed) {
    // Generate perfect circle path
    const circlePoints: DrawingPoint[] = [];
    const steps = 60;
    const r = (box.width + box.height) / 4; // average radius
    for (let i = 0; i <= steps; i++) {
      const angle = (i * 2 * Math.PI) / steps;
      circlePoints.push({
        x: box.cx + r * Math.cos(angle),
        y: box.cy + r * Math.sin(angle),
      });
    }
    return {
      type: 'circle',
      points: circlePoints,
      confidence: Math.round((1 - coefficientOfVariation) * 100),
    };
  }

  // Use Douglas-Peucker simplification to detect polygons (epsilon proportional to box size)
  const epsilon = Math.max(box.width, box.height) * 0.12;
  const vertices = douglasPeucker(points, epsilon);

  // Exclude start/end duplicated points if they are close (closed polygon)
  const polygonClosed = getDist2D(vertices[0], vertices[vertices.length - 1]) < Math.max(box.width, box.height) * 0.2;
  const uniqueVertices = [...vertices];
  if (polygonClosed && uniqueVertices.length > 2) {
    uniqueVertices.pop(); // Remove the last point since it is the same as the first
  }

  const vCount = uniqueVertices.length;

  // 3. Triangle
  if (vCount === 3) {
    const perfectTriangle = [
      uniqueVertices[0],
      uniqueVertices[1],
      uniqueVertices[2],
      uniqueVertices[0], // Close path
    ];
    return {
      type: 'triangle',
      points: perfectTriangle,
      confidence: 85,
    };
  }

  // 4. Rectangle / Square
  if (vCount === 4) {

    const perfectRectangle = [
      { x: box.minX, y: box.minY },
      { x: box.maxX, y: box.minY },
      { x: box.maxX, y: box.maxY },
      { x: box.minX, y: box.maxY },
      { x: box.minX, y: box.minY }, // Close path
    ];
    return {
      type: 'rectangle', // Front-end will map this to rectangle or square
      points: perfectRectangle,
      confidence: 88,
    };
  }

  // 5. Check for Arrow (special case: simplified vertices count is higher, but it's an arrow shape)
  // We can look at the stroke geometry. Since arrows are harder to fit mathematically with pure vertices,
  // we check if it has a sharp tip at one end and a shaft.
  // For simplicity, we can do a simplified heuristic: if simplified path has 5-7 vertices and isn't closed,
  // we check if we can draw a perfect arrow vector.
  // Let's check: an arrow consists of a main line and a head.
  // If the path isn't closed, and we can find a sharp corner at the end, let's treat it as an arrow.
  // For the perfect vector, we'll draw a straight line from start to end, with arrowhead at the end.
  const isArrowHeuristic = !polygonClosed && vCount >= 4 && vCount <= 7;
  if (isArrowHeuristic) {
    const start = points[0];
    const end = points[points.length - 1];
    
    // Construct perfect arrow: shaft from start to end, arrowhead at end
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);
    const headLength = Math.max(box.width, box.height) * 0.2; // length of head
    
    // Arrowhead points
    const arrowHead1 = {
      x: end.x - headLength * Math.cos(angle - Math.PI / 6),
      y: end.y - headLength * Math.sin(angle - Math.PI / 6),
    };
    const arrowHead2 = {
      x: end.x - headLength * Math.cos(angle + Math.PI / 6),
      y: end.y - headLength * Math.sin(angle + Math.PI / 6),
    };

    const arrowPoints = [
      start,
      end,
      arrowHead1,
      end,
      arrowHead2
    ];

    return {
      type: 'arrow',
      points: arrowPoints,
      confidence: 80,
    };
  }

  // 6. Polygon / Standard freeform
  if (vCount > 4 && polygonClosed) {
    const closedPolygon = [...uniqueVertices, uniqueVertices[0]];
    return {
      type: 'polygon',
      points: closedPolygon,
      confidence: 75,
    };
  }

  return null;
};
