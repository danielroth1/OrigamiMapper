/**
 * Tiles (repeats) the uploaded image to fill the A4 ratio canvas (height/width = 297/210).
 * The image is repeated horizontally and vertically as needed, with a white background.
 * @param dataUrl - The input image as a data URL.
 * @param callback - Called with the tiled image as a data URL.
 */
export function tileToA4Ratio(dataUrl: string, callback: (tiledDataUrl: string) => void) {
  const img = new window.Image();
  img.onload = () => {
    const A4_RATIO = 297 / 210; // Height / Width
    let { width, height } = img;
    let newWidth = width;
    let newHeight = height;
    const currentRatio = height / width;
    if (currentRatio > A4_RATIO) {
      // Too tall, expand width
      newWidth = Math.round(height / A4_RATIO);
      newHeight = height;
    } else if (currentRatio < A4_RATIO) {
      // Too wide, expand height
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
      // Tile the image to fill the canvas
      for (let y = 0; y < newHeight; y += height) {
        for (let x = 0; x < newWidth; x += width) {
          ctx.drawImage(img, x, y, width, height);
        }
      }
      callback(canvas.toDataURL());
    } else {
      callback(dataUrl); // fallback
    }
  };
  img.onerror = () => callback(dataUrl);
  img.src = dataUrl;
}
import React from 'react';

/**
 * Crops the uploaded image to fit the A4 ratio (height/width = 297/210).
 * The image is centered and excess parts are removed.
 * @param dataUrl - The input image as a data URL.
 * @param callback - Called with the cropped image as a data URL.
 */
export function cropToA4Ratio(dataUrl: string, callback: (croppedDataUrl: string) => void) {
  const img = new window.Image();
  img.onload = () => {
    const A4_RATIO = 297 / 210; // Height / Width
    let { width, height } = img;
    const currentRatio = height / width;
    let cropWidth = width;
    let cropHeight = height;
    let offsetX = 0;
    let offsetY = 0;
    if (currentRatio > A4_RATIO) {
      // Image is too tall, crop height
      cropHeight = Math.round(width * A4_RATIO);
      offsetY = Math.round((height - cropHeight) / 2);
    } else if (currentRatio < A4_RATIO) {
      // Image is too wide, crop width
      cropWidth = Math.round(height / A4_RATIO);
      offsetX = Math.round((width - cropWidth) / 2);
    }
    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(img, offsetX, offsetY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      callback(canvas.toDataURL());
    } else {
      callback(dataUrl); // fallback
    }
  };
  img.onerror = () => callback(dataUrl);
  img.src = dataUrl;
}

/**
 * Scales the uploaded image to fit the A4 ratio (height/width = 297/210).
 * The image is stretched to fill the A4 ratio canvas, possibly distorting the image.
 * @param dataUrl - The input image as a data URL.
 * @param callback - Called with the scaled image as a data URL.
 */
export function scaleToA4Ratio(dataUrl: string, callback: (scaledDataUrl: string) => void) {
  const img = new window.Image();
  img.onload = () => {
    const A4_RATIO = 297 / 210; // Height / Width
    let { width, height } = img;
    let newWidth = width;
    let newHeight = height;
    const currentRatio = height / width;
    if (currentRatio > A4_RATIO) {
      // Too tall, scale width up
      newWidth = Math.round(height / A4_RATIO);
      newHeight = height;
    } else if (currentRatio < A4_RATIO) {
      // Too wide, scale height up
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
      callback(dataUrl); // fallback
    }
  };
  img.onerror = () => callback(dataUrl);
  img.src = dataUrl;
}

interface ImageUploadProps {
  label: string;
  onImage: (dataUrl: string) => void;
}

export default function ImageUpload({ label, onImage }: ImageUploadProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        // Change this to cropToA4Ratio or scaleToA4Ratio as needed
        cropToA4Ratio(reader.result.toString(), onImage);
        // Example: scaleToA4Ratio(reader.result.toString(), onImage);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <label>
      {label}
      <input type="file" accept="image/*" onChange={handleChange} />
    </label>
  );
}
