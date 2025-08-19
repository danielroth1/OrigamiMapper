// Constants
// A4 pixel sizes are selected dynamically based on requested DPI below.

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
        // Precompute triangle bounding box and rotation
        const dstXs = [dstTri[0][0], dstTri[1][0], dstTri[2][0]];
        const dstYs = [dstTri[0][1], dstTri[1][1], dstTri[2][1]];
        const minX = Math.max(0, Math.floor(Math.min(dstXs[0], dstXs[1], dstXs[2])));
        const maxX = Math.min(dstW - 1, Math.ceil(Math.max(dstXs[0], dstXs[1], dstXs[2])));
        const minY = Math.max(0, Math.floor(Math.min(dstYs[0], dstYs[1], dstYs[2])));
        const maxY = Math.min(dstH - 1, Math.ceil(Math.max(dstYs[0], dstYs[1], dstYs[2])));
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        let angleRad = 0, cosA = 1, sinA = 0;
        if (dstPoly.rotation) {
            angleRad = -dstPoly.rotation * Math.PI / 180;
            cosA = Math.cos(angleRad);
            sinA = Math.sin(angleRad);
        }
        // Precompute barycentric matrix
        const A00 = dstTri[0][0] - dstTri[2][0], A01 = dstTri[1][0] - dstTri[2][0];
        const A10 = dstTri[0][1] - dstTri[2][1], A11 = dstTri[1][1] - dstTri[2][1];
        const detA = A00 * A11 - A01 * A10;
        if (Math.abs(detA) < 0.0001) continue;
        const invA00 = A11 / detA, invA01 = -A01 / detA;
        const invA10 = -A10 / detA, invA11 = A00 / detA;
        // For each pixel in the bounding box
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                let xRot = x, yRot = y;
                if (dstPoly.rotation) {
                    const xShifted = x - cx, yShifted = y - cy;
                    xRot = cosA * xShifted - sinA * yShifted + cx;
                    yRot = sinA * xShifted + cosA * yShifted + cy;
                }
                // Fast point-in-triangle test using barycentric coordinates
                const bx = xRot - dstTri[2][0], by = yRot - dstTri[2][1];
                const lambda1 = invA00 * bx + invA01 * by;
                const lambda2 = invA10 * bx + invA11 * by;
                const lambda3 = 1 - lambda1 - lambda2;
                if (lambda1 < 0 || lambda1 > 1 || lambda2 < 0 || lambda2 > 1 || lambda3 < 0 || lambda3 > 1) continue;
                // Map to source coordinates
                const srcX = lambda1 * srcTri[0][0] + lambda2 * srcTri[1][0] + lambda3 * srcTri[2][0];
                const srcY = lambda1 * srcTri[0][1] + lambda2 * srcTri[1][1] + lambda3 * srcTri[2][1];
                const srcXInt = Math.round(Math.max(0, Math.min(srcW - 1, srcX)));
                const srcYInt = Math.round(Math.max(0, Math.min(srcH - 1, srcY)));
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
export async function runMappingJS(outsideImageData: string, insideImageData: string, templateJsonData: string, dpi: number = 300): Promise<{ [key: string]: string }> {
  // dpi: number (200, 300, 600). Default 300 for backward compatibility.
  const template = JSON.parse(templateJsonData);
  const { offset, inputPolys, outputPolys } = loadJson(template);

  const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
    new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = dataUrl;
    });

  const outsideImg = await loadImage(outsideImageData);
  const insideImg = await loadImage(insideImageData);
  const inputImgs = [outsideImg, insideImg];

  // Create one canvas per image at its native size (no scaling)
  const inputCanvases = inputImgs.map(img => {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
  // draw at native size (no resampling), but disable smoothing to be safe
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, 0); // original pixels only
    return canvas;
  }).filter((c): c is HTMLCanvasElement => c !== null);

  // Safety: ensure we have both canvases
  if (inputCanvases.length < 2) {
    return {};
  }

  // Intermediate (debug) canvases per image (same native size)
  const intermCanvases: HTMLCanvasElement[] = [];
  for (let idx = 0; idx < 2; idx++) {
    const base = inputCanvases[idx];
    const canvas = document.createElement('canvas');
    canvas.width = base.width;
    canvas.height = base.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return {};
  // keep intermediate debug canvas pixel-exact
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(base, 0, 0);

    const color = idx === 0 ? 'rgba(255,0,0,1)' : 'rgba(0,0,255,1)';
    const fillColor = idx === 0 ? 'rgba(255,0,0,0.2)' : 'rgba(0,0,255,0.2)';
    drawPolygons(
      ctx,
      inputPolys.filter(p => p.imageIdx === idx),
      base.width,
      base.height,
      color,
      fillColor,
      4,
      [0, 0],
      0.2,
      true
    );
    intermCanvases.push(canvas);
  }

  // Determine A4 pixel size based on requested DPI to allow user control over output resolution
  let a4Pixels: [number, number];
  if (dpi === 200) a4Pixels = [1654, 2339];
  else if (dpi === 600) a4Pixels = [4961, 7016];
  else /* default 300 */ a4Pixels = [2480, 3508];
  const [A4_W, A4_H] = a4Pixels;
  const outputCanvases: HTMLCanvasElement[] = [0, 1].map(() => {
    const c = document.createElement('canvas');
    c.width = A4_W;
    c.height = A4_H;
    const ctx = c.getContext('2d');
    if (ctx) {
      // start with a white background for printable pages
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, c.width, c.height);
      // Ensure rendering to these canvases doesn't do smoothing that'd blur sharp edges
      ctx.imageSmoothingEnabled = false;
    }
    return c;
  });

  // Dicts
  const inputPolyDict = Object.fromEntries(inputPolys.map(p => [p.id, p]));
  const outputPolyDict = Object.fromEntries(outputPolys.map(p => [p.id, p]));

  // Map polygons (each page uses its own native size)
  Object.keys(inputPolyDict).forEach(id => {
    if (!(id in outputPolyDict)) return;
    const srcPoly = inputPolyDict[id];
    const dstPoly = outputPolyDict[id];
    const srcCanvas = inputCanvases[srcPoly.imageIdx];
    const dstCanvas = outputCanvases[dstPoly.imageIdx];
    mapPolygonPixels(srcCanvas, srcPoly, dstCanvas, dstPoly, offset);
  });

  // Output canvases are already A4, so no additional scaling step is required.
  const outputCanvasesA4 = outputCanvases;

  return {
    output_page1: outputCanvasesA4[0].toDataURL('image/png'),
    output_page2: outputCanvasesA4[1].toDataURL('image/png'),
    output_outside_mapping: intermCanvases[0].toDataURL('image/png'),
    output_inside_mapping: intermCanvases[1].toDataURL('image/png')
  };
}
