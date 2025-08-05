/**
 * Image transformation utilities for OrigamiMapper
 */
export class ImageTransform {
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
