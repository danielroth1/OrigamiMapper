import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import type { OrigamiMapperTypes } from '../../OrigamiMapperTypes';
import { mirrorOutsidePolygons, mirrorInsidePolygons } from '../../utils/polygons';
import ImageUpload from './ImageUpload';
import { IoDownload, IoFolderOpen, IoCaretBackSharp, IoRefreshCircle, IoTrash, IoMagnetOutline, IoResizeOutline, IoGridOutline, IoCloseCircleOutline, IoReloadOutline } from 'react-icons/io5';

// Toggle Import/Export JSON buttons in the editor toolbars
const SHOW_IMPORT_EXPORT_JSON = false;

export interface PolygonEditorHandle {
  getCurrentJson: () => OrigamiMapperTypes.TemplateJson;
  scalePolygonsToCanvas: () => void; // uniformly scale all polygons to fit canvas (contain)
  setFromJson: (json: OrigamiMapperTypes.TemplateJson) => void;
  suppressNextAutoReset: () => void;
}

interface PolygonEditorProps {
  data: OrigamiMapperTypes.TemplateJson;
  backgroundImg?: string;
  label: string;
  // Assign a group so paired editors (inside/outside) can sync zoom together
  zoomGroup?: 'top' | 'bottom';
  // When true, reset() applies an initial 90° CCW rotation and then translates
  // the combined polygon bbox so its top-left is at (0,0). No scaling.
  applyResetTransform?: boolean;
  // rotation in degrees for the background image preview and transform helpers
  rotation?: 0 | 90 | 180 | 270;
  // callback invoked when user changes rotation via the editor UI
  onRotationChange?: (rotation: 0 | 90 | 180 | 270) => void;
  // optional callback invoked when polygons or background image change
  onChange?: (json: OrigamiMapperTypes.TemplateJson) => void;
  // optional callback invoked when an autosave should occur (only on mouse up after a change)
  onOutsave?: (json: OrigamiMapperTypes.TemplateJson) => void;
  // optional callback invoked when user wants to delete the current background image
  onDelete?: () => void;
  // optional callback invoked to delete the entire box (parent controls removal)
  onDeleteBox?: () => void;
  // optional callback when user uploads an image from inside this editor
  onUploadImage?: (dataUrl: string) => void;
}

