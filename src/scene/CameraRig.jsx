import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Hybrid camera system: journeys + free roam.
 *
 * The camera rests at an "anchor" (street or café) with a gentle idle drift.
 * Focusing a hotspot starts a "journey": a smooth walk from wherever the
 * camera currently is to a viewpoint for that mesh — an authored view_* empty
 * from the glb, or a computed fallback. Entering/leaving the café are two-leg
 * journeys through the door.
 *
 * On top of that, a free-roam layer: WASD/arrows walk on the ground plane and
 * drag-to-look yaws/pitches (no pointer lock). Roaming starts on the first
 * movement key or look-drag while in the city with no journey active, and
 * ends whenever a journey starts — journeys always win.
 *
 * Blender (Z-up) -> three.js (Y-up): (x, y, z)_blender -> (x, z, -y)_three
 */
const STREET = {
  pos: new THREE.Vector3(6, 1.6, 10),
  target: new THREE.Vector3(-2, 4, -4), // slight up-tilt toward billboard
};
const CAFE_DOOR = new THREE.Vector3(-3, 1.6, 2); // just outside the door
const CAFE = {
  pos: new THREE.Vector3(-3, 1.6, -1), // just inside (cam_cafe)
  target: new THREE.Vector3(-3, 1.4, -5), // looking into the room
};

// Walkable rectangle for free roam. TODO: tune against the scene geometry.
export const WALK_BOUNDS = { minX: -20, maxX: 20, minZ: -20, maxZ: 20 };

const WALK_DURATION = 1.5; // seconds
const ENTER_DURATION = 2.4;
const LEAVE_DURATION = 1.9;
const EYE = 1.6;

const ROAM_SPEED = 2.2; // m/s
const ROAM_SPRINT = 4.2;
const ACCEL = 8; // 1/s — velocity lerp rate
const GROUND_SMOOTH = 10; // 1/s — eye-height lerp rate
const LOOK_SENSITIVITY = 0.0035; // rad/px
const PITCH_LIMIT = Math.PI / 3; // ±60°
const DRAG_THRESHOLD = 5; // px of pointer travel — below this a gesture is a click
// Cursor steering: the cursor's offset from the canvas center turns the view.
// A center dead-zone keeps the view calm when looking straight ahead; the
// turn ramps up toward the edges. No drag, no dwell.
const STEER_DEADZONE = 0.22; // fraction of half-canvas that stays still
const STEER_YAW_SPEED = 1.6; // rad/s at the canvas edge
const STEER_PITCH_SPEED = 1.0;
const GROUND_KEYWORDS = ['ground', 'floor', 'patiodeck', 'road', 'sidewalk'];

const KEYMAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'shift',
  ShiftRight: 'shift',
};

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _input = new THREE.Vector3();
const _targetVel = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _bob = new THREE.Vector3();
const _euler = new THREE.Euler();

