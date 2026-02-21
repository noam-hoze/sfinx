"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const SIZE_MAP = {
  sm: { px: 90,  cameraZ: 4.5, nucleusR: 0.06, ringR: 0.50, electronR: 0.035 },
  md: { px: 280, cameraZ: 4.5, nucleusR: 0.09, ringR: 0.72, electronR: 0.048 },
  lg: { px: 380, cameraZ: 4.5, nucleusR: 0.11, ringR: 0.88, electronR: 0.060 },
} as const;

const D = Math.PI / 180;

const RING_CONFIGS = [
  { rx: 65 * D, ry:   0 * D, color: 0xc084fc, speed: 3.8, startAngle: 0.0 },
  { rx: 65 * D, ry: 135 * D, color: 0x4f46e5, speed: 3.8, startAngle: 2.1 },
  { rx: 65 * D, ry: 225 * D, color: 0x22d3ee, speed: 3.8, startAngle: 4.2 },
] as const;

const TRAIL_LEN = 90;

// Trail: per-vertex alpha fade, normal alpha blend (works on any background)
const TRAIL_VERT = /* glsl */`
  attribute float aAlpha;
  varying float vAlpha;
  varying vec3  vColor;
  void main() {
    vAlpha = aAlpha;
    vColor = color;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TRAIL_FRAG = /* glsl */`
  varying float vAlpha;
  varying vec3  vColor;
  void main() {
    gl_FragColor = vec4(vColor, vAlpha);
  }
