import { useEffect, useState } from 'react';

interface TemplateSelectProps {
  onTemplate: (templateJson: string) => void;
}

export default function TemplateSelect({ onTemplate }: TemplateSelectProps) {
  const templates = ['box.json'];
  const [selected, setSelected] = useState('');

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
        <option value="">Select a template</option>
        {templates.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </label>
  );
}
