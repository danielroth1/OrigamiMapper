import React, { useEffect, useState } from "react";

export default function TemplateSelect({ onTemplate }) {
  const templates = ["box.json"]; // Add more filenames as needed
  const [selected, setSelected] = useState("");

  useEffect(() => {
    if (selected) {
      fetch(`./origami-mapper/templates/${selected}`)
      // fetch(`./templates/${selected}`)
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
        style={{ marginLeft: "1em" }}
      >
        <option value="">Select a template</option>
        {templates.map(t => (
          <option key={t} value={t}>{t}</option>
        ))}
      </select>
    </label>
  );
}