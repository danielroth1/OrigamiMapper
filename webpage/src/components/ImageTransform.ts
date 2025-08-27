/**
 * Image transformation utilities for OrigamiMapper
 */
export class ImageTransform {
  /**
   * Rotates the given image by 0/90/180/270 degrees and returns a new data URL.
   */
  static rotateDegrees(dataUrl: string, degrees: 0 | 90 | 180 | 270, callback: (rotatedDataUrl: string) => void) {
    if (degrees === 0) {
      callback(dataUrl);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      const rad = (degrees * Math.PI) / 180;
      const swap = degrees === 90 || degrees === 270;
      const canvas = document.createElement('canvas');
      canvas.width = swap ? img.height : img.width;
      canvas.height = swap ? img.width : img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        callback(dataUrl);
        return;
      }
      ctx.save();
      // Move origin to center then rotate and draw
      if (degrees === 90) {
        ctx.translate(canvas.width, 0);
      } else if (degrees === 180) {
        ctx.translate(canvas.width, canvas.height);
      } else if (degrees === 270) {
        ctx.translate(0, canvas.height);
      }
      ctx.rotate(rad);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
      callback(canvas.toDataURL());
    };
    img.onerror = () => callback(dataUrl);
    img.src = dataUrl;
  }
  /**
   * Tiles the uploaded image 4 times (2x2 grid) to fill the A4 ratio canvas (height/width = 297/210).
   */
  static tile4Times(dataUrl: string, callback: (tiledDataUrl: string) => void) {
    const img = new window.Image();
    img.onload = () => {
      const A4_RATIO = 297 / 210;
      let { width, height } = img;
      let canvasWidth = width * 2;
      let canvasHeight = height * 2;
      const currentRatio = canvasHeight / canvasWidth;
      if (currentRatio > A4_RATIO) {
        canvasHeight = Math.round(canvasWidth * A4_RATIO);
      } else if (currentRatio < A4_RATIO) {
        canvasWidth = Math.round(canvasHeight / A4_RATIO);
      }
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        for (let y = 0; y < canvasHeight; y += height) {
          for (let x = 0; x < canvasWidth; x += width) {
            ctx.drawImage(img, x, y, width, height);
          }
        }
        callback(canvas.toDataURL());
      } else {
        callback(dataUrl);
      }
    };
    img.onerror = () => callback(dataUrl);
    img.src = dataUrl;
  }

  /**
   * Tiles the uploaded image 8 times (4x2 grid) to fill the A4 ratio canvas (height/width = 297/210).
   */
  static tile8Times(dataUrl: string, callback: (tiledDataUrl: string) => void) {
    const img = new window.Image();
    img.onload = () => {
      const A4_RATIO = 297 / 210;
      let { width, height } = img;
      // Try 4x2, 5x2, 5x3, 4x3, 3x3, 3x4, 2x4, 2x5, 2x6, 2x7, 2x8, 2x9, 2x10
      // Find best grid to fill A4 with 8-10 tiles, shrinking as needed
      let bestGrid = { gridX: 4, gridY: 2, tiles: 8 };
      let bestFit = 0;
      let bestTileW = width;
      let bestTileH = height;
      let bestCanvasW = width * 4;
      let bestCanvasH = height * 2;
      for (let tiles = 8; tiles <= 10; tiles++) {
        for (let gridY = 2; gridY <= tiles; gridY++) {
          let gridX = Math.ceil(tiles / gridY);
          let tileW = width;
          let tileH = height;
          let canvasW = gridX * tileW;
          let canvasH = gridY * tileH;
          let ratio = canvasH / canvasW;
          // Shrink tiles to fit A4 aspect
          if (ratio > A4_RATIO) {
            canvasH = Math.round(canvasW * A4_RATIO);
            tileH = canvasH / gridY;
            tileW = canvasW / gridX;
          } else if (ratio < A4_RATIO) {
            canvasW = Math.round(canvasH / A4_RATIO);
            tileW = canvasW / gridX;
            tileH = canvasH / gridY;
          }
          // Score fit: how close to A4 and how much area is filled
          let fit = Math.min(canvasW, canvasH) / Math.max(canvasW, canvasH);
          // Check if squashing is too much (e.g. shrink ratio < 0.7)
          let shrinkW = tileW / width;
          let shrinkH = tileH / height;
          let minShrink = Math.min(shrinkW, shrinkH);
          if (minShrink < 0.7) {
            // Crop image to preserve aspect ratio, cut sides
            let cropW = width * 0.7;
            let cropH = height * 0.7;
            tileW = cropW;
            tileH = cropH;
            canvasW = gridX * tileW;
            canvasH = gridY * tileH;
            ratio = canvasH / canvasW;
            if (ratio > A4_RATIO) {
              canvasH = Math.round(canvasW * A4_RATIO);
              tileH = canvasH / gridY;
              tileW = canvasW / gridX;
            } else if (ratio < A4_RATIO) {
              canvasW = Math.round(canvasH / A4_RATIO);
              tileW = canvasW / gridX;
              tileH = canvasH / gridY;
            }
          }
          if (fit > bestFit) {
            bestFit = fit;
            bestGrid = { gridX, gridY, tiles };
            bestTileW = tileW;
            bestTileH = tileH;
            bestCanvasW = canvasW;
            bestCanvasH = canvasH;
          }
        }
      }
      const { gridX, gridY } = bestGrid;
      let tileW = bestTileW;
      let tileH = bestTileH;
      let canvasW = bestCanvasW;
      let canvasH = bestCanvasH;
      // If cropping, crop the image before tiling
      let cropX = (width - tileW) / 2;
      let cropY = (height - tileH) / 2;
      const canvas = document.createElement('canvas');
      canvas.width = canvasW;
      canvas.height = canvasH;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvasW, canvasH);
        for (let y = 0; y < gridY; y++) {
          for (let x = 0; x < gridX; x++) {
            ctx.drawImage(
              img,
              cropX,
              cropY,
              tileW,
              tileH,
              x * tileW,
              y * tileH,
              tileW,
              tileH
            );
          }
        }
        callback(canvas.toDataURL());
      } else {
        callback(dataUrl);
      }
    };
    img.onerror = () => callback(dataUrl);
    img.src = dataUrl;
  }

  /**
   * Tiles (repeats) the uploaded image to fill the A4 ratio canvas (height/width = 297/210).
   */
  static tileToA4Ratio(dataUrl: string, callback: (tiledDataUrl: string) => void) {
    const img = new window.Image();
    img.onload = () => {
      const A4_RATIO = 297 / 210;
      let { width, height } = img;
      let newWidth = width;
      let newHeight = height;
      const currentRatio = height / width;
      if (currentRatio > A4_RATIO) {
        newWidth = Math.round(height / A4_RATIO);
        newHeight = height;
      } else if (currentRatio < A4_RATIO) {
        newHeight = Math.round(width * A4_RATIO);
        newWidth = width;
      }
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, newWidth, newHeight);
        for (let y = 0; y < newHeight; y += height) {
          for (let x = 0; x < newWidth; x += width) {
            ctx.drawImage(img, x, y, width, height);
          }
        }
        callback(canvas.toDataURL());
      } else {
        callback(dataUrl);
      }
    };
    img.onerror = () => callback(dataUrl);
    img.src = dataUrl;
  }

  /**
   * Scales the uploaded image to fit the A4 ratio (height/width = 297/210).
   */
  static scaleToA4Ratio(dataUrl: string, callback: (scaledDataUrl: string) => void) {
    const img = new window.Image();
    img.onload = () => {
      const A4_RATIO = 297 / 210;
      let { width, height } = img;
      let newWidth = width;
      let newHeight = height;
      const currentRatio = height / width;
      if (currentRatio > A4_RATIO) {
        newWidth = Math.round(height / A4_RATIO);
        newHeight = height;
      } else if (currentRatio < A4_RATIO) {
        newHeight = Math.round(width * A4_RATIO);
        newWidth = width;
      }
      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, newWidth, newHeight);
        ctx.drawImage(img, 0, 0, newWidth, newHeight);
        callback(canvas.toDataURL());
      } else {
        callback(dataUrl);
      }
    };
    img.onerror = () => callback(dataUrl);
    img.src = dataUrl;
  }
}
