import React from 'react';
import './PTGConfigForm.css';
import {
  ImageControlsSection,
  ManaCostSection,
  PowerToughnessSection,
  CollectorInfoSection,
  CardColorSelect
} from './SharedCardFormComponents';

interface PTGConfigFormProps {
  cardData: any;
  cardStyle: string;
  templateType: string;
  setTemplateType: (template: string) => void;
  manaSelects: string[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onManaSelect: (index: number, value: string) => void;
  setCardStyle: (style: string) => void;
  onImage: (dataUrl: string) => void;
}

const PTGConfigForm: React.FC<PTGConfigFormProps> = (props) => {
  return (
    <form className="ptg-config-form">
      {/* Card Style and Color selectors - first row */}
      <div style={{ display: 'flex', gap: '1em', alignItems: 'center', marginBottom: '1em' }}>
        <div style={{ display: 'flex', gap: '0.5em', alignItems: 'center' }}>
          <label htmlFor="card-template-select">Card Style:</label>
          <select
            id="card-template-select"
            value={props.templateType}
            onChange={e => props.setTemplateType(e.target.value)}
            style={{ minWidth: '120px' }}
          >
            <option value="PTG Style">PTG Style</option>
            <option value="Mana/Token">Mana/Token</option>
          </select>
        </div>
        <CardColorSelect cardStyle={props.cardStyle} setCardStyle={props.setCardStyle} />
      </div>

      <div className="ptg-top-bar">
        <ImageControlsSection
          cardData={props.cardData}
          cardStyle={props.cardStyle}
          templateType={props.templateType}
          setTemplateType={props.setTemplateType}
          setCardStyle={props.setCardStyle}
          onImage={props.onImage}
          onChange={props.onChange}
        />
      </div>

      <div className="ptg-row">
        <label>Name:</label>
        <input type="text" name="name" value={props.cardData.name} onChange={props.onChange} />
      </div>

      <div className="ptg-mana-selects">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1em', marginBottom: '0.5em' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
            <input
              type="checkbox"
              name="showMana"
              checked={props.cardData.showMana !== false}
              onChange={props.onChange}
            />
            Show Mana Cost
          </label>
        </div>
        <ManaCostSection
          cardData={props.cardData}
          manaSelects={props.manaSelects}
          onChange={props.onChange}
          onManaSelect={props.onManaSelect}
        />
      </div>

      

      <div className="ptg-row">
        <label>Type Line:</label>
        <input type="text" name="typeLine" value={props.cardData.typeLine} onChange={props.onChange} />
      </div>

      <div className="ptg-row ptg-pt-row">
        <PowerToughnessSection
          cardData={props.cardData}
          onChange={props.onChange}
        />
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
          <textarea id="rulesText" name="rulesText" rows={4} value={props.cardData.rulesText} onChange={props.onChange} />
        </div>
        <div className="ptg-inline-field">
          <label htmlFor="flavorText">Flavor Text:</label>
          <textarea id="flavorText" name="flavorText" rows={4} value={props.cardData.flavorText} onChange={props.onChange} />
        </div>
      </div>

      <CollectorInfoSection
        cardData={props.cardData}
        onChange={props.onChange}
        variant="ptg"
      />
    </form>
  );
};

export default PTGConfigForm;
