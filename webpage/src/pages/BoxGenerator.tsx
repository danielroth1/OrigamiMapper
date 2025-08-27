import { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import CubeViewer, { type FaceTextures } from "../components/boxGenerator/CubeViewer";
import type { OrigamiMapperTypes } from '../OrigamiMapperTypes';
import ImagePreview from '../components/boxGenerator/ImagePreview';
import TemplateSelect from '../components/boxGenerator/TemplateSelect';
import { runMappingJS } from '../OrigamiMapperJS';
import { ImageTransform } from '../components/ImageTransform';
import PolygonEditor, { type PolygonEditorHandle } from '../components/boxGenerator/PolygonEditor';
import boxData from '../templates/box.json';
import Header from '../components/Header';
import '../App.css';
import { IoSave, IoCloudUpload } from 'react-icons/io5';


function BoxGenerator() {
  const [outsideImgRaw, setOutsideImgRaw] = useState('');
  const [insideImgRaw, setInsideImgRaw] = useState('');
  const [outsideImgTransformed, setOutsideImgTransformed] = useState('');
  const [insideImgTransformed, setInsideImgTransformed] = useState('');
  const [, setTemplate] = useState('Box');
  const [transformMode, setTransformMode] = useState<'none' | 'scale' | 'tile' | 'tile4' | 'tile8'>('none');
  const [results, setResults] = useState<{ [key: string]: string }>({});
  const [outputDpi, setOutputDpi] = useState<number>(300);
  const [scalePercent, setScalePercent] = useState(0); // percent (0..100+): amount to reduce the printed box on each side
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [withFoldLines, setWithFoldLines] = useState(true);
  const [withCutLines, setWithCutLines] = useState(true);
  const [outsideFaces, setOutsideFaces] = useState<FaceTextures>({});
  const [insideFaces, setInsideFaces] = useState<FaceTextures>({});
  const [suppressAutoDemo, setSuppressAutoDemo] = useState(false);
  // Rotation selectors (0, 90, 180, 270 degrees) per image
  const [outsideRotation, setOutsideRotation] = useState<0 | 90 | 180 | 270>(0);
  const [insideRotation, setInsideRotation] = useState<0 | 90 | 180 | 270>(0);
  // Change this constant in code to control the initial zoom programmatically
  const DEFAULT_VIEWER_ZOOM = 1.0;
  // 1x1 transparent PNG used as placeholder when one image is missing for mapping
  const BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

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
      // disable smoothing to keep pixel-exact tiling
      ctx.imageSmoothingEnabled = false;
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
        // Tile the source image across the polygon's bounding box so texture repeats when polygons
        // reference coordinates outside the 0..1 range.
        try {
          const startX = Math.floor(rminX / img.width) * img.width;
          const startY = Math.floor(rminY / img.height) * img.height;
          for (let tx = startX; tx <= rmaxX; tx += img.width) {
            for (let ty = startY; ty <= rmaxY; ty += img.height) {
              // Determine tile indices relative to start
              const ix = Math.round((tx - 0) / img.width);
              const iy = Math.round((ty - 0) / img.height);
              const flipH = (ix % 2) !== 0; // flip horizontally on odd columns
              const flipV = (iy % 2) !== 0; // flip vertically on odd rows
              ctx.save();
              try {
                // Move to tile origin. Draw with a 1px overlap to avoid seam gaps caused by clipping/rounding.
                const drawX = tx;
                const drawY = ty;
                if (flipH || flipV) {
                  const transX = drawX + (flipH ? img.width : 0);
                  const transY = drawY + (flipV ? img.height : 0);
                  ctx.translate(transX, transY);
                  ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
                  ctx.drawImage(img, 0, 0);
                } else {
                  ctx.drawImage(img, drawX, drawY);
                }
              } catch (err) {
                // fallback to simple draw without overlap
                try { ctx.drawImage(img, tx, ty); } catch { }
              }
              ctx.restore();
            }
          }
        } catch (err) {
          // Fallback: draw single image at origin
          try { ctx.drawImage(img, 0, 0); } catch { }
        }
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

  const getEditorData = (isInside: boolean) => ({
  ...boxData,
  offset: (Array.isArray(boxData.offset) ? (boxData.offset.slice(0, 2) as [number, number]) : ([0, 0] as [number, number])),
    input_polygons: (boxData.input_polygons ?? []).filter(p => isInside ? p.id.includes('i') : !p.id.includes('i')).map(p => ({
      ...p,
      vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
    })),
    output_polygons: (boxData.output_polygons ?? []).map(p => ({
      ...p,
      vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
    }))
  });

  // Transform image according to selected mode
  const transformImage = (
    dataUrl: string,
    mode: 'none' | 'scale' | 'tile' | 'tile4' | 'tile8',
    rotation: 0 | 90 | 180 | 270,
    callback: (result: string) => void
  ) => {
    // First rotate (if needed), then apply tiling/scaling mode
    const afterRotate = (rotated: string) => {
      if (mode === 'none') {
        callback(rotated);
      } else if (mode === 'scale') {
        ImageTransform.scaleToA4Ratio(rotated, callback);
      } else if (mode === 'tile') {
        ImageTransform.tileToA4Ratio(rotated, callback);
      } else if (mode === 'tile4') {
        ImageTransform.tile4Times(rotated, callback);
      } else if (mode === 'tile8') {
        ImageTransform.tile8Times(rotated, callback);
      }
    };
    ImageTransform.rotateDegrees(dataUrl, rotation, afterRotate);
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
    transformImage(dataUrl, transformMode, outsideRotation, setOutsideImgTransformed);
  };
  const setInsideImg = (dataUrl: string) => {
    setInsideImgRaw(dataUrl);
    transformImage(dataUrl, transformMode, insideRotation, setInsideImgTransformed);
  };

  // Re-transform images when mode changes
  useEffect(() => {
    if (outsideImgRaw) transformImage(outsideImgRaw, transformMode, outsideRotation, setOutsideImgTransformed);
    if (insideImgRaw) transformImage(insideImgRaw, transformMode, insideRotation, setInsideImgTransformed);
  }, [transformMode, outsideRotation, insideRotation, outsideImgRaw, insideImgRaw]);

  // Rebuild cube textures when transformed images change (debounced)
  useEffect(() => {
    scheduleBuild();
  }, [outsideImgTransformed, insideImgTransformed]);

  const handleRun = async (showProgress = false) => {
    setLoading(true);
    if (showProgress) {
      // show the shared progress bar while mapping runs
      setPdfLoading(true);
      setPdfProgress(5);
      // yield so progress UI shows before heavy mapping work
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    // Helper to produce default json from boxData for missing side
    const makeDefaultForSide = (isInside: boolean) => ({
      ...boxData,
      offset: (Array.isArray(boxData.offset) ? boxData.offset.slice(0, 2) as [number, number] : [0, 0]),
      input_polygons: (boxData.input_polygons ?? [])
        .filter(p => isInside ? p.id.includes('i') : !p.id.includes('i'))
        .map(p => ({
          ...p,
          vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
        })),
      output_polygons: (boxData.output_polygons ?? [])
        .map(p => ({
          ...p,
          vertices: ((p.vertices ?? []).filter(v => Array.isArray(v) && v.length === 2) as [number, number][])
        }))
    });

    // Get JSONs from mounted editors or defaults when editor is not present
    const outsideJson = outsideEditorRef.current ? outsideEditorRef.current.getCurrentJson() : makeDefaultForSide(false);
    const insideJson = insideEditorRef.current ? insideEditorRef.current.getCurrentJson() : makeDefaultForSide(true);
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
      // If one side is missing, pass a white canvas image as replacement (do not show on canvas).
      const makeWhiteDataUrl = () => {
        const c = document.createElement('canvas');
        c.width = 800; c.height = 600;
        const cx = c.getContext('2d');
        if (cx) { cx.fillStyle = '#ffffff'; cx.fillRect(0, 0, c.width, c.height); }
        return c.toDataURL('image/png');
      };
      const leftImg = outsideImgTransformed || makeWhiteDataUrl();
      const rightImg = insideImgTransformed || makeWhiteDataUrl();
      dict = await runMappingJS(leftImg, rightImg, JSON.stringify(combinedJson), outputDpi);
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
    if (suppressAutoDemo) return; // user explicitly deleted images; don't auto-reload them
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

  // -------------------------
  // Autosave (IndexedDB) & .mapper file save/load helpers
  // -------------------------
  const DB_NAME = 'origami-mapper';
  const STORE_NAME = 'projects';
  const DB_VERSION = 1;

  const openDB = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  const putItem = async (item: any) => {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const r = store.put(item);
      r.onsuccess = () => resolve();
      r.onerror = () => reject(r.error);
    });
  };

  const getItem = async (id: string) => {
    const db = await openDB();
    return new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const r = store.get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  };

  const dataUrlToBlob = async (dataUrl?: string | null) => {
    if (!dataUrl) return null;
    try {
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch {
      return null;
    }
  };

  const blobToDataUrl = (blob?: Blob | null) => new Promise<string | null>((resolve, reject) => {
    if (!blob) return resolve(null);
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  // Autosave current app state under id 'autosave'
  const saveAutosave = async () => {
    try {
      const outsideJson = outsideEditorRef.current ? outsideEditorRef.current.getCurrentJson() : null;
      const insideJson = insideEditorRef.current ? insideEditorRef.current.getCurrentJson() : null;
      const outsideBlob = await dataUrlToBlob(outsideImgRaw || null);
      const insideBlob = await dataUrlToBlob(insideImgRaw || null);
      const item = {
        id: 'autosave',
        updatedAt: Date.now(),
        outsideBlob,
        insideBlob,
        outsideJson,
        insideJson,
        transformMode,
        scalePercent,
        outputDpi,
        withFoldLines,
        withCutLines
      };
      await putItem(item);
    } catch (err) {
      // non-fatal
      console.warn('Failed to autosave:', err);
    }
  };

  const loadAutosave = async () => {
    try {
      const rec = await getItem('autosave');
      if (!rec) return;
      const outDataUrl = await blobToDataUrl(rec.outsideBlob);
      const inDataUrl = await blobToDataUrl(rec.insideBlob);
      if (outDataUrl) setOutsideImg(outDataUrl);
      if (inDataUrl) setInsideImg(inDataUrl);
      if (rec.transformMode) setTransformMode(rec.transformMode);
      if (typeof rec.scalePercent === 'number') setScalePercent(rec.scalePercent);
      if (typeof rec.outputDpi === 'number') setOutputDpi(rec.outputDpi);
      if (typeof rec.withFoldLines === 'boolean') setWithFoldLines(rec.withFoldLines);
      if (typeof rec.withCutLines === 'boolean') setWithCutLines(rec.withCutLines);
      // restore editor JSONs if editors are mounted later; use a small timeout to allow refs to attach
      setTimeout(() => {
        try { if (rec.outsideJson && outsideEditorRef.current) outsideEditorRef.current.setFromJson(rec.outsideJson); } catch (e) { }
        try { if (rec.insideJson && insideEditorRef.current) insideEditorRef.current.setFromJson(rec.insideJson); } catch (e) { }
      }, 50);
    } catch (err) {
      console.warn('Failed to load autosave:', err);
    }
  };

  // Save to .mapper (zip) file
  const saveToMapperFile = async () => {
    try {
      // Build combined JSON like handleRun does
      const outsideJson = outsideEditorRef.current ? outsideEditorRef.current.getCurrentJson() : boxData;
      const insideJson = insideEditorRef.current ? insideEditorRef.current.getCurrentJson() : boxData;
      const combinedJson = {
        ...outsideJson,
        input_polygons: [ ...(outsideJson.input_polygons ?? []), ...(insideJson.input_polygons ?? []) ],
        output_polygons: [ ...(outsideJson.output_polygons ?? []), ...(insideJson.output_polygons ?? []) ]
      };

      const zip = new JSZip();
      zip.file('box.json', JSON.stringify(combinedJson, null, 2));
      // add raw images if present
      if (outsideImgRaw) {
        const outBlob = await dataUrlToBlob(outsideImgRaw);
        if (outBlob) zip.file('outside.png', outBlob);
      }
      if (insideImgRaw) {
        const inBlob = await dataUrlToBlob(insideImgRaw);
        if (inBlob) zip.file('inside.png', inBlob);
      }
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, 'origami_project.mapper');
    } catch (err) {
      console.error('Failed to save .mapper file:', err);
      alert('Failed to save project file: ' + String(err));
    }
  };

  // Hidden file input ref for loading .mapper files
  const mapperInputRef = useRef<HTMLInputElement | null>(null);

  const onMapperFileSelected = async (file: File | null) => {
    if (!file) return;
    try {
      const ab = await file.arrayBuffer();
      const zip = await JSZip.loadAsync(ab);
      // read box.json
      if (zip.file('box.json')) {
        const txt = await zip.file('box.json')!.async('string');
        try {
          const parsed = JSON.parse(txt);
          // Split parsed JSON into outside/inside variants and set into respective editors
          const outsideParsed = {
            ...parsed,
            input_polygons: (parsed.input_polygons ?? []).filter((p: any) => !String(p.id).includes('i'))
          };
          const insideParsed = {
            ...parsed,
            input_polygons: (parsed.input_polygons ?? []).filter((p: any) => String(p.id).includes('i'))
          };
          setTimeout(() => {
            try { if (outsideParsed && outsideEditorRef.current) outsideEditorRef.current.setFromJson(outsideParsed); } catch (e) { }
            try { if (insideParsed && insideEditorRef.current) insideEditorRef.current.setFromJson(insideParsed); } catch (e) { }
          }, 50);
        } catch (e) { console.warn('box.json parse error', e); }
      }
      // images
      if (zip.file('outside.png')) {
        const blob = await zip.file('outside.png')!.async('blob');
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl) setOutsideImg(dataUrl);
      }
      if (zip.file('inside.png')) {
        const blob = await zip.file('inside.png')!.async('blob');
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl) setInsideImg(dataUrl);
      }
    } catch (err) {
      console.error('Failed to load .mapper file:', err);
      alert('Failed to load project file: ' + String(err));
    }
  };

  // Wire autosave: debounce changes
  const autosaveTimer = useRef<number | null>(null);
  useEffect(() => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => { void saveAutosave(); }, 600);
    return () => { if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outsideImgRaw, insideImgRaw, transformMode, scalePercent, outputDpi, withFoldLines, withCutLines]);

  // Load autosave on mount
  useEffect(() => { void loadAutosave(); }, []);

  const handleDownloadPdf = async (resultsOverride?: { [key: string]: string }) => {
    try {
      const pageIds = ['output_page1', 'output_page2'];
      const source = resultsOverride ?? results;
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
        // marginPercent applies to each side (percentage of page width/height)
        const frac = (scalePercent || 0) / 100;
        const innerW = PAGE_W * (1 - 2 * frac);
        const innerH = PAGE_H * (1 - 2 * frac);
        const x = (PAGE_W - innerW) / 2;
        const y = (PAGE_H - innerH) / 2;
        // Try to obtain data URL if page image exists
        let dataUrl: string | null = null;
        if (url) {
          try { dataUrl = await ensureDataUrl(url); } catch (err) { dataUrl = null; }
        }
        // If page image missing, create a blank white canvas to insert
        if (!dataUrl) {
          try {
            const c = document.createElement('canvas');
            // compute px size using 96 DPI as approx for canvas; this is only for raster generation
            const pxW = Math.max(1, Math.round((innerW / 25.4) * 96));
            const pxH = Math.max(1, Math.round((innerH / 25.4) * 96));
            c.width = pxW; c.height = pxH;
            const cx = c.getContext('2d');
            if (cx) {
              cx.fillStyle = '#ffffff';
              cx.fillRect(0, 0, pxW, pxH);
              dataUrl = c.toDataURL('image/png');
            } else {
              dataUrl = BLANK_PNG;
            }
          } catch (err) {
            dataUrl = BLANK_PNG;
          }
        }
        // Place image stretched to inner box. If innerW/innerH exceed page, image will be cropped.
        doc.addImage(dataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
        // Optionally overlay fold helper lines (A4 images) scaled to the same inner box
        if (withFoldLines) {
          try {
            // Use project-relative public path. Vite serves public/ at root (BASE_URL)
            const base = (import.meta as any).env?.BASE_URL || '/';
            const helperPath = base + 'assets/lines_page' + (i + 1) + '.png';
            // fetch and convert to dataURL
            // Note: jsPDF requires data URL or binary image; ensure we have data URL
            const resp = await fetch(helperPath);
            if (resp.ok) {
              const blob = await resp.blob();
              const helperDataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              // Rotate the helper image 180deg using an offscreen canvas, then add it
              const imgEl = new Image();
              imgEl.src = helperDataUrl;
              await new Promise<void>((resolve) => {
                imgEl.onload = () => resolve();
                imgEl.onerror = () => resolve();
              });
              try {
                const cw = imgEl.naturalWidth || imgEl.width || 1;
                const ch = imgEl.naturalHeight || imgEl.height || 1;
                const c = document.createElement('canvas');
                c.width = cw;
                c.height = ch;
                const cx = c.getContext('2d');
                if (cx) {
                  // rotate 180deg around center and draw with transparency
                  cx.translate(cw / 2, ch / 2);
                  cx.rotate(Math.PI);
                  cx.globalAlpha = 0.6;
                  cx.drawImage(imgEl, -cw / 2, -ch / 2, cw, ch);
                  cx.globalAlpha = 1;
                  const rotatedDataUrl = c.toDataURL('image/png');
                  doc.addImage(rotatedDataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
                } else {
                  // Fallback: insert original if canvas unavailable
                  doc.addImage(helperDataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
                }
              } catch (err) {
                // fallback to original
                doc.addImage(helperDataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
              }
            }
          } catch (err) {
            // non-fatal: continue without overlay
            console.warn('Failed to load fold helper lines:', err);
          }
        }
        // Optionally add dotted cut-line outline hugging the image edges
        if (withCutLines) {
          try {
            const DPI = 96;
            const pxW = Math.max(1, Math.round((innerW / 25.4) * DPI));
            const pxH = Math.max(1, Math.round((innerH / 25.4) * DPI));
            const c2 = document.createElement('canvas');
            c2.width = pxW;
            c2.height = pxH;
            const cx2 = c2.getContext('2d');
            if (cx2) {
              cx2.clearRect(0, 0, pxW, pxH);
              cx2.strokeStyle = 'rgba(0,0,0,0.6)';
              cx2.lineWidth = 1;
              cx2.setLineDash([2, 2]);
              const inset = 0.5;
              cx2.strokeRect(inset, inset, pxW - 1, pxH - 1);
              const overlayDataUrl = c2.toDataURL('image/png');
              doc.addImage(overlayDataUrl, 'PNG', x, y, innerW, innerH, undefined, 'FAST');
            }
          } catch (err) {
            console.warn('Failed to draw cut-line overlay:', err);
          }
        }
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
        <div style={{ color: '#fff', margin: '2em auto 2em auto', fontSize: '1.1em', maxWidth: '600px', textAlign: 'center' }}>
          Build your own Card Deck Box! <br />
          This tool generates printable templates from your images. <br />
          Perfect for holding a standard deck of 60 cards.
        </div>

        {/* 3D cube preview + 2D Editors */}
        <div className="images" style={{ display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center', justifyContent: 'center' }}>

          {/* 3d Cube preview */}
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

          {/* 2D Editors side by side */}
          <div style={{ display: 'flex', flexDirection: 'row', gap: '2em', justifyContent: 'center', alignItems: 'flex-start' }}>
            <PolygonEditor
              ref={outsideEditorRef}
              onChange={json => scheduleBuild(json.input_polygons, undefined)}
              data={getEditorData(false)}
              label='Outside image'
              backgroundImg={outsideImgTransformed}
              onUploadImage={setOutsideImg}
              onDelete={() => { setOutsideImgRaw(''); setOutsideImgTransformed(''); scheduleBuild([], undefined); setSuppressAutoDemo(true); }}
            />
            <PolygonEditor
              ref={insideEditorRef}
              onChange={json => scheduleBuild(undefined, json.input_polygons)}
              data={getEditorData(true)}
              label='Inside image'
              backgroundImg={insideImgTransformed}
              onUploadImage={setInsideImg}
              onDelete={() => { setInsideImgRaw(''); setInsideImgTransformed(''); scheduleBuild(undefined, []); setSuppressAutoDemo(true); }}
            />
          </div>
          {/* Shared info text below both editors */}
          <div style={{ fontSize: '0.65em', color: '#aaa', margin: '0.5em auto 0 auto', lineHeight: 1.2, maxWidth: '400px', wordBreak: 'break-word', whiteSpace: 'pre-line', textAlign: 'center' }}>
            Drag to move (auto group).
            Shift+Drag scale.
            Ctrl/Cmd+Drag rotate.
            Drag empty area to marquee select.
          </div>
        </div>

        {/* Settings / Export controls / Reference images */}
        <div className="reference-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '2em', marginBottom: '2em' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', marginBottom: '0.5em' }}>Outside Reference</div>
            <img src="/origami-mapper/assets/box_outside_mapping.png" width={120} />
          </div>
          <div style={{ flex: '0 1 400px' }}>
            {/* Uploads are handled inside each PolygonEditor to avoid duplicate inputs */}
            <section className="template-run-card" style={{ background: '#181818', borderRadius: '12px', padding: '1em', margin: '0 auto', maxWidth: '400px', boxShadow: '0 2px 12px #0006', display: 'flex', flexDirection: 'column', gap: '1em', alignItems: 'center' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75em', width: '100%', alignItems: 'start', justifyItems: 'start' }}>
                <div style={{ width: '100%', display: 'flex', alignItems: 'start', justifyContent: 'start' }}>
                  <TemplateSelect onTemplate={setTemplate} />
                </div>
                <div style={{ width: '100%', display: 'flex', alignItems: 'start', justifyContent: 'start', gap: '0.5em' }}>
                  <span style={{ color: '#fff' }}>Transform:</span>
                  <select value={transformMode} onChange={e => setTransformMode(e.target.value as any)} style={{ padding: '0.3em', borderRadius: '6px', minWidth: '90px' }}>
                    <option value="none">None</option>
                    <option value="scale">Scale</option>
                    <option value="tile">Tile (Fill A4)</option>
                    <option value="tile4">Tile 4x (2x2)</option>
                    <option value="tile8">Tile 8x (4x2)</option>
                  </select>
                </div>
                <div style={{ width: '100%', display: 'flex', alignItems: 'start', justifyContent: 'start', gap: '0.5em' }}>
                  <span style={{ color: '#fff' }}>Outside rotation:</span>
                  <select value={outsideRotation} onChange={e => setOutsideRotation(Number(e.target.value) as 0 | 90 | 180 | 270)} style={{ padding: '0.3em', borderRadius: '6px', minWidth: '90px' }}>
                    <option value={0}>0°</option>
                    <option value={90}>90°</option>
                    <option value={180}>180°</option>
                    <option value={270}>270°</option>
                  </select>
                </div>
                <div style={{ width: '100%', display: 'flex', alignItems: 'start', justifyContent: 'start', gap: '0.5em' }}>
                  <span style={{ color: '#fff' }}>Inside rotation:</span>
                  <select value={insideRotation} onChange={e => setInsideRotation(Number(e.target.value) as 0 | 90 | 180 | 270)} style={{ padding: '0.3em', borderRadius: '6px', minWidth: '90px' }}>
                    <option value={0}>0°</option>
                    <option value={90}>90°</option>
                    <option value={180}>180°</option>
                    <option value={270}>270°</option>
                  </select>
                </div>
                <div style={{ width: '100%', display: 'flex', alignItems: 'start', justifyContent: 'start', gap: '0.5em' }}>
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: '0.5em' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'start', gap: '0.25em' }}>
                    <label
                      title={"Add fold lines that show how to fold the paper. The lines will not be visible in the finished box."}
                      style={{ color: '#fff', fontSize: '0.95em', display: 'flex', alignItems: 'center', gap: '0.5em' }}
                    >
                      <input
                        type="checkbox"
                        checked={withFoldLines}
                        onChange={e => setWithFoldLines(e.target.checked)}
                        title={"Add fold lines that show how to fold the paper. The lines will not be visible in the finished box."}
                        aria-label={"With fold helper lines"}
                      />
                      With fold helper lines
                    </label>
                    <label
                      title={"Add guide lines indicating where the printed sheet should be trimmed. Useful because many printers cannot print to the paper edge."}
                      style={{ color: '#fff', fontSize: '0.95em', display: 'flex', alignItems: 'center', gap: '0.5em' }}
                    >
                      <input
                        type="checkbox"
                        checked={withCutLines}
                        onChange={e => setWithCutLines(e.target.checked)}
                        title={"Add guide lines indicating where the printed sheet should be trimmed. Useful because many printers cannot print to the paper edge."}
                        aria-label={"With cut lines"}
                      />
                      With cut lines
                    </label>
                  </div>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5em' }}>
                    <div
                      title={"Reduce the box size by this percentage. The value is applied to each side of the page when generating the PDF."}
                      style={{ color: '#fff', fontSize: '0.9em' }}
                    >
                      Scale: {scalePercent}%
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      value={scalePercent}
                      onChange={e => {
                        // prevent negative values: clamp to 0 or above
                        const v = Math.max(0, Number(e.target.value));
                        setScalePercent(v);
                      }}
                      title={"Reduce the box size by this percentage. The value is applied to each side of the page when generating the PDF."}
                      aria-label={"Reduce the box size by percentage"}
                      style={{ width: '85%' }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '1em' }}>
                    <button onClick={() => handleRun(false)} disabled={loading || pdfLoading} className="menu-btn">
                      {loading ? 'Processing...' : 'Run Mapping'}
                    </button>
                    <button onClick={() => handleRunThenDownload()} disabled={pdfLoading || loading} className="menu-btn">
                      {pdfLoading ? 'Preparing PDF...' : 'Download'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '1em', marginTop: '0.5em' }}>
                    <button onClick={() => saveToMapperFile()} disabled={loading || pdfLoading} className="menu-btn" title="Save project (.mapper)">
                      <IoSave style={{ verticalAlign: 'middle', marginRight: 8 }} /> Save
                    </button>
                    <button onClick={() => mapperInputRef.current?.click()} disabled={loading || pdfLoading} className="menu-btn" title="Load project (.mapper)">
                      <IoCloudUpload style={{ verticalAlign: 'middle', marginRight: 8 }} /> Load
                    </button>
                    <input ref={mapperInputRef} type="file" accept=".mapper,application/zip" style={{ display: 'none' }} onChange={e => onMapperFileSelected(e.target.files?.[0] ?? null)} />
                  </div>
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
            </section>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', marginBottom: '0.5em' }}>Inside Reference</div>
            <img src="/origami-mapper/assets/box_inside_mapping.png" width={120} />
          </div>
        </div>

        {/* Output previews side by side */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: '2em', justifyContent: 'center', alignItems: 'flex-start', marginTop: '1em' }}>
          <ImagePreview src={results.output_page1} label="Output Page 1" />
          <ImagePreview src={results.output_page2} label="Output Page 2" />
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
      </div>
    </>
  );
}

export default BoxGenerator;
