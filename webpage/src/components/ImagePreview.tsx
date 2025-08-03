
interface ImagePreviewProps {
  src: string;
  label: string;
}

export default function ImagePreview({ src, label }: ImagePreviewProps) {
  return (
    <div>
      <h3>{label}</h3>
      <img src={src} alt={label} />
    </div>
  );
}
