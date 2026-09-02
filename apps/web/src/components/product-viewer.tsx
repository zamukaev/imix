'use client';

import { Canvas } from '@react-three/fiber';
import { Bounds, Environment, Lightformer, OrbitControls, useGLTF } from '@react-three/drei';

/**
 * The 3D product viewer — ARCHITECTURE.md §6.
 *
 * Never imported directly by a page: `ProductMedia` pulls it in with
 * `next/dynamic` so three, R3F and drei land in their own chunk and cost
 * nothing to a visitor who never opens the 3D tab.
 *
 * The performance budget is spent deliberately:
 *
 * - **The canvas exists only on demand**, which is where the real saving is: it
 *   is mounted when the visitor opens the 3D tab and unmounted when they leave
 *   it, so the WebGL context and the render loop are scoped to deliberate use.
 * - **`frameloop="always"`**, which looks like the expensive choice and is the
 *   honest one. Under `"demand"` the picture has to be re-requested by hand
 *   after every asynchronous step — the suspended loader resolving, `Bounds`
 *   moving the camera in an effect, the environment rendering its cube target —
 *   and missing any one of them leaves an empty well that reads as a broken
 *   feature. Paired with the mount/unmount above, a continuous loop costs
 *   nothing to the visitors who never open this.
 * - **No auto-rotate.** §5.4 is explicit that nothing spins for its own sake,
 *   and a spinning product is the clearest case of it. This also means there is
 *   no ambient motion for `prefers-reduced-motion` to suppress: the model moves
 *   only while the visitor is dragging it.
 * - **`dpr` clamped to 2**, so a 3× phone screen does not render nine times the
 *   pixels for a slab on a neutral ground.
 */

/** One drag-rotation of the model, framed automatically whatever its real size. */
function Model({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  // `Bounds fit clip` frames whatever it is given, so a 0.15 m phone and a 0.31 m
  // laptop both arrive at a sensible size without a per-product camera.
  // `observe` re-fits when the well changes size, which is what keeps the model
  // framed across a viewport change rather than only on first paint.
  return (
    // The margin is set by the widest model rather than the tallest: a laptop
    // turned three-quarters on is wider than it is high, and a tighter fit
    // clipped its lid against the edge of the well.
    <Bounds fit clip observe margin={1.7}>
      <primitive object={scene} />
    </Bounds>
  );
}

/** Rotation, and deliberately nothing else. */
function Controls() {
  return (
    <OrbitControls
      // A product turns; it does not get walked around. Zoom and pan are the two
      // ways this control usually ends up somewhere the visitor cannot recover
      // from, so neither is offered.
      enableZoom={false}
      enablePan={false}
      // Stop just short of both poles: straight up or down the axis is where an
      // orbit camera flips and the model appears to jump.
      minPolarAngle={0.2}
      maxPolarAngle={Math.PI - 0.2}
    />
  );
}

export default function ProductViewer({ url, label }: { url: string; label: string }) {
  return (
    <Canvas
      // WebGL is not reachable by keyboard or screen reader, so the canvas
      // describes itself as one image and the photo tab remains the path that
      // actually conveys the product.
      role="img"
      aria-label={label}
      frameloop="always"
      dpr={[1, 2]}
      camera={{ position: [0.4, 0.3, 0.6], fov: 30 }}
    >
      <ambientLight intensity={0.7} />
      <directionalLight position={[2, 3, 2]} intensity={2} />
      <directionalLight position={[-2, 1, -2]} intensity={0.6} />

      {/*
        A metal body renders almost black without something to reflect. This
        environment is built from lightformers in the scene rather than a
        `preset`, because the presets fetch an HDRI from a CDN — an artifact of
        the library, and a network dependency the storefront should not have.
      */}
      <Environment resolution={128}>
        <Lightformer intensity={2} position={[0, 3, 1]} scale={[6, 2, 1]} />
        <Lightformer intensity={0.8} position={[-3, 0, 1]} scale={[2, 4, 1]} />
      </Environment>

      <Model url={url} />
      <Controls />
    </Canvas>
  );
}
