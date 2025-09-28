import { Canvas } from '@react-three/fiber';
import { Stats, OrbitControls, Edges } from '@react-three/drei';
import * as THREE from 'three';
import { useMemo } from 'react';

// (Legacy OpenBox removed; replaced by TexturedOpenBox below.)

export type FaceKey = 'R'|'L'|'U'|'V'|'H'; // Right, Left, Bottom (U), Front (V), Back (H)
export type FaceTextures = Partial<Record<FaceKey, string>>;

interface CubeViewerProps {
  // Back-compat single-box props (treated as bottom box when dual not provided)
  outsideFaces?: FaceTextures;
  insideFaces?: FaceTextures;
  // Dual-box props
  bottomOutsideFaces?: FaceTextures;
  bottomInsideFaces?: FaceTextures;
  topOutsideFaces?: FaceTextures;
  topInsideFaces?: FaceTextures;
  // Geometry base size (unitless)
  width?: number;
  height?: number;
  // Per-box scale for 3D preview only
  bottomScale?: number;
  topScale?: number;
  // Open percentage (0..100). 0 = overlapping, 100 = 1.5 * max(box heights) apart.
  openPercent?: number;
  initialZoom?: number; // 1 = default; >1 = zoomed in (closer)
}

// Map our logical face letters to material slot order after removing top face.
// There are different mappings for outside vs inside so Hi/Vi can be placed independently.
// Slots (groups) after removing top: 0:+X (R), 1:-X (L), 2:-Y (U bottom), 3:+Z (front), 4:-Z (back)
const OUTSIDE_SLOT_ORDER: FaceKey[] = ['R','L','U','V','H']; // outside: place H on front, V on back
const INSIDE_SLOT_ORDER: FaceKey[] = ['R','L','U','V','H'];  // inside: original ordering (V front, H back)

function buildMaterials(faces: FaceTextures | undefined, side: THREE.Side, baseColor: number, slotOrder: FaceKey[] = OUTSIDE_SLOT_ORDER): THREE.Material[] {
  return slotOrder.map(key => {
    const dataUrl = faces?.[key];
    if (dataUrl) {
      const tex = new THREE.Texture();
      const img = new Image();
      img.onload = () => {
        tex.image = img;
        // If this material is used for the inside (BackSide), flip horizontally so the
        // texture appears correctly when viewed from inside the box. We flip by
        // setting repeat.x = -1 and using RepeatWrapping with center at 0.5.
        if (side === THREE.BackSide) {
          tex.wrapS = THREE.RepeatWrapping;
          tex.center.set(0.5, 0.5);
          tex.repeat.x = -1;
        }
        tex.needsUpdate = true;
      };
      img.src = dataUrl;
      tex.colorSpace = THREE.SRGBColorSpace;
      return new THREE.MeshStandardMaterial({ map: tex, side, roughness: 0.6, metalness: 0.05 });
    }
    return new THREE.MeshStandardMaterial({ color: baseColor, side, roughness: 0.8, metalness: 0.02 });
  });
}

