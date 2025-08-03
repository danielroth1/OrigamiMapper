import React from "react";

export default function ImagePreview({ src, label }) {
  return (
    <div>
      <h3>{label}</h3>
      <img src={src} alt={label} />
    </div>
  );
}