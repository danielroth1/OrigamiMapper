import React from 'react';

interface CardColorSelectProps {
  cardStyle: string;
  setCardStyle: (style: string) => void;
  id?: string;
  style?: React.CSSProperties;
}

const CardColorSelect: React.FC<CardColorSelectProps> = ({ cardStyle, setCardStyle, id = 'card-color-select', style }) => {
  return (
    <>
      <label htmlFor={id}>Card Color:</label>
      <select
        id={id}
        value={cardStyle}
        onChange={(e) => setCardStyle(e.target.value)}
        style={{ minWidth: '120px', padding: '0.3em', borderRadius: '6px', ...(style || {}) }}
      >
        <option value="Black">Black</option>
        <option value="Black2">Black2</option>
        <option value="Green">Green</option>
        <option value="White">White</option>
        <option value="White2">White2 (B/W)</option>
        <option value="Red">Red</option>
        <option value="Red2">Red2 (Coffee)</option>
        <option value="Blue">Blue</option>
        <option value="Blue2">Blue2 (Nautical)</option>
        <option value="Yellow">Yellow</option>
        <option value="Artifact">Artifact</option>
      </select>
    </>
  );
};

export default CardColorSelect;
