import React from 'react';
import CardColorSelect from './CardColorSelect';

interface PTGConfigFormProps {
  cardData: any;
  cardStyle: string;
  templateType: string;
  setTemplateType: (template: string) => void;
  manaSelects: string[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onManaSelect: (index: number, value: string) => void;
  setCardStyle: (style: string) => void;
}

const PTGConfigForm: React.FC<PTGConfigFormProps> = (props) => {
  return (
    <form style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
      <div style={{ display: 'flex', gap: '2em', alignItems: 'center', marginBottom: '1em', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1em' }}>
          <CardColorSelect cardStyle={props.cardStyle} setCardStyle={props.setCardStyle} />
          <label htmlFor="card-template-select" style={{ marginLeft: '2em' }}>Card Style:</label>
          <select
            id="card-template-select"
            value={props.templateType}
            onChange={e => props.setTemplateType(e.target.value)}
            style={{ minWidth: '120px', padding: '0.3em', borderRadius: '6px' }}
          >
            <option value="PTG Style">PTG Style</option>
            <option value="Mana/Token">Mana/Token/Energy</option>
          </select>
        </div>
        <div style={{ textAlign: 'center' }}>
          {/* ImageUpload is passed as a prop, but you can use it here if needed */}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>Name:</label>
        <input type="text" name="name" value={props.cardData.name} onChange={props.onChange} style={{ flex: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>Mana Cost:</label>
        <input type="text" name="manaCost" value={props.cardData.manaCost} onChange={props.onChange} style={{ minWidth: '120px' }} />
        {[0,1,2,3].map(i => (
          <select key={i} style={{ minWidth: '50px' }} value={props.manaSelects[i]} onChange={e => props.onManaSelect(i, e.target.value)}>
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
      {/* Art image options */}
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label htmlFor="imageFit">Art Image Fit:</label>
        <select id="imageFit" name="imageFit" value={props.cardData.imageFit || 'cover'} onChange={props.onChange} style={{ minWidth: '140px' }}>
          <option value="cover">All of the space should be filled (cover)</option>
          <option value="contain">Fit (contain)</option>
          <option value="fill">Stretch (fill)</option>
        </select>
        <label htmlFor="imageTransform">Transform:</label>
        <select id="imageTransform" name="imageTransform" value={props.cardData.imageTransform || 'none'} onChange={props.onChange} style={{ minWidth: '140px' }}>
          <option value="none">None</option>
          <option value="rotate90">Rotate 90°</option>
          <option value="rotate180">Rotate 180°</option>
          <option value="rotate270">Rotate 270°</option>
          <option value="flipH">Flip Horizontal</option>
          <option value="flipV">Flip Vertical</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>Type Line:</label>
        <input type="text" name="typeLine" value={props.cardData.typeLine} onChange={props.onChange} style={{ flex: 1 }} />
      </div>
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>
          <input
            type="checkbox"
            name="showPT"
            checked={props.cardData.showPT !== false}
            onChange={props.onChange}
            style={{ marginRight: '0.5em' }}
          />
          Power / Toughness enabled
        </label>
        <label>Power:</label>
        <input type="number" name="power" value={props.cardData.power} onChange={props.onChange} style={{ width: '60px' }} disabled={props.cardData.showPT === false} />
        <label>Toughness:</label>
        <input type="number" name="toughness" value={props.cardData.toughness} onChange={props.onChange} style={{ width: '60px' }} disabled={props.cardData.showPT === false} />
      </div>
      <div>
        <label>Rules Text:</label>
        <textarea name="rulesText" rows={3} value={props.cardData.rulesText} onChange={props.onChange} style={{ width: '100%', resize: 'vertical' }} />
      </div>
      <div>
        <label>Flavor Text:</label>
        <textarea name="flavorText" rows={3} value={props.cardData.flavorText} onChange={props.onChange} style={{ width: '100%', resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>Collector No.:</label>
        <input type="text" name="collectorNo" value={props.cardData.collectorNo} onChange={props.onChange} style={{ width: '80px' }} />
        <label>Rarity:</label>
        <select name="rarity" value={props.cardData.rarity} onChange={props.onChange} style={{ minWidth: '60px' }}>
          <option>R</option>
          <option>U</option>
          <option>C</option>
          <option>M</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>Set Code:</label>
        <input type="text" name="setCode" value={props.cardData.setCode} onChange={props.onChange} style={{ width: '80px' }} />
        <label>Language:</label>
        <select name="language" value={props.cardData.language} onChange={props.onChange} style={{ minWidth: '60px' }}>
          <option>EN</option>
          <option>DE</option>
          <option>FR</option>
          <option>JP</option>
          <option>KZ</option>
          <option>UA</option>
          <option>RU</option>
          <option>CN</option>
          <option>ES</option>
          <option>PT</option>
          <option>IT</option>
          <option>KO</option>
          <option>TK</option>
        </select>
      </div>
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center' }}>
        <label>Copyright:</label>
        <input type="text" name="copyright" value={props.cardData.copyright} onChange={props.onChange} style={{ flex: 1 }} />
      </div>
    </form>
  );
};

export default PTGConfigForm;
