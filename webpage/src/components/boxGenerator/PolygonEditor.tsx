import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import type { OrigamiMapperTypes } from '../../OrigamiMapperTypes';
import ImageUpload from './ImageUpload';
import { IoDownload, IoFolderOpen, IoCaretBackSharp, IoRefreshCircle, IoTrash } from 'react-icons/io5';

export interface PolygonEditorHandle {
  getCurrentJson: () => OrigamiMapperTypes.TemplateJson;
  scalePolygonsToCanvas: () => void; // uniformly scale all polygons to fit canvas (contain)
}

interface PolygonEditorProps {
  data: OrigamiMapperTypes.TemplateJson;
  backgroundImg?: string;
  label: string;
  // optional callback invoked when polygons or background image change
  onChange?: (json: OrigamiMapperTypes.TemplateJson) => void;
  // optional callback invoked when user wants to delete the current background image
  onDelete?: () => void;
  // optional callback when user uploads an image from inside this editor
  onUploadImage?: (dataUrl: string) => void;
}

const PolygonEditor = forwardRef<PolygonEditorHandle, PolygonEditorProps>(({ data, backgroundImg, label, onChange, onDelete, onUploadImage }, ref) => {
  // Track Shift key globally
  const shiftPressedRef = useRef(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftPressedRef.current = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftPressedRef.current = false;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);
  const mountRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const a4PlaneRef = useRef<THREE.Mesh | null>(null);
  // Separate mesh for background image (so we can preserve its aspect ratio without stretching to A4)
  const bgImageMeshRef = useRef<THREE.Mesh | null>(null);
  const [polygons, setPolygons] = useState<OrigamiMapperTypes.Polygon[]>(data.input_polygons);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionRect, setSelectionRect] = useState<null | { x: number; y: number; w: number; h: number }>(null);
  // History for revert functionality
  const historyRef = useRef<OrigamiMapperTypes.Polygon[][]>([]);
  const [canRevert, setCanRevert] = useState(false);
  const MAX_HISTORY = 50;
  const clonePolygons = (polys: OrigamiMapperTypes.Polygon[]) => polys.map(p => ({ ...p, rotation: p.rotation, vertices: p.vertices.map(v => [...v] as [number, number]) }));
  const pushHistory = (snapshot: OrigamiMapperTypes.Polygon[]) => {
    historyRef.current.push(clonePolygons(snapshot));
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift();
    setCanRevert(historyRef.current.length > 0);
  };
  const handleRevert = () => {
    if (!historyRef.current.length) return;
    const prev = historyRef.current.pop();
    if (prev) {
      setPolygons(clonePolygons(prev));
    }
    setCanRevert(historyRef.current.length > 0);
    if (typeof onChange === 'function' && prev) {
      try { onChange({ ...data, input_polygons: clonePolygons(prev) }); } catch { }
    }
  };
  const handleReset = () => {
    const polygons = resetPolygons(data.input_polygons, width, height);
    setPolygons(polygons);
    setSelectedIds(new Set());
    pushHistory(polygonsRef.current);
    if (typeof onChange === 'function') {
      try { onChange({ ...data, input_polygons: polygons }); } catch { }
    }
  };
  const selectionRectRef = useRef<null | { x: number; y: number; w: number; h: number }>(null);
  useEffect(() => { selectionRectRef.current = selectionRect; }, [selectionRect]);
  const groupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const polygonsRef = useRef(polygons);
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => { polygonsRef.current = polygons; }, [polygons]);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);

  // Notify parent when a new background image is provided (image-level change).
  // Polygon changes are reported only after the user finishes an interaction (mouse up)
  useEffect(() => {
    if (typeof onChange === 'function' && backgroundImg) {
      try {
        onChange({ ...data, input_polygons: polygonsRef.current });
      } catch (e) {
        // ignore parent errors
      }
    }
  }, [backgroundImg]);

  type TransformMode = 'idle' | 'select' | 'move' | 'scale' | 'rotate';
  interface TransformState {
    mode: TransformMode;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    originalPolygons: OrigamiMapperTypes.Polygon[]; // snapshot of polygons at start for selected
    bboxCenter: { x: number; y: number }; // pixel coords
    initialAngle?: number; // for rotation
    scaleStartDistance?: number; // optional alternative future use
    // If true, we haven't exceeded movement threshold yet (treat as click if mouseup without move)
    pendingClickInsideSelection?: boolean;
    rotationAccum?: number; // total accumulated delta during a rotate drag
    originalRotations?: Map<string, number>; // starting rotation per polygon id
  }
  const transformStateRef = useRef<TransformState | null>(null);

  // Max canvas bounds (original A4 derived size). Actual canvas will fit inside while matching background image aspect ratio.
  const MAX_CANVAS_WIDTH = 180;
  const MAX_CANVAS_HEIGHT = (297 / 210) * 180;
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: MAX_CANVAS_WIDTH, h: MAX_CANVAS_HEIGHT });
  const width = canvasSize.w;
  const height = canvasSize.h;
  const initialHistoryPushedRef = useRef(false);
  const imageDimsRef = useRef<{ w: number; h: number } | null>(null);
  const lastConvertedKeyRef = useRef<string | null>(null);

  // Setup scene/camera/renderer once on mount, cleanup on unmount
  useEffect(() => {
    // Record initial state for revert only once
    if (!initialHistoryPushedRef.current) {
      pushHistory(data.input_polygons);
      initialHistoryPushedRef.current = true;
    }
    // Clean up any previous canvas/renderer/scene (defensive if remounting)
    if (rendererRef.current && mountRef.current) {
      if (mountRef.current.contains(rendererRef.current.domElement)) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      rendererRef.current.dispose();
      rendererRef.current = null;
    }
    sceneRef.current = null;
    cameraRef.current = null;
    a4PlaneRef.current = null;

    // Create new scene/camera/renderer first so we can safely attach listeners
    sceneRef.current = new THREE.Scene();
    sceneRef.current.background = new THREE.Color(0xf0f0f0);
    cameraRef.current = new THREE.OrthographicCamera(0, width, height, 0, 1, 1000);
    cameraRef.current.position.z = 500;
    rendererRef.current = new THREE.WebGLRenderer({ antialias: true });
    rendererRef.current.setPixelRatio(window.devicePixelRatio);
    rendererRef.current.setSize(width, height);
    rendererRef.current.outputColorSpace = THREE.SRGBColorSpace;
    rendererRef.current.toneMapping = THREE.NoToneMapping;
    if (mountRef.current) {
      mountRef.current.appendChild(rendererRef.current.domElement);
    }
    const a4Geometry = new THREE.PlaneGeometry(width, height);
    let a4Material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    a4PlaneRef.current = new THREE.Mesh(a4Geometry, a4Material);
    a4PlaneRef.current.position.set(width / 2, height / 2, -1);
    sceneRef.current.add(a4PlaneRef.current);

    // Helper functions for interaction (use refs for live state)
    const getPolygonBBox = (poly: OrigamiMapperTypes.Polygon) => {
      // Treat internal coordinates as origin top-left, y increasing downward
      const xs = poly.vertices.map(v => v[0] * width);
      const ys = poly.vertices.map(v => v[1] * height);
      const minX = Math.min(...xs); const maxX = Math.max(...xs); const minY = Math.min(...ys); const maxY = Math.max(...ys);
      return { minX, maxX, minY, maxY };
    };
    const pointInBBox = (x: number, y: number, b: { minX: number; maxX: number; minY: number; maxY: number }) => x >= b.minX && x <= b.maxX && y >= b.minY && y <= b.maxY;
    const getGroupIds = (id: string): string[] => {
      const prefix = id.split('_')[0];
      return polygonsRef.current.filter(p => p.id === prefix || p.id.startsWith(prefix + '_') || p.id.startsWith(prefix) && p.id.includes('_')).filter(p => p.id.split('_')[0] === prefix).map(p => p.id);
    };
    const getCombinedBBox = (ids: Set<string>) => {
      if (ids.size === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      polygonsRef.current.forEach(p => {
        if (ids.has(p.id)) {
          const b = getPolygonBBox(p);
          minX = Math.min(minX, b.minX); minY = Math.min(minY, b.minY); maxX = Math.max(maxX, b.maxX); maxY = Math.max(maxY, b.maxY);
        }
      });
      return { minX, minY, maxX, maxY };
    };
    const canvasEl = rendererRef.current!.domElement;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const rect = canvasEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const currentSelectedBBox = getCombinedBBox(selectedIdsRef.current);
      // Decide mode
      let mode: TransformMode = 'idle';
      if (e.shiftKey) mode = 'scale';
      else if (e.ctrlKey || e.metaKey) mode = 'rotate';
      else {
        // Prioritize selected bbox
        if (currentSelectedBBox && pointInBBox(x, y, currentSelectedBBox)) {
          mode = 'move';
        } else {
          // Find any polygon containing point (bbox test)
          const hitPoly = polygonsRef.current.find(p => pointInBBox(x, y, getPolygonBBox(p)));
          if (hitPoly) {
            // Select its group
            const groupIds = new Set(getGroupIds(hitPoly.id));
            setSelectedIds(groupIds);
            mode = 'move';
          } else {
            // Start selection rectangle
            mode = 'select';
            const startRect = { x, y, w: 0, h: 0 };
            setSelectionRect(startRect);
            selectionRectRef.current = startRect;
            // Unselect polygons when clicking empty area
            setSelectedIds(new Set());
          }
        }
      }
      const bbox = getCombinedBBox(selectedIdsRef.current.size ? selectedIdsRef.current : new Set());
      let center = { x: width / 2, y: height / 2 };
      if (selectedIdsRef.current.size && bbox) {
        center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
      }
      // For rotation initial angle
      const initialAngle = Math.atan2(y - center.y, x - center.x);
      transformStateRef.current = {
        mode,
        startX: x,
        startY: y,
        lastX: x,
        lastY: y,
        originalPolygons: polygonsRef.current.map(p => ({ ...p, vertices: p.vertices.map(v => [...v] as [number, number]) })),
        bboxCenter: center,
        initialAngle,
        pendingClickInsideSelection: mode === 'move' && currentSelectedBBox != null && pointInBBox(x, y, currentSelectedBBox),
        rotationAccum: 0,
        originalRotations: new Map(polygonsRef.current.map(p => [p.id, p.rotation || 0]))
      };
    };
    const handleMouseMove = (e: MouseEvent) => {
      const state = transformStateRef.current;
      if (!state) return;
      const rect = canvasEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const dx = x - state.startX;
      const dy = y - state.startY;
      // If user has moved more than a tiny threshold, it's a drag, not a click
      if (state.pendingClickInsideSelection && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        state.pendingClickInsideSelection = false;
      }

      // Allow dynamic mode switching while dragging
      if (state.mode !== 'select') {
        let desiredMode: TransformMode = state.mode;
        if (e.shiftKey) desiredMode = 'scale';
        else if (e.ctrlKey || e.metaKey) desiredMode = 'rotate';
        else desiredMode = 'move';
        if (desiredMode !== state.mode) {
          // Reset reference snapshot when switching modes
          const selectedSnapshot = polygonsRef.current.map(p => ({ ...p, vertices: p.vertices.map(v => [...v] as [number, number]) }));
          // Recompute bbox center
          const getCombinedBBox = (ids: Set<string>) => {
            if (ids.size === 0) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            polygonsRef.current.forEach(p => {
              if (selectedIdsRef.current.has(p.id)) {
                const xs = p.vertices.map(v => v[0] * width);
                const ys = p.vertices.map(v => (1 - v[1]) * height);
                const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
                minX = Math.min(minX, minx); maxX = Math.max(maxX, maxx); minY = Math.min(minY, miny); maxY = Math.max(maxY, maxy);
              }
            });
            return { minX, minY, maxX, maxY };
          };
          const bbox = getCombinedBBox(selectedIdsRef.current);
          let center = { x: width / 2, y: height / 2 };
          if (bbox) center = { x: (bbox.minX + bbox.maxX) / 2, y: (bbox.minY + bbox.maxY) / 2 };
          state.mode = desiredMode;
          state.originalPolygons = selectedSnapshot;
          state.startX = x; state.startY = y; // reset deltas to avoid jump
          state.lastX = x; state.lastY = y;
          state.bboxCenter = center;
          // Correct atan2 usage: atan2(deltaY, deltaX) and use center.x (not center.y) for X component
          state.initialAngle = Math.atan2(y - center.y, x - center.x);
          state.rotationAccum = 0;
          state.originalRotations = new Map(polygonsRef.current.map(p => [p.id, p.rotation || 0]));
        }
      }
      if (state.mode === 'select' && selectionRectRef.current) {
        const start = selectionRectRef.current;
        const newRect = { x: start.x, y: start.y, w: x - start.x, h: y - start.y };
        setSelectionRect(newRect); // triggers UI update
        selectionRectRef.current = newRect; // keep ref in sync for subsequent moves
        // Normalize rect to compute selection
        const rx = newRect.w < 0 ? newRect.x + newRect.w : newRect.x;
        const ry = newRect.h < 0 ? newRect.y + newRect.h : newRect.y;
        const rw = Math.abs(newRect.w);
        const rh = Math.abs(newRect.h);
        const sel = new Set<string>();
        polygonsRef.current.forEach(p => {
          const b = getPolygonBBox(p);
          // Check if bbox intersects selection rectangle
          const rectMinX = rx, rectMaxX = rx + rw, rectMinY = ry, rectMaxY = ry + rh;
          const intersects =
            b.maxX >= rectMinX && b.minX <= rectMaxX &&
            b.maxY >= rectMinY && b.minY <= rectMaxY;
          if (intersects) {
            getGroupIds(p.id).forEach(id => sel.add(id));
          }
        });
        setSelectedIds(sel);
        return;
      }
      if (!selectedIdsRef.current.size) return;
      if (state.mode === 'move') {
        const ndx = dx / width;
        const ndy = dy / height; // screen positive downwards
        // compute clamped delta so selection stays inside canvas
        const origMap = new Map(state.originalPolygons.map(p => [p.id, p]))
        const working = polygonsRef.current.map(p => {
          if (selectedIdsRef.current.has(p.id)) {
            const orig = origMap.get(p.id)!;
            const verts = orig.vertices.map(([vx, vy]) => [vx + ndx, vy + ndy] as [number, number]);
            return { ...p, vertices: verts };
          }
          return p;
        });
        setPolygons(working);
      } else if (state.mode === 'scale') {
        let scale = 1 + (dy) / 100; // down enlarges
        scale = Math.max(0.1, Math.min(10, scale));
        const centerNorm = { x: state.bboxCenter.x / width, y: state.bboxCenter.y / height };
        const origMap = new Map(state.originalPolygons.map(p => [p.id, p]));
        const updated = polygonsRef.current.map(p => {
          if (selectedIdsRef.current.has(p.id)) {
            const orig = origMap.get(p.id)!;
            const verts = orig.vertices.map(([vx, vy]) => {
              const nx = centerNorm.x + (vx - centerNorm.x) * scale;
              const ny = centerNorm.y + (vy - centerNorm.y) * scale;
              return [nx, ny] as [number, number];
            });
            return { ...p, vertices: verts };
          }
          return p;
        });
        setPolygons(updated);
      } else if (state.mode === 'rotate') {
        // Relative cumulative rotation: rotate current vertices by incremental delta
        const centerPixel = { x: state.bboxCenter.x, y: state.bboxCenter.y };
        const prevAngle = Math.atan2(state.lastY - centerPixel.y, state.lastX - centerPixel.x);
        const currAngle = Math.atan2(y - centerPixel.y, x - centerPixel.x);
        let deltaAngle = currAngle - prevAngle;
        if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
        else if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
        const cosA = Math.cos(deltaAngle);
        const sinA = Math.sin(deltaAngle);
        state.rotationAccum = (state.rotationAccum || 0) + deltaAngle;
        const updated = polygonsRef.current.map(p => {
          if (!selectedIdsRef.current.has(p.id)) return p;
          const verts = p.vertices.map(([vx, vy]) => {
            const px = vx * width;
            const py = vy * height;
            const ox = px - centerPixel.x;
            const oy = py - centerPixel.y;
            const rx = ox * cosA - oy * sinA;
            const ry = ox * sinA + oy * cosA;
            const npx = rx + centerPixel.x;
            const npy = ry + centerPixel.y;
            return [npx / width, npy / height] as [number, number];
          });
          return { ...p, vertices: verts };
        });
        setPolygons(updated);
      }
      state.lastX = x; state.lastY = y;
    };
    const handleMouseUp = () => {
      const state = transformStateRef.current;
      let finalPolygons = polygonsRef.current;
      let changed = false;
      if (state) {
        if (state.mode === 'select') {
          // selection already applied during drag
        } else if (state.mode === 'move' || state.mode === 'scale' || state.mode === 'rotate') {
          // Compare originalPolygons to current; if different, push original snapshot
          const before = state.originalPolygons;
          const after = polygonsRef.current;
          if (before.length !== after.length) {
            changed = true;
          } else {
            for (let i = 0; i < before.length && !changed; i++) {
              const b = before[i];
              const a = after[i];
              if (b.id !== a.id || b.vertices.length !== a.vertices.length) { changed = true; break; }
              for (let j = 0; j < b.vertices.length; j++) {
                if (b.vertices[j][0] !== a.vertices[j][0] || b.vertices[j][1] !== a.vertices[j][1]) { changed = true; break; }
              }
            }
          }
          if (changed) {
            pushHistory(before);
          }
          // Issue is that quick mouse movements somehow caused rotation indices being different than state.rotationAccum.
          // Persist and reconcile rotation metadata if rotate occurred.
          // Compute exact per-polygon rotation delta by comparing a representative vertex's angle
          // before/after around the rotation center and set Polygon.rotation accordingly.
          if (state.mode === 'rotate') {
            const center = state.bboxCenter;
            const origMap = new Map(state.originalPolygons.map(p => [p.id, p]));
            const reconciled = polygonsRef.current.map(p => {
              if (!selectedIdsRef.current.has(p.id)) return p;
              const orig = origMap.get(p.id);
              if (!orig || !orig.vertices.length || !p.vertices.length) return p;
              // Use first vertex as representative for angle calculation (consistent with how rotation was applied)
              const ox = orig.vertices[0][0] * width;
              const oy = orig.vertices[0][1] * height;
              const nx = p.vertices[0][0] * width;
              const ny = p.vertices[0][1] * height;
              const angBefore = Math.atan2(oy - center.y, ox - center.x);
              const angAfter = Math.atan2(ny - center.y, nx - center.x);
              let delta = angAfter - angBefore;
              if (delta > Math.PI) delta -= 2 * Math.PI;
              else if (delta < -Math.PI) delta += 2 * Math.PI;
              const baseRot = state.originalRotations?.get(p.id) ?? (orig.rotation || 0);
              const newRot = baseRot + delta;
              return { ...p, rotation: newRot };
            });
            finalPolygons = reconciled;
            setPolygons(reconciled);
          }
          // If it was just a click inside existing selection without movement, unselect (toggle off)
          if (state.pendingClickInsideSelection) {
            setSelectedIds(new Set());
          }
        }
      }
      setSelectionRect(null);
      transformStateRef.current = null;

      // Notify parent once after user finishes interaction
      if (typeof onChange === 'function' && changed) {
        try { onChange({ ...data, input_polygons: finalPolygons }); } catch { }
      }
    };
    canvasEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      rendererRef.current!.render(sceneRef.current!, cameraRef.current!);
    };
    animate();

    return () => {
      if (mountRef.current && rendererRef.current) {
        if (mountRef.current.contains(rendererRef.current.domElement)) {
          mountRef.current.removeChild(rendererRef.current.domElement);
        }
      }
      rendererRef.current?.domElement.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [width, height]);

  // Load background image (no canvas resize) and convert polygon coordinates from image space -> canvas space once.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !a4PlaneRef.current) return;
    // If renderer exists, hide or show its DOM element depending on whether a background image is present.
    if (rendererRef.current && mountRef.current && rendererRef.current.domElement) {
      try { rendererRef.current.domElement.style.display = backgroundImg ? '' : 'none'; } catch { }
    }
    if (!backgroundImg) {
      // When no background image is present we don't mount the renderer/scene for performance
      // and to avoid showing an empty canvas. Ensure any previous bg mesh is removed.
      if (bgImageMeshRef.current) {
        scene.remove(bgImageMeshRef.current);
        (bgImageMeshRef.current.material as THREE.Material).dispose();
        (bgImageMeshRef.current.geometry as THREE.BufferGeometry).dispose();
        bgImageMeshRef.current = null;
      }
  const mat = a4PlaneRef.current.material as THREE.MeshBasicMaterial;
  mat.map = null;
  mat.needsUpdate = true;
      return;
    }
    if (backgroundImg) {
      const img = new Image();
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          const scale = Math.min(
            MAX_CANVAS_WIDTH / w,
            MAX_CANVAS_HEIGHT / h,
            1 // don't upscale
          );
          w *= scale; h *= scale;
          if (Math.abs(w - width) > 0.5 || Math.abs(h - height) > 0.5) {
            setCanvasSize({ w, h });
            imageDimsRef.current = { w: img.naturalWidth, h: img.naturalHeight };
            const key = backgroundImg + ':' + polygonsRef.current.length;
            // Convert polygon coordinates only once per background image (or after reset/import)
            if (lastConvertedKeyRef.current !== key) {
              const converted = resetPolygons(data.input_polygons, w, h);
              setPolygons(converted);
              lastConvertedKeyRef.current = key;
            }
          }
        }
      };
      img.src = backgroundImg;
    }

    // Remove previous bg image mesh
    if (bgImageMeshRef.current) {
      scene.remove(bgImageMeshRef.current);
      (bgImageMeshRef.current.material as THREE.Material).dispose();
      (bgImageMeshRef.current.geometry as THREE.BufferGeometry).dispose();
      bgImageMeshRef.current = null;
    }

    const loader = new THREE.TextureLoader();
    if (backgroundImg) {
      loader.load(backgroundImg as string, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const geom = new THREE.PlaneGeometry(width, height);
        const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(width / 2, height / 2, -0.5);
        scene.add(mesh);
        bgImageMeshRef.current = mesh;
      });
    }
  }, [backgroundImg, width, height]);

  // Update polygon meshes/groups and drag controls when polygons change
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const renderer = rendererRef.current;
    if (!scene || !camera || !renderer) return;

    // Remove old polygon groups (keep a4Plane and background image mesh)
    scene.children = scene.children.filter(obj => obj === a4PlaneRef.current || obj === bgImageMeshRef.current);
    groupsRef.current.clear();

    // Create mapping from fillMesh to outline
    const fillToOutlineMap = new Map<THREE.Mesh, Line2>();

    const polygonGroups = polygons.map(polygon => {
      const shape = new THREE.Shape();
      polygon.vertices.forEach((v, i) => {
        // Flip y-axis so origin is top-left
        const x = v[0] * width;
        const y = (1 - v[1]) * height;
        if (i === 0) {
          shape.moveTo(x, y);
        } else {
          shape.lineTo(x, y);
        }
      });
      shape.closePath();

      const fillGeometry = new THREE.ShapeGeometry(shape);
      const isSelected = selectedIds.has(polygon.id);
      const fillMaterial = new THREE.MeshBasicMaterial({
        color: isSelected ? 0xffaa00 : 0x2194ce,
        opacity: isSelected ? 0.6 : 0.4,
        transparent: true,
        side: THREE.DoubleSide,
      });
      const fillMesh = new THREE.Mesh(fillGeometry, fillMaterial);

      const points = shape.getPoints();
      // Convert points to flat array for LineGeometry
      const positions = points.map(p => [p.x, p.y, 0]).flat();
      const outlineGeometry = new LineGeometry();
      outlineGeometry.setPositions(positions);
      const outlineMaterial = new LineMaterial({
        color: 0x000000,
        linewidth: 2, // in world units
        dashed: false,
      });
      outlineMaterial.resolution.set(window.innerWidth, window.innerHeight); // required for LineMaterial
      const outline = new Line2(outlineGeometry, outlineMaterial);

      fillToOutlineMap.set(fillMesh, outline);

      const group = new THREE.Group();
      group.add(fillMesh);
      group.add(outline);
      group.userData = { id: polygon.id };
      groupsRef.current.set(polygon.id, group);

      return { group, fillMesh };
    });

    polygonGroups.forEach(({ group }) => {
      scene.add(group);
    });

    return () => { };
  }, [polygons, selectedIds]);

