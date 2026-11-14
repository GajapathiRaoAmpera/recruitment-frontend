import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

/**
 * A small brand-coloured robot walking on a moving floor. Loaded on demand by <RobotLoader> so three.js
 * stays out of the main bundle. Throws when WebGL is unavailable; the caller then shows its static fallback.
 * Returns a cleanup that stops the loop and frees every GPU resource.
 */
export function mountRobot(host: HTMLElement, { animate }: { animate: boolean }): () => void {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: string) => new THREE.Color(css.getPropertyValue(name).trim() || fallback);
  const C = {
    navy: token("--ampera-navy-900", "#000f5c"),
    magenta: token("--ampera-magenta-600", "#9c369a"),
    lavender: token("--ampera-lavender-500", "#8070b4"),
    cream: token("--ampera-cream", "#fffefa"),
  };

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(2.9, 1.9, 4.6);
  camera.lookAt(0, 1.0, 0);

  scene.add(new THREE.HemisphereLight(C.cream, C.lavender, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(C.magenta, 1.4);
  rim.position.set(-4, 3, -3);
  scene.add(rim);

  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => (disposables.push(x), x);
  const mat = (color: THREE.Color, extra: THREE.MeshStandardMaterialParameters = {}) =>
    keep(new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15, ...extra }));
  const shell = mat(C.cream.clone().lerp(C.lavender, 0.12));
  const joint = mat(C.lavender);
  const dark = mat(C.navy, { roughness: 0.25 });
  const glow = mat(C.magenta, { emissive: C.magenta, emissiveIntensity: 1.4 });
  const eyeMat = mat(C.cream, { emissive: C.cream, emissiveIntensity: 1.2 });

  const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(keep(g), m);
    o.position.set(x, y, z);
    return o;
  };

  const robot = new THREE.Group();
  scene.add(robot);
  const body = new THREE.Group(); // everything above the hips; bobs with each step
  robot.add(body);

  body.add(mesh(new RoundedBoxGeometry(0.9, 0.8, 0.6, 4, 0.16), shell, 0, 1.2, 0));
  body.add(mesh(new THREE.CircleGeometry(0.11, 24), glow, 0, 1.25, 0.301)); // chest light

  const head = new THREE.Group();
  head.position.set(0, 1.9, 0);
  body.add(head);
  head.add(mesh(new RoundedBoxGeometry(0.78, 0.56, 0.6, 4, 0.18), shell));
  head.add(mesh(new RoundedBoxGeometry(0.62, 0.3, 0.05, 2, 0.06), dark, 0, 0, 0.29)); // visor
  const eyes = [-0.14, 0.14].map((x) => mesh(new THREE.CapsuleGeometry(0.035, 0.06, 4, 8), eyeMat, x, 0.01, 0.325));
  eyes.forEach((e) => head.add(e));
  head.add(mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 8), joint, 0, 0.38, 0));
  const bulb = mesh(new THREE.SphereGeometry(0.06, 16, 16), glow, 0, 0.52, 0);
  head.add(bulb);
  head.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 16), joint, 0, -0.3, 0)); // neck

  /** A limb hangs from a pivot so rotating the pivot swings it from the shoulder/hip. */
  const limb = (x: number, y: number, len: number, parent: THREE.Object3D, foot: boolean) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    pivot.add(mesh(new THREE.SphereGeometry(0.09, 16, 16), joint));
    pivot.add(mesh(new THREE.CapsuleGeometry(0.085, len, 4, 12), shell, 0, -len / 2 - 0.06, 0));
    pivot.add(
      foot
        ? mesh(new RoundedBoxGeometry(0.22, 0.1, 0.32, 2, 0.04), dark, 0, -len - 0.17, 0.05)
        : mesh(new THREE.SphereGeometry(0.08, 16, 16), joint, 0, -len - 0.16, 0),
    );
    parent.add(pivot);
    return pivot;
  };
  const arms = [limb(-0.56, 1.48, 0.42, body, false), limb(0.56, 1.48, 0.42, body, false)];
  const legs = [limb(-0.22, 0.78, 0.4, robot, true), limb(0.22, 0.78, 0.4, robot, true)];

  // Floor: a soft shadow plus dashes that slide back, so the robot reads as walking forward in place.
  const shadow = mesh(
    new THREE.CircleGeometry(0.75, 32),
    keep(new THREE.MeshBasicMaterial({ color: C.navy, transparent: true, opacity: 0.12, depthWrite: false })),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.002;
  scene.add(shadow);
  const dashGeo = keep(new THREE.PlaneGeometry(0.06, 0.34));
  const DASHES = 7;
  const SPAN = 4.2;
  const dashes = [-0.7, 0.7].flatMap((x) =>
    Array.from({ length: DASHES }, (_, i) => {
      const d = new THREE.Mesh(dashGeo, keep(new THREE.MeshBasicMaterial({ color: C.lavender, transparent: true, depthWrite: false })));
      d.rotation.x = -Math.PI / 2;
      d.position.set(x, 0.001, -SPAN / 2 + (i * SPAN) / DASHES);
      scene.add(d);
      return d;
    }),
  );
  // The robot faces +z; the dashes slide toward -z beneath it.

  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const t0 = performance.now();
  let raf = 0;
  let last = 0;
  const pose = (t: number) => {
    const dt = Math.min(0.05, t - last);
    last = t;
    const step = t * 6.2; // ~1 stride per second
    const swing = Math.sin(step);
    legs[0]!.rotation.x = swing * 0.55;
    legs[1]!.rotation.x = -swing * 0.55;
    arms[0]!.rotation.x = -swing * 0.6;
    arms[1]!.rotation.x = swing * 0.6;
    arms[0]!.rotation.z = -0.08;
    arms[1]!.rotation.z = 0.08;
    body.position.y = Math.abs(Math.cos(step)) * 0.05;
    body.rotation.z = swing * 0.03;
    head.rotation.y = Math.sin(t * 0.9) * 0.18;
    head.rotation.x = Math.sin(step * 2) * 0.02;
    const blink = t % 3.6 < 0.12 ? 0.15 : 1;
    eyes.forEach((e) => (e.scale.y = blink));
    glow.emissiveIntensity = 1.1 + Math.sin(t * 3) * 0.4;
    bulb.scale.setScalar(1 + Math.sin(t * 3) * 0.12);
    shadow.scale.setScalar(1 - body.position.y * 1.5);
    for (const d of dashes) {
      // Same speed as the feet (~1 m/s) so the floor doesn't look like it slips.
      d.position.z = ((((d.position.z + SPAN / 2 - dt * 1.0) % SPAN) + SPAN) % SPAN) - SPAN / 2;
      (d.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - Math.abs(d.position.z) / (SPAN / 2));
    }
  };
  const frame = () => {
    pose((performance.now() - t0) / 1000);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  };
  if (animate) frame();
  else {
    pose(0.35); // reduced motion: one mid-stride frame, no loop
    renderer.render(scene, camera);
  }

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    disposables.forEach((d) => d.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  };
}
