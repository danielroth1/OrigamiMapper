import { useEffect, useState } from 'react';

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
      fetch(`/templates/${selected}`)
        .then(res => res.text())
        .then(onTemplate);
    }
  }, [selected, onTemplate]);

  return (
    <label>
      Template:
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        style={{ marginLeft: '1em' }}
      >
        {templates.map(t => (
          <option key={t} value={t}>{displayName(t)}</option>
        ))}
      </select>
    </label>
  );
}