function TexturedOpenBox({ outsideFaces, insideFaces, width=1, height=1 }: { outsideFaces?: FaceTextures; insideFaces?: FaceTextures; width?: number; height?: number }) {
  const geometry = useMemo(() => {
    const depth = 0.82828282828*width;
    const g = new THREE.BoxGeometry(width, height, depth);
    // remove top face (index 2) similar to OpenBox above
    const removedGroupIndex = 2;
    const index = g.getIndex();
    if (index) {
      const oldArray = index.array as ArrayLike<number>;
      const groups = g.groups.filter((_, i) => i !== removedGroupIndex);
      const remStart = g.groups[removedGroupIndex].start;
      const remEnd = remStart + g.groups[removedGroupIndex].count;
      const newIndices: number[] = [];
      for (let i=0;i<oldArray.length;i++) if (i < remStart || i >= remEnd) newIndices.push(oldArray[i]);
      g.setIndex(newIndices);
      g.clearGroups();
      let runningStart=0;
      for (const grp of groups) {
        const mi = grp.materialIndex ?? 0;
        g.addGroup(runningStart, grp.count, mi < removedGroupIndex ? mi : mi - 1);
        runningStart += grp.count;
      }
    }
    return g;
  }, [width, height]);

  const outsideMats = useMemo(()=>buildMaterials(outsideFaces, THREE.FrontSide, 0xcccccc, OUTSIDE_SLOT_ORDER), [outsideFaces]);
  const insideBaseColor = (insideFaces && Object.keys(insideFaces).length > 0) ? 0x222222 : 0xffffff;
  const insideMats = useMemo(()=>buildMaterials(insideFaces, THREE.BackSide, insideBaseColor, INSIDE_SLOT_ORDER), [insideFaces]);

  return (
    <>
      <mesh geometry={geometry} material={outsideMats} />
      <mesh geometry={geometry} material={insideMats} />
      <Edges geometry={geometry} threshold={15} />
    </>
  );
}

export default function CubeViewer({
  outsideFaces,
  insideFaces,
  bottomOutsideFaces,
  bottomInsideFaces,
  topOutsideFaces,
  topInsideFaces,
  width = 1,
  height = 1,
  bottomScale = 1,
  topScale = 1,
  openPercent = 0,
  initialZoom = 1
}: CubeViewerProps) {
  // base camera position (isometric-ish). We move camera closer by multiplying by 1/initialZoom.
  // initialZoom: 1 = default, 2 = twice as close, 0.5 = farther away
  const clampZoom = Math.max(0.2, initialZoom);
  const basePos = new THREE.Vector3(0.85, 0.85, 0.95);
  const camPos = basePos.clone().divideScalar(clampZoom);

  // Determine which textures to use for bottom when only single-box props are provided
  const bottomOut = bottomOutsideFaces ?? outsideFaces;
  const bottomIn = bottomInsideFaces ?? insideFaces;
  const topOut = topOutsideFaces;
  const topIn = topInsideFaces;

  // Compute vertical separation based on openPercent and scaled box heights
  const clampedOpen = Math.max(0, Math.min(100, openPercent || 0));
  const maxScaledH = Math.max(height * Math.max(0.01, bottomScale), height * Math.max(0.01, topScale));
  const totalSep = (clampedOpen / 100) * (1.5 * maxScaledH);
  const bottomY = -totalSep / 2;
  const topY = totalSep / 2;

  return (
    <Canvas
      camera={{ position: [camPos.x, camPos.y, camPos.z] }}
      // enable antialias via GL props; configure encoding/toneMapping in onCreated with casts
      gl={{ antialias: true }}
    >
  {/* neutral, not-overpowering lights so textures read correctly */}
  <primitive object={useMemo(() => new THREE.AmbientLight(0xffffff, 1.5), [])} />
  <primitive object={useMemo(() => { const light = new THREE.DirectionalLight(0xffffff, 1.5); light.position.set(3, 4, 5); return light; }, [])} />
      {/* Bottom box (or single box when top not provided) */}
      {bottomOut || bottomIn ? (
        <group position={[0, bottomY, 0]} scale={[bottomScale, bottomScale, bottomScale]}>
          <TexturedOpenBox outsideFaces={bottomOut} insideFaces={bottomIn} width={width} height={height} />
        </group>
      ) : null}
      {/* Top box (render only if provided) */}
      {topOut || topIn ? (
        <group position={[0, topY, 0]} scale={[topScale, topScale, topScale]} rotation={[Math.PI, Math.PI, 0]}>
          <TexturedOpenBox outsideFaces={topOut} insideFaces={topIn} width={width} height={height} />
        </group>
      ) : null}
  <OrbitControls enablePan={false} />
  {import.meta.env.DEV && <Stats />}
    </Canvas>
  );
}

