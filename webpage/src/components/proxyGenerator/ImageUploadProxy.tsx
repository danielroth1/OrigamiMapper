

import React, { useState, useRef } from 'react';

interface ImageUploadProps {
  label: string;
  onImage: (dataUrl: string) => void;
}

export default function ImageUpload({ label, onImage }: ImageUploadProps) {
  const [image, setImage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // compression UI state
  const [compressing, setCompressing] = useState<boolean>(false);
  const [compressEnabled, setCompressEnabled] = useState<boolean>(true);

  // Read ArrayBuffer from file
  const readFileArrayBuffer = (file: File): Promise<ArrayBuffer> => new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as ArrayBuffer);
    fr.onerror = rej;
    fr.readAsArrayBuffer(file);
  });

  // Try to extract DPI from common formats (JPEG - JFIF / PNG pHYs). Return dpi as number or null if unknown.
  const extractDpi = async (file: File): Promise<number | null> => {
    try {
      const buffer = await readFileArrayBuffer(file);
      const view = new DataView(buffer);
      // Check PNG signature
      if (view.byteLength >= 24) {
        // PNG: first 8 bytes signature
        const pngSig = '\x89PNG\r\n\x1a\n';
        const sig = String.fromCharCode(...new Uint8Array(buffer.slice(0, 8)));
        if (sig === pngSig) {
          // search for pHYs chunk after signature
          let offset = 8;
          while (offset + 8 < view.byteLength) {
            const length = view.getUint32(offset);
            const chunkType = String.fromCharCode(
              view.getUint8(offset + 4),
              view.getUint8(offset + 5),
              view.getUint8(offset + 6),
              view.getUint8(offset + 7)
            );
            if (chunkType === 'pHYs') {
              const chunkOffset = offset + 8;
              const px = view.getUint32(chunkOffset);
              const py = view.getUint32(chunkOffset + 4);
              const unit = view.getUint8(chunkOffset + 8); // 0: unknown, 1: meter
              if (unit === 1) {
                // pixels per meter -> dpi
                const dpiX = px * 0.0254;
                const dpiY = py * 0.0254;
                return Math.max(dpiX, dpiY);
              }
              return null;
            }
            offset += 8 + length + 4; // length + chunkType + data + crc
          }
        }
      }

      // JPEG: look for APP0 JFIF marker or APP1 EXIF. We'll parse JFIF APP0 for density
      // JPEG markers start with 0xFFD8
      if (view.getUint16(0) === 0xFFD8) {
        let offset = 2;
        const length = view.byteLength;
        while (offset < length) {
          if (view.getUint8(offset) !== 0xFF) break;
          const marker = view.getUint8(offset + 1);
          const markerLen = view.getUint16(offset + 2);
          // APP0 (0xE0) is JFIF
          if (marker === 0xE0) {
            // check 'JFIF\0' at offset+4
            const id = String.fromCharCode(
              view.getUint8(offset + 4),
              view.getUint8(offset + 5),
              view.getUint8(offset + 6),
              view.getUint8(offset + 7),
              view.getUint8(offset + 8)
            );
            if (id === 'JFIF\0') {
              const unit = view.getUint8(offset + 9); // 0 none, 1 dpi, 2 dpcm
              const xdensity = view.getUint16(offset + 10);
              const ydensity = view.getUint16(offset + 12);
              if (unit === 1) return Math.max(xdensity, ydensity);
              if (unit === 2) return Math.max(xdensity, ydensity) * 2.54; // dpcm -> dpi
              return null;
            }
          }
          offset += 2 + markerLen;
        }
      }
    } catch (err) {
      // ignore parsing errors
    }
    return null;
  };

  // Compress image using canvas, trying preferred mime (webp/jpeg) and optionally downscale.
  // Iterates quality first, then progressively downscales if necessary.
  const compressToFit = async (
    file: File,
    maxBytes = 2 * 1024 * 1024,
    preferredMime = 'image/webp',
    allowDownscale = true
  ): Promise<string> => {
    // avoid compressing SVG/GIF animations: only handle raster types
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      return await new Promise<string>((res) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result as string);
        fr.readAsDataURL(file);
      });
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = objectUrl;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = rej;
    });
    // Start with full-size canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');

    const origW = img.naturalWidth;
    const origH = img.naturalHeight;

    // qualities to try (higher = better quality)
    const qualities = [0.92, 0.86, 0.78, 0.68, 0.58, 0.48, 0.38];

    // mime fallbacks: try preferredMime first, then jpeg
    const mimes = preferredMime ? [preferredMime, 'image/jpeg'] : ['image/jpeg'];

    // function to get blob from canvas at mime/quality
    const canvasToBlob = (mime: string, quality: number) => new Promise<Blob | null>((res) => canvas.toBlob((b) => res(b), mime, quality));

    // Try no-downscale first
    let scale = 1;
    for (let attempt = 0; attempt < (allowDownscale ? 8 : 1); attempt++) {
      canvas.width = Math.max(1, Math.round(origW * scale));
      canvas.height = Math.max(1, Math.round(origH * scale));
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      for (const mime of mimes) {
        for (const q of qualities) {
          // eslint-disable-next-line no-await-in-loop
          const blob = await canvasToBlob(mime, q);
          if (!blob) continue;
          if (blob.size <= maxBytes) {
            URL.revokeObjectURL(objectUrl);
            return await new Promise<string>((res) => {
              const r = new FileReader();
              r.onload = () => res(r.result as string);
              r.readAsDataURL(blob);
            });
          }
        }
      }

      // if not within size, reduce scale for next attempt
      if (!allowDownscale) break;
      scale *= 0.85; // downscale by 15% and retry
      // stop if canvas becomes too small
      if (canvas.width < 200 || canvas.height < 200) break;
    }

    // final fallback: return best-effort lowest-quality webp or jpeg
    const finalBlob = await (async () => {
      // try lowest webp then jpeg
      for (const mime of mimes) {
        const b = await canvasToBlob(mime, 0.36);
        if (b) return b;
      }
      return new Blob();
    })();
    URL.revokeObjectURL(objectUrl);
    return await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.readAsDataURL(finalBlob);
    });
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/svg+xml'
    ];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a valid image file (PNG, JPEG, GIF, WEBP, BMP, SVG).');
      return;
    }

    try {
      const fileSize = file.size;
      const dpi = await extractDpi(file);
      const shouldCompressDpi = (dpi !== null && dpi > 600) && fileSize > 2 * 1024 * 1024;
      if (shouldCompressDpi) {
        // compress (keep legacy behavior: aim for 2MB)
        if (compressEnabled) {
          setCompressing(true);
          try {
            const compressedDataUrl = await compressToFit(file, 2 * 1024 * 1024, 'image/jpeg', true);
            setImage(compressedDataUrl);
            onImage(compressedDataUrl);
          } finally {
            setCompressing(false);
          }
          return;
        }
      }

      // New rule: if file is bigger than 8MB, compress it (prefer WebP and allow downscaling)
      const max8 = 8 * 1024 * 1024;
      if (fileSize > max8) {
        if (compressEnabled) {
          setCompressing(true);
          try {
            const compressedDataUrl = await compressToFit(file, max8, 'image/webp', true);
            setImage(compressedDataUrl);
            onImage(compressedDataUrl);
          } finally {
            setCompressing(false);
          }
          return;
        }
      }
    } catch (err) {
      // parsing/compression failed - fall back to original upload
      console.warn('Image DPI detection/compression failed:', err);
    }

    // default: read normally
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        setImage(reader.result.toString());
        onImage(reader.result.toString());
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setImage('');
    onImage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7em', position: 'relative' }}>
      <label style={{ marginRight: '0.5em' }}>{label}</label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: 'inline-block' }}
      />

      {/* compression checkbox; use native title attribute for full tooltip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4em', marginLeft: '0.5em' }}>
        <label
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3em', cursor: 'pointer', fontSize: '0.85rem' }}
          title={'Images larger than 8MB will be compressed when this is enabled.'}
        >
          <input type="checkbox" checked={compressEnabled} onChange={(ev) => setCompressEnabled(ev.target.checked)} />
          <span>Upload Compression</span>
        </label>
      </div>

      {image && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4em', marginLeft: '0.5em' }}>
          {compressing && (
            <span aria-hidden style={{ width: '1em', height: '1em', display: 'inline-block' }}>
              <svg width="16" height="16" viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="20" fill="none" stroke="#555" strokeWidth="4" strokeDasharray="31.4 31.4">
                  <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="1s" repeatCount="indefinite" />
                </circle>
              </svg>
            </span>
          )}
          <span
            title="Remove image"
            onClick={handleRemove}
            style={{
              color: '#a00',
              fontWeight: 'bold',
              fontSize: '1.5em',
              cursor: 'pointer',
              userSelect: 'none',
              textShadow: '0 0 2px #400'
            }}
          >&#10006;</span>
        </div>
      )}
    </div>
  );
}