const PolygonEditor = forwardRef<PolygonEditorHandle, PolygonEditorProps>(({ data, backgroundImg, label, zoomGroup, applyResetTransform, rotation, onRotationChange, onChange, onOutsave, onDelete, onDeleteBox, onUploadImage }, ref) => {
  // Debug flag removed; use SHOW_IMPORT_EXPORT_JSON constant for Import/Export visibility
  // Track modifier keys to reflect pressed state on the UI buttons.
  const [shiftKeyDown, setShiftKeyDown] = useState(false);
  const [ctrlKeyDown, setCtrlKeyDown] = useState(false);
  // Manual toggle states for the left toolbar buttons. These control the visual "pressed"
  // appearance but do NOT override the requirement that actual rotate/scale interactions
  // only happen when the user holds Ctrl/Meta (rotate) or Shift (scale).
  const [rotateManual, setRotateManual] = useState(false);
  const [scaleManual, setScaleManual] = useState(false);
  // Snap-rotation toggle: when true, rotations snap to 11.25° increments while dragging
  const [snapRotation, setSnapRotation] = useState(true);

  // Refs that mirror the manual toggle states so event handlers (which are created once)
  // can read the latest values without recreating the whole scene/handlers.
  const rotateManualRef = useRef(rotateManual);
  const scaleManualRef = useRef(scaleManual);
  const snapRotationRef = useRef(snapRotation);
  useEffect(() => { rotateManualRef.current = rotateManual; }, [rotateManual]);
  useEffect(() => { scaleManualRef.current = scaleManual; }, [scaleManual]);
  useEffect(() => { snapRotationRef.current = snapRotation; }, [snapRotation]);

  useEffect(() => {
    // When modifier keys are pressed or released, keep the manual toggle state
    // and the modifier key state in sync so there's no distinction between them.
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftKeyDown(true);
        // enable scale when Shift is pressed
        setScaleManual(false);
        setRotateManual(false);
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlKeyDown(true);
        // enable rotate when Ctrl/Meta is pressed
        setRotateManual(false);
        setScaleManual(false);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftKeyDown(false);
        setScaleManual(false);
      }
      if (e.key === 'Control' || e.key === 'Meta') {
        setCtrlKeyDown(false);
        setRotateManual(false);
      }
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
      // Also request an autosave immediately after undo
      const json = { ...data, input_polygons: clonePolygons(prev) };
      if (typeof onOutsave === 'function') {
        try { onOutsave(json); } catch { }
      }
      // Emit a matching outsave event for any external listeners
      try {
        window.dispatchEvent(new CustomEvent('polygonEditor:outsave', { detail: { json, label } }));
      } catch { }
    }
  };
  const handleReset = () => {
    const polygons = resetPolygons(data.input_polygons, width, height);
    setPolygons(polygons);
    setSelectedIds(new Set());
    pushHistory(polygonsRef.current);
    const json = { ...data, input_polygons: polygons };
    if (typeof onChange === 'function') {
      try { onChange(json); } catch { }
    }
    // Also request an autosave immediately after reset
    if (typeof onOutsave === 'function') {
      try { onOutsave(json); } catch { }
    }
    // Emit a matching outsave event for any external listeners
    try {
      window.dispatchEvent(new CustomEvent('polygonEditor:outsave', { detail: { json, label } }));
    } catch { }
  };
  const selectionRectRef = useRef<null | { x: number; y: number; w: number; h: number }>(null);
  useEffect(() => { selectionRectRef.current = selectionRect; }, [selectionRect]);
  // Used to cycle through overlapping polygons when clicking repeatedly in the same spot
  const clickCycleRef = useRef<null | { x: number; y: number; candidates: string[]; index: number; lastTime: number }>(null);
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
    // last snapped total rotation (radians) applied during this drag; used when snapRotation is enabled
    lastSnappedRotation?: number;
  }
  const transformStateRef = useRef<TransformState | null>(null);

  // Max canvas bounds (original A4 derived size). Actual canvas will fit inside while matching background image aspect ratio.
  const INIT_MAX_CANVAS_WIDTH = (1 / 0.75) * 180;
  const INIT_MAX_CANVAS_HEIGHT = (1 / 0.75) * (297 / 210) * 180;
  const MIN_MAX_CANVAS = 50; // don't let the max canvas drop below this
  const ABSOLUTE_MAX_CANVAS = 2000; // absolute upper cap for safety
  const [maxCanvasSize, setMaxCanvasSize] = useState<{ w: number; h: number }>({ w: INIT_MAX_CANVAS_WIDTH, h: INIT_MAX_CANVAS_HEIGHT });
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: INIT_MAX_CANVAS_WIDTH, h: INIT_MAX_CANVAS_HEIGHT });
  const width = canvasSize.w;
  const height = canvasSize.h;
  const editorIdRef = useRef<string>(Math.random().toString(36).slice(2));

  // Sync zoom across editors in the same group
  useEffect(() => {
    const handler = (ev: Event) => {
      try {
        const e = ev as CustomEvent<{ group: 'top' | 'bottom'; factor: number; origin: string }>;
        if (!zoomGroup) return;
        if (!e?.detail) return;
        if (e.detail.group !== zoomGroup) return;
        if (e.detail.origin === editorIdRef.current) return;
        const factor = e.detail.factor;
        setMaxCanvasSize(prev => {
          const nw = Math.min(ABSOLUTE_MAX_CANVAS, Math.max(MIN_MAX_CANVAS, Math.round(prev.w * factor)));
          const nh = Math.min(ABSOLUTE_MAX_CANVAS, Math.max(MIN_MAX_CANVAS, Math.round(prev.h * factor)));
          return { w: nw, h: nh };
        });
      } catch { }
    };
    window.addEventListener('polygonEditor:zoom' as any, handler);
    return () => window.removeEventListener('polygonEditor:zoom' as any, handler);
  }, [zoomGroup]);
  const initialHistoryPushedRef = useRef(false);
  const imageDimsRef = useRef<{ w: number; h: number } | null>(null);
  const lastConvertedKeyRef = useRef<string | null>(null);
  // Force a one-time polygon reset on the next background image update (set when user rotates via UI)
  const forceResetOnNextBgChangeRef = useRef<boolean>(false);
  // Force a one-time polygon reset when the user uploads a new image via this editor
  const resetOnUserUploadRef = useRef<boolean>(false);
  // Suppress auto reset on the next background update (used when loading from autosave/mapper)
  const suppressNextAutoResetRef = useRef<boolean>(false);

  // Deep equality for polygon arrays (IDs and vertices, with small float tolerance)
  const deepEqualPolygons = (a: OrigamiMapperTypes.Polygon[], b: OrigamiMapperTypes.Polygon[]) => {
    if (a === b) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    const EPS = 1e-9;
    for (let i = 0; i < a.length; i++) {
      const pa = a[i];
      const pb = b[i];
      if (pa.id !== pb.id) return false;
      if (pa.vertices.length !== pb.vertices.length) return false;
      for (let j = 0; j < pa.vertices.length; j++) {
        const [ax, ay] = pa.vertices[j];
        const [bx, by] = pb.vertices[j];
        if (Math.abs(ax - bx) > EPS || Math.abs(ay - by) > EPS) return false;
      }
    }
    return true;
  };

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
      // Decide mode (consider manual toggles as well)
      let mode: TransformMode = 'idle';
      if (e.shiftKey || scaleManualRef.current) mode = 'scale';
      else if (e.ctrlKey || e.metaKey || rotateManualRef.current) mode = 'rotate';
      else {
        // Prioritize selected bbox
        if (currentSelectedBBox && pointInBBox(x, y, currentSelectedBBox)) {
          mode = 'move';
        } else {
          // Find any polygon(s) containing point (bbox test)
          const hits = polygonsRef.current.filter(p => pointInBBox(x, y, getPolygonBBox(p)));
          if (hits.length) {
            // Build ordered unique group prefixes (so polygons that are parts of the same group
            // are cycled together).
            const prefixes: string[] = [];
            for (const p of hits) {
              const prefix = p.id.split('_')[0];
              if (!prefixes.includes(prefix)) prefixes.push(prefix);
            }
            // If multiple candidates, cycle between them when the user repeatedly clicks the same spot
            const MAX_DIST_PX = 6; // max movement between clicks to be considered the same spot
            const MAX_DELAY_MS = 1000; // max time between clicks to continue cycling
            let nextIndex = 0;
            const now = Date.now();
            const prev = clickCycleRef.current;
            const sameSpot = prev && Math.hypot(prev.x - x, prev.y - y) <= MAX_DIST_PX && (now - prev.lastTime) <= MAX_DELAY_MS;
            const sameCandidates = prev && prev.candidates.length === prefixes.length && prev.candidates.every((v, i) => v === prefixes[i]);
            if (prev && sameSpot && sameCandidates) {
              nextIndex = (prev.index + 1) % prefixes.length;
            } else {
              nextIndex = 0;
            }
            clickCycleRef.current = { x, y, candidates: prefixes, index: nextIndex, lastTime: now };
            const chosenPrefix = prefixes[nextIndex];
            const groupIds = new Set(getGroupIds(chosenPrefix));
            setSelectedIds(groupIds);
            mode = 'move';
          } else {
            // Clear any pending click-cycle when clicking empty space
            clickCycleRef.current = null;
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
        , lastSnappedRotation: 0
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
        if (e.shiftKey || scaleManualRef.current) desiredMode = 'scale';
        else if (e.ctrlKey || e.metaKey || rotateManualRef.current) desiredMode = 'rotate';
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
        // Compute accumulated rotation from this drag
        const centerPixel = { x: state.bboxCenter.x, y: state.bboxCenter.y };
        const prevAngle = Math.atan2(state.lastY - centerPixel.y, state.lastX - centerPixel.x);
        const currAngle = Math.atan2(y - centerPixel.y, x - centerPixel.x);
        let deltaAngle = currAngle - prevAngle;
        if (deltaAngle > Math.PI) deltaAngle -= 2 * Math.PI;
        else if (deltaAngle < -Math.PI) deltaAngle += 2 * Math.PI;
        state.rotationAccum = (state.rotationAccum || 0) + deltaAngle;

        const snapEnabled = snapRotationRef.current;
        const step = (11.25 * Math.PI) / 180; // 11.25°
        const origMap = new Map(state.originalPolygons.map(p => [p.id, p]));
        const updated = polygonsRef.current.map(p => {
          if (!selectedIdsRef.current.has(p.id)) return p;
          const orig = origMap.get(p.id) || p;
          const baseRot = state.originalRotations?.get(p.id) ?? (orig.rotation || 0);
          const total = baseRot + (state.rotationAccum || 0);
          const snappedTotal = snapEnabled ? Math.round(total / step) * step : total;
          const applyDelta = snappedTotal - baseRot;
          const c = Math.cos(applyDelta);
          const s = Math.sin(applyDelta);
          const verts = orig.vertices.map(([vx, vy]) => {
            const px = vx * width;
            const py = vy * height;
            const ox = px - centerPixel.x;
            const oy = py - centerPixel.y;
            const rx = ox * c - oy * s;
            const ry = ox * s + oy * c;
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
    const handleMouseUp = (e: MouseEvent) => {
      const state = transformStateRef.current;
      let finalPolygons = polygonsRef.current;
      let changed = false;
      // If Ctrl/Meta was held and user didn't actually rotate (no accumulated rotation),
      // treat this as a Ctrl-click toggle: if a polygon (triangle) is under the cursor,
      // toggle its group membership in the selection set and bail out early.
      try {
        if (state && (e?.ctrlKey || e?.metaKey) && state.mode === 'rotate' && ((state.rotationAccum || 0) === 0)) {
          const rect = canvasEl.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          // Find polygons whose bbox contains the point
          const hits = polygonsRef.current.filter(p => pointInBBox(x, y, getPolygonBBox(p)));
          if (hits.length) {
            const prefix = hits[0].id.split('_')[0];
            const groupIds = new Set(getGroupIds(prefix));
            const newSel = new Set<string>(selectedIdsRef.current);
            // If the whole group is already selected, remove it; otherwise add it.
            let allPresent = true;
            groupIds.forEach(id => { if (!newSel.has(id)) allPresent = false; });
            if (allPresent) {
              groupIds.forEach(id => newSel.delete(id));
            } else {
              groupIds.forEach(id => newSel.add(id));
            }
            setSelectedIds(newSel);
            // Clear transient state and selection rect
            setSelectionRect(null);
            transformStateRef.current = null;
            return;
          }
        }
      } catch (err) {
        // swallow any errors from hit-testing and continue to normal mouseup behavior
      }
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
          // If the interaction was a rotation, treat any non-zero accumulated rotation as a change
          // even if the vertices end up numerically identical (e.g., a full 360° turn).
          if (!changed && state.mode === 'rotate') {
            const EPS = 1e-6;
            if (Math.abs(state.rotationAccum || 0) > EPS) changed = true;
          }
          if (changed) {
            pushHistory(before);
          }
          // Issue is that quick mouse movements somehow caused rotation indices being different than state.rotationAccum.
          // Persist and reconcile rotation metadata if rotate occurred.
          // Robustly compute per-polygon delta with atan2(cross, dot), resolve 180° sign via drag,
          // and choose the 2π-equivalent closest to the accumulated drag before snapping.
          if (state.mode === 'rotate') {
            const center = state.bboxCenter;
            const origMap = new Map(state.originalPolygons.map(p => [p.id, p]));
            const accum = state.rotationAccum || 0;
            const TWO_PI = Math.PI * 2;
            const step = (11.25 * Math.PI) / 180; // 11.25°
            const reconciled = polygonsRef.current.map(p => {
              if (!selectedIdsRef.current.has(p.id)) return p;
              const orig = origMap.get(p.id);
              if (!orig || !orig.vertices.length) return p;
              const baseRot = state.originalRotations?.get(p.id) ?? (orig.rotation || 0);

              // Vector from center to first vertex (before & after)
              const ox0 = orig.vertices[0][0] * width - center.x;
              const oy0 = orig.vertices[0][1] * height - center.y;
              const nx0 = p.vertices[0][0] * width - center.x;
              const ny0 = p.vertices[0][1] * height - center.y;

              const normO = Math.hypot(ox0, oy0);
              const normN = Math.hypot(nx0, ny0);
              let delta: number;
              if (normO < 1e-6 || normN < 1e-6) {
                // Degenerate case (vertex at center) – fall back to drag accumulation
                delta = accum;
              } else {
                const dot = ox0 * nx0 + oy0 * ny0;
                const cross = ox0 * ny0 - oy0 * nx0;
                delta = Math.atan2(cross, dot);
                // Near-exact 180°: atan2(≈0, -1) yields ±π; pick sign to match drag
                if (Math.abs(Math.abs(delta) - Math.PI) < 1e-3) {
                  const sign = accum >= 0 ? 1 : -1;
                  delta = sign * Math.PI;
                }
                // Pick equivalent angle closest to accumulated drag
                const k = Math.round((accum - delta) / TWO_PI);
                delta += k * TWO_PI;
              }

              let total = baseRot + delta;
              if (snapRotationRef.current) {
                total = Math.round(total / step) * step;
              }

              // Recompute vertices from original using the snapped absolute rotation
              const applyDelta = total - baseRot;
              const c = Math.cos(applyDelta);
              const s = Math.sin(applyDelta);
              const verts = orig.vertices.map(([vx, vy]) => {
                const px = vx * width;
                const py = vy * height;
                const ox2 = px - center.x;
                const oy2 = py - center.y;
                const rx = ox2 * c - oy2 * s;
                const ry = ox2 * s + oy2 * c;
                const npx = rx + center.x;
                const npy = ry + center.y;
                return [npx / width, npy / height] as [number, number];
              });
              return { ...p, rotation: total, vertices: verts };
            });
            finalPolygons = reconciled;
            setPolygons(reconciled);
          }
          // Persist rotation metadata if rotate occurred
          // if (state.mode === 'rotate' && state.rotationAccum && Math.abs(state.rotationAccum) > 1e-6) {
          //   const rotDelta = state.rotationAccum;
          //   const updated = polygonsRef.current.map(p => selectedIdsRef.current.has(p.id)
          //     ? { ...p, rotation: ((state.originalRotations?.get(p.id) || 0) + rotDelta) }
          //     : p);
          //   finalPolygons = updated;
          //   setPolygons(updated);
          // }
          // If it was just a click inside existing selection without movement, unselect (toggle off)
          if (state.pendingClickInsideSelection) {
            setSelectedIds(new Set());
          }
          state.lastSnappedRotation = 0;
        }
      }
      setSelectionRect(null);
      transformStateRef.current = null;

      // Notify parent once after user finishes interaction
      if (changed) {
        const json = { ...data, input_polygons: finalPolygons };
        if (typeof onChange === 'function') {
          try { onChange(json); } catch { }
        }
        // Trigger autosave callback only on mouse up after a change
        if (typeof onOutsave === 'function') {
          try { onOutsave(json); } catch { }
        }
        // Also emit a CustomEvent for external listeners (optional)
        try {
          window.dispatchEvent(new CustomEvent('polygonEditor:outsave', { detail: { json, label } }));
        } catch { }
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
  }, [width, height, maxCanvasSize, backgroundImg]);

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
            maxCanvasSize.w / w,
            maxCanvasSize.h / h
          );
          w *= scale; h *= scale;
          if (Math.abs(w - width) > 0.5 || Math.abs(h - height) > 0.5) {
            setCanvasSize({ w, h });
            imageDimsRef.current = { w: img.naturalWidth, h: img.naturalHeight };
            const key = backgroundImg + ':' + polygonsRef.current.length;
            // Auto-reset when user rotated (force flag), explicitly uploaded a new image in this editor,
            // or when the editor is pristine; skip otherwise (e.g., mirror case)
            if (lastConvertedKeyRef.current !== key) {
              const isPristine = historyRef.current.length <= 1 && deepEqualPolygons(polygonsRef.current, data.input_polygons);
              const shouldReset = !suppressNextAutoResetRef.current && (forceResetOnNextBgChangeRef.current || resetOnUserUploadRef.current || isPristine);
              if (shouldReset) {
                const converted = resetPolygons(data.input_polygons, w, h);
                setPolygons(converted);
              }
              // consume the flags after handling current bg
              forceResetOnNextBgChangeRef.current = false;
              resetOnUserUploadRef.current = false;
              suppressNextAutoResetRef.current = false;
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
    // Force an update even if the polygon contents didn't change by creating a new
    // array reference. This ensures effects and handlers that depend on `polygons`
    // will run when the background/image or canvas size changes.
    setPolygons(prev => [...prev]);
  }, [backgroundImg, width, height, maxCanvasSize]);

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
    base = scalePolygonsToCanvas(converted, width, height);
    // If applyResetTransform is enabled, rotate all polygons 90° CCW (visual)
    // around the canvas center, then translate so combined bbox top-left is at (0,0).
    // No scaling.
    // When applyResetTransform is enabled:
    // - Outside editors: apply full reset (rotate 90°, translate to 0,0, scale contain, mirror for top)
    // - Inside editors: skip the 90° rotation, but still translate to 0,0, scale contain, and mirror for top
    if (applyResetTransform) {
      // 1) Convert normalized -> absolute pixels
      const absPolys = base.map(p => ({
        ...p,
        vertices: p.vertices.map(([vx, vy]) => [vx * width, vy * height] as [number, number])
      }));
      // Determine whether these are inside or outside polygons
      const isOutsideSet = absPolys.every(pp => !String(pp.id).includes('i'));
      // 2) For outside: rotate around canvas center by -90° (visual CCW).
      //    For inside: skip 90° rotation, continue with translate/scale steps.
      let rotPolys = absPolys;
      if (isOutsideSet) {
        const cx = width / 2;
        const cy = height / 2;
        const rad = -Math.PI / 2;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        rotPolys = absPolys.map(p => ({
          ...p,
          vertices: p.vertices.map(([px, py]) => {
            const ox = px - cx;
            const oy = py - cy;
            const rx = ox * cos - oy * sin;
            const ry = ox * sin + oy * cos;
            const npx = rx + cx;
            const npy = ry + cy;
            return [npx, npy] as [number, number];
          })
        }));
      }
      // 3) Find combined bbox and translate to align top-left to (0,0)
      let minX = Infinity, minY = Infinity;
      rotPolys.forEach(p => p.vertices.forEach(([px, py]) => { if (px < minX) minX = px; if (py < minY) minY = py; }));
      const tx = isFinite(minX) ? -minX : 0;
      const ty = isFinite(minY) ? -minY : 0;
      const translated = rotPolys.map(p => ({
        ...p,
        vertices: p.vertices.map(([px, py]) => [px + tx, py + ty] as [number, number])
      }));
      // 4) Scale uniformly to contain: make bbox width==canvas width OR height==canvas height (whichever is smaller)
      let maxX = -Infinity, maxY = -Infinity;
      translated.forEach(p => p.vertices.forEach(([px, py]) => { if (px > maxX) maxX = px; if (py > maxY) maxY = py; }));
      const bboxW = Math.max(1e-6, maxX - 0); // minX is 0 after translation
      const bboxH = Math.max(1e-6, maxY - 0); // minY is 0 after translation
      const s = Math.min(width / bboxW, height / bboxH);
      const scaled = translated.map(p => ({
        ...p,
        vertices: p.vertices.map(([px, py]) => [px * s, py * s] as [number, number])
      }));
      // 5) Convert back to normalized
      let norm = scaled.map(p => ({
        ...p,
        rotation: p.rotation || 0,
        vertices: p.vertices.map(([px, py]) => [px / width, py / height] as [number, number])
      }));
      // 6) If this is the TOP editor, apply mirroring:
      try {
        if (zoomGroup === 'top') {
          const isOutside = norm.every(pp => !String(pp.id).includes('i'));
          const isInside = norm.every(pp => String(pp.id).includes('i'));
          if (isOutside) {
            const mirrored = mirrorOutsidePolygons(norm, norm);
            // Normalize rotation property and translate so top-left of combined bbox is at (0,0)
            let next = mirrored.map(p => ({ ...p, rotation: p.rotation ?? 0 }));
            let minX = Infinity, minY = Infinity;
            next.forEach(pp => pp.vertices.forEach(([vx, vy]) => { if (vx < minX) minX = vx; if (vy < minY) minY = vy; }));
            if (isFinite(minX) && isFinite(minY)) {
              const dx = -minX, dy = -minY;
              next = next.map(pp => ({
                ...pp,
                vertices: pp.vertices.map(([vx, vy]) => [vx + dx, vy + dy] as [number, number])
              }));
            }
            norm = next;
          } else if (isInside) {
            const mirrored = mirrorInsidePolygons(norm, norm);
            let next = mirrored.map(p => ({ ...p, rotation: p.rotation ?? 0 }));
            let minX = Infinity, minY = Infinity;
            next.forEach(pp => pp.vertices.forEach(([vx, vy]) => { if (vx < minX) minX = vx; if (vy < minY) minY = vy; }));
            if (isFinite(minX) && isFinite(minY)) {
              const dx = -minX, dy = -minY;
              next = next.map(pp => ({
                ...pp,
                vertices: pp.vertices.map(([vx, vy]) => [vx + dx, vy + dy] as [number, number])
              }));
            }
            norm = next;
          }
        }
      } catch { }
      return norm;
    }

    // Default behavior: original scaling pipeline

    return converted.map(p => ({ ...p, rotation: p.rotation || 0 }));
  };

  // Expose getCurrentJson to parent via ref
  useImperativeHandle(ref, () => ({
    getCurrentJson: () => ({
      ...data,
      input_polygons: polygons
    }),
    scalePolygonsToCanvas: () => scalePolygonsToCanvas(polygonsRef.current, width, height),
    setFromJson: (json: OrigamiMapperTypes.TemplateJson) => {
      if (!json || !json.input_polygons) return;
      pushHistory(polygonsRef.current);
      setPolygons(json.input_polygons);
      setSelectedIds(new Set());
      if (typeof onChange === 'function') {
        try { onChange({ ...data, input_polygons: json.input_polygons }); } catch { }
      }
    },
    suppressNextAutoReset: () => { suppressNextAutoResetRef.current = true; }
  }), [data, polygons]);

  // Rotation is handled by the parent via transformed background image; no CSS rotation here.

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
          // Mark that polygons should reset on the next background update for this user-initiated upload
          resetOnUserUploadRef.current = true;
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
      {/* Placeholder if no image present */}
      {!backgroundImg && (
        <div className="upload-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ImageUpload label={`Load image`} onImage={(data) => {
            // Mark that polygons should reset on the next background update for this user-initiated upload
            resetOnUserUploadRef.current = true;
            if (typeof onUploadImage === 'function') onUploadImage(data);
          }} />
        </div>
      )}
      {/* Main Grid */}
      {backgroundImg && (
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto auto', gridTemplateRows: 'auto auto auto' }}>
          {/* Top bar */}
          <div style={{ gridRow: '1', gridColumn: '2', marginBottom: '0.3em', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '6px', padding: '2px', alignSelf: 'flex-start', marginTop: '6px', marginLeft: '6px' }}>
              {/* Hidden file input for Import (top toolbar) */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,image/*"
                style={{ display: 'none' }}
                onChange={handleImport}
              />
              {/* Moved: Import/Export (config), Clear, Delete Box, Reset */}
              {SHOW_IMPORT_EXPORT_JSON && (
                <>
                  <button
                    type="button"
                    title="Import JSON or Image"
                    onClick={() => fileInputRef.current?.click()}
                    style={{ padding: '0 0', width: 34, height: 34, borderRadius: 6, border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <IoFolderOpen color="#fff" size={18} />
                  </button>
                  <button
                    type="button"
                    title="Export JSON"
                    onClick={handleExport}
                    style={{ padding: '0 0', width: 34, height: 34, borderRadius: 6, border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <IoDownload color="#fff" size={18} />
                  </button>
                </>
              )}
              <button
                type="button"
                title="Clear background image"
                onClick={() => { if (typeof onDelete === 'function') onDelete(); }}
                style={{ padding: '0 0', width: 34, height: 34, borderRadius: 6, border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <IoCloseCircleOutline color="#fff" size={18} />
              </button>
              {typeof onDeleteBox === 'function' && (
                <button
                  type="button"
                  title="Delete box"
                  onClick={() => { onDeleteBox(); }}
                  style={{ padding: '0 0', width: 34, height: 34, borderRadius: 6, border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <IoTrash color="#fff" size={18} />
                </button>
              )}
              <button
                type="button"
                title="Reset"
                onClick={handleReset}
                style={{ padding: '0 0', width: 34, height: 34, borderRadius: 6, border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <IoReloadOutline color="#fff" size={18} />
              </button>
              {/* Separator between moved buttons and existing rotate/zoom */}
              <div style={{ width: 1, height: 24, background: '#bbb', alignSelf: 'center', margin: '0 6px' }} />
              <button
                type="button"
                title="Rotate counter-clockwise 90°"
                onClick={() => {
                  if (typeof onRotationChange !== 'function') return;
                  // User rotation: ensure polygons are re-based to new background orientation on next image update
                  forceResetOnNextBgChangeRef.current = true;
                  const cur = rotation ?? 0;
                  const next = ((cur + 270) % 360) as 0 | 90 | 180 | 270;
                  onRotationChange(next);
                }}
                style={{ padding: '0 0', width: 34, height: 34, borderRadius: 6, border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <IoRefreshCircle color="#fff" size={18} style={{ transform: 'rotate(-90deg) scaleX(-1)' }} />
              </button>
              <button
                type="button"
                title="Rotate clockwise 90°"
                onClick={() => {
                  if (typeof onRotationChange !== 'function') return;
                  // User rotation: ensure polygons are re-based to new background orientation on next image update
                  forceResetOnNextBgChangeRef.current = true;
                  const cur = rotation ?? 0;
                  const next = ((cur + 90) % 360) as 0 | 90 | 180 | 270;
                  onRotationChange(next);
                }}
                style={{ padding: '0 0', width: 34, height: 34, borderRadius: 6, border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <IoRefreshCircle color="#fff" size={18} style={{ transform: 'rotate(90deg)' }} />
              </button>
              {/* Zoom out / Zoom in buttons (next to rotate CCW) */}
              <button
                type="button"
                title="Zoom out"
                onClick={() => {
                  const factor = 0.75;
                  setMaxCanvasSize(prev => {
                    const nw = Math.max(MIN_MAX_CANVAS, Math.round(prev.w * factor));
                    const nh = Math.max(MIN_MAX_CANVAS, Math.round(prev.h * factor));
                    return { w: Math.min(ABSOLUTE_MAX_CANVAS, nw), h: Math.min(ABSOLUTE_MAX_CANVAS, nh) };
                  });
                  try { if (zoomGroup) window.dispatchEvent(new CustomEvent('polygonEditor:zoom', { detail: { group: zoomGroup, factor, origin: editorIdRef.current } })); } catch { }
                }}
                style={{ padding: '0 0', width: 34, height: 34, borderRadius: 6, border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                {/* magnifying glass with minus */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="8" y1="11" x2="14" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <path d="M21 21l-3-3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                title="Zoom in"
                onClick={() => {
                  const factor = 1 / 0.75;
                  setMaxCanvasSize(prev => {
                    const nw = Math.min(ABSOLUTE_MAX_CANVAS, Math.round(prev.w * factor));
                    const nh = Math.min(ABSOLUTE_MAX_CANVAS, Math.round(prev.h * factor));
                    return { w: Math.max(MIN_MAX_CANVAS, nw), h: Math.max(MIN_MAX_CANVAS, nh) };
                  });
                  try { if (zoomGroup) window.dispatchEvent(new CustomEvent('polygonEditor:zoom', { detail: { group: zoomGroup, factor, origin: editorIdRef.current } })); } catch { }
                }}
                style={{ padding: '0 0', width: 34, height: 34, borderRadius: 6, border: 'none', background: '#000', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                {/* magnifying glass with plus */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="11" cy="11" r="6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <line x1="11" y1="8" x2="11" y2="14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <line x1="8" y1="11" x2="14" y2="11" stroke="white" strokeWidth="2" strokeLinecap="round" />
                  <path d="M21 21l-3-3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
          {/* Left Bar */}
          <div style={{ gridRow: '2', gridColumn: '1', display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '0.5em', marginRight: '0.3em' }}>
            {/* Left toolbar with rotate/scale toggles */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3em', alignItems: 'center', paddingTop: '6px' }}>
              {/* Revert button (moved from bottom): small toolbar button at top-left */}
              <button
                type="button"
                onClick={() => { if (canRevert) handleRevert(); }}
                title="Revert"
                aria-disabled={!canRevert}
                style={{
                  fontSize: '1.0em',
                  padding: '0.25em 0.35em',
                  borderRadius: '6px',
                  background: canRevert ? '#000' : '#333',
                  border: 'none',
                  cursor: canRevert ? 'pointer' : 'not-allowed',
                  opacity: canRevert ? 1 : 0.5,
                  color: '#fff',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <IoCaretBackSharp color="#fff" size={18} />
              </button>
              {/* Rotate button: visual pressed when ctrl/meta down or manually toggled, only if polygons selected */}
              <button
                type="button"
                onClick={() => {
                  if (!selectedIds.size) return;
                  setRotateManual(prev => {
                    const next = !prev;
                    if (next) {
                      // enforce mutual exclusion
                      setScaleManual(false);
                      setShiftKeyDown(false);
                    }
                    return next;
                  });
                }}
                title="Rotate mode (hold Ctrl / ⌘ while dragging to rotate)"
                aria-disabled={selectedIds.size === 0}
                aria-pressed={selectedIds.size ? (rotateManual || ctrlKeyDown) : false}
                style={{
                  fontSize: '1.0em',
                  padding: '0.25em 0.35em',
                  borderRadius: '6px',
                  background: (selectedIds.size && (rotateManual || ctrlKeyDown)) ? '#333' : '#000',
                  border: 'none',
                  cursor: selectedIds.size ? 'pointer' : 'not-allowed',
                  opacity: selectedIds.size ? 1 : 0.5,
                  color: '#fff',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ position: 'relative', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IoRefreshCircle size={20} />
                </span>
              </button>
              {/* Scale button: visual pressed when shift down or manually toggled */}
              <button
                type="button"
                onClick={() => {
                  if (!selectedIds.size) return;
                  setScaleManual(prev => {
                    const next = !prev;
                    if (next) {
                      // enforce mutual exclusion
                      setRotateManual(false);
                      setCtrlKeyDown(false);
                    }
                    return next;
                  });
                }}
                title="Scale mode (hold Shift while dragging to scale)"
                aria-disabled={selectedIds.size === 0}
                aria-pressed={selectedIds.size ? (scaleManual || shiftKeyDown) : false}
                style={{
                  fontSize: '1.0em',
                  padding: '0.25em 0.35em',
                  borderRadius: '6px',
                  background: (selectedIds.size && (scaleManual || shiftKeyDown)) ? '#333' : '#000',
                  border: 'none',
                  cursor: selectedIds.size ? 'pointer' : 'not-allowed',
                  opacity: selectedIds.size ? 1 : 0.5,
                  color: '#fff',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ position: 'relative', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IoResizeOutline size={20} />
                  <IoGridOutline size={10} style={{ position: 'absolute', right: -2, bottom: -2, opacity: 0.85 }} />
                </span>
              </button>
              {/* Snap rotation toggle: when enabled, rotations snap to 11.25° increments while dragging */}
              <button
                type="button"
                onClick={() => { setSnapRotation(prev => !prev); }}
                title="Snap rotation to 11.25° steps while rotating"
                aria-pressed={snapRotation}
                style={{
                  fontSize: '1.0em',
                  padding: '0.25em 0.35em',
                  borderRadius: '6px',
                  background: snapRotation ? '#333' : '#000',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: 1,
                  color: '#fff',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <span style={{ position: 'relative', width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IoMagnetOutline size={20} />
                  <IoRefreshCircle size={10} style={{ position: 'absolute', right: -2, bottom: -2, opacity: 0.85 }} />
                </span>
              </button>

              {/* Removed moved buttons from left toolbar (now in top toolbar) */}
            </div>
          </div>
          {/* Right bar */}
          <div style={{ gridRow: '2', gridColumn: '3' }}></div>
          {/* Canvas */}
          <div
            ref={mountRef}
            style={{
              gridRow: '2', gridColumn: '2',
              position: 'relative',
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center'
            }}
          >
            {selectionRect && (() => {
              // When the canvas is smaller than the parent container and centered via flex,
              // adjust the selection rectangle by the canvas's offset within the mount container.
              let offsetLeft = 0, offsetTop = 0;
              try {
                const mountEl = mountRef.current;
                const canvasEl = rendererRef.current?.domElement || null;
                if (mountEl && canvasEl) {
                  const mRect = mountEl.getBoundingClientRect();
                  const cRect = canvasEl.getBoundingClientRect();
                  offsetLeft = cRect.left - mRect.left;
                  offsetTop = cRect.top - mRect.top;
                }
              } catch { /* no-op */ }
              const left = offsetLeft + Math.min(selectionRect.x, selectionRect.x + selectionRect.w);
              const top = offsetTop + Math.min(selectionRect.y, selectionRect.y + selectionRect.h);
              const width = Math.abs(selectionRect.w);
              const height = Math.abs(selectionRect.h);
              return (
                <div
                  style={{
                    position: 'absolute',
                    left,
                    top,
                    width,
                    height,
                    border: '1px dashed #ff8800',
                    background: 'rgba(255,136,0,0.1)',
                    pointerEvents: 'none'
                  }}
                />
              );
            })()}
          </div>
          {/* Bottom bar removed: buttons moved to left toolbar */}
        </div>
      )}

    </div>
  );
});

export default PolygonEditor;
