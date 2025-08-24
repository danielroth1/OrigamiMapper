import React from 'react';
import CardColorSelect from './CardColorSelect';

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
          <CardColorSelect cardStyle={props.cardStyle} setCardStyle={props.setCardStyle} />
          <label htmlFor="card-template-select" style={{ marginLeft: '2em' }}>Card Style:</label>
          <select
            id="card-template-select"
            value={props.templateType}
            onChange={e => props.setTemplateType(e.target.value)}
            style={{ minWidth: '120px', padding: '0.3em', borderRadius: '6px' }}
          >
            <option value="PTG Style">PTG Style</option>
            <option value="Mana/Token">Mana/Token</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1em' }}>
        <label>Title:</label>
        <select name="name" value={props.cardData.name} onChange={props.onChange} style={{ minWidth: '120px', padding: '0.3em', borderRadius: '6px' }}>
          <option value="Mana">Mana</option>
          <option value="Energy">Energy</option>
          <option value="Token">Token</option>
          <option value="Treasure">Treasure</option>
          <option value="Clue">Clue</option>
          <option value="Food">Food</option>
          <option value="Gold">Gold</option>
          <option value="Blood">Blood</option>
          <option value="Powerstone">Powerstone</option>
          <option value="Map">Map</option>
          <option value="The Ring">The Ring</option>
          <option value="Emblem">Emblem</option>
          <option value="Poison">Poison</option>
          <option value="Experience">Experience</option>
          <option value="Monarch">Monarch</option>
          <option value="City's Blessing">City's Blessing</option>
          <option value="Initiative">Initiative</option>
          <option value="Energy Reserve">Energy Reserve</option>
          <option value="Zombie">Zombie</option>
          <option value="Goblin">Goblin</option>
          <option value="Soldier">Soldier</option>
          <option value="Angel">Angel</option>
          <option value="Dragon">Dragon</option>
          <option value="Beast">Beast</option>
          <option value="Saproling">Saproling</option>
          <option value="Spirit">Spirit</option>
          <option value="Elemental">Elemental</option>
          <option value="Elf">Elf</option>
          <option value="Cat">Cat</option>
          <option value="Bird">Bird</option>
          <option value="Construct">Construct</option>
          <option value="Human">Human</option>
          <option value="Knight">Knight</option>
          <option value="Wolf">Wolf</option>
          <option value="Rat">Rat</option>
          <option value="Snake">Snake</option>
          <option value="Demon">Demon</option>
          <option value="Wurm">Wurm</option>
          <option value="Dragon">Dragon</option>
          <option value="Golem">Golem</option>
          <option value="Plant">Plant</option>
          <option value="Thopter">Thopter</option>
          <option value="Servo">Servo</option>
          <option value="Fish">Fish</option>
          <option value="Insect">Insect</option>
          <option value="Dog">Dog</option>
          <option value="Bear">Bear</option>
          <option value="Fungus">Fungus</option>
          <option value="Horse">Horse</option>
          <option value="Pegasus">Pegasus</option>
          <option value="Squirrel">Squirrel</option>
          <option value="Troll">Troll</option>
          <option value="Unicorn">Unicorn</option>
          <option value="Vampire">Vampire</option>
          <option value="Warrior">Warrior</option>
          <option value="Wizard">Wizard</option>
          <option value="Shapeshifter">Shapeshifter</option>
          <option value="Sliver">Sliver</option>
          <option value="Merfolk">Merfolk</option>
          <option value="Minotaur">Minotaur</option>
          <option value="Ogre">Ogre</option>
          <option value="Orc">Orc</option>
          <option value="Pirate">Pirate</option>
          <option value="Zombie Army">Zombie Army</option>
        </select>
      </div>
      </form>
  );
};

export default PokeManaConfigForm;
