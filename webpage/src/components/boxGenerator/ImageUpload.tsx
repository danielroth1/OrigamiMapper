
interface ImageUploadProps {
  label: string;
  onImage: (dataUrl: string) => void;
}

export default function ImageUpload({ label, onImage }: ImageUploadProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Only accept specific image MIME types
    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/gif',
      'image/webp',
      'image/bmp',
      'image/svg+xml',
      'image/x-icon',
      'image/vnd.microsoft.icon'
    ];
    if (!allowedTypes.includes(file.type)) {
      alert('Please upload a valid image file (PNG, JPEG, GIF, WEBP, BMP, SVG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        onImage(reader.result.toString());
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
