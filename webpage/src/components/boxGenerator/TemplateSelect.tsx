import { useState, useEffect } from 'react';

interface TemplateSelectProps {
  onTemplate: (templateJson: string) => void;
}

export default function TemplateSelect({ onTemplate }: TemplateSelectProps) {
  // List of templates (add more as needed)
  const templates = ['box.json'];
  // Capitalize and remove .json for display
  const displayName = (t: string) => t.replace('.json', '').replace(/^./, c => c.toUpperCase());
  // Default selection is 'Box'
  const [selected, setSelected] = useState('box.json');

  useEffect(() => {
    if (selected) {
      fetch(`/origami-mapper/templates/${selected}`)
        .then(res => res.text())
        .then(onTemplate);
    }
  }, [selected, onTemplate]);

  return (
    <label style={{ display: 'flex', alignItems: 'start', gap: '1em', margin: 0 }}>
      <span style={{ color: '#fff' }}>Template:</span>
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        style={{ padding: '0.3em', borderRadius: '6px', minWidth: '90px' }}
      >
        {templates.map(t => (
          <option key={t} value={t}>{displayName(t)}</option>
        ))}
      </select>
    </label>
  );
}
