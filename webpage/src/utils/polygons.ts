import type { OrigamiMapperTypes } from '../OrigamiMapperTypes';

// Shared helpers and types to avoid duplication
type Face = 'R' | 'L' | 'U' | 'V' | 'H';

const byFace = (polys: OrigamiMapperTypes.Polygon[]) => {
  const map: Record<string, OrigamiMapperTypes.Polygon[]> = {};
  polys.forEach(p => { const k = p.id[0]; if ('RLUVH'.includes(k)) (map[k] = map[k] || []).push(p); });
  return map;
};

const rot180 = (cx: number, cy: number, x: number, y: number): [number, number] => [2 * cx - x, 2 * cy - y];

// Normalize degrees to [-180, 180)
const normAngleDeg = (a: number) => {
  let ang = a;
  ang = ((ang + 180) % 360 + 360) % 360 - 180;
  return ang;
};

// Unified copy function used by both mirrorOutsidePolygons and mirrorInsidePolygons
const applyCopyFromTo = (
  s: Record<string, OrigamiMapperTypes.Polygon[]>,
  out: OrigamiMapperTypes.Polygon[],
  target: OrigamiMapperTypes.Polygon[],
  srcLetter: Face,
  tgtLetter: Face,
  rotate: boolean,
  shiftUtoV: boolean
) => {
  const src = s[srcLetter]; if (!src || src.length === 0) return;
  const tgtGroup = target.filter(p => p.id[0] === tgtLetter);
  if (tgtGroup.length === 0) return;
  const shiftVec = (() => {
    if (!shiftUtoV) return { dx: 0, dy: 0 };
    const v = s['V'];
    if (!v || v.length === 0) return { dx: 0, dy: 0 };
    const p0 = v[0];
    if (p0.vertices.length < 3) return { dx: 0, dy: 0 };
    const a1 = src[0].vertices[0];
    const c1 = src[0].vertices[1];
    const a2 = p0.vertices[2];
    const c2 = p0.vertices[0];
    return { dx: c1[0] - a1[0] + c2[0] - a2[0], dy: c1[1] - a1[1] + c2[1] - a2[1] };
  })();
  const centroid = (verts: [number, number][]) => {
    let sx = 0, sy = 0; const n = verts.length || 1;
    for (const [x, y] of verts) { sx += x; sy += y; }
    return { cx: sx / n, cy: sy / n };
  };
  const groupCentroid = (polys: OrigamiMapperTypes.Polygon[]) => {
    const all: [number, number][] = [];
    for (const pp of polys) all.push(...pp.vertices);
    return centroid(all.length ? all : [[0, 0]]);
  };
  const csGroup = groupCentroid(src);
  const ctGroup = groupCentroid(tgtGroup);
  const dxGroup = (ctGroup.cx - csGroup.cx) + shiftVec.dx;
  const dyGroup = (ctGroup.cy - csGroup.cy) + shiftVec.dy;
  // transform corresponding source face polygons in the output array, preserving polygon identity
  for (let i = 0; i < out.length; i++) {
    if (out[i].id[0] !== srcLetter) continue;
    const srcPoly = out[i];
    const verts = srcPoly.vertices.map(([x, y]: [number, number]) => {
      const [rx, ry] = rotate ? rot180(csGroup.cx, csGroup.cy, x, y) : [x, y];
      return [rx + dxGroup, ry + dyGroup] as [number, number];
    });
    const baseRot = typeof srcPoly.rotation === 'number' ? srcPoly.rotation : 0;
    const newRot = rotate ? normAngleDeg(baseRot + 180) : baseRot;
    out[i] = { ...out[i], vertices: verts, rotation: newRot };
  }
};

// Mirror logic for OUTSIDE polygons only:
// - L and R are swapped between source and target and rotated 180° around the source face bbox center
// - V and H are copied to same faces, rotated 180°
// - U is copied to U without rotation and shifted by vector V[0] -> V[2]
export const mirrorOutsidePolygons = (
  source: OrigamiMapperTypes.Polygon[],
  target: OrigamiMapperTypes.Polygon[]
): OrigamiMapperTypes.Polygon[] => {
  const s = byFace(source);
  const out: OrigamiMapperTypes.Polygon[] = source.map(p => ({ ...p, vertices: p.vertices.map((v: [number, number]) => [...v] as [number, number]) }));
  // Swap L<->R, rotate those; V/H rotate in place; U copies in place with shift towards V by vector V[0]->V[2]
  applyCopyFromTo(s, out, target, 'R', 'L', true, false);
  applyCopyFromTo(s, out, target, 'L', 'R', true, false);
  applyCopyFromTo(s, out, target, 'V', 'V', true, false);
  applyCopyFromTo(s, out, target, 'H', 'H', true, false);
  applyCopyFromTo(s, out, target, 'U', 'U', true, true);
  return out;
};

// Mirror logic for INSIDE polygons:
// - R and L are swapped between source and target WITHOUT rotation.
// - V, H, and U are copied to same faces, rotated 180° around the source face bbox center.
// - No translation is applied to any group.
export const mirrorInsidePolygons = (
  source: OrigamiMapperTypes.Polygon[],
  target: OrigamiMapperTypes.Polygon[]
): OrigamiMapperTypes.Polygon[] => {
  const s = byFace(source);
  const out: OrigamiMapperTypes.Polygon[] = source.map(p => ({ ...p, vertices: p.vertices.map((v: [number, number]) => [...v] as [number, number]) }));
  // Inside rules: swap L<->R WITHOUT rotation; rotate U/V/H in place; no translation or U-shifts
  applyCopyFromTo(s, out, target, 'R', 'L', true, false);
  applyCopyFromTo(s, out, target, 'L', 'R', true, false);
  applyCopyFromTo(s, out, target, 'U', 'U', true, false);
  applyCopyFromTo(s, out, target, 'V', 'H', true, false);
  applyCopyFromTo(s, out, target, 'H', 'V', true, false);
  return out;
};
