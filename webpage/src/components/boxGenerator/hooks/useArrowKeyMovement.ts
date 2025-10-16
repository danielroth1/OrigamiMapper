import { useEffect, useRef } from 'react';
import type { OrigamiMapperTypes } from '../../../OrigamiMapperTypes';

export interface ArrowKeyMoveOptions {
  width: number;
  height: number;
  backgroundImg?: string;
  data: OrigamiMapperTypes.TemplateJson;
  label: string;
  selectedIdsRef: React.MutableRefObject<Set<string>>;
  polygonsRef: React.MutableRefObject<OrigamiMapperTypes.Polygon[]>;
  setPolygons: (p: OrigamiMapperTypes.Polygon[] | ((prev: OrigamiMapperTypes.Polygon[]) => OrigamiMapperTypes.Polygon[])) => void;
  onChange?: (json: OrigamiMapperTypes.TemplateJson) => void;
  onOutsave?: (json: OrigamiMapperTypes.TemplateJson) => void;
  pushHistory: (snapshot: OrigamiMapperTypes.Polygon[]) => void;
  // Optional tuning
  tapStepPx?: number; // default 1
  holdDelayMs?: number; // default 200
  holdSpeedPxPerSec?: number; // default 200
}

// Adds arrow-key movement: tap moves by 1px; holding moves at constant speed via RAF; supports multi-key.
export function useArrowKeyMovement(opts: ArrowKeyMoveOptions) {
  const {
    width,
    height,
    backgroundImg,
    data,
    label,
    selectedIdsRef,
    polygonsRef,
    setPolygons,
    onChange,
    onOutsave,
    pushHistory,
    tapStepPx = 1,
    holdDelayMs = 100,
    holdSpeedPxPerSec = 50,
  } = opts;

  const arrowKeysDownRef = useRef<{ ArrowUp?: boolean; ArrowDown?: boolean; ArrowLeft?: boolean; ArrowRight?: boolean }>({});
  const holdTimerRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const holdActiveRef = useRef(false);
  const lastFrameTsRef = useRef<number | null>(null);
  const keyMoveSessionRef = useRef<{ snapshot: OrigamiMapperTypes.Polygon[] | null; changed: boolean }>({ snapshot: null, changed: false });

  const beginKeyboardSession = () => {
    if (!keyMoveSessionRef.current.snapshot) {
      keyMoveSessionRef.current = {
        snapshot: polygonsRef.current.map(p => ({ ...p, vertices: p.vertices.map(v => [...v] as [number, number]) })),
        changed: false
      };
    }
  };
  const markChanged = () => { keyMoveSessionRef.current.changed = true; };
  const finalizeKeyboardSession = () => {
    const sess = keyMoveSessionRef.current;
    if (sess.snapshot && sess.changed) {
      pushHistory(sess.snapshot);
      const json = { ...data, input_polygons: polygonsRef.current };
      if (typeof onChange === 'function') { try { onChange(json); } catch { } }
      if (typeof onOutsave === 'function') { try { onOutsave(json); } catch { } }
      try { window.dispatchEvent(new CustomEvent('polygonEditor:outsave', { detail: { json, label } })); } catch { }
    }
    keyMoveSessionRef.current = { snapshot: null, changed: false };
  };

  const applyPixelMove = (dxPx: number, dyPx: number) => {
    if (!selectedIdsRef.current.size) return;
    if (dxPx === 0 && dyPx === 0) return;
    const ndx = dxPx / width;
    const ndy = dyPx / height; // positive downwards
    const updated = polygonsRef.current.map(p => {
      if (!selectedIdsRef.current.has(p.id)) return p;
      const verts = p.vertices.map(([vx, vy]) => [vx + ndx, vy + ndy] as [number, number]);
      return { ...p, vertices: verts };
    });
    setPolygons(updated);
  };

  useEffect(() => {
    const keysPressed = arrowKeysDownRef.current;
    const anyArrowDown = () => !!(keysPressed.ArrowUp || keysPressed.ArrowDown || keysPressed.ArrowLeft || keysPressed.ArrowRight);

    const stopRAF = () => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      holdActiveRef.current = false;
      lastFrameTsRef.current = null;
    };

    const tick = (ts: number) => {
      if (!anyArrowDown() || !selectedIdsRef.current.size) {
        stopRAF();
        finalizeKeyboardSession();
        return;
      }
      const last = lastFrameTsRef.current ?? ts;
      let dt = (ts - last) / 1000;
      if (dt > 0.05) dt = 0.05; // clamp to avoid jumps
      lastFrameTsRef.current = ts;

      let vx = 0, vy = 0;
      if (keysPressed.ArrowLeft) vx -= 1;
      if (keysPressed.ArrowRight) vx += 1;
      if (keysPressed.ArrowUp) vy -= 1;
      if (keysPressed.ArrowDown) vy += 1;

      if (vx === 0 && vy === 0) {
        rafIdRef.current = requestAnimationFrame(tick);
        return;
      }
      const len = Math.hypot(vx, vy) || 1;
      vx /= len; vy /= len;
      const dxPx = vx * holdSpeedPxPerSec * dt;
      const dyPx = vy * holdSpeedPxPerSec * dt;
      beginKeyboardSession();
      applyPixelMove(dxPx, dyPx);
      markChanged();
      rafIdRef.current = requestAnimationFrame(tick);
    };

    const startHold = () => {
      if (holdActiveRef.current) return;
      if (!anyArrowDown() || !selectedIdsRef.current.size) return;
      holdActiveRef.current = true;
      lastFrameTsRef.current = performance.now();
      rafIdRef.current = requestAnimationFrame(tick);
    };

    const clearHoldTimer = () => {
      if (holdTimerRef.current != null) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };

    const scheduleHold = () => {
      clearHoldTimer();
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        startHold();
      }, holdDelayMs);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!backgroundImg) return; // active only when editor has an image
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        if (!selectedIdsRef.current.size) return;
        e.preventDefault();
        const already = !!keysPressed[e.key as keyof typeof keysPressed];
        keysPressed[e.key as keyof typeof keysPressed] = true;
        if (!already) {
          const dx = (e.key === 'ArrowLeft' ? -tapStepPx : e.key === 'ArrowRight' ? tapStepPx : 0);
          const dy = (e.key === 'ArrowUp' ? -tapStepPx : e.key === 'ArrowDown' ? tapStepPx : 0);
          beginKeyboardSession();
          applyPixelMove(dx, dy);
          markChanged();
          scheduleHold();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        keysPressed[e.key as keyof typeof keysPressed] = false;
        if (!anyArrowDown()) {
          clearHoldTimer();
          stopRAF();
          finalizeKeyboardSession();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearHoldTimer();
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
      holdActiveRef.current = false;
      finalizeKeyboardSession();
    };
  }, [backgroundImg, data, height, label, polygonsRef, selectedIdsRef, width]);
}