export default function CameraRig({
  mode,
  focus,
  motionPaused,
  onEntered,
  onLeft,
  onRoamStart,
  setFade,
}) {
  const { camera, scene, gl } = useThree();
  const t = useRef(0); // idle time accumulator
  const pointer = useRef({ x: 0, y: 0 });
  const smoothed = useRef({ x: 0, y: 0 });
  const lookTarget = useRef(STREET.target.clone()); // where the camera is looking, every frame
  const anchor = useRef({ pos: STREET.pos.clone(), target: STREET.target.clone() });
  // { fromPos, fromTarget, to: {pos, target}, t, duration, type, onDone } | null
  const journey = useRef(null);
  const prevFocus = useRef(null);

  // --- roam state ---
  const roaming = useRef(false);
  const keys = useRef(new Set());
  // look input writes the *target*; the camera eases toward it each frame
  const yaw = useRef(0);
  const pitch = useRef(0);
  const yawTarget = useRef(0);
  const pitchTarget = useRef(0);
  const velocity = useRef(new THREE.Vector3());
  const eyeY = useRef(EYE); // smoothed eye height (pre-bob)
  const bobClock = useRef(0); // advances with distance traveled
  const prevBob = useRef(new THREE.Vector3());
  const groundMeshes = useRef([]);
  const raycaster = useRef(new THREE.Raycaster());
  const drag = useRef({ down: false, x: 0, y: 0, total: 0 });
  const suppressClick = useRef(false);
  const pointerPx = useRef({ x: -1, y: -1 }); // raw client coords for cursor steering
  const canvasRect = useRef(null); // cached — reading layout every frame causes jank
  const groundAccum = useRef(1); // time since last ground raycast
  const groundTargetY = useRef(EYE);
  const lastCastX = useRef(0);
  const lastCastZ = useRef(0);
  const reducedMotion = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  // Refs mirroring props, for the stable window/canvas listeners.
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const onRoamStartRef = useRef(onRoamStart);
  onRoamStartRef.current = onRoamStart;

  // If the glb contains a camera named cam_main, adopt its transform as the street anchor.
  useEffect(() => {
    const camMain = scene.getObjectByName('cam_main');
    if (camMain) {
      camMain.getWorldPosition(STREET.pos);
      const dir = new THREE.Vector3();
      camMain.getWorldDirection(dir);
      STREET.target.copy(STREET.pos).add(dir.multiplyScalar(10));
      anchor.current = { pos: STREET.pos.clone(), target: STREET.target.clone() };
      lookTarget.current.copy(STREET.target);
    }
  }, [scene]);

  useEffect(() => {
    const onMove = (e) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
      pointerPx.current.x = e.clientX;
      pointerPx.current.y = e.clientY;
    };
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // Journeys always depart from the camera's CURRENT position/look-target,
  // so refocusing mid-flight redirects smoothly instead of snapping.
  // Starting a journey always ends free roam — journeys take priority.
  const startJourney = (to, duration, type, onDone) => {
    roaming.current = false;
    velocity.current.set(0, 0, 0);
    prevBob.current.set(0, 0, 0);
    journey.current = {
      fromPos: camera.position.clone(),
      fromTarget: lookTarget.current.clone(),
      to,
      t: 0,
      duration,
      type,
      onDone,
    };
  };

  const beginRoam = () => {
    if (roaming.current) return;
    roaming.current = true;
    // adopt the camera's current orientation as the free-look state
    _euler.setFromQuaternion(camera.quaternion, 'YXZ');
    yaw.current = _euler.y;
    pitch.current = THREE.MathUtils.clamp(_euler.x, -PITCH_LIMIT, PITCH_LIMIT);
    yawTarget.current = yaw.current;
    pitchTarget.current = pitch.current;
    eyeY.current = camera.position.y;
    groundTargetY.current = camera.position.y;
    groundAccum.current = 1; // force a fresh ground cast on the first roam frame
    velocity.current.set(0, 0, 0);
    prevBob.current.set(0, 0, 0);
    // cache walkable geometry so the per-frame ground ray stays cheap
    const found = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const n = `${o.name}/${o.parent?.name ?? ''}`.toLowerCase();
      if (GROUND_KEYWORDS.some((k) => n.includes(k))) found.push(o);
    });
    groundMeshes.current = found;
    onRoamStartRef.current?.();
  };

  // Movement keys. The first movement key while idle in the city starts roaming.
  useEffect(() => {
    const onKeyDown = (e) => {
      const k = KEYMAP[e.code];
      if (!k || e.metaKey || e.ctrlKey || e.altKey) return;
      keys.current.add(k);
      if (k !== 'shift' && modeRef.current === 'city' && !journey.current) beginRoam();
    };
    const onKeyUp = (e) => {
      const k = KEYMAP[e.code];
      if (k) keys.current.delete(k);
    };
    const onBlur = () => keys.current.clear();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cache the canvas rect for edge-look; reading it per frame forces layout.
  useEffect(() => {
    const el = gl.domElement;
    const update = () => {
      canvasRect.current = el.getBoundingClientRect();
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener('resize', update);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [gl]);

  // Drag-to-look on the canvas (no pointer lock). A gesture under
  // DRAG_THRESHOLD px is a click and passes through to the hotspot raycast;
  // anything larger is a look-drag and its click is suppressed.
  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e) => {
      if (e.button !== 0) return;
      drag.current = { down: true, x: e.clientX, y: e.clientY, total: 0 };
    };
    const onMove = (e) => {
      const d = drag.current;
      if (!d.down) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      d.total += Math.abs(dx) + Math.abs(dy);
      if (d.total < DRAG_THRESHOLD) return;
      if (modeRef.current !== 'city' || journey.current) return;
      beginRoam();
      yawTarget.current -= dx * LOOK_SENSITIVITY;
      pitchTarget.current = THREE.MathUtils.clamp(
        pitchTarget.current - dy * LOOK_SENSITIVITY,
        -PITCH_LIMIT,
        PITCH_LIMIT
      );
    };
    const onUp = () => {
      if (!drag.current.down) return;
      suppressClick.current = drag.current.total >= DRAG_THRESHOLD;
      drag.current.down = false;
    };
    // capture-phase on window runs before r3f's canvas click handler
    const onClickCapture = (e) => {
      if (suppressClick.current && e.target === el) e.stopPropagation();
      suppressClick.current = false;
    };
    el.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('click', onClickCapture, true);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('click', onClickCapture, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl]);

  // Focus changes: walk up to the hotspot, or back to the street anchor.
  useEffect(() => {
    if (mode !== 'city') {
      prevFocus.current = focus;
      return;
    }
    if (focus) {
      const view = viewFor(scene, focus);
      if (view) startJourney(view, WALK_DURATION, 'walk');
    } else if (prevFocus.current && !roaming.current) {
      // focus cleared by "back to the street" — but when roam broke the
      // focus, stay put: the user is walking, not returning
      startJourney(
        { pos: STREET.pos.clone(), target: STREET.target.clone() },
        WALK_DURATION,
        'walk'
      );
    }
    prevFocus.current = focus;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, mode]);

  // Café transitions: two-leg journeys through the door.
  useEffect(() => {
    if (mode === 'entering') {
      startJourney(
        { pos: CAFE_DOOR.clone(), target: CAFE.target.clone() },
        ENTER_DURATION * 0.6,
        'enter-approach',
        () =>
          startJourney(
            { pos: CAFE.pos.clone(), target: CAFE.target.clone() },
            ENTER_DURATION * 0.4,
            'enter-through',
            onEntered
          )
      );
    } else if (mode === 'leaving') {
      startJourney(
        { pos: CAFE_DOOR.clone(), target: STREET.target.clone() },
        LEAVE_DURATION * 0.4,
        'leave-through',
        () =>
          startJourney(
            { pos: STREET.pos.clone(), target: STREET.target.clone() },
            LEAVE_DURATION * 0.6,
            'leave-return',
            onLeft
          )
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);
    const j = journey.current;
    const bobAllowed = !motionPaused && !reducedMotion.current;

    if (j) {
      j.t = Math.min(j.t + dt / j.duration, 1);
      const p = easeInOut(j.t);

      if (!j.prevPos) j.prevPos = j.fromPos.clone();
      camera.position.lerpVectors(j.fromPos, j.to.pos, p);
      lookTarget.current.lerpVectors(j.fromTarget, j.to.target, p);
      camera.lookAt(lookTarget.current);

      // half-strength head-bob on walks so they read as footsteps, not dollies
      if (j.type === 'walk' && bobAllowed) {
        bobClock.current += camera.position.distanceTo(j.prevPos);
        _right.setFromMatrixColumn(camera.matrix, 0);
        _bob.copy(_right).multiplyScalar(Math.sin(bobClock.current * 3.5) * 0.006);
        _bob.y += Math.sin(bobClock.current * 7) * 0.0125;
        j.prevPos.copy(camera.position);
        camera.position.add(_bob);
      } else {
        j.prevPos.copy(camera.position);
      }

      if (j.type === 'enter-through') {
        // fade to black over the last ~55% of the leg; holds 1 at completion
        // so the scene swap happens behind the overlay
        const fadeStart = 0.45;
        setFade(p < fadeStart ? 0 : (p - fadeStart) / (1 - fadeStart));
      } else if (j.type === 'leave-through') {
        setFade(1 - p);
      }
      // other journey types leave the fade alone (it's already 0)

      if (j.t >= 1) {
        anchor.current = { pos: j.to.pos.clone(), target: j.to.target.clone() };
        journey.current = null;
        j.onDone?.();
      }
      return;
    }

    // ------- cursor steer: the cursor's offset from center turns the view -------
    // Works across the whole canvas (dead-zone in the middle), no drag needed.
    // Skipped while focused on a hotspot so reading it isn't disturbed.
    if (mode === 'city' && !focus && !drag.current.down && canvasRect.current) {
      const rect = canvasRect.current;
      const px = pointerPx.current.x;
      const py = pointerPx.current.y;
      let fx = 0;
      let fy = 0;
      if (px >= rect.left && px <= rect.right && py >= rect.top && py <= rect.bottom) {
        // -1..1 from the canvas center, with the dead-zone removed
        fx = steerAxis(((px - rect.left) / rect.width) * 2 - 1);
        fy = steerAxis(((py - rect.top) / rect.height) * 2 - 1);
      }
      if (fx !== 0 || fy !== 0) {
        if (!roaming.current) beginRoam();
        yawTarget.current -= fx * STEER_YAW_SPEED * dt;
        pitchTarget.current = THREE.MathUtils.clamp(
          pitchTarget.current - fy * STEER_PITCH_SPEED * dt,
          -PITCH_LIMIT,
          PITCH_LIMIT
        );
      }
    }

    // ------- free roam: WASD on the ground plane + drag look -------
    if (roaming.current && mode === 'city') {
      camera.position.sub(prevBob.current);

      // ease the look toward the input target so drag/edge turns feel fluid
      const lookDamp = 1 - Math.exp(-14 * dt);
      yaw.current += (yawTarget.current - yaw.current) * lookDamp;
      pitch.current += (pitchTarget.current - pitch.current) * lookDamp;

      camera.rotation.order = 'YXZ';
      camera.rotation.set(pitch.current, yaw.current, 0);

      camera.getWorldDirection(_forward);
      _forward.y = 0;
      _forward.normalize();
      _right.crossVectors(_forward, UP); // camera-right on XZ

      _input.set(0, 0, 0);
      const k = keys.current;
      if (k.has('forward')) _input.add(_forward);
      if (k.has('back')) _input.sub(_forward);
      if (k.has('right')) _input.add(_right);
      if (k.has('left')) _input.sub(_right);

      _targetVel.set(0, 0, 0);
      if (_input.lengthSq() > 0) {
        _targetVel
          .copy(_input.normalize())
          .multiplyScalar(k.has('shift') ? ROAM_SPRINT : ROAM_SPEED);
      }
      velocity.current.lerp(_targetVel, 1 - Math.exp(-ACCEL * dt));
      camera.position.addScaledVector(velocity.current, dt);

      camera.position.x = THREE.MathUtils.clamp(
        camera.position.x,
        WALK_BOUNDS.minX,
        WALK_BOUNDS.maxX
      );
      camera.position.z = THREE.MathUtils.clamp(
        camera.position.z,
        WALK_BOUNDS.minZ,
        WALK_BOUNDS.maxZ
      );

      // follow the ground: ray straight down, throttled (raycasting every
      // frame — especially the whole-scene fallback — causes visible hitches)
      groundAccum.current += dt;
      const movedX = camera.position.x - lastCastX.current;
      const movedZ = camera.position.z - lastCastZ.current;
      if (groundAccum.current > 0.09 || movedX * movedX + movedZ * movedZ > 0.09) {
        groundAccum.current = 0;
        lastCastX.current = camera.position.x;
        lastCastZ.current = camera.position.z;
        _origin.set(camera.position.x, eyeY.current + 2, camera.position.z);
        raycaster.current.set(_origin, DOWN);
        raycaster.current.far = 10;
        const targets = groundMeshes.current.length ? groundMeshes.current : scene.children;
        const hits = raycaster.current.intersectObjects(targets, true);
        if (hits.length) groundTargetY.current = hits[0].point.y + EYE;
      }
      // eye height eases toward the last hit every frame, so curbs stay soft
      eyeY.current +=
        (groundTargetY.current - eyeY.current) * (1 - Math.exp(-GROUND_SMOOTH * dt));
      camera.position.y = eyeY.current;

      // head-bob, advanced by distance traveled
      _bob.set(0, 0, 0);
      const speed = velocity.current.length();
      if (speed > 0.2 && bobAllowed) {
        bobClock.current += speed * dt;
        _bob.copy(_right).multiplyScalar(Math.sin(bobClock.current * 3.5) * 0.012);
        _bob.y = Math.sin(bobClock.current * 7) * 0.025;
      }
      camera.position.add(_bob);
      prevBob.current.copy(_bob);

      // keep the look-target current so a journey can depart smoothly
      camera.getWorldDirection(_forward);
      lookTarget.current.copy(camera.position).addScaledVector(_forward, 10);
      return;
    }

    // ------- idle: gentle drift + damped mouse parallax around the anchor -------
    if (!motionPaused) t.current += dt;

    const damp = 1 - Math.exp(-3 * dt);
    smoothed.current.x += (pointer.current.x - smoothed.current.x) * damp;
    smoothed.current.y += (pointer.current.y - smoothed.current.y) * damp;

    // Walked up to read something: settled but alive.
    const settled = !!focus && mode === 'city';
    const driftScale = settled ? 0.3 : 1;
    const parScale = settled ? 0.5 : 1;

    const a = anchor.current;
    const driftX = Math.sin(t.current * 0.28) * 0.12 * driftScale;
    const driftY = Math.sin(t.current * 0.19 + 1.3) * 0.06 * driftScale;
    const parX = smoothed.current.x * 0.35 * parScale;
    const parY = -smoothed.current.y * 0.18 * parScale;

    camera.position.set(a.pos.x + driftX + parX, a.pos.y + driftY + parY, a.pos.z);
    lookTarget.current.set(
      a.target.x + parX * 0.5,
      a.target.y + parY * 0.5,
      a.target.z
    );
    camera.lookAt(lookTarget.current);
  });

  return null;
}

/** Where to stand to read a hotspot mesh. */
function viewFor(scene, meshName) {
  const mesh = scene.getObjectByName(meshName);
  if (!mesh) return null;
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());

  // Authored viewpoint: an empty named view_<name> exported with the glb.
  const empty = scene.getObjectByName('view_' + meshName.replace('screen_', ''));
  if (empty) {
    return { pos: empty.getWorldPosition(new THREE.Vector3()), target: center };
  }

  // Fallback: stand at eye height, backed off from the mesh along the
  // horizontal direction toward the street anchor.
  const size = box.getSize(new THREE.Vector3());
  const dist = THREE.MathUtils.clamp(Math.max(size.x, size.y, size.z) * 1.7, 1.3, 15);
  const away = new THREE.Vector3().subVectors(STREET.pos, center);
  away.y = 0;
  if (away.lengthSq() < 1e-6) away.set(0, 0, 1);
  away.normalize();
  const pos = center.clone().addScaledVector(away, dist);
  pos.y = EYE;
  return { pos, target: center };
}

function easeInOut(x) {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

// Map a -1..1 cursor position to a steer amount: 0 inside the dead-zone,
// then ramping (squared for finer control near the edge of the zone) to ±1.
function steerAxis(v) {
  const s = Math.sign(v);
  const m = Math.abs(v);
  if (m <= STEER_DEADZONE) return 0;
  const n = (m - STEER_DEADZONE) / (1 - STEER_DEADZONE);
  return s * n * n;
}
