
interface ImageUploadProps {
  label: string;
  onImage: (dataUrl: string) => void;
  // optional id to apply to the file input element so other UI can trigger it
  inputId?: string;
}

export default function ImageUpload({ label, onImage, inputId }: ImageUploadProps) {
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
      <input id={inputId} type="file" accept="image/*" onChange={handleChange} />
    </label>
  );
}
