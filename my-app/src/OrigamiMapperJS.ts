// Constants
const A4_SIZE_PX = [1654, 2339]; // 210x297mm at 200 DPI

// Class to represent a 2D polygon
class Polygon2D {
  id: string;
  vertices: [number, number][];
  imageIdx: number;
  rotation: number;
  constructor(id: string, vertices: [number, number][], imageIdx: number = 0, rotation: number = 0) {
    this.id = id;
    this.vertices = vertices; // List of [x, y] tuples, relative (0-1)
    this.imageIdx = imageIdx; // 0 or 1
    this.rotation = rotation; // degrees
  }

  absolute(width: number, height: number): [number, number][] {
    return this.vertices.map(([x, y]) => [x * width, y * height]);
  }
}

// Load template JSON data
type TemplatePolygon = {
  id: string;
  vertices: [number, number][];
  input_image?: number;
  output_image?: number;
  rotation?: number;
};

type TemplateJson = {
  offset: [number, number];
  input_polygons: TemplatePolygon[];
  output_polygons: TemplatePolygon[];
};

function loadJson(data: TemplateJson) {
  const offset = data.offset;
  const inputPolys = data.input_polygons.map(p => 
    new Polygon2D(p.id, p.vertices, p.input_image || 0));
  
  const outputPolys = data.output_polygons.map(p => 
    new Polygon2D(p.id, p.vertices, p.output_image || 0, p.rotation || 0));
  
  return { offset, inputPolys, outputPolys };
}


