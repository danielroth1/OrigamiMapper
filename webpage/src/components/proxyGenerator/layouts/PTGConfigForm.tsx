import React from 'react';
import CardColorSelect from './CardColorSelect';
import './PTGConfigForm.css';

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
    <form className="ptg-config-form">
      <div className="ptg-top-bar">
        <div className="ptg-color-template-group">
          <CardColorSelect cardStyle={props.cardStyle} setCardStyle={props.setCardStyle} />
          <label htmlFor="card-template-select">Card Style:</label>
          <select
            id="card-template-select"
            value={props.templateType}
            onChange={e => props.setTemplateType(e.target.value)}
          >
            <option value="PTG Style">PTG Style</option>
            <option value="Mana/Token">Mana/Token/Energy</option>
          </select>
        </div>
      </div>

      <div className="ptg-row">
        <label>Name:</label>
        <input type="text" name="name" value={props.cardData.name} onChange={props.onChange} />
      </div>

      <div className="ptg-row ptg-mana-selects">
        <label>Mana Cost:</label>
        <input
          type="text"
          name="manaCost"
          value={props.cardData.manaCost}
          onChange={props.onChange}
          className="ptg-mana-cost-input"
          maxLength={2}
          placeholder="##"
          pattern="[0-9]{0,2}"
          title="0-99"
          inputMode="numeric"
          style={{ minWidth: '40px' }}
        />
        {[0,1,2,3].map(i => (
          <select key={i} value={props.manaSelects[i]} onChange={e => props.onManaSelect(i, e.target.value)}>
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

      <div className="ptg-row">
        <label htmlFor="imageFit">Art Image Fit:</label>
        <select id="imageFit" name="imageFit" value={props.cardData.imageFit || 'cover'} onChange={props.onChange}>
          <option value="cover">All of the space should be filled (cover)</option>
          <option value="contain">Fit (contain)</option>
          <option value="fill">Stretch (fill)</option>
        </select>
        <label htmlFor="imageTransform">Transform:</label>
        <select id="imageTransform" name="imageTransform" value={props.cardData.imageTransform || 'none'} onChange={props.onChange}>
          <option value="none">None</option>
          <option value="rotate90">Rotate 90°</option>
          <option value="rotate180">Rotate 180°</option>
          <option value="rotate270">Rotate 270°</option>
          <option value="flipH">Flip Horizontal</option>
          <option value="flipV">Flip Vertical</option>
        </select>
      </div>

      <div className="ptg-row">
        <label>Type Line:</label>
        <input type="text" name="typeLine" value={props.cardData.typeLine} onChange={props.onChange} />
      </div>

      <div className="ptg-row ptg-pt-row">
        <label className="ptg-checkbox-label" style={{ marginRight: '0.25rem' }}>
          <input
            type="checkbox"
            name="showPT"
            checked={props.cardData.showPT !== false}
            onChange={props.onChange}
            disabled={props.cardData.pwEnabled === true}
          />
          Power / Toughness enabled
        </label>
        <div className="ptg-pt-group">
          <label>Power:</label>
          <input
            type="number"
            name="power"
            value={props.cardData.power}
            onChange={props.onChange}
            className="ptg-very-small-input"
            disabled={props.cardData.showPT === false || props.cardData.pwEnabled === true}
          />
        </div>
        <div className="ptg-pt-group">
          <label>Toughness:</label>
          <input
            type="number"
            name="toughness"
            value={props.cardData.toughness}
            onChange={props.onChange}
            className="ptg-very-small-input"
            disabled={props.cardData.showPT === false || props.cardData.pwEnabled === true}
          />
        </div>
      </div>

      <div className="ptg-row ptg-pw-wrapper">
        <label className="ptg-checkbox-label">
          <input
            type="checkbox"
            name="pwEnabled"
            checked={props.cardData.pwEnabled === true}
            onChange={props.onChange}
          />
          Planeswalker Stats
        </label>
        <div className="ptg-pw-abilities">
          <div className="ptg-pw-ability ptg-pw-row" style={{ alignItems: 'center', gap: '0.5em' }}>
            <label style={{ fontSize: '0.85em', marginRight: '0.3em' }}>Life:</label>
            <input
              type="number"
              name="pwLife"
              value={props.cardData.pwLife ?? 0}
              onChange={props.onChange}
              className="ptg-small-input"
              disabled={!props.cardData.pwEnabled}
            />
          </div>
          {/* force next pwStat rows to start on a new grid row */}
          <div style={{ gridColumn: '1 / -1', height: 0 }} />
          <div className="ptg-pw-ability ptg-pw-row" style={{ alignItems: 'center', gap: '0.5em' }}>
            <input
              type="text"
              name="pwStat1"
              maxLength={3}
              value={props.cardData.pwStat1 ?? '+1'}
              onChange={props.onChange}
              className="ptg-very-small-input"
              disabled={!props.cardData.pwEnabled}
              style={{ marginRight: '0.3em' }}
            />
            <textarea
              name="pwDesc1"
              rows={2}
              maxLength={400}
              placeholder="20-50 words"
              value={props.cardData.pwDesc1 ?? 'Create a 1/1 black Zombie creature token with deathtouch.'}
              onChange={props.onChange}
              disabled={!props.cardData.pwEnabled}
              style={{ flex: 1 }}
            />
          </div>
          <div className="ptg-pw-ability ptg-pw-row" style={{ alignItems: 'center', gap: '0.5em' }}>
            <input
              type="text"
              name="pwStat2"
              maxLength={3}
              value={props.cardData.pwStat2 ?? '-2'}
              onChange={props.onChange}
              className="ptg-very-small-input"
              disabled={!props.cardData.pwEnabled}
              style={{ marginRight: '0.3em' }}
            />
            <textarea
              name="pwDesc2"
              rows={2}
              maxLength={400}
              placeholder="20-50 words"
              value={props.cardData.pwDesc2 ?? 'Up to one target creature gets -X/-X until your next turn, where X is the number of Zombies you control.'}
              onChange={props.onChange}
              disabled={!props.cardData.pwEnabled}
              style={{ flex: 1 }}
            />
          </div>
          <div className="ptg-pw-ability" style={{ alignItems: 'center', gap: '0.5em' }}>
            <input
              type="text"
              name="pwStat3"
              maxLength={3}
              value={props.cardData.pwStat3 ?? '-7'}
              onChange={props.onChange}
              className="ptg-very-small-input"
              disabled={!props.cardData.pwEnabled}
              style={{ marginRight: '0.3em' }}
            />
            <textarea
              name="pwDesc3"
              rows={2}
              maxLength={400}
              placeholder="20-50 words"
              value={props.cardData.pwDesc3 ?? 'Exile all creature cards from graveyards. For each card exiled this way, create a 2/2 black Zombie creature token.'}
              onChange={props.onChange}
              disabled={!props.cardData.pwEnabled}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </div>

      <div className="ptg-text-inline">
        <div className="ptg-inline-field">
          <label htmlFor="rulesText">Rules Text:</label>
          <textarea id="rulesText" name="rulesText" rows={2} value={props.cardData.rulesText} onChange={props.onChange} />
        </div>
        <div className="ptg-inline-field">
          <label htmlFor="flavorText">Flavor Text:</label>
          <textarea id="flavorText" name="flavorText" rows={2} value={props.cardData.flavorText} onChange={props.onChange} />
        </div>
      </div>

      <div className="ptg-row">
        <label>Collector No.:</label>
        <input type="text" name="collectorNo" value={props.cardData.collectorNo} onChange={props.onChange} className="ptg-small-input" />
        <label>Rarity:</label>
        <select name="rarity" value={props.cardData.rarity} onChange={props.onChange} className="ptg-small-input">
          <option>R</option>
          <option>U</option>
          <option>C</option>
          <option>M</option>
        </select>
      </div>

      <div className="ptg-row">
        <label>Set Code:</label>
        <input type="text" name="setCode" value={props.cardData.setCode} onChange={props.onChange} className="ptg-small-input" />
        <label>Language:</label>
        <select name="language" value={props.cardData.language} onChange={props.onChange} className="ptg-small-input">
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

      <div className="ptg-row">
        <label>Copyright:</label>
        <input type="text" name="copyright" value={props.cardData.copyright} onChange={props.onChange} />
      </div>
    </form>
  );
};

export default PTGConfigForm;
