import React, { useState } from 'react';
import Header from '../components/Header';
import ImageUpload from '../components/ImageUpload';

const currentYear = new Date().getFullYear();
const initialCardData = {
  image: '',
  name: 'Arcane Phoenix',
  manaCost: '3 {R} {U}',
  typeLine: 'Creature — Phoenix Wizard',
  power: 4,
  toughness: 4,
  rulesText: "Flying, haste. Whenever Arcane Phoenix deals combat damage to a player, draw a card.\n{R}{U}: Return Arcane Phoenix from your graveyard to your hand.",
  flavorText: "Born from the flames of forgotten spells, it soars above the battlefield, wisdom and fire in its wake.",
  collectorNo: '0217',
  rarity: 'M',
  setCode: 'MYT',
  language: 'EN',
  artist: 'Jonas Roth',
  copyright: `© ${currentYear} Jonas Roth`,
};

const ProxyGenerator: React.FC = () => {
  const [cardData, setCardData] = useState(initialCardData);
  const [cardStyle, setCardStyle] = useState('Modern');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target as any;
    setCardData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (dataUrl: string) => {
    setCardData(prev => ({ ...prev, image: dataUrl }));
  };

  return (
    <div className="App">
      <Header />
      <div style={{ maxWidth: '700px', margin: '2em auto', background: '#181818', borderRadius: '12px', padding: '2em', color: '#fff', boxShadow: '0 2px 12px #0006' }}>
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
                <option value="Green">Green</option>
                <option value="White">White</option>
                <option value="Red">Red</option>
                <option value="Blue">Blue</option>
              </select>
            </div>
            <div style={{ textAlign: 'center' }}>
              <ImageUpload label="Choose Image" onImage={handleImageUpload} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Name:</label>
            <input type="text" name="name" value={cardData.name} onChange={handleChange} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Mana Cost:</label>
            <input type="text" name="manaCost" value={cardData.manaCost} onChange={handleChange} style={{ minWidth: '120px' }} />
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Type Line:</label>
            <input type="text" name="typeLine" value={cardData.typeLine} onChange={handleChange} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Power:</label>
            <input type="number" name="power" value={cardData.power} onChange={handleChange} style={{ width: '60px' }} />
            <label>Toughness:</label>
            <input type="number" name="toughness" value={cardData.toughness} onChange={handleChange} style={{ width: '60px' }} />
          </div>
          <div>
            <label>Rules Text:</label>
            <textarea name="rulesText" rows={3} value={cardData.rulesText} onChange={handleChange} style={{ width: '100%', resize: 'vertical' }} />
          </div>
          <div>
            <label>Flavor Text:</label>
            <textarea name="flavorText" rows={3} value={cardData.flavorText} onChange={handleChange} style={{ width: '100%', resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Collector No.:</label>
            <input type="text" name="collectorNo" value={cardData.collectorNo} onChange={handleChange} style={{ width: '80px' }} />
            <label>Rarity:</label>
            <select name="rarity" value={cardData.rarity} onChange={handleChange} style={{ minWidth: '60px' }}>
              <option>R</option>
              <option>U</option>
              <option>C</option>
              <option>M</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Set Code:</label>
            <input type="text" name="setCode" value={cardData.setCode} onChange={handleChange} style={{ width: '80px' }} />
            <label>Language:</label>
            <select name="language" value={cardData.language} onChange={handleChange} style={{ minWidth: '60px' }}>
              <option>EN</option>
              <option>DE</option>
              <option>FR</option>
              <option>JP</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Artist:</label>
            <input type="text" name="artist" value={cardData.artist} onChange={handleChange} style={{ flex: 1 }} />
          </div>
          <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
            <label>Copyright:</label>
            <input type="text" name="copyright" value={cardData.copyright} onChange={handleChange} style={{ flex: 1 }} />
          </div>
        </form>
        {/* Card Live Preview */}
  <div style={{ margin: '2em auto', width: '300px', height: '420px', background: '#EDECE8', border: '2px solid #000', borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.5)', overflow: 'hidden', fontFamily: 'Georgia, serif', position: 'relative', display: 'flex', flexDirection: 'column' }}>
    {/* Name Bar */}
    <div style={{ background: '#D9CFB7', borderBottom: '1px solid #000', padding: '0.4em 0.6em', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontWeight: 'bold', fontSize: '1em', color: '#000' }}>{cardData.name}</span>
      <span style={{ fontFamily: 'monospace', fontSize: '0.9em', color: '#000' }}>{cardData.manaCost}</span>
    </div>
    {/* Art Area */}
    <div style={{
      width: `${(48.5/63.5)*100}%`,
      height: `${(39/88.9)*100}%`,
      background: cardData.image ? `url(${cardData.image}) center/cover` : '#AAA',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      margin: '0 auto'
    }} />
    {/* Type Bar */}
  <div style={{ background: '#D9CFB7', borderBottom: '1px solid #000', padding: '0.3em 0.6em', fontStyle: 'italic', fontSize: '0.85em', color: '#000', textAlign: 'left' }}>{cardData.typeLine}</div>
    {/* Text Box */}
  <div style={{ padding: '0.5em 0.6em', fontSize: '0.8em', flex: '1', overflowY: 'auto', whiteSpace: 'pre-line', color: '#000' }}>
      {cardData.rulesText}
      {cardData.flavorText && <div style={{ fontStyle: 'italic', marginTop: '0.5em', color: '#444' }}>{cardData.flavorText}</div>}
    </div>
    {/* Bottom Info */}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7em', padding: '0.3em 0.6em', borderTop: '1px solid #000', color: '#000' }}>
      <span>{cardData.collectorNo} • {cardData.rarity} • {cardData.setCode} • {cardData.language}</span>
      <span>{cardData.artist}</span>
    </div>
    {/* Power/Toughness */}
    <div style={{ position: 'absolute', bottom: '0.4em', right: '0.4em', border: '1px solid #000', background: '#EDECE8', padding: '0 0.2em', fontWeight: 'bold', fontSize: '0.9em' }}>
      {cardData.power}/{cardData.toughness}
    </div>
    {/* Copyright */}
    <div style={{ position: 'absolute', bottom: '0.4em', left: '0.6em', fontSize: '0.6em' }}>{cardData.copyright}</div>
  </div>
      </div>
    </div>
  );
};

export default ProxyGenerator;
