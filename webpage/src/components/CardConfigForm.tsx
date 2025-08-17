import React from 'react';

interface CardConfigFormProps {
  cardData: any;
  cardStyle: string;
  manaSelects: string[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onManaSelect: (index: number, value: string) => void;
  onImageUpload: (dataUrl: string) => void;
  setCardStyle: (style: string) => void;
}

const CardConfigForm: React.FC<CardConfigFormProps> = ({ cardData, cardStyle, manaSelects, onChange, onManaSelect, onImageUpload, setCardStyle }) => (
  <form style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
    <div style={{ display: 'flex', gap: '2em', alignItems: 'center', marginBottom: '1em', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1em' }}>
        <label htmlFor="card-style-select">Card Style:</label>
        <select
          id="card-style-select"
          value={cardStyle}
          onChange={e => setCardStyle(e.target.value)}
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
      </div>
      <div style={{ textAlign: 'center' }}>
        {/* ImageUpload is passed as a prop, but you can use it here if needed */}
      </div>
    </div>
    <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
      <label>Name:</label>
      <input type="text" name="name" value={cardData.name} onChange={onChange} style={{ flex: 1 }} />
    </div>
    <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
      <label>Mana Cost:</label>
      <input type="text" name="manaCost" value={cardData.manaCost} onChange={onChange} style={{ minWidth: '120px' }} />
      {[0,1,2,3].map(i => (
        <select key={i} style={{ minWidth: '50px' }} value={manaSelects[i]} onChange={e => onManaSelect(i, e.target.value)}>
          <option value="">--</option>
          <option value="R">Red</option>
          <option value="U">Blue</option>
          <option value="G">Green</option>
          <option value="W">White</option>
          <option value="Y">Yellow</option>
          <option value="B">Black</option>
        </select>
      ))}
    </div>
    <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
      <label>Type Line:</label>
      <input type="text" name="typeLine" value={cardData.typeLine} onChange={onChange} style={{ flex: 1 }} />
    </div>
    <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
      <label>Power:</label>
      <input type="number" name="power" value={cardData.power} onChange={onChange} style={{ width: '60px' }} />
      <label>Toughness:</label>
      <input type="number" name="toughness" value={cardData.toughness} onChange={onChange} style={{ width: '60px' }} />
    </div>
    <div>
      <label>Rules Text:</label>
      <textarea name="rulesText" rows={3} value={cardData.rulesText} onChange={onChange} style={{ width: '100%', resize: 'vertical' }} />
    </div>
    <div>
      <label>Flavor Text:</label>
      <textarea name="flavorText" rows={3} value={cardData.flavorText} onChange={onChange} style={{ width: '100%', resize: 'vertical' }} />
    </div>
    <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
      <label>Collector No.:</label>
      <input type="text" name="collectorNo" value={cardData.collectorNo} onChange={onChange} style={{ width: '80px' }} />
      <label>Rarity:</label>
      <select name="rarity" value={cardData.rarity} onChange={onChange} style={{ minWidth: '60px' }}>
        <option>R</option>
        <option>U</option>
        <option>C</option>
        <option>M</option>
      </select>
    </div>
    <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
      <label>Set Code:</label>
      <input type="text" name="setCode" value={cardData.setCode} onChange={onChange} style={{ width: '80px' }} />
      <label>Language:</label>
      <select name="language" value={cardData.language} onChange={onChange} style={{ minWidth: '60px' }}>
        <option>EN</option>
        <option>DE</option>
        <option>FR</option>
        <option>JP</option>
      </select>
    </div>
    <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
      <label>Copyright:</label>
      <input type="text" name="copyright" value={cardData.copyright} onChange={onChange} style={{ flex: 1 }} />
    </div>
  </form>
);

export default CardConfigForm;
