import React, { forwardRef } from 'react';
import PTGStyle from './layouts/PTGStyle';
import PokeMana from './layouts/PokeMana';

interface CardPreviewProps {
  cardData: any;
  frame: any;
  manaSelects: string[];
  manaIcons: Record<string, (color: string) => React.ReactNode>;
  template: string; // template type for switchable layouts
}

const CardPreview = forwardRef<HTMLDivElement, CardPreviewProps>((props, ref) => {
  const { template } = props;
  switch (template) {
    case 'PTG Style':
      return <PTGStyle ref={ref} {...props} />;
    case 'Mana/Token':
      return <PokeMana ref={ref} {...props} />;
    default:
      return <PTGStyle ref={ref} {...props} />;
  }
});

export default CardPreview;
