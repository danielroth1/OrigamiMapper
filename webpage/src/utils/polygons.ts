import type { OrigamiMapperTypes } from '../OrigamiMapperTypes';

// Shared helpers and types to avoid duplication
type Face = 'R' | 'L' | 'U' | 'V' | 'H';

const byFace = (polys: OrigamiMapperTypes.Polygon[]) => {
  const map: Record<string, OrigamiMapperTypes.Polygon[]> = {};
  polys.forEach(p => { const k = p.id[0]; if ('RLUVH'.includes(k)) (map[k] = map[k] || []).push(p); });
  return map;
};

const rot180 = (cx: number, cy: number, x: number, y: number): [number, number] => [2 * cx - x, 2 * cy - y];

const bbox = (polys: OrigamiMapperTypes.Polygon[]) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  polys.forEach(pp => pp.vertices.forEach(([x, y]: [number, number]) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }));
  return { minX, minY, maxX, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
};

const normAngle = (a: number) => {
  let ang = a;
  const TWO_PI = Math.PI * 2;
  ang = ((ang + Math.PI) % TWO_PI + TWO_PI) % TWO_PI - Math.PI; // normalize to [-PI, PI)
  return ang;
};

// Compute an oriented bounding box for a set of polygons by performing PCA on all vertices.
// Returns principal axis angle (angle of major axis), center, unit axes (u major, v minor),
// and half lengths along those axes.
interface OBB {
  cx: number; cy: number;
  ux: number; uy: number; // major axis unit vector
  vx: number; vy: number; // minor axis unit vector (perpendicular)
  hu: number; hv: number; // half lengths
  ang: number; // angle of major axis
}

const computeOBB = (polys: OrigamiMapperTypes.Polygon[]): OBB | null => {
  const pts: [number, number][] = [];
  polys.forEach(p => p.vertices.forEach(v => pts.push([v[0], v[1]])));
  if (pts.length === 0) return null;
  // If polygons have an explicit rotation property, assume group shares same orientation.
  // Use first non-null rotation as OBB angle instead of PCA angle, still compute extents projected onto that rotated frame.
  const explicitRot = (() => {
    for (const p of polys) {
      if (typeof p.rotation === 'number') return p.rotation as number;
    }
    return 0;
  })();
  // Compute centroid
  let cx = 0, cy = 0;
  pts.forEach(([x, y]) => { cx += x; cy += y; });
  cx /= pts.length; cy /= pts.length;
  let evx: number, evy: number, mvx: number, mvy: number, ang: number;
  if (explicitRot !== null) {
    ang = normAngle(explicitRot);
    evx = Math.cos(ang); evy = Math.sin(ang);
    mvx = -evy; mvy = evx;
  } else {
    // Compute covariance matrix for PCA fallback
    let xx = 0, yy = 0, xy = 0;
    pts.forEach(([x, y]) => { const dx = x - cx, dy = y - cy; xx += dx * dx; yy += dy * dy; xy += dx * dy; });
    xx /= pts.length; yy /= pts.length; xy /= pts.length;
    const trace = xx + yy;
    const det = xx * yy - xy * xy;
    const discr = Math.max(trace * trace / 4 - det, 0);
    const l1 = trace / 2 + Math.sqrt(discr);
    let tmpx = xy, tmpy = l1 - xx;
    if (Math.abs(tmpx) < 1e-8 && Math.abs(tmpy) < 1e-8) { tmpx = 1; tmpy = 0; }
    const len = Math.hypot(tmpx, tmpy);
    evx = tmpx / len; evy = tmpy / len;
    mvx = -evy; mvy = evx;
    ang = Math.atan2(evy, evx);
  }
  // Project all points to axes to find extents
  let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
  pts.forEach(([x, y]) => {
    const dx = x - cx, dy = y - cy;
    const u = dx * evx + dy * evy;
    const v = dx * mvx + dy * mvy;
    if (u < minU) minU = u; if (u > maxU) maxU = u;
    if (v < minV) minV = v; if (v > maxV) maxV = v;
  });
  const hu = (maxU - minU) / 2; const hv = (maxV - minV) / 2;
  // Recompute center with respect to OBB center (shift along axes)
  const centerShiftU = (maxU + minU) / 2;
  const centerShiftV = (maxV + minV) / 2;
  cx += evx * centerShiftU + mvx * centerShiftV;
  cy += evy * centerShiftU + mvy * centerShiftV;
  return { cx, cy, ux: evx, uy: evy, vx: mvx, vy: mvy, hu, hv, ang };
};

