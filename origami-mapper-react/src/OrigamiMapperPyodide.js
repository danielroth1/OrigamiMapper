let pyodide = null;

export async function loadPyodideAndMapper() {
  if (!pyodide) {
    pyodide = await window.loadPyodide();
    await pyodide.loadPackage(['numpy', 'pillow', 'scikit-image']);
    const code = await fetch('./origami-mapper/origami_mapper_pyodide.py').then(r => r.text());
    // const code = await fetch('./origami_mapper_pyodide.py').then(r => r.text());
    console.log("code:", code);
    await pyodide.runPythonAsync(code);
  }
  return pyodide;
}

export async function runMapping(outsideImage, insideImage, templateJson) {
  await loadPyodideAndMapper();
  pyodide.globals.set('outside_image_data', outsideImage);
  pyodide.globals.set('inside_image_data', insideImage);
  pyodide.globals.set('template_json', templateJson);
  console.log("templateJson:", templateJson, "outsideImage:", outsideImage, "insideImage:", insideImage);
  let result = await pyodide.runPythonAsync(`
run_mapping_from_data(outside_image_data, inside_image_data, template_json)
  `);
  return result.toJs();
}