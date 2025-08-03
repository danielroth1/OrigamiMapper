import React from 'react';

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
      if (reader.result) onImage(reader.result.toString());
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