// Draw polygons on a canvas context
function drawPolygons(
  ctx: CanvasRenderingContext2D,
  polygons: Polygon2D[],
  width: number,
  height: number,
  color: string = 'rgba(255,0,0,1)',
  fill: string | null = null,
  lineWidth: number = 4,
  offset: [number, number] = [0, 0],
  fillAlpha: number = 0.2,
  showId: boolean = true
) {
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  
  polygons.forEach(poly => {
    const absPoints = poly.absolute(width, height);
    const offsetPoints = absPoints.map(([x, y]) => [x + offset[0], y + offset[1]]);
    
    // Fill polygon with specified alpha if requested
    if (fill) {
      const fillColor = fill || color.replace('1)', `${fillAlpha})`);
      ctx.fillStyle = fillColor;
      
      ctx.beginPath();
      offsetPoints.forEach(([x, y], i) => {
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    }
    
    // Draw outline
    ctx.beginPath();
    offsetPoints.forEach(([x, y], i) => {
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
    
    // Render the ID at the centroid
    if (showId) {
      const xs = offsetPoints.map(p => p[0]);
      const ys = offsetPoints.map(p => p[1]);
      const centroidX = xs.reduce((a, b) => a + b) / xs.length;
      const centroidY = ys.reduce((a, b) => a + b) / ys.length;
      
      ctx.font = '24px Arial';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(poly.id, centroidX, centroidY);
    }
  });
}

// Utility class for polygon operations
class PolygonUtils {
  static rotatePoints(points: [number, number][], angleDeg: number, origin: [number, number]): [number, number][] {
    const angleRad = angleDeg * Math.PI / 180;
    const cosA = Math.cos(angleRad);
    const sinA = Math.sin(angleRad);
    const [ox, oy] = origin;
    return points.map(([x, y]) => {
      const tx = x - ox;
      const ty = y - oy;
      const rx = tx * cosA - ty * sinA + ox;
      const ry = tx * sinA + ty * cosA + oy;
      return [rx, ry];
    });
  }

  static triangulatePolygon(vertices: [number, number][]): [ [number, number] , [number, number], [number, number] ][] {
    if (vertices.length < 3) return [];
    if (vertices.length === 3) return [vertices as [ [number, number], [number, number], [number, number] ]];
    const triangles: [ [number, number], [number, number], [number, number] ][] = [];
    for (let i = 1; i < vertices.length - 1; i++) {
      triangles.push([vertices[0], vertices[i], vertices[i + 1]]);
    }
    return triangles;
  }

  static pointInTriangle(p: [number, number], a: [number, number], b: [number, number], c: [number, number]): boolean {
    const [px, py] = p;
    const [ax, ay] = a;
    const [bx, by] = b;
    const [cx, cy] = c;
    const v0: [number, number] = [cx - ax, cy - ay];
    const v1: [number, number] = [bx - ax, by - ay];
    const v2: [number, number] = [px - ax, py - ay];
    const dot00 = v0[0] * v0[0] + v0[1] * v0[1];
    const dot01 = v0[0] * v1[0] + v0[1] * v1[1];
    const dot02 = v0[0] * v2[0] + v0[1] * v2[1];
    const dot11 = v1[0] * v1[0] + v1[1] * v1[1];
    const dot12 = v1[0] * v2[0] + v1[1] * v2[1];
    const denom = dot00 * dot11 - dot01 * dot01;
    if (denom === 0) return false;
    const invDenom = 1 / denom;
    const u = (dot11 * dot02 - dot01 * dot12) * invDenom;
    const v = (dot00 * dot12 - dot01 * dot02) * invDenom;
    return (u >= 0) && (v >= 0) && (u + v < 1);
  }
}

// Map pixels from source polygon to destination polygon
interface CanvasLike {
    width: number;
    height: number;
    getContext(contextId: '2d'): CanvasRenderingContext2D | null;
    toDataURL(type?: string, quality?: any): string;
}

interface PolygonLike {
    id: string;
    vertices: [number, number][];
    imageIdx: number;
    rotation: number;
    absolute(width: number, height: number): [number, number][];
}

function mapPolygonPixels(
    srcCanvas: CanvasLike,
    srcPoly: PolygonLike,
    dstCanvas: CanvasLike,
    dstPoly: PolygonLike,
    offset: [number, number] = [0, 0]
): CanvasLike {
    const srcW = srcCanvas.width;
    const srcH = srcCanvas.height;
    const dstW = dstCanvas.width;
    const dstH = dstCanvas.height;
    
    const offsetX = Math.round(offset[0] * srcW);
    const offsetY = Math.round(offset[1] * srcH);
    
    const srcAbs = srcPoly.absolute(srcW, srcH).map(([x, y]) => [x + offsetX, y + offsetY]) as [number, number][];
    const dstAbs = dstPoly.absolute(dstW, dstH) as [number, number][];
    
    if (srcAbs.length < 3 || dstAbs.length < 3) return dstCanvas;
    
    const srcCtx = srcCanvas.getContext('2d');
    const dstCtx = dstCanvas.getContext('2d');
    if (!srcCtx || !dstCtx) return dstCanvas;
    const srcImageData = srcCtx.getImageData(0, 0, srcW, srcH);
    const dstImageData = dstCtx.getImageData(0, 0, dstW, dstH);
    
    const srcTris = PolygonUtils.triangulatePolygon(srcAbs);
    const dstTris = PolygonUtils.triangulatePolygon(dstAbs);
    
    for (let i = 0; i < srcTris.length && i < dstTris.length; i++) {
        const srcTri = srcTris[i];
        const dstTri = dstTris[i];
        
        // Get bounding box of destination triangle
        const dstXs = dstTri.map(p => p[0]);
        const dstYs = dstTri.map(p => p[1]);
        const minX = Math.max(0, Math.floor(Math.min(...dstXs)));
        const maxX = Math.min(dstW - 1, Math.ceil(Math.max(...dstXs)));
        const minY = Math.max(0, Math.floor(Math.min(...dstYs)));
        const maxY = Math.min(dstH - 1, Math.ceil(Math.max(...dstYs)));
        
        // Compute bounding box center
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        
        // For each pixel in the bounding box
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                // Apply rotation if specified
                let xRot = x;
                let yRot = y;
                
                if (dstPoly.rotation) {
                    const angleRad = -dstPoly.rotation * Math.PI / 180;
                    const cosA = Math.cos(angleRad);
                    const sinA = Math.sin(angleRad);
                    const xShifted = x - cx;
                    const yShifted = y - cy;
                    xRot = cosA * xShifted - sinA * yShifted + cx;
                    yRot = sinA * xShifted + cosA * yShifted + cy;
                }
                
                // Check if the point is inside the triangle
                if (!PolygonUtils.pointInTriangle([xRot, yRot], dstTri[0], dstTri[1], dstTri[2])) {
                    continue;
                }
                
                // Compute barycentric coordinates
                const A: [[number, number], [number, number]] = [
                    [dstTri[0][0] - dstTri[2][0], dstTri[1][0] - dstTri[2][0]],
                    [dstTri[0][1] - dstTri[2][1], dstTri[1][1] - dstTri[2][1]]
                ];
                
                const detA = A[0][0] * A[1][1] - A[0][1] * A[1][0];
                if (Math.abs(detA) < 0.0001) continue; // Skip degenerate triangles
                
                const invA: [[number, number], [number, number]] = [
                    [A[1][1] / detA, -A[0][1] / detA],
                    [-A[1][0] / detA, A[0][0] / detA]
                ];
                
                const b: [number, number] = [xRot - dstTri[2][0], yRot - dstTri[2][1]];
                const lambda1 = invA[0][0] * b[0] + invA[0][1] * b[1];
                const lambda2 = invA[1][0] * b[0] + invA[1][1] * b[1];
                const lambda3 = 1 - lambda1 - lambda2;
                
                // Skip if outside triangle
                if (lambda1 < 0 || lambda1 > 1 || lambda2 < 0 || lambda2 > 1 || lambda3 < 0 || lambda3 > 1) {
                    continue;
                }
                
                // Map to source coordinates
                const srcX = lambda1 * srcTri[0][0] + lambda2 * srcTri[1][0] + lambda3 * srcTri[2][0];
                const srcY = lambda1 * srcTri[0][1] + lambda2 * srcTri[1][1] + lambda3 * srcTri[2][1];
                
                // Sample source pixel (with bilinear interpolation for better quality)
                const srcXInt = Math.round(Math.max(0, Math.min(srcW - 1, srcX)));
                const srcYInt = Math.round(Math.max(0, Math.min(srcH - 1, srcY)));
                
                // Copy pixel data
                const srcIdx = (srcYInt * srcW + srcXInt) * 4;
                const dstIdx = (y * dstW + x) * 4;
                
                dstImageData.data[dstIdx] = srcImageData.data[srcIdx];
                dstImageData.data[dstIdx + 1] = srcImageData.data[srcIdx + 1];
                dstImageData.data[dstIdx + 2] = srcImageData.data[srcIdx + 2];
                dstImageData.data[dstIdx + 3] = srcImageData.data[srcIdx + 3];
            }
        }
    }
    
    dstCtx.putImageData(dstImageData, 0, 0);
    return dstCanvas;
}

// Main function to run the mapping
export async function runMappingJS(outsideImageData: string, insideImageData: string, templateJsonData: string): Promise<{ [key: string]: string }> {
  // Parse template JSON
  const template = JSON.parse(templateJsonData);
  const { offset, inputPolys, outputPolys } = loadJson(template);
  
  // Load the images
  const loadImage = (dataUrl: string): Promise<HTMLImageElement> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = dataUrl;
    });
  };
  
  const outsideImg = await loadImage(outsideImageData) as HTMLImageElement;
  const insideImg = await loadImage(insideImageData) as HTMLImageElement;
  const inputImgs = [outsideImg, insideImg];
  
  // Calculate dimensions
  const w = Math.max(outsideImg.width, insideImg.width);
  const h = Math.max(outsideImg.height, insideImg.height);
  
  // Keep A4 aspect ratio, but ensure width and height are at least that of the input images
  const [a4W, a4H] = A4_SIZE_PX;
  const aspect = a4W / a4H;
  let canvasW = a4W;
  let canvasH = a4H;
  
  if (w > a4W || h > a4H) {
    const scaleW = w / a4W;
    const scaleH = h / a4H;
    if (scaleW > scaleH) {
      canvasW = w;
      canvasH = Math.round(w / aspect);
      if (canvasH < h) canvasH = h;
    } else {
      canvasH = h;
      canvasW = Math.round(h * aspect);
      if (canvasW < w) canvasW = w;
    }
  }
  
  // Create canvases for input images
  const inputCanvases = inputImgs.map(img => {
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    
    // Scale image to fit canvas
    const imgW = img.width;
    const imgH = img.height;
    const scale = Math.min(canvasW / imgW, canvasH / imgH);
    const newW = Math.round(imgW * scale);
    const newH = Math.round(imgH * scale);
    
    // Draw image on canvas
    if (!ctx) {
      console.log("Canvas context is null");
      return null; // return if null context
    }
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasW, canvasH);
    ctx.drawImage(img, 0, 0, newW, newH);
    
    return canvas;
  }).filter((canvas): canvas is HTMLCanvasElement => canvas !== null);
  
  // Create intermediate images (showing the polygons)
  const intermCanvases = [];
  for (let idx = 0; idx < 2; idx++) {
    const canvas = document.createElement('canvas');
    canvas.width = canvasW;
    canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    
    // Copy input image to intermediate canvas
    if (!ctx) {
      console.log("Canvas context is null");
      return {}; // return empty result if null context
    }
    ctx.drawImage(inputCanvases[idx], 0, 0);
    
    // Draw polygons
    const color = idx === 0 ? 'rgba(255,0,0,1)' : 'rgba(0,0,255,1)';
    const fillColor = idx === 0 ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,255,0.2)';
    
    drawPolygons(
      ctx,
      inputPolys.filter(p => p.imageIdx === idx),
      canvasW,
      canvasH,
      color,
      fillColor,
      4,
      [0, 0],
      0.2,
      true
    );
    
    intermCanvases.push(canvas);
  }
  
  // Create output images
  const outputCanvases = [
    document.createElement('canvas'),
    document.createElement('canvas')
  ];
  
  outputCanvases[0].width = outputCanvases[1].width = canvasW;
  outputCanvases[0].height = outputCanvases[1].height = canvasH;
  
  // Fill with white
  outputCanvases.forEach(canvas => {
    const ctx = canvas.getContext('2d');
    if(!ctx) return; // return if null context
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvasW, canvasH);
  });
  
  // Create dictionaries for quick lookup
  const inputPolyDict = Object.fromEntries(inputPolys.map(p => [p.id, p]));
  const outputPolyDict = Object.fromEntries(outputPolys.map(p => [p.id, p]));
  
  // Map polygons
  Object.keys(inputPolyDict).forEach(polyId => {
    if (polyId in outputPolyDict) {
      const srcPoly = inputPolyDict[polyId];
      const dstPoly = outputPolyDict[polyId];
      const srcCanvas = inputCanvases[srcPoly.imageIdx];
      const dstCanvas = outputCanvases[dstPoly.imageIdx];
      
      mapPolygonPixels(srcCanvas, srcPoly, dstCanvas, dstPoly, offset);
    }
  });
  
  // Convert canvases to data URLs
  const results = {
    output_page1: outputCanvases[0].toDataURL('image/png'),
    output_page2: outputCanvases[1].toDataURL('image/png'),
    output_outside_mapping: intermCanvases[0].toDataURL('image/png'),
    output_inside_mapping: intermCanvases[1].toDataURL('image/png')
  };
  
  return results;
}
