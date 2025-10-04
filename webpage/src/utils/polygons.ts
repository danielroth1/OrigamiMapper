import type { OrigamiMapperTypes } from '../OrigamiMapperTypes';

// Mirror logic for OUTSIDE polygons only:
// - L and R are swapped between source and target and rotated 180° around the source face bbox center
// - V and H are copied to same faces, rotated 180°
// - U is copied to U without rotation and shifted by vector V[0] -> V[2]
export const mirrorOutsidePolygons = (
  source: OrigamiMapperTypes.Polygon[],
  target: OrigamiMapperTypes.Polygon[]
): OrigamiMapperTypes.Polygon[] => {
  const byFace = (polys: OrigamiMapperTypes.Polygon[]) => {
    const map: Record<string, OrigamiMapperTypes.Polygon[]> = {};
    polys.forEach(p => { const k = p.id[0]; if ('RLUVH'.includes(k)) (map[k] = map[k] || []).push(p); });
    return map;
  };
  const s = byFace(source);
  const t: OrigamiMapperTypes.Polygon[] = target.map(p => ({ ...p, vertices: p.vertices.map((v: [number, number]) => [...v] as [number, number]) }));
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
  type Face = 'R' | 'L' | 'U' | 'V' | 'H';
  const copyFromTo = (srcLetter: Face, tgtLetter: Face, rotate: boolean, shiftUtoV: boolean) => {
    const src = s[srcLetter]; if (!src || src.length === 0) return;
    const b = bbox(src);
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
    let idx = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i].id[0] !== tgtLetter) continue;
      const srcPoly = src[(idx++) % src.length];
      const verts = srcPoly.vertices.map(([x, y]: [number, number]) => {
        let nx = x, ny = y;
        if (rotate) {
          const r = rot180(b.cx, b.cy, x, y);
          nx = r[0]; ny = r[1];
        }
        nx += shiftVec.dx; ny += shiftVec.dy;
        return [nx, ny] as [number, number];
      });
      const baseRot = typeof srcPoly.rotation === 'number' ? srcPoly.rotation : 0;
      const newRot = rotate ? normAngle(baseRot + Math.PI) : baseRot;
      t[i] = { ...t[i], vertices: verts, rotation: newRot };
    }
  };
  // Swap L<->R, rotate those; V/H rotate in place; U copies in place with shift towards V by vector V[0]->V[2]
  copyFromTo('R', 'L', true, false);
  copyFromTo('L', 'R', true, false);
  copyFromTo('V', 'V', true, false);
  copyFromTo('H', 'H', true, false);
  copyFromTo('U', 'U', true, true);
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
  const byFace = (polys: OrigamiMapperTypes.Polygon[]) => {
    const map: Record<string, OrigamiMapperTypes.Polygon[]> = {};
    polys.forEach(p => { const k = p.id[0]; if ('RLUVH'.includes(k)) (map[k] = map[k] || []).push(p); });
    return map;
  };
  const s = byFace(source);
  const t: OrigamiMapperTypes.Polygon[] = target.map(p => ({ ...p, vertices: p.vertices.map((v: [number, number]) => [...v] as [number, number]) }));
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
  type Face = 'R' | 'L' | 'U' | 'V' | 'H';
  const copyFromTo = (srcLetter: Face, tgtLetter: Face, rotate: boolean) => {
    const src = s[srcLetter]; if (!src || src.length === 0) return;
    const b = bbox(src);
    let idx = 0;
    for (let i = 0; i < t.length; i++) {
      if (t[i].id[0] !== tgtLetter) continue;
      const srcPoly = src[(idx++) % src.length];
      const verts = srcPoly.vertices.map(([x, y]: [number, number]) => rotate ? rot180(b.cx, b.cy, x, y) : [x, y] as [number, number]);
      const baseRot = typeof srcPoly.rotation === 'number' ? srcPoly.rotation : 0;
      const newRot = rotate ? normAngle(baseRot + Math.PI) : baseRot;
      t[i] = { ...t[i], vertices: verts, rotation: newRot };
    }
  };
  // Swap L<->R with rotation; rotate U/V/H in place; no translation or special U-shifts
  copyFromTo('R', 'L', false);
  copyFromTo('L', 'R', false);
  copyFromTo('U', 'U', true);
  copyFromTo('V', 'V', true);
  copyFromTo('H', 'H', true);
  return t;
};
