import React, { useState } from 'react';
import Header from '../components/Header';

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
    const { name, value, type, files } = e.target as any;
    if (type === 'file' && files && files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setCardData(prev => ({ ...prev, image: ev.target?.result as string }));
      };
      reader.readAsDataURL(files[0]);
    } else {
      setCardData(prev => ({ ...prev, [name]: value }));
    }
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
              <label htmlFor="card-image-upload" style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1em', marginBottom: '0.5em', display: 'block' }}></label>
              <input
                id="card-image-upload"
                type="file"
                name="image"
                accept="image/*"
                onChange={handleChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="card-image-upload">
                <button type="button" className="menu-btn" style={{ margin: '0.5em 0' }}>Choose Image</button>
              </label>
              {cardData.image && (
                <div style={{ margin: '1em 0' }}>
                  <img src={cardData.image} alt="Card" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', boxShadow: '0 2px 8px #0006' }} />
                </div>
              )}
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
      </div>
    </div>
  );
};

export default ProxyGenerator;
