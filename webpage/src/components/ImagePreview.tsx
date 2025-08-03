interface ImagePreviewProps {
  src: string;
  label: string;
}

export default function ImagePreview({ src, label }: ImagePreviewProps) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: '#fff', fontSize: '1em', marginBottom: '0.3em' }}>{label}</div>
      <img
        src={src}
        alt={label}
        style={{
          maxWidth: '180px',
          width: '100%',
          height: 'auto',
          borderRadius: '8px',
          boxShadow: '0 2px 8px #0006',
        }}
      />
    </div>
  );
}
