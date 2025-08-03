import React from "react";

export default function ImageUpload({ label, onImage }) {
  return (
    <div>
      <label>
        {label}
        <input
          type="file"
          accept="image/*"
          onChange={e => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = () => onImage(reader.result);
              reader.readAsDataURL(file);
            }
          }}
        />
      </label>
    </div>
  );
}