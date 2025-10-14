import { Canvas } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Stats, OrbitControls, Edges } from '@react-three/drei';
import * as THREE from 'three';

// (Legacy OpenBox removed; replaced by TexturedOpenBox below.)

export type FaceKey = 'R' | 'L' | 'U' | 'V' | 'H'; // Right, Left, Bottom (U), Front (V), Back (H)
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
const OUTSIDE_SLOT_ORDER: FaceKey[] = ['R', 'L', 'U', 'V', 'H']; // outside: place H on front, V on back
const INSIDE_SLOT_ORDER: FaceKey[] = ['R', 'L', 'U', 'V', 'H'];  // inside: original ordering (V front, H back)

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

function TexturedOpenBox({ outsideFaces, insideFaces, width = 1, height = 1 }: { outsideFaces?: FaceTextures; insideFaces?: FaceTextures; width?: number; height?: number }) {
  const geometry = useMemo(() => {
    const depth = 0.82828282828 * width;
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
      for (let i = 0; i < oldArray.length; i++) if (i < remStart || i >= remEnd) newIndices.push(oldArray[i]);
      g.setIndex(newIndices);
      g.clearGroups();
      let runningStart = 0;
      for (const grp of groups) {
        const mi = grp.materialIndex ?? 0;
        g.addGroup(runningStart, grp.count, mi < removedGroupIndex ? mi : mi - 1);
        runningStart += grp.count;
      }
    }
    return g;
  }, [width, height]);

  const outsideMats = useMemo(() => buildMaterials(outsideFaces, THREE.FrontSide, 0xcccccc, OUTSIDE_SLOT_ORDER), [outsideFaces]);
  const insideBaseColor = (insideFaces && Object.keys(insideFaces).length > 0) ? 0x222222 : 0xffffff;
  const insideMats = useMemo(() => buildMaterials(insideFaces, THREE.BackSide, insideBaseColor, INSIDE_SLOT_ORDER), [insideFaces]);

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
  const basePos = new THREE.Vector3(1.85, 1.85, 1.95);
  const camPos = basePos.clone().divideScalar(clampZoom);

  // Determine which textures to use for bottom when only single-box props are provided
  const bottomOut = bottomOutsideFaces ?? outsideFaces;
  const bottomIn = bottomInsideFaces ?? insideFaces;
  const topOut = topOutsideFaces;
  const topIn = topInsideFaces;

  // Compute vertical separation based on openPercent and scaled box heights
  const clampedOpen = Math.max(0, Math.min(100, openPercent || 0));
  const maxScaledH = Math.max(height * Math.max(0.01, bottomScale), height * Math.max(0.01, topScale));
  const totalSep = (clampedOpen / 100) * (2.5 * maxScaledH);
  // Linear Y separation (always computed linearly so early phase [0,45] is unchanged)
  const bottomYLinear = -totalSep / 2;
  const topYLinear = totalSep / 2;

  // Curved phase configuration
  // Curve begins at 45 and ends at 100. Movement follows a parabola in the YZ plane (plane normal/rotation axis = (1,0,0)).
  // Boxes also rotate around X axis (clockwise for top, counter-clockwise for bottom) from 0° at 45 to 60° at 100.
  const CURVE_START = 45;
  const curveT = clampedOpen <= CURVE_START ? 0 : (clampedOpen - CURVE_START) / (100 - CURVE_START);
  const thetaMax = THREE.MathUtils.degToRad(90);
  const theta = curveT * thetaMax; // additional rotation around X
  // Parabolic offset along Z: z = k * t^2, symmetric for top/bottom to move away from each other
  const curveStrength = 1.0 * maxScaledH; // tweakable intensity of the curve
  const zOffset = curveStrength * curveT * curveT;

  // Final positions (stay in the YZ plane; X remains 0). For 0..45, curveT=0 so z=0 and no extra rotation.
  const bottomPos: [number, number, number] = [0, bottomYLinear, -zOffset];
  const topPos: [number, number, number] = [0, topYLinear, -zOffset];

  // Final rotations
  const bottomRot: [number, number, number] = [theta, 0, 0]; // CCW around +X
  const baseTopRotX = Math.PI; // keep top inverted as before
  const topRot: [number, number, number] = [baseTopRotX - theta, Math.PI, 0]; // CW around +X

  // Keep refs to WebGL renderer & scene so we can toggle transparency for screenshot capture
  const glRef = useRef<any>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
  const rtRef = useRef<THREE.WebGLRenderTarget | null>(null);

  // Expose a dev-only global to toggle transparent background when generating previews
  if ((import.meta as any).env?.DEV) {
    (window as any).__toggleCubePreviewTransparency = (enable: boolean) => {
      if (!glRef.current || !sceneRef.current) return;
      try {
        if (enable) {
          // Remove background so clear uses transparent pixels
            (sceneRef.current as any).background = null;
            glRef.current.setClearColor(0x000000, 0); // fully transparent
        } else {
            glRef.current.setClearColor(0x0f0f10, 1);
            // Optionally keep no explicit scene background to allow CSS backdrop; leave null
        }
      } catch {}
    };

    // Strategy B: offscreen render target capture with guaranteed transparency
    (window as any).__captureCubeViewerFrame = async (opts?: {
      width?: number; // logical pixels desired (not DPR adjusted). Defaults to onscreen canvas width
      height?: number; // logical pixels desired. Defaults to onscreen canvas height
      transparent?: boolean; // default true
      format?: 'png' | 'webp';
      quality?: number; // for webp 0..1
      dpr?: number; // override device pixel ratio for higher-res capture
    }): Promise<string | null> => {
      const renderer: THREE.WebGLRenderer | null = glRef.current;
      const scene = sceneRef.current;
      const cam = cameraRef.current;
      if (!renderer || !scene || !cam) return null;
      const {
        width,
        height,
        transparent = true,
        format = 'png',
        quality = 0.9,
        dpr
      } = opts || {};
      // Determine capture size
      const targetSize = new THREE.Vector2();
      renderer.getSize(targetSize);
      const baseW = Math.max(2, Math.floor(width || targetSize.x));
      const baseH = Math.max(2, Math.floor(height || targetSize.y));
      const pixelRatio = dpr || renderer.getPixelRatio();
      const rtW = Math.floor(baseW * pixelRatio);
      const rtH = Math.floor(baseH * pixelRatio);

      // (Re)create render target if size changed
      if (!rtRef.current || rtRef.current.width !== rtW || rtRef.current.height !== rtH) {
        if (rtRef.current) rtRef.current.dispose();
        rtRef.current = new THREE.WebGLRenderTarget(rtW, rtH, {
          depthBuffer: true,
          stencilBuffer: false,
          format: THREE.RGBAFormat,
          type: THREE.UnsignedByteType,
        });
      }
      const rt = rtRef.current;

      // Save renderer state
      const prevTarget = renderer.getRenderTarget();
      const prevAutoClear = renderer.autoClear;
      const prevClearColor = new THREE.Color();
      const prevClearAlpha = renderer.getClearAlpha();
      (renderer as any).getClearColor(prevClearColor);
      const prevSceneBg = scene.background;

      try {
        if (transparent) {
          scene.background = null;
          renderer.setClearColor(0x000000, 0);
        }
        // Else keep existing scene.background / clear color
        renderer.autoClear = true;
        renderer.setRenderTarget(rt);
        renderer.clear(true, true, true);
        renderer.render(scene, cam);

        // Read pixels
        const buffer = new Uint8Array(rtW * rtH * 4);
        renderer.readRenderTargetPixels(rt, 0, 0, rtW, rtH, buffer);
        // Put into offscreen 2D canvas (unflip + scale down if DPR>1)
        const canvas = document.createElement('canvas');
        canvas.width = baseW; canvas.height = baseH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;
        // Create ImageData at full RT size, then draw scaled if DPR>1
        const fullCanvas = pixelRatio === 1 ? canvas : document.createElement('canvas');
        if (pixelRatio !== 1) { fullCanvas.width = rtW; fullCanvas.height = rtH; }
        const fctx = fullCanvas.getContext('2d');
        if (!fctx) return null;
        const imgData = fctx.createImageData(rtW, rtH);
        // Flip Y while copying (WebGL origin is bottom-left) -> iterate rows
        for (let y = 0; y < rtH; y++) {
          const srcRow = rtH - 1 - y;
            const srcStart = srcRow * rtW * 4;
            const dstStart = y * rtW * 4;
            imgData.data.set(buffer.subarray(srcStart, srcStart + rtW * 4), dstStart);
        }
        fctx.putImageData(imgData, 0, 0);
        if (pixelRatio !== 1) {
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(fullCanvas, 0, 0, rtW, rtH, 0, 0, baseW, baseH);
        }
        const mime = format === 'webp' ? 'image/webp' : 'image/png';
        const dataUrl = canvas.toDataURL(mime, format === 'webp' ? Math.min(1, Math.max(0, quality)) : undefined);
        return dataUrl;
      } catch (e) {
        console.warn('[CubeViewer] capture failed', e);
        return null;
      } finally {
        // Restore renderer state
        renderer.setRenderTarget(prevTarget);
        renderer.autoClear = prevAutoClear;
        renderer.setClearColor(prevClearColor, prevClearAlpha);
        scene.background = prevSceneBg;
      }
    };
  }

  return (
    <Canvas
      camera={{ position: [camPos.x, camPos.y, camPos.z] }}
      // alpha true so we can capture transparency; preserveDrawingBuffer for toDataURL stability
      gl={{ antialias: true, preserveDrawingBuffer: true, alpha: true }}
      onCreated={(state) => {
        try {
          const dom = state.gl.domElement as HTMLCanvasElement;
          dom.id = 'cube-viewer-canvas';
          glRef.current = state.gl;
          sceneRef.current = state.scene;
          cameraRef.current = state.camera as any;
          state.gl.setClearColor(0x0f0f10, 1); // default opaque background for normal UI
        } catch { /* ignore */ }
      }}
    >
      {/* neutral, not-overpowering lights so textures read correctly */}
      <primitive object={useMemo(() => new THREE.AmbientLight(0xffffff, 1.5), [])} />
      <primitive object={useMemo(() => { const light = new THREE.DirectionalLight(0xffffff, 1.5); light.position.set(3, 4, 5); return light; }, [])} />
      {/* Bottom box (or single box when top not provided) */}
      {bottomOut || bottomIn ? (
        <group position={bottomPos} rotation={bottomRot} scale={[bottomScale, bottomScale, bottomScale]}>
          <TexturedOpenBox outsideFaces={bottomOut} insideFaces={bottomIn} width={width} height={height} />
        </group>
      ) : null}
      {/* Top box (render only if provided) */}
      {topOut || topIn ? (
        <group position={topPos} scale={[topScale, topScale, topScale]} rotation={topRot}>
          <TexturedOpenBox outsideFaces={topOut} insideFaces={topIn} width={width} height={height} />
        </group>
      ) : null}
      <OrbitControls enablePan={false} />
      {import.meta.env.DEV && <Stats />}
    </Canvas>
  );
}