`;


interface AtomSceneProps {
  size?: "sm" | "md" | "lg";
  debug?: boolean;
}

export default function AtomScene({ size = "md", debug = false }: AtomSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const debugRef     = useRef<HTMLPreElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const debugEl = debugRef.current;

    const s = SIZE_MAP[size];

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(s.px, s.px);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    // NoToneMapping gives predictable linear colors on transparent canvas —
    // ACES/filmic tone mapping is designed for dark backgrounds and clips
    // saturated emissives to white on a light page.
    renderer.toneMapping = THREE.NoToneMapping;
    container.appendChild(renderer.domElement);

    // ── Scene + camera ────────────────────────────────────────────────────
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 100);
    const f = s.cameraZ / 4.5;
    camera.position.set(-0.036 * f, 3.608 * f, 2.689 * f);
    camera.lookAt(0, 0, 0);

    // ── Orbit controls (debug only) ───────────────────────────────────────
    let controls: OrbitControls | null = null;
    if (debug) {
      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
    }

    // ── Lighting ──────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    const keyLight = new THREE.DirectionalLight(0xfff8f0, 1.2);
    keyLight.position.set(4, 5, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xc8d8ff, 0.4);
    fillLight.position.set(-4, -2, 2);
    scene.add(fillLight);

    // Nucleus glow — on default layer so it illuminates the nucleus mesh
    const nucleusLight = new THREE.PointLight(0x9b59f5, 1.5, 2.2, 2);
    scene.add(nucleusLight);

    // ── Atom group ────────────────────────────────────────────────────────
    const atomGroup = new THREE.Group();
    scene.add(atomGroup);

    // ── Nucleus ───────────────────────────────────────────────────────────
    const nucleus = new THREE.Mesh(
      new THREE.SphereGeometry(s.nucleusR, 48, 48),
      new THREE.MeshLambertMaterial({
        color: 0xb07ef8,
        emissive: 0x6d28d9,
        emissiveIntensity: 0.6,
      })
    );
    nucleus.position.set(0, -0.2, 0);
    atomGroup.add(nucleus);

    // ── Rings + electrons ─────────────────────────────────────────────────
    const electrons: { mesh: THREE.Mesh; angle: number; speed: number; radius: number }[] = [];

    RING_CONFIGS.forEach((cfg) => {
      const group = new THREE.Group();
      group.rotation.set(cfg.rx, cfg.ry, 0);

      const ringMesh = new THREE.Mesh(
        new THREE.TorusGeometry(s.ringR, 0.012, 16, 128),
        new THREE.MeshBasicMaterial({
          color: 0xe2e8f0,
          transparent: true,
          opacity: 0.32,
        })
      );
      group.add(ringMesh);

      const electron = new THREE.Mesh(
        new THREE.SphereGeometry(s.electronR, 24, 24),
        new THREE.MeshStandardMaterial({
          color: cfg.color,
          emissive: cfg.color,
          emissiveIntensity: 0.7,
          roughness: 0.4,
          metalness: 0.1,
        })
      );
      const eLight = new THREE.PointLight(cfg.color, 1.2, 1.0, 2);
      electron.add(eLight);
      group.add(electron);
      atomGroup.add(group);
      electrons.push({ mesh: electron, angle: cfg.startAngle, speed: cfg.speed, radius: s.ringR });
    });

    // ── Camera spin constants ──────────────────────────────────────────────
    // Every CAM_SPIN_INTERVAL s, the camera does a quick 360° spin around a
    // randomly chosen axis and lands back on the exact starting position.
    const CAM_SPIN_INTERVAL = 0;
    const CAM_SPIN_DUR      = 2.0;

    // Diverse set of axes — each gives a visually distinct tumble/pan/roll
    const SPIN_AXES = [
      new THREE.Vector3( 0,  1,  0),                    // horizontal pan
      new THREE.Vector3( 1,  0,  0),                    // vertical tilt
      new THREE.Vector3( 0,  0,  1),                    // roll
      new THREE.Vector3( 1,  1,  0).normalize(),        // diagonal pan-tilt
      new THREE.Vector3(-1,  1,  0).normalize(),        // opposite diagonal
      new THREE.Vector3( 0,  1,  1).normalize(),        // diagonal pan-roll
      new THREE.Vector3( 1,  0,  1).normalize(),        // diagonal tilt-roll
      new THREE.Vector3( 1,  1,  1).normalize(),        // full 3-axis diagonal
    ];

    const camStartPos = camera.position.clone();
    const camStartUp  = new THREE.Vector3(0, 1, 0);
    const _spinQ      = new THREE.Quaternion();
    let spinProgress  = 1.0;   // start "done"
    let lastSpinAt    = -1.0;  // -1 → first spin fires after 1 s initial delay
    let spinAxisIdx   = -1;


    // ── Trails ────────────────────────────────────────────────────────────
    const _wp = new THREE.Vector3();

    const trails = electrons.map((_, i) => {
      const col = new THREE.Color(RING_CONFIGS[i].color);
      const posArr   = new Float32Array(TRAIL_LEN * 3);
      const rPos     = new Float32Array(TRAIL_LEN * 3);
      const rColor   = new Float32Array(TRAIL_LEN * 3);
      const rAlpha   = new Float32Array(TRAIL_LEN);

      const posAttr   = new THREE.BufferAttribute(rPos,   3);
      const colorAttr = new THREE.BufferAttribute(rColor, 3);
      const alphaAttr = new THREE.BufferAttribute(rAlpha, 1);
      posAttr.setUsage(THREE.DynamicDrawUsage);
      alphaAttr.setUsage(THREE.DynamicDrawUsage);

      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", posAttr);
      geo.setAttribute("color",    colorAttr);
      geo.setAttribute("aAlpha",   alphaAttr);
      geo.setDrawRange(0, 0);

      const mat = new THREE.ShaderMaterial({
        vertexShader:   TRAIL_VERT,
        fragmentShader: TRAIL_FRAG,
        transparent:    true,
        depthWrite:     false,
        depthTest:      false,
        vertexColors:   true,
      });

      // Stack 3 lines on same geometry — alpha accumulates for a bolder look
      for (let k = 0; k < 3; k++) {
        const line = new THREE.Line(geo, mat);
        line.renderOrder = 2;
        scene.add(line);
      }

      for (let j = 0; j < TRAIL_LEN; j++) {
        rColor[j * 3]     = col.r;
        rColor[j * 3 + 1] = col.g;
        rColor[j * 3 + 2] = col.b;
      }
      colorAttr.needsUpdate = true;

      return { posArr, rPos, rAlpha, posAttr, alphaAttr, geo, head: 0, count: 0 };
    });

    // ── Animation loop ────────────────────────────────────────────────────
    let frameId: number;
    let lastTime = performance.now();
    let elapsed  = 0;

    function animate(now: number) {
      frameId = requestAnimationFrame(animate);
      const delta = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      elapsed += delta;

      controls?.update();

      nucleus.scale.setScalar(1 + Math.sin(now * 0.0012) * 0.06);

      // Camera spin: every CAM_SPIN_INTERVAL s, pick a random axis (no repeat)
      // and do a quick ease-in-out 360° — lands exactly back at start.
      if (!controls) {
        // First spin waits 1 s (lastSpinAt starts at -1); after that, no gap.
        const waitFor = spinAxisIdx === -1 ? 1.0 : CAM_SPIN_INTERVAL;
        if (spinProgress >= 1.0 && elapsed - lastSpinAt >= waitFor) {
          lastSpinAt   = elapsed;
          spinProgress = 0.0;
          let next: number;
          do { next = Math.floor(Math.random() * SPIN_AXES.length); }
          while (next === spinAxisIdx);
          spinAxisIdx = next;
        }
        if (spinProgress < 1.0) {
          spinProgress = Math.min(spinProgress + delta / CAM_SPIN_DUR, 1.0);
          const eased = -(Math.cos(Math.PI * spinProgress) - 1) / 2;
          _spinQ.setFromAxisAngle(SPIN_AXES[spinAxisIdx], eased * Math.PI * 2);
          camera.position.copy(camStartPos).applyQuaternion(_spinQ);
          camera.up.copy(camStartUp).applyQuaternion(_spinQ);
          camera.lookAt(0, 0, 0);
        }
      }

      electrons.forEach((e, i) => {
        e.angle += e.speed * delta;
        e.mesh.position.set(
          Math.cos(e.angle) * e.radius,
          Math.sin(e.angle) * e.radius,
          0
        );

        e.mesh.updateWorldMatrix(true, false);
        e.mesh.getWorldPosition(_wp);

        const tr = trails[i];

        tr.posArr[tr.head * 3]     = _wp.x;
        tr.posArr[tr.head * 3 + 1] = _wp.y;
        tr.posArr[tr.head * 3 + 2] = _wp.z;
        tr.head = (tr.head + 1) % TRAIL_LEN;
        if (tr.count < TRAIL_LEN) tr.count++;

        for (let j = 0; j < tr.count; j++) {
          const src = ((tr.head - 1 - j) + TRAIL_LEN) % TRAIL_LEN;
          tr.rPos[j * 3]     = tr.posArr[src * 3];
          tr.rPos[j * 3 + 1] = tr.posArr[src * 3 + 1];
          tr.rPos[j * 3 + 2] = tr.posArr[src * 3 + 2];
          tr.rAlpha[j] = Math.pow(1 - j / TRAIL_LEN, 0.6);
        }

        tr.posAttr.needsUpdate   = true;
        tr.alphaAttr.needsUpdate = true;
        tr.geo.setDrawRange(0, tr.count);
      });

      if (debug && debugEl) {
        const p = camera.position;
        debugEl.textContent =
          `camera.position\n  x: ${p.x.toFixed(3)}\n  y: ${p.y.toFixed(3)}\n  z: ${p.z.toFixed(3)}`;
      }

      renderer.setClearColor(0x000000, 0);
      renderer.clear();
      renderer.render(scene, camera);
    }

    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      controls?.dispose();
      trails.forEach(tr => { tr.geo.dispose(); });
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [size, debug]);

  const px = SIZE_MAP[size].px;
  return (
    <div style={{ position: "relative", width: px, height: px, margin: "0 auto" }}>
      <div ref={containerRef} style={{ width: px, height: px }} />
      {debug && (
        <pre
          ref={debugRef}
          style={{
            position: "absolute", top: 8, left: 8,
            background: "rgba(0,0,0,0.65)", color: "#0f0",
            fontSize: 11, padding: "6px 10px", borderRadius: 6,
            pointerEvents: "none", margin: 0, lineHeight: 1.6,
          }}
        />
      )}
    </div>
  );
}