// New scaling algorithm:
  // 1. Compute pixel-space bbox of all polygons (using original image pixel coords).
  // 2. Non-uniformly scale bbox to A4 aspect (210:297) by setting width->210, height->297 units.
  // 3. Uniformly scale those A4 units so bbox fits inside background image and touches at least one side (width or height).
  // 4. Map vertices accordingly, anchored at top-left (no centering) and normalize to canvas coordinates.
  const scalePolygonsA4 = (base: OrigamiMapperTypes.Polygon[], imgW: number, imgH: number): OrigamiMapperTypes.Polygon[] => {
    if (!base.length) return base;
    // Original image pixel coords for bbox
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    base.forEach(p => {
      p.vertices.forEach(([vx, vy]) => {
        const px = vx * imgW;
        const py = vy * imgH;
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      });
    });
    // Target A4 logical units
    const A4W = 210;
    const A4H = 297;
    // After non-uniform scaling, bbox is A4W x A4H units. Uniform scale to fit image.
    const uniform = Math.min(imgW / A4W, imgH / A4H);
    
    // Anchor at (0,0) top-left. (Optional centering could be added later.)
    // Convert to canvas-normalized coordinates. Because background image is stretched to canvas,
    // we map by proportion of image dimensions: normalizedX = finalPixelX / imgW, normalizedY = finalPixelY / imgH.
    return base.map(p => ({
      ...p,
      vertices: p.vertices.map(([vx, vy]) => {
        const px = vx * uniform * A4W;
        const py = vy * uniform * A4H;
        const normX = px / imgW;
        const normY = py / imgH;
        return [normX, normY] as [number, number];
      })
    }));
  };

  // Uniformly scale all polygons so their combined bounding box fits inside the canvas
  // while touching at least one side (contain behavior).
  const scalePolygonsToCanvas = (base: OrigamiMapperTypes.Polygon[], width: number, height: number): OrigamiMapperTypes.Polygon[] => {
    if (!base.length) return base;
    // Compute bounding box in pixel space
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    base.forEach(p => {
      p.vertices.forEach(([vx, vy]) => {
        const px = vx * width;
        const py = vy * height; // y already top-left origin in our normalized system
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      });
    });
    const bboxW = Math.max(1e-6, maxX - minX);
    const bboxH = Math.max(1e-6, maxY - minY);
    const scale = Math.min(width / bboxW, height / bboxH); // contain: touch at least one side
    if (Math.abs(scale - 1) < 1e-6) return base; // nothing to do
    const scaleOriginX = 0;
    const scaleOriginY = 0;
    const scaled = base.map(p => ({
      ...p,
      vertices: p.vertices.map(([vx, vy]) => {
        const px = vx * width;
        const py = vy * height;
        const sx = (px - scaleOriginX) * scale + scaleOriginX;
        const sy = (py - scaleOriginY) * scale + scaleOriginY;
        return [sx / width, sy / height] as [number, number];
      })
    }));
    return scaled;
  };

  const resetPolygons = (base: OrigamiMapperTypes.Polygon[], width: number, height: number): OrigamiMapperTypes.Polygon[] => {
    if (!base.length) return base;
    let converted = scalePolygonsA4(base, width, height);
    converted = scalePolygonsToCanvas(converted, width, height);
    // If this editor is for outside polygons, mark initial rotation metadata as 90deg (pi/2) without changing vertices
    const isOutside = label.toLowerCase().includes('outside');
    converted = converted.map(p => {
      if (isOutside && !p.id.includes('i')) {
        return { ...p, rotation: Math.PI / 2 };
      }
      return { ...p, rotation: p.rotation || 0 };
    });
    return converted;
  };

  // Expose getCurrentJson to parent via ref
  useImperativeHandle(ref, () => ({
    getCurrentJson: () => ({
      ...data,
      input_polygons: polygons
    }),
    scalePolygonsToCanvas: () => scalePolygonsToCanvas(polygonsRef.current, width, height),
  }), [data, polygons]);

  const handleExport = () => {
    const output = { ...data, input_polygons: polygons };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'box_modified.json';
    link.click();
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(file.name);
    const isJson = file.type === 'application/json' || /\.json$/i.test(file.name);

    if (isImage) {
      // Load as image and pass to parent
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        if (typeof onUploadImage === 'function') {
          onUploadImage(dataUrl);
        }
      };
      reader.readAsDataURL(file);
      event.target.value = '';
      return;
    }

    // Fallback to JSON import (polygon layout)
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.input_polygons) {
          pushHistory(polygonsRef.current);
          setPolygons(json.input_polygons);
          if (typeof onChange === 'function') {
            try { onChange({ ...data, input_polygons: json.input_polygons }); } catch { }
          }
        }
      } catch (err) {
        const msg = isJson ? 'Invalid JSON file.' : 'Unsupported file. Please choose an image or a JSON file.';
        alert(msg);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div style={{ textAlign: 'center', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {backgroundImg && (
        <div style={{ color: '#fff', fontSize: '1em', marginBottom: '0.3em' }}>{label}</div>
      )}
      <div
        ref={mountRef}
        style={{
          maxWidth: '180px',
          position: 'relative',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {selectionRect && (
          <div style={{
            position: 'absolute',
            left: Math.min(selectionRect.x, selectionRect.x + selectionRect.w),
            top: Math.min(selectionRect.y, selectionRect.y + selectionRect.h),
            width: Math.abs(selectionRect.w),
            height: Math.abs(selectionRect.h),
            border: '1px dashed #ff8800',
            background: 'rgba(255,136,0,0.1)',
            pointerEvents: 'none'
          }} />
        )}
        {!backgroundImg && (
          <div className="upload-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <ImageUpload label={`Load ${label}`} onImage={(data) => { if (typeof onUploadImage === 'function') onUploadImage(data); }} />
          </div>
        )}
      </div>
      {backgroundImg && (
      <div style={{
        marginTop: '0.5em',
        display: 'flex',
        gap: '0.3em',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,image/*"
          style={{ display: 'none' }}
          onChange={handleImport}
        />
  <button
          type="button"
          style={{ fontSize: '1.2em', padding: '0.3em 0.5em', borderRadius: '5px', background: '#000', border: 'none', cursor: 'pointer' }}
          onClick={() => fileInputRef.current?.click()}
          title="Import JSON or Image"
        ><IoFolderOpen style={{ color: '#fff', fontSize: '1.5em', verticalAlign: 'middle' }} /></button>
        <button
          style={{ fontSize: '1.2em', padding: '0.3em 0.5em', borderRadius: '5px', background: '#000', border: 'none', cursor: 'pointer' }}
          onClick={handleExport}
          title="Export JSON"
        ><IoDownload style={{ color: '#fff', fontSize: '1.5em', verticalAlign: 'middle' }} /></button>
        <button
          type="button"
          style={{ fontSize: '1.2em', padding: '0.3em 0.5em', borderRadius: '5px', background: '#000', border: 'none', cursor: 'pointer' }}
          onClick={() => {
            if (typeof onDelete !== 'function') return;
            const ok = window.confirm('Delete image? This cannot be undone.');
            if (ok) onDelete();
          }}
          title="Delete image"
        ><IoTrash style={{ color: '#fff', fontSize: '1.5em', verticalAlign: 'middle' }} /></button>
        <button
          type="button"
          disabled={!canRevert}
          style={{
            fontSize: '1.2em',
            padding: '0.3em 0.5em',
            borderRadius: '5px',
            background: canRevert ? '#000' : '#333',
            border: 'none',
            cursor: canRevert ? 'pointer' : 'not-allowed'
          }}
          onClick={handleRevert}
          title="Revert"
        ><IoCaretBackSharp style={{ color: '#fff', fontSize: '1.5em', verticalAlign: 'middle' }} /></button>
        <button
          type="button"
          style={{ fontSize: '1.2em', padding: '0.3em 0.5em', borderRadius: '5px', background: '#000', border: 'none', cursor: 'pointer' }}
          onClick={handleReset}
          title="Reset"
        ><IoRefreshCircle style={{ color: '#fff', fontSize: '1.5em', verticalAlign: 'middle' }} /></button>
  </div>
  )}
    </div>
  );
});

export default PolygonEditor;
