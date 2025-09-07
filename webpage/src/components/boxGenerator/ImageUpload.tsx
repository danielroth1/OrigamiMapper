
import React, { useState, useRef } from 'react';

interface ImageUploadProps {
  label: string;
  onImage: (dataUrl: string) => void;
  // optional id to apply to the file input element so other UI can trigger it
  inputId?: string;
}

export default function ImageUpload({ label, onImage, inputId }: ImageUploadProps) {
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [loadingUrl, setLoadingUrl] = useState(false);
  
  const inputRef = useRef<HTMLInputElement | null>(null);



  const fileToDataUrl = (file: Blob) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const handleFile = async (file: File) => {
    if (!file) return;
    // allow images only
    if (!file.type || !file.type.startsWith('image/')) {
      alert('Please upload a valid image file.');
      return;
    }
    try {
  const dataUrl = await fileToDataUrl(file);
      onImage(dataUrl);
    } catch (err) {
      console.warn('Failed to read file', err);
      alert('Failed to read file');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    void handleFile(file);
  };

  const loadFromUrl = async (rawUrl: string) => {
    if (!rawUrl) return;
    setLoadingUrl(true);
    try {
      const res = await fetch(rawUrl, { method: 'GET', cache: 'no-cache' });
      if (!res.ok) throw new Error('Failed to fetch image: ' + res.status);
      const blob = await res.blob();
      if (!blob.type || !blob.type.startsWith('image/')) {
        const lower = rawUrl.split('?')[0].toLowerCase();
        if (!lower.match(/\.svg$/)) throw new Error('URL did not point to a recognized image type');
      }
  const dataUrl = await fileToDataUrl(blob);
      onImage(dataUrl);
      setUrlValue('');
      setShowUrlInput(false);
    } catch (err) {
      console.warn('Failed to load image from URL', err);
      alert('Failed to load image from URL: ' + String(err));
    } finally {
      setLoadingUrl(false);
    }
  };

  // Drag / drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Prefer files
    const dt = e.dataTransfer;
    if (dt.files && dt.files.length > 0) {
      const f = dt.files[0];
      void handleFile(f);
      return;
    }
    // Fallback: try to read a dragged URL
    const url = dt.getData('text/uri-list') || dt.getData('text/plain');
    if (url) void loadFromUrl(url.trim());
  };

  // Paste handler (when area is focused)
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === 'file' && it.type.startsWith('image/')) {
        const file = it.getAsFile();
        if (file) { e.preventDefault(); void handleFile(file); return; }
      }
    }
    // no file in clipboard; maybe a URL string
    const txt = e.clipboardData.getData('text/plain');
    if (txt && (txt.startsWith('http://') || txt.startsWith('https://'))) {
      e.preventDefault();
      void loadFromUrl(txt.trim());
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 8, color: '#ddd' }}>{label}</div>
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={0}
        role="button"
        aria-label="Image drop area"
        onClick={() => inputRef.current?.click()}
        style={{
          border: '2px dashed rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: 12,
          minHeight: 84,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          background: '#0f0f10',
          cursor: 'pointer'
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ color: '#aaa', fontSize: '0.95em' }}>Drop image here or paste (Ctrl/Cmd+V).</div>
          <div style={{ color: '#888', fontSize: '0.85em', marginTop: 6 }}>Click to browse files or use the URL loader.</div>
          <div style={{ marginTop: 8 }}>
            <button type="button" onClick={(e) => { e.stopPropagation(); setShowUrlInput(s => !s); }} style={{ padding: '6px 10px' }}>
              {showUrlInput ? 'Cancel URL' : 'Load from URL'}
            </button>
          </div>
        </div>
        <input ref={el => { inputRef.current = el }} id={inputId} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
      </div>

      {showUrlInput && (
        <form onSubmit={(e) => { e.preventDefault(); void loadFromUrl(urlValue.trim()); }} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            type="url"
            placeholder="https://example.com/image.png"
            value={urlValue}
            onChange={e => setUrlValue(e.target.value)}
            style={{ flex: 1 }}
            aria-label="Image URL"
          />
          <button type="submit" disabled={loadingUrl}>{loadingUrl ? 'Loading...' : 'Load'}</button>
        </form>
      )}
    </div>
  );
}
