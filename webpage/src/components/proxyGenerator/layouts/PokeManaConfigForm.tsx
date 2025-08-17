import React from 'react';

interface PokeManaConfigFormProps {
  cardData: any;
  cardStyle: string;
  templateType: string;
  setTemplateType: (template: string) => void;
  manaSelects: string[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onManaSelect: (index: number, value: string) => void;
  setCardStyle: (style: string) => void;
}

const PokeManaConfigForm: React.FC<PokeManaConfigFormProps> = (props) => {
  // Example: Only show name, color, and image for PokeMana

  return (
    <form style={{ display: 'flex', flexDirection: 'column', gap: '1em', borderRadius: '8px', padding: '1em' }}>
      <div style={{ display: 'flex', gap: '2em', alignItems: 'center', marginBottom: '1em', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1em' }}>
          <label htmlFor="card-color-select">Card Color:</label>
          <select
            id="card-color-select"
            value={props.cardStyle}
            onChange={e => props.setCardStyle(e.target.value)}
            style={{ minWidth: '120px', padding: '0.3em', borderRadius: '6px' }}
          >
            <option value="Black">Black</option>
            <option value="Black2">Black2</option>
            <option value="Green">Green</option>
            <option value="White">White</option>
            <option value="Red">Red</option>
            <option value="Blue">Blue</option>
            <option value="Yellow">Yellow</option>
            <option value="Artifact">Artifact</option>
          </select>
          <label htmlFor="card-template-select" style={{ marginLeft: '2em' }}>Card Style:</label>
          <select
            id="card-template-select"
            value={props.templateType}
            onChange={e => props.setTemplateType(e.target.value)}
            style={{ minWidth: '120px', padding: '0.3em', borderRadius: '6px' }}
          >
            <option value="PTG Style">PTG Style</option>
            <option value="Poké Mana">Poké Mana</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1em' }}>
        <label>Title:</label>
        <select name="name" value={props.cardData.name} onChange={props.onChange} style={{ minWidth: '120px', padding: '0.3em', borderRadius: '6px' }}>
          <option value="Mana">Mana</option>
          <option value="Energy">Energy</option>
        </select>
      </div>
      </form>
  );
};

export default PokeManaConfigForm;
