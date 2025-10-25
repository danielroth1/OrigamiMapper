import React from 'react';

interface OutputDpiSelectProps {
  value: number;
  onChange: (dpi: number) => void;
}

const OutputDpiSelect: React.FC<OutputDpiSelectProps> = ({ value, onChange }) => {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5em', width: '100%' }}>
      <span style={{ color: '#fff' }}>Output DPI:</span>
      <select 
        value={value} 
        onChange={e => onChange(Number(e.target.value))} 
        style={{ padding: '0.3em', borderRadius: '6px', minWidth: '80px' }}
      >
        <option value={200}>200</option>
        <option value={300}>300</option>
        <option value={600}>600</option>
      </select>
    </div>
  );
};

export default OutputDpiSelect;
