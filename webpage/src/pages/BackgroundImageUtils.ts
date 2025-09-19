// Utilities for computing background colors/gradients from images
export const mmToPt = (mm: number) => (mm * 72) / 25.4;

// Compute automatic left/right 20% gradient from a data URL (returns CSS gradient or null)
export const computeAutoBgFromDataUrl = async (dataUrl: string): Promise<string | null> => {
  return new Promise<string | null>((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const w = img.naturalWidth || img.width || 1;
          const h = img.naturalHeight || img.height || 1;
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, w);
          canvas.height = Math.max(1, h);
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const sampleWidth = Math.max(1, Math.round(canvas.width * 0.2));
          const leftX = 0;
          const rightX = Math.max(0, canvas.width - sampleWidth);
          const ys = 0;
          const sampleH = canvas.height;
          const leftData = ctx.getImageData(leftX, ys, sampleWidth, sampleH).data;
          const rightData = ctx.getImageData(rightX, ys, sampleWidth, sampleH).data;
          const avgColor = (data: Uint8ClampedArray) => {
            let r = 0, g = 0, b = 0, count = 0;
            for (let i = 0; i < data.length; i += 4) {
              const alpha = data[i+3];
              if (alpha === 0) continue;
              r += data[i]; g += data[i+1]; b += data[i+2]; count++;
            }
            if (count === 0) return [255,255,255];
            return [Math.round(r/count), Math.round(g/count), Math.round(b/count)];
          };
          const l = avgColor(leftData);
          const r = avgColor(rightData);
          const leftColor = `rgb(${l[0]}, ${l[1]}, ${l[2]})`;
          const rightColor = `rgb(${r[0]}, ${r[1]}, ${r[2]})`;
          const gradient = `linear-gradient(90deg, ${leftColor} 0%, ${leftColor} 20%, ${rightColor} 80%, ${rightColor} 100%)`;
          resolve(gradient);
        } catch (e) { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    } catch (e) { resolve(null); }
  });
};

export default { mmToPt, computeAutoBgFromDataUrl };
