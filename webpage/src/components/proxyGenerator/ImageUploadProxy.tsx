

import React, { useState, useRef } from 'react';

interface ImageUploadProps {
  label: string;
  onImage: (dataUrl: string) => void;
}

export default function ImageUpload({ label, onImage }: ImageUploadProps) {
  const [image, setImage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.7em' }}>
      <label style={{ marginRight: '0.5em' }}>{label}</label>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        style={{ display: 'inline-block' }}
      />
      {image && (
        <span
          title="Remove image"
          onClick={handleRemove}
          style={{
            color: '#a00',
            fontWeight: 'bold',
            fontSize: '1.5em',
            cursor: 'pointer',
            marginLeft: '0.5em',
            userSelect: 'none',
            textShadow: '0 0 2px #400'
          }}
        >&#10006;</span>
      )}
    </div>
  );
}
