import React, { useState } from "react";
import logo from './logo.svg';
import ImageUpload from "./components/ImageUpload";
import ImagePreview from "./components/ImagePreview";
import TemplateSelect from "./components/TemplateSelect";
import { runMapping } from "./OrigamiMapperPyodide";
import "./App.css";

function App() {
  const [outsideImg, setOutsideImg] = useState("");
  const [insideImg, setInsideImg] = useState("");
  const [template, setTemplate] = useState("");
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);

  const handleRun = async () => {
    if (!outsideImg || !insideImg || !template) {
      alert("Please upload both images and select a template.");
      return;
    }
    setLoading(true);
    console.log("template:", template, "outsideImage:", outsideImg, "insideImage:", insideImg);
    const res = await runMapping(outsideImg, insideImg, template);
    console.log("Mapping results:", res);
    var dict = {
      output_page1: res.get('output_page1'),
      output_page2: res.get('output_page2'),
      output_outside_mapping: res.get('output_outside_mapping'),
      output_inside_mapping: res.get('output_inside_mapping')
    };
    console.log("Processed results:", dict);
    setResults(dict);
    setLoading(false);
  };

  const handleDownloadAll = () => {
    ["output_page1", "output_page2", "output_outside_mapping", "output_inside_mapping"].forEach(id => {
      const url = results[id];
      if (url) {
        const link = document.createElement("a");
        link.href = url;
        link.download = id + ".png";
        link.click();
      }
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <img src={"./logo512x306.png"} className="App-logo" alt="logo" />
        <div>To fit your image to your box, you may use the following A4 sheets as reference.</div>
        &nbsp;<br/>
        <div className="images">
          <div>
            outside:<br/>
            <img src={"./assets/box_outside_mapping.png"} width={300}/>
          </div>
          <div>
            inside:<br/>
            <img src={"./assets/box_inside_mapping.png"} width={300}/>
          </div>
        </div>
        &nbsp;<br/>
        <ImageUpload label="Upload Outside Image: " onImage={setOutsideImg} />
        <ImageUpload label="Upload Inside Image: " onImage={setInsideImg} />
        <TemplateSelect onTemplate={setTemplate} />
        <div>
          <button onClick={handleRun} disabled={loading}>
            {loading ? "Processing..." : "Run Mapping"}
          </button>
          <button onClick={handleDownloadAll} disabled={!results.output_page1}>
            Download All Results
          </button>
        </div>
        <div className="images">
          <ImagePreview src={outsideImg} label="Outside Input" />
          <ImagePreview src={insideImg} label="Inside Input" />
          <ImagePreview src={results.output_page1} label="Output Page 1" />
          <ImagePreview src={results.output_page2} label="Output Page 2" />
          <ImagePreview src={results.output_outside_mapping} label="Outside Mapping" />
          <ImagePreview src={results.output_inside_mapping} label="Inside Mapping" />
        </div>
      </header>
    </div>
  );
}

export default App;
