import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import CubeViewer, { type FaceTextures } from "../components/boxGenerator/CubeViewer";
import type { OrigamiMapperTypes } from '../OrigamiMapperTypes';
import ImageUpload from '../components/boxGenerator/ImageUpload';
import ImagePreview from '../components/boxGenerator/ImagePreview';
import TemplateSelect from '../components/boxGenerator/TemplateSelect';
import { runMappingJS } from '../OrigamiMapperJS';
import { ImageTransform } from '../components/ImageTransform';
import PolygonEditor, { type PolygonEditorHandle } from '../components/boxGenerator/PolygonEditor';
import boxData from '../templates/box.json';
import Header from '../components/Header';
import '../App.css';


function BoxGenerator() {
  const [outsideImgRaw, setOutsideImgRaw] = useState('');
  const [insideImgRaw, setInsideImgRaw] = useState('');
  const [outsideImgTransformed, setOutsideImgTransformed] = useState('');
  const [insideImgTransformed, setInsideImgTransformed] = useState('');
  const [, setTemplate] = useState('Box');
  const [transformMode, setTransformMode] = useState<'none' | 'scale' | 'tile' | 'tile4' | 'tile8'>('none');
  const [results, setResults] = useState<{ [key: string]: string }>({});
  const [outputDpi, setOutputDpi] = useState<number>(300);
  const [scalePercent, setScalePercent] = useState(0); // percent, can be negative
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [outsideFaces, setOutsideFaces] = useState<FaceTextures>({});
  const [insideFaces, setInsideFaces] = useState<FaceTextures>({});
  // Change this constant in code to control the initial zoom programmatically
  const DEFAULT_VIEWER_ZOOM = 1.0;

  // Build face textures from polygons + background images (async: waits for image load)
  const buildFaceTextures = async (polygons: OrigamiMapperTypes.Polygon[], imgDataUrl: string): Promise<FaceTextures> => {
    if (!imgDataUrl) return {};
    const img = new Image();
    img.src = imgDataUrl; // synchronous set
    const faceGroups: Record<string, OrigamiMapperTypes.Polygon[]> = {};
    polygons.forEach((p: OrigamiMapperTypes.Polygon) => {
      const faceLetter = p.id[0];
      if (!'RLUVH'.includes(faceLetter)) return; // skip unrelated
      // Combine numbered sub-polygons (1,2,3) per face
      (faceGroups[faceLetter] = faceGroups[faceLetter] || []).push(p);
    });
    const out: FaceTextures = {};
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return {};
    // Helper to rasterize polygons of one face into tight bbox and return dataURL
    const renderFace = (polys: OrigamiMapperTypes.Polygon[]) => {
      if (!polys.length) return null;
      // Combine 2D rotation metadata plus any rotation_3d present (average if differing)
      let sumRot = 0, countRot = 0;
      polys.forEach(p => { if (typeof p.rotation === 'number') { sumRot += p.rotation; countRot++; } });
      const baseRot = countRot ? (sumRot / countRot) : 0;
      let sumRot3 = 0, countRot3 = 0;
      polys.forEach(p => { if (typeof p.rotation_3d === 'number') { sumRot3 += p.rotation_3d; countRot3++; } });
      const rot3d = countRot3 ? (sumRot3 / countRot3) : 0;
      const groupRot = baseRot + rot3d;
      const invRot = -groupRot; // rotate canvas by inverse to align content
      // Compute centroid (pivot)
      let cx = 0, cy = 0, count = 0;
      polys.forEach(p => p.vertices.forEach(([x, y]) => { cx += x * img.width; cy += y * img.height; count++; }));
      if (count > 0) { cx /= count; cy /= count; }
      // Compute bounding box in rotated (inverse) space
      const cosI = Math.cos(invRot); const sinI = Math.sin(invRot);
      let rminX = Infinity, rminY = Infinity, rmaxX = -Infinity, rmaxY = -Infinity;
      polys.forEach(p => p.vertices.forEach(([x, y]) => {
        const px = x * img.width; const py = y * img.height;
        const ox = px - cx; const oy = py - cy;
        const rx = ox * cosI - oy * sinI + cx;
        const ry = ox * sinI + oy * cosI + cy;
        if (rx < rminX) rminX = rx; if (ry < rminY) rminY = ry; if (rx > rmaxX) rmaxX = rx; if (ry > rmaxY) rmaxY = ry;
      }));
      if (rminX === Infinity) return null;
      const rw = Math.max(2, Math.ceil(rmaxX - rminX));
      const rh = Math.max(2, Math.ceil(rmaxY - rminY));
      canvas.width = rw; canvas.height = rh;
      ctx.save();
      // Transform so that rotated bounding box top-left becomes (0,0) and rotation undone
      ctx.translate(-rminX, -rminY);
      ctx.translate(cx, cy);
      ctx.rotate(invRot);
      ctx.translate(-cx, -cy);
      // Draw each polygon path, clip, draw image
      polys.forEach(p => {
        ctx.save();
        ctx.beginPath();
        p.vertices.forEach(([x, y], i) => {
          const px = x * img.width; const py = y * img.height;
          if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, 0, 0);
        ctx.restore();
      });
      ctx.restore();
      return canvas.toDataURL('image/png');
    };
    // Wait for image to load if necessary
    if (!img.complete) {
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve(); // resolve on error too to avoid hanging; will just produce empty textures
      });
    }
    Object.entries(faceGroups).forEach(([letter, polys]) => {
      const tex = renderFace(polys);
      if (tex) out[letter as keyof FaceTextures] = tex;
    });
    return out;
  };

  const handleBuildCubeTextures = (outsidePolys?: OrigamiMapperTypes.Polygon[], insidePolys?: OrigamiMapperTypes.Polygon[]) => {
    // Use provided polygon lists when available (from editor onChange), otherwise query refs
    const outPolys = outsidePolys ?? outsideEditorRef.current?.getCurrentJson().input_polygons ?? [];
    const inPolys = insidePolys ?? insideEditorRef.current?.getCurrentJson().input_polygons ?? [];
    // Build asynchronously and set states when textures are ready. This ensures textures update
    // even if the image wasn't loaded when the build was scheduled.
    buildFaceTextures(outPolys, outsideImgTransformed).then(tex => setOutsideFaces(tex));
    buildFaceTextures(inPolys, insideImgTransformed).then(tex => setInsideFaces(tex));
  };

  // Refs for PolygonEditors
  const outsideEditorRef = useRef<PolygonEditorHandle>(null);
  const insideEditorRef = useRef<PolygonEditorHandle>(null);

  // Transform image according to selected mode
  const transformImage = (dataUrl: string, mode: 'none' | 'scale' | 'tile' | 'tile4' | 'tile8', callback: (result: string) => void) => {
    if (mode === 'none') {
      callback(dataUrl);
    } else if (mode === 'scale') {
      ImageTransform.scaleToA4Ratio(dataUrl, callback);
    } else if (mode === 'tile') {
      ImageTransform.tileToA4Ratio(dataUrl, callback);
    } else if (mode === 'tile4') {
      ImageTransform.tile4Times(dataUrl, callback);
    } else if (mode === 'tile8') {
      ImageTransform.tile8Times(dataUrl, callback);
    }
  };

  // Debounced auto-build when polygon editors or images change. PolygonEditor will call onChange with new JSON.
  const buildDebounceRef = useRef<number | null>(null);
  const scheduleBuild = (outsidePolys?: OrigamiMapperTypes.Polygon[], insidePolys?: OrigamiMapperTypes.Polygon[]) => {
    if (buildDebounceRef.current) window.clearTimeout(buildDebounceRef.current);
    buildDebounceRef.current = window.setTimeout(() => {
      handleBuildCubeTextures(outsidePolys, insidePolys);
      buildDebounceRef.current = null;
    }, 120);
  };

  // Set and transform outside image
  const setOutsideImg = (dataUrl: string) => {
    setOutsideImgRaw(dataUrl);
    transformImage(dataUrl, transformMode, setOutsideImgTransformed);
  };
  const setInsideImg = (dataUrl: string) => {
    setInsideImgRaw(dataUrl);
    transformImage(dataUrl, transformMode, setInsideImgTransformed);
  };

  // Re-transform images when mode changes
  useEffect(() => {
    if (outsideImgRaw) transformImage(outsideImgRaw, transformMode, setOutsideImgTransformed);
    if (insideImgRaw) transformImage(insideImgRaw, transformMode, setInsideImgTransformed);
  }, [transformMode, outsideImgRaw, insideImgRaw]);

  // Rebuild cube textures when transformed images change (debounced)
  useEffect(() => {
    scheduleBuild();
  }, [outsideImgTransformed, insideImgTransformed]);

  const handleRun = async (showProgress = false) => {
    if (!outsideImgTransformed || !insideImgTransformed) {
      alert('Please upload both images.');
      return null;
    }
    if (!outsideEditorRef.current || !insideEditorRef.current) {
      alert('Polygon editors not ready.');
      return null;
    }
    setLoading(true);
    if (showProgress) {
      // show the shared progress bar while mapping runs
      setPdfLoading(true);
      setPdfProgress(5);
      // yield so progress UI shows before heavy mapping work
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    // Get JSONs from both editors
    const outsideJson = outsideEditorRef.current.getCurrentJson();
    const insideJson = insideEditorRef.current.getCurrentJson();
    // Combine them: merge input_polygons and output_polygons, keep other fields from outsideJson
    const combinedJson = {
      ...outsideJson,
      input_polygons: [
        ...(outsideJson.input_polygons ?? []),
        ...(insideJson.input_polygons ?? [])
      ],
      output_polygons: [
        ...(outsideJson.output_polygons ?? []),
        ...(insideJson.output_polygons ?? [])
      ]
    };
    // indicate mapping has started
    if (showProgress) setPdfProgress(20);
    let dict;
    let mappingSucceeded = false;
    try {
      dict = await runMappingJS(outsideImgTransformed, insideImgTransformed, JSON.stringify(combinedJson), outputDpi);
      // mapping done
      if (showProgress) {
        // mapping progress stays within 0..50 so PDF generation can continue from 50..100
        setPdfProgress(40);
        // give UI a moment
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      setResults(dict);
      if (showProgress) {
        // near-complete for mapping, leave at 50 for PDF stage
        setPdfProgress(50);
        // small delay so users can see near-final progress
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      mappingSucceeded = true;
    } finally {
      setLoading(false);
      // If mapping was started for the purpose of a combined run+download and it succeeded,
      // keep the shared PDF progress UI active so the subsequent PDF generation continues
      // the same progress bar. Only clear the progress UI on failure.
      if (showProgress && !mappingSucceeded) {
        setPdfLoading(false);
        setPdfProgress(0);
      }
    }
    return dict;
  };

  // Auto-load demo images if present (public/assets/examples/input.jpg & output.jpg)
  useEffect(() => {
    // Debug gate: only run when in dev mode or explicit VITE_DEBUG flag
    const isDebug = (import.meta as any).env?.DEV || (import.meta as any).env?.VITE_DEBUG === 'true';
    if (!isDebug) return; // skip in production unless flag set
    // Only attempt if neither image is already set (avoid overriding user uploads)
    if (outsideImgRaw || insideImgRaw) return;
    const base = (import.meta as any).env?.BASE_URL || '/'; // Vite base path (e.g., '/origami-mapper/')
    const outsideUrl = base + 'assets/examples/outside.jpg';
    const insideUrl = base + 'assets/examples/inside.jpg';

    const fetchAsDataUrlIfExists = async (url: string): Promise<string | null> => {
      try {
        const res = await fetch(url, { method: 'GET', cache: 'no-cache' });
        if (!res.ok || res.status >= 400) return null;
        const blob = await res.blob();
        if (blob.size === 0) return null;
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (_) {
        return null;
      }
    };

    (async () => {
      const [inputDataUrl, outputDataUrl] = await Promise.all([
        fetchAsDataUrlIfExists(outsideUrl),
        fetchAsDataUrlIfExists(insideUrl)
      ]);
      if (inputDataUrl) setOutsideImg(inputDataUrl); // treat example input as outside image
      if (outputDataUrl) setInsideImg(outputDataUrl); // treat example output as inside image
    })();
  }, [outsideImgRaw, insideImgRaw]);

  const ensureDataUrl = async (url: string): Promise<string> => {
    if (!url) throw new Error('No URL');
    if (url.startsWith('data:')) return url;
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const handleDownloadPdf = async (resultsOverride?: { [key: string]: string }) => {
    try {
      const pageIds = ['output_page1', 'output_page2'];
      const source = resultsOverride ?? results;
      const hasAny = pageIds.some(id => !!source[id]);
      if (!hasAny) return;
      setPdfLoading(true);
      // let React render loading state before doing heavy synchronous work
      await new Promise(resolve => setTimeout(resolve, 0));
      // A4 dimensions in mm
      const PAGE_W = 210;
      const PAGE_H = 297;
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });

      for (let i = 0; i < pageIds.length; i++) {
        const id = pageIds[i];
        const url = source[id];
        // update progress to indicate work started for this page - continue from mapping's 50%
        setPdfProgress(50 + Math.round((i / pageIds.length) * 40));
        // yield so progress UI can update before potentially heavy work
        await new Promise(resolve => setTimeout(resolve, 20));
        if (!url) {
          if (i < pageIds.length - 1) doc.addPage();
          continue;
        }
        const dataUrl = await ensureDataUrl(url);
        // marginPercent applies to each side (percentage of page width/height)
        const frac = (scalePercent || 0) / 100;
        const innerW = PAGE_W * (1 - 2 * frac);
        const innerH = PAGE_H * (1 - 2 * frac);
        const x = (PAGE_W - innerW) / 2;
        const y = (PAGE_H - innerH) / 2;
        // Place image stretched to inner box. If innerW/innerH exceed page, image will be cropped.
        doc.addImage(dataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
        // update progress after placing this page image
        setPdfProgress(50 + Math.round(((i + 1) / pageIds.length) * 40));
        // yield so progress UI can update before next iteration
        await new Promise(resolve => setTimeout(resolve, 20));
        if (i < pageIds.length - 1) doc.addPage();
      }
      // finalizing
      setPdfProgress(95);
      // give the UI a moment to render finalizing state before triggering save
      await new Promise(resolve => setTimeout(resolve, 50));
      doc.save('origami_mapper_results.pdf');
      setPdfProgress(100);
      // small delay so users can see 100% before it disappears
      setTimeout(() => {
        setPdfLoading(false);
        setPdfProgress(0);
      }, 600);
    } catch (err) {
      console.error(err);
      const msg = (err as any)?.message ? (err as any).message : String(err);
      alert('Failed to generate PDF: ' + msg);
      setPdfLoading(false);
      setPdfProgress(0);
    }
  };

  // Run mapping first, then generate PDF
  const handleRunThenDownload = async () => {
    if (loading) return;
    // ensure mapping runs (this function will set loading state itself)
    const dict = await handleRun(true);
    if (dict) await handleDownloadPdf(dict);
  };

  return (
    <>
      <div className="App">
        {/* Fixed header for all pages */}
        <Header />
        <div style={{ color: '#fff', margin: '2em auto 0 auto', fontSize: '1.1em', maxWidth: '600px', textAlign: 'center' }}>
          Build your own Card Deck Box! <br />
          This tool generates printable templates from your images. <br />
          Perfect for holding a standard deck of 60 cards.
        </div>
        <div className="reference-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '2em', marginBottom: '2em' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', marginBottom: '0.5em' }}>Outside Reference</div>
            <img src="/origami-mapper/assets/box_outside_mapping.png" width={120} />
          </div>
          <div style={{ flex: '0 1 400px' }}>
            <section className="upload-card" style={{ background: '#181818', borderRadius: '12px', padding: '1.5em', paddingTop: '0.1em', margin: '1.5em auto', maxWidth: '400px', boxShadow: '0 2px 12px #0006' }}>
              <h2 style={{ color: '#fff', fontSize: '1.3em', marginBottom: '1em' }}>Upload Images</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1em' }}>
                <ImageUpload label="Upload Outside Image" onImage={setOutsideImg} />
                <ImageUpload label="Upload Inside Image" onImage={setInsideImg} />
              </div>
            </section>
            <section className="template-run-card" style={{ background: '#181818', borderRadius: '12px', padding: '1em', margin: '0 auto', maxWidth: '400px', boxShadow: '0 2px 12px #0006', display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75em', width: '100%', alignItems: 'center', justifyItems: 'center' }}>
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TemplateSelect onTemplate={setTemplate} />
                </div>
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5em' }}>
                  <span style={{ color: '#fff' }}>Transform:</span>
                  <select value={transformMode} onChange={e => setTransformMode(e.target.value as any)} style={{ padding: '0.3em', borderRadius: '6px', minWidth: '90px' }}>
                    <option value="none">None</option>
                    <option value="scale">Scale</option>
                    <option value="tile">Tile (Fill A4)</option>
                    <option value="tile4">Tile 4x (2x2)</option>
                    <option value="tile8">Tile 8x (4x2)</option>
                  </select>
                </div>
                <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5em' }}>
                  <span style={{ color: '#fff' }}>Output DPI:</span>
                  <select value={outputDpi} onChange={e => setOutputDpi(Number(e.target.value))} style={{ padding: '0.3em', borderRadius: '6px', minWidth: '80px' }}>
                    <option value={200}>200</option>
                    <option value={300}>300</option>
                    <option value={600}>600</option>
                  </select>
                </div>
                {/* buttons moved below grid */}
              </div>
              <div style={{ width: '100%', display: 'flex', gap: '1em', justifyContent: 'center', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1em' }}>
                  <button onClick={() => handleRun(false)} disabled={loading || pdfLoading} className="menu-btn">
                    {loading ? 'Processing...' : 'Run Mapping'}
                  </button>
                  <button onClick={() => handleRunThenDownload()} disabled={!outsideImgTransformed || !insideImgTransformed || pdfLoading || loading} className="menu-btn">
                    {pdfLoading ? 'Preparing PDF...' : 'Download'}
                  </button>
                </div>
                {/* simple progress bar shown while PDF is being generated */}
                {(pdfLoading || pdfProgress > 0) && (
                  <div style={{ width: '90%', maxWidth: 360, marginTop: 8 }}>
                    <div style={{ height: 10, background: '#2b2b2b', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ width: `${pdfProgress}%`, height: '100%', background: '#4caf50', transition: 'width 200ms ease' }} />
                    </div>
                  </div>
                )}
              </div>
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5em' }}>
                <div style={{ color: '#fff', fontSize: '0.9em' }}>Scale: {scalePercent}%</div>
                <input
                  type="range"
                  min={-20}
                  max={30}
                  value={scalePercent}
                  onChange={e => setScalePercent(Number(e.target.value))}
                  style={{ width: '85%' }}
                />
              </div>
            </section>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', marginBottom: '0.5em' }}>Inside Reference</div>
            <img src="/origami-mapper/assets/box_inside_mapping.png" width={120} />
          </div>
        </div>
        <div className="images" style={{ display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center', justifyContent: 'center' }}>
          {/* Editors side by side */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '2em', justifyContent: 'center', alignItems: 'flex-start' }}>
            <PolygonEditor
              ref={outsideEditorRef}
              onChange={json => scheduleBuild(json.input_polygons, undefined)}
              data={{
                ...boxData,
                offset: (Array.isArray(boxData.offset) ? boxData.offset.slice(0, 2) as [number, number] : [0, 0]),
                input_polygons: (boxData.input_polygons ?? [])
                  .filter(p => !p.id.includes('i'))
                  .map(p => ({
                    ...p,
                    vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
                  })),
                output_polygons: (boxData.output_polygons ?? [])
                  .map(p => ({
                    ...p,
                    vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
                  }))
              }}
              label='Outside image mapping'
              backgroundImg={outsideImgTransformed}
            />
            <PolygonEditor
              ref={insideEditorRef}
              onChange={json => scheduleBuild(undefined, json.input_polygons)}
              data={{
                ...boxData,
                offset: (Array.isArray(boxData.offset) ? boxData.offset.slice(0, 2) as [number, number] : [0, 0]),
                input_polygons: (boxData.input_polygons ?? [])
                  .filter(p => p.id.includes('i'))
                  .map(p => ({
                    ...p,
                    vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
                  })),
                output_polygons: (boxData.output_polygons ?? [])
                  .map(p => ({
                    ...p,
                    vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
                  }))
              }}
              label='Inside image mapping'
              backgroundImg={insideImgTransformed}
            />
          </div>
          {/* Shared info text below both editors */}
          <div style={{ fontSize: '0.65em', color: '#aaa', margin: '0.5em auto 0 auto', lineHeight: 1.2, maxWidth: '400px', wordBreak: 'break-word', whiteSpace: 'pre-line', textAlign: 'center' }}>
            Drag to move (auto group).
            Shift+Drag scale.
            Ctrl/Cmd+Drag rotate.
            Drag empty area to marquee select.
          </div>
          <div style={{ width: 320, height: 260 }}>
            {/* framed boundary for the canvas */}
            <div style={{
              width: '100%',
              height: '100%',
              padding: 8,
              borderRadius: 10,
              background: '#0f0f10',
              border: '1px solid rgba(255,255,255,0.06)',
              boxShadow: '0 4px 18px rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <div style={{ width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1 }}>
                  <CubeViewer outsideFaces={outsideFaces} insideFaces={insideFaces} initialZoom={DEFAULT_VIEWER_ZOOM} />
                </div>
              </div>
            </div>
          </div>
          {/* Output previews side by side */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '2em', justifyContent: 'center', alignItems: 'flex-start', marginTop: '1em' }}>
            <ImagePreview src={results.output_page1} label="Output Page 1" />
            <ImagePreview src={results.output_page2} label="Output Page 2" />
          </div>
        </div>
      </div>
      <footer style={{ color: '#bbb', textAlign: 'center', padding: '1.5em 0', marginTop: '1em', fontSize: '1em' }}>
        <div>
          <br />
          <a href="https://github.com/danielroth1/OrigamiMapper" target="_blank" rel="noopener noreferrer" style={{ color: '#bbb', fontSize: '0.9em', textDecoration: 'underline', margin: '0 0.5em' }}>GitHub</a>
          |
          <a href="https://blog.mailbase.info" target="_blank" rel="noopener noreferrer" style={{ color: '#bbb', fontSize: '0.9em', textDecoration: 'underline', margin: '0 0.5em' }}>Blog</a>
          |
          <a href="https://blog.mailbase.info/datenschutz/" target="_blank" rel="noopener noreferrer" style={{ color: '#bbb', fontSize: '0.9em', textDecoration: 'underline', margin: '0 0.5em' }}>Datenschutz</a>
        </div>
      </footer>
    </>
  );
}

export default BoxGenerator;
