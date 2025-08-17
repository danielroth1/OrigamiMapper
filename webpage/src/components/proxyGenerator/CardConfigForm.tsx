import React from 'react';
import PTGConfigForm from './layouts/PTGConfigForm';
import PokeManaConfigForm from './layouts/PokeManaConfigForm';

interface CardConfigFormProps {
  cardData: any;
  cardStyle: string;
  templateType: string;
  setTemplateType: (template: string) => void;
  manaSelects: string[];
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onManaSelect: (index: number, value: string) => void;
  setCardStyle: (style: string) => void;
}

const CardConfigForm: React.FC<CardConfigFormProps> = (props) => {
  switch (props.templateType) {
    case 'PTG Style':
      return <PTGConfigForm {...props} />;
    case 'Poké Mana':
      return <PokeManaConfigForm {...props} />;
    default:
      return <PTGConfigForm {...props} />;
  }
};

export default CardConfigForm;
