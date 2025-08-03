let pyodide: any = null;

export async function loadPyodideAndMapper() {
  if (!pyodide) {
    pyodide = await (window as any).loadPyodide();
    await pyodide.loadPackage(['numpy', 'pillow', 'scikit-image']);
    // const code = await fetch('./origami-mapper/origami_mapper_pyodide.py').then(r => r.text()); // TODO: Uncomment this line if you have a specific path for templates
    const code = await fetch('./origami_mapper_pyodide.py').then(r => r.text());
    console.log("code:", code);
    await pyodide.runPythonAsync(code);
  }
  return pyodide;
}

export async function runMapping(outsideImage: string, insideImage: string, templateJson: string) {
  await loadPyodideAndMapper();
  pyodide.globals.set('outside_image_data', outsideImage);
  pyodide.globals.set('inside_image_data', insideImage);
  pyodide.globals.set('template_json', templateJson);
  let result = await pyodide.runPythonAsync(`
run_mapping_from_data(outside_image_data, inside_image_data, template_json)
  `);
  return result.toJs();
}
