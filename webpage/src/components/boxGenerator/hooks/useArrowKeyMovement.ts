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
  // Mode flags
  isRotateModeActive?: boolean;
  isScaleModeActive?: boolean;
  snapRotation?: boolean;
  // Optional tuning
  tapStepPx?: number; // default 1
  holdDelayMs?: number; // default 200
  holdSpeedPxPerSec?: number; // default 200
  rotateTapDeg?: number; // default 1 (or 11.25 when snapRotation true)
  rotateSpeedDegPerSec?: number; // default 90
  scaleTapFactor?: number; // default 0.01 (1%)
  scaleSpeedPerSec?: number; // default 0.5 (50%/s)
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
    isRotateModeActive = false,
    isScaleModeActive = false,
    snapRotation = false,
    tapStepPx = 1,
    holdDelayMs = 200,
    holdSpeedPxPerSec = 200,
    rotateTapDeg,
    rotateSpeedDegPerSec = 90,
    scaleTapFactor = 0.01,
    scaleSpeedPerSec = 0.5,
  } = opts;

  const arrowKeysDownRef = useRef<{ ArrowUp?: boolean; ArrowDown?: boolean; ArrowLeft?: boolean; ArrowRight?: boolean }>({});
  const holdTimerRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const holdActiveRef = useRef(false);
  const lastFrameTsRef = useRef<number | null>(null);
  const keyMoveSessionRef = useRef<{
    snapshot: OrigamiMapperTypes.Polygon[] | null;
    changed: boolean;
    // session data for transforms
    center?: { x: number; y: number };
    move?: { dxPx: number; dyPx: number };
    scale?: { factor: number };
    rotate?: { accumRad: number; baseRotations: Map<string, number> };
  }>({ snapshot: null, changed: false });

  const getSelectedBBoxCenter = (): { x: number; y: number } | null => {
    const ids = selectedIdsRef.current;
    if (!ids.size) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    polygonsRef.current.forEach(p => {
      if (!ids.has(p.id)) return;
      p.vertices.forEach(([vx, vy]) => {
        const px = vx * width;
        const py = vy * height;
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      });
    });
    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  };

  const beginKeyboardSession = () => {
    if (!keyMoveSessionRef.current.snapshot) {
      const snapshot = polygonsRef.current.map(p => ({ ...p, vertices: p.vertices.map(v => [...v] as [number, number]) }));
      const center = getSelectedBBoxCenter() || { x: width / 2, y: height / 2 };
      const baseRotations = new Map<string, number>();
      snapshot.forEach(p => { if (selectedIdsRef.current.has(p.id)) baseRotations.set(p.id, p.rotation || 0); });
      keyMoveSessionRef.current = {
        snapshot,
        changed: false,
        center,
        move: { dxPx: 0, dyPx: 0 },
        scale: { factor: 1 },
        rotate: { accumRad: 0, baseRotations }
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

  const applyMoveFromSession = () => {
    const sess = keyMoveSessionRef.current;
    if (!sess.snapshot || !sess.move) return;
    const { dxPx, dyPx } = sess.move;
    const ndx = dxPx / width;
    const ndy = dyPx / height;
    const updated = sess.snapshot.map(p => {
      if (!selectedIdsRef.current.has(p.id)) return { ...p };
      const verts = p.vertices.map(([vx, vy]) => [vx + ndx, vy + ndy] as [number, number]);
      return { ...p, vertices: verts };
    });
    setPolygons(updated);
  };

  const applyScaleFromSession = () => {
    const sess = keyMoveSessionRef.current;
    if (!sess.snapshot || !sess.scale || !sess.center) return;
    const s = Math.max(0.05, Math.min(10, sess.scale.factor));
    const cx = sess.center.x, cy = sess.center.y;
    const updated = sess.snapshot.map(p => {
      if (!selectedIdsRef.current.has(p.id)) return { ...p };
      const verts = p.vertices.map(([vx, vy]) => {
        const px = vx * width; const py = vy * height;
        const ox = px - cx; const oy = py - cy;
        const sx = ox * s; const sy = oy * s;
        return [(sx + cx) / width, (sy + cy) / height] as [number, number];
      });
      return { ...p, vertices: verts };
    });
    setPolygons(updated);
  };

  const applyRotateFromSession = () => {
    const sess = keyMoveSessionRef.current;
    if (!sess.snapshot || !sess.rotate || !sess.center) return;
    const cx = sess.center.x, cy = sess.center.y;
    const baseRotations = sess.rotate.baseRotations;
    const accum = sess.rotate.accumRad;
    const step = (11.25 * Math.PI) / 180;
    const updated = sess.snapshot.map(p => {
      if (!selectedIdsRef.current.has(p.id)) return { ...p };
      const base = baseRotations.get(p.id) || (p.rotation || 0);
      const total = base + accum;
      const snapped = snapRotation ? Math.round(total / step) * step : total;
      const applyDelta = snapped - base;
      const c = Math.cos(applyDelta), s = Math.sin(applyDelta);
      const verts = p.vertices.map(([vx, vy]) => {
        const px = vx * width; const py = vy * height;
        const ox = px - cx; const oy = py - cy;
        const rx = ox * c - oy * s; const ry = ox * s + oy * c;
        return [(rx + cx) / width, (ry + cy) / height] as [number, number];
      });
      return { ...p, rotation: snapped, vertices: verts };
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

      beginKeyboardSession();
      // Determine mode for hold
      if (isRotateModeActive) {
        // Rotation: compute sign from keys
        let sign = 0;
        if (keysPressed.ArrowLeft || keysPressed.ArrowUp) sign -= 1;
        if (keysPressed.ArrowRight || keysPressed.ArrowDown) sign += 1;
        if (sign !== 0) {
          const deg = rotateSpeedDegPerSec * dt * sign;
          const rad = (deg * Math.PI) / 180;
          keyMoveSessionRef.current.rotate!.accumRad += rad;
          applyRotateFromSession();
          markChanged();
        }
      } else if (isScaleModeActive) {
        // Scale: Up/Right enlarge, Down/Left shrink
        let dir = 0;
        if (keysPressed.ArrowUp || keysPressed.ArrowRight) dir += 1;
        if (keysPressed.ArrowDown || keysPressed.ArrowLeft) dir -= 1;
        if (dir !== 0) {
          const rate = scaleSpeedPerSec * dt * dir;
          keyMoveSessionRef.current.scale!.factor *= (1 + rate);
          applyScaleFromSession();
          markChanged();
        }
      } else {
        // Move: normalized vector for constant speed including diagonals
        let vx = 0, vy = 0;
        if (keysPressed.ArrowLeft) vx -= 1;
        if (keysPressed.ArrowRight) vx += 1;
        if (keysPressed.ArrowUp) vy -= 1;
        if (keysPressed.ArrowDown) vy += 1;
        if (vx !== 0 || vy !== 0) {
          const len = Math.hypot(vx, vy) || 1;
          vx /= len; vy /= len;
          keyMoveSessionRef.current.move!.dxPx += vx * holdSpeedPxPerSec * dt;
          keyMoveSessionRef.current.move!.dyPx += vy * holdSpeedPxPerSec * dt;
          applyMoveFromSession();
          markChanged();
        }
      }
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
          beginKeyboardSession();
          if (isRotateModeActive) {
            // Tap rotation
            const base = rotateTapDeg ?? (snapRotation ? 11.25 : 1);
            let sign = 0;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') sign -= 1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') sign += 1;
            if (sign !== 0) {
              keyMoveSessionRef.current.rotate!.accumRad += ((base * Math.PI) / 180) * sign;
              applyRotateFromSession();
              markChanged();
            }
          } else if (isScaleModeActive) {
            // Tap scale (uniform)
            let dir = 0;
            if (e.key === 'ArrowUp' || e.key === 'ArrowRight') dir += 1;
            if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') dir -= 1;
            if (dir !== 0) {
              keyMoveSessionRef.current.scale!.factor *= (1 + dir * scaleTapFactor);
              applyScaleFromSession();
              markChanged();
            }
          } else {
            // Tap move (fine)
            const dx = (e.key === 'ArrowLeft' ? -tapStepPx : e.key === 'ArrowRight' ? tapStepPx : 0);
            const dy = (e.key === 'ArrowUp' ? -tapStepPx : e.key === 'ArrowDown' ? tapStepPx : 0);
            keyMoveSessionRef.current.move!.dxPx += dx;
            keyMoveSessionRef.current.move!.dyPx += dy;
            applyMoveFromSession();
            markChanged();
          }
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
  }, [backgroundImg, data, height, label, polygonsRef, selectedIdsRef, width, isRotateModeActive, isScaleModeActive, snapRotation, holdSpeedPxPerSec, rotateSpeedDegPerSec, scaleSpeedPerSec, scaleTapFactor, tapStepPx, rotateTapDeg, holdDelayMs]);
}