// Unified copy function used by both mirrorOutsidePolygons and mirrorInsidePolygons
const applyCopyFromTo = (
  s: Record<string, OrigamiMapperTypes.Polygon[]>,
  t: OrigamiMapperTypes.Polygon[],
  srcLetter: Face,
  tgtLetter: Face,
  rotate: boolean,
  shiftUtoV: boolean
) => {
  const src = s[srcLetter]; if (!src || src.length === 0) return;
  // Compute OBB for source and target groups (target face subset before modification)
  const tgtGroup: OrigamiMapperTypes.Polygon[] = t.filter(p => p.id[0] === tgtLetter);
  const obbSrc = computeOBB(src);
  const obbTgt = computeOBB(tgtGroup);
  // Fallback to axis-aligned bbox if OBB fails
  const bSrc = obbSrc || (() => { const b = bbox(src); return { cx: b.cx, cy: b.cy, ux: 1, uy: 0, vx: 0, vy: 1, hu: (b.maxX - b.minX) / 2, hv: (b.maxY - b.minY) / 2, ang: 0 }; })();
  const bTgt = obbTgt || (() => { const b = bbox(tgtGroup); return { cx: b.cx, cy: b.cy, ux: 1, uy: 0, vx: 0, vy: 1, hu: (b.maxX - b.minX) / 2, hv: (b.maxY - b.minY) / 2, ang: 0 }; })();
  // Transform FROM target OBB space TO source OBB space (user correction):
  // For target point P: (u,v)_tgt -> scale to source extents -> rotate to source axes -> translate to source center.
  const scaleU = bSrc.hu > 1e-9 ? (bSrc.hu / (bTgt.hu || 1e-9)) : 1;
  const scaleV = bSrc.hv > 1e-9 ? (bSrc.hv / (bTgt.hv || 1e-9)) : 1;
  // Target axes
  const tux = bTgt.ux, tuy = bTgt.uy, tvx = bTgt.vx, tvy = bTgt.vy;
  // Source axes
  const sux = bSrc.ux, suy = bSrc.uy, svx = bSrc.vx, svy = bSrc.vy;
  const srcAng = bSrc.ang;
  const tgtAng = bTgt.ang;
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
  // replace corresponding target face polygons by transformed source polygons
  for (let i = 0; i < t.length; i++) {
    if (t[i].id[0] !== tgtLetter) continue;
    const tgtPoly = t[i];
    const verts = tgtPoly.vertices.map(([x, y]: [number, number]) => {
      // Convert to target local (u,v)
      const dx = x - bTgt.cx;
      const dy = y - bTgt.cy;
      const u = dx * tux + dy * tuy; // projection onto target major axis
      const v = dx * tvx + dy * tvy; // projection onto target minor axis
      // Scale to source extents
      const us = u * scaleU;
      const vs = v * scaleV;
      // Map into source axes
      let nx = bSrc.cx + us * sux + vs * svx;
      let ny = bSrc.cy + us * suy + vs * svy;
      // Optional 180 rotation about source center if rotate flag
      if (rotate) {
        const r = rot180(bSrc.cx, bSrc.cy, nx, ny);
        nx = r[0]; ny = r[1];
      }
      // shiftUtoV translation applied last
      nx += shiftVec.dx; ny += shiftVec.dy;
      return [nx, ny] as [number, number];
    });
    const baseRot = typeof tgtPoly.rotation === 'number' ? tgtPoly.rotation : 0;
    // New rotation adjusted to source orientation
    const angDelta = srcAng - tgtAng + (rotate ? Math.PI : 0);
    const newRot = normAngle(baseRot + angDelta);
    t[i] = { ...t[i], vertices: verts, rotation: newRot };
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
  const t: OrigamiMapperTypes.Polygon[] = target.map(p => ({ ...p, rotation: p.rotation, vertices: p.vertices.map((v: [number, number]) => [...v] as [number, number]) }));
  // Swap L<->R, rotate those; V/H rotate in place; U copies in place with shift towards V by vector V[0]->V[2]
  applyCopyFromTo(s, t, 'R', 'L', true, false);
  applyCopyFromTo(s, t, 'L', 'R', true, false);
  applyCopyFromTo(s, t, 'V', 'V', true, false);
  applyCopyFromTo(s, t, 'H', 'H', true, false);
  applyCopyFromTo(s, t, 'U', 'U', true, true);
  return t;
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
  const t: OrigamiMapperTypes.Polygon[] = target.map(p => ({ ...p, rotation: p.rotation, vertices: p.vertices.map((v: [number, number]) => [...v] as [number, number]) }));
  // Inside rules: swap L<->R WITHOUT rotation; rotate U/V/H in place; no translation or U-shifts
  applyCopyFromTo(s, t, 'R', 'L', true, false);
  applyCopyFromTo(s, t, 'L', 'R', true, false);
  applyCopyFromTo(s, t, 'U', 'U', true, false);
  applyCopyFromTo(s, t, 'V', 'H', true, false);
  applyCopyFromTo(s, t, 'H', 'V', true, false);
  return t;
  // return source;
};
