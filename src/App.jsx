import React, { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  BrightnessContrast,
  HueSaturation,
} from '@react-three/postprocessing';
import CityScene from './scene/CityScene.jsx';
import SceneErrorBoundary from './scene/SceneErrorBoundary.jsx';
import CafeScene from './scene/CafeScene.jsx';
import CameraRig from './scene/CameraRig.jsx';
import TwilightSky from './scene/TwilightSky.jsx';
import FocusAffordance from './scene/FocusAffordance.jsx';
import Shell from './ui/Shell.jsx';
import SectionPanel from './ui/SectionPanel.jsx';
import Landing from './ui/Landing.jsx';
import { HOTSPOTS, CAFE_HOTSPOTS } from './config/hotspots.js';

export default function App() {
  // 'city' | 'entering' | 'cafe' | 'leaving'
  const [mode, setMode] = useState('city');
  const [focused, setFocused] = useState(null); // hotspot mesh name or null
  const [panelOpen, setPanelOpen] = useState(false);
  const [hoveredLabel, setHoveredLabel] = useState(null);
  const [motionPaused, setMotionPaused] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const [fade, setFade] = useState(0); // 0 transparent, 1 black
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [entered, setEntered] = useState(false);
  const appRef = useRef(null);
  const zoomApiRef = useRef(null);

  const inCafe = mode === 'cafe' || mode === 'leaving';
  const hotspotMap = inCafe ? CAFE_HOTSPOTS : HOTSPOTS;
  const focusedHotspot = focused ? hotspotMap[focused] : null;

  const backToStreet = useCallback(() => {
    setPanelOpen(false);
    setFocused(null);
  }, []);

  const handleHotspotClick = useCallback(
    (meshName) => {
      const spot = hotspotMap[meshName];
      if (!spot) return;
      if (spot.kind === 'cafe') {
        setPanelOpen(false);
        setFocused(null);
        setMode('entering'); // CameraRig runs the fly-through, then calls onEntered
      } else {
        // Walk the camera up to the object; the panel is a secondary action.
        setPanelOpen(false);
        setFocused(meshName);
      }
    },
    [hotspotMap]
  );

  const handleEntered = useCallback(() => {
    setMode('cafe');
    setFade(0);
  }, []);
  const handleLeft = useCallback(() => {
    setMode('city');
    setFade(0);
  }, []);
  const exitCafe = useCallback(() => {
    setPanelOpen(false);
    setFocused(null);
    setMode('leaving');
  }, []);

  const toggleFullscreen = useCallback(() => {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (fsEl) {
      (document.exitFullscreen || document.webkitExitFullscreen)?.call(document);
    } else {
      const el = appRef.current;
      (el?.requestFullscreen || el?.webkitRequestFullscreen)?.call(el);
    }
  }, []);

  useEffect(() => {
    const onChange = () =>
      setIsFullscreen(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
    };
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (panelOpen) setPanelOpen(false);
      else if (focused) backToStreet();
      else if (mode === 'cafe') exitCafe();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, focused, mode, backToStreet, exitCafe]);

  return (
    <div className="app" ref={appRef}>
      <Shell
        motionPaused={motionPaused}
        onToggleMotion={() => setMotionPaused((p) => !p)}
        hoveredLabel={hoveredLabel}
        focusedLabel={focusedHotspot?.label ?? null}
        inCafe={mode === 'cafe'}
        onExitCafe={exitCafe}
        onBackToStreet={backToStreet}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
      />

      <div className="canvas-wrap" aria-label="Interactive 3D street scene">
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, toneMappingExposure: 1.15 }}
          camera={{ fov: 45, near: 0.1, far: 600, position: [6, 1.6, 10] }}
        >
          <color attach="background" args={['#05050f']} />
          <fog attach="fog" args={['#181228', 30, 260]} />
          <TwilightSky />
          <Suspense fallback={null}>
            {!inCafe && (
              <SceneErrorBoundary>
                <CityScene
                  onHotspotClick={handleHotspotClick}
                  onHover={setHoveredLabel}
                  interactive={mode === 'city' && !panelOpen}
                />
              </SceneErrorBoundary>
            )}
            {inCafe && (
              <SceneErrorBoundary>
                <CafeScene
                  onHotspotClick={handleHotspotClick}
                  onHover={setHoveredLabel}
                  interactive={mode === 'cafe' && !panelOpen}
                />
              </SceneErrorBoundary>
            )}
            {focused && !panelOpen && (mode === 'city' || mode === 'cafe') && (
              <FocusAffordance
                meshName={focused}
                hotspot={focusedHotspot}
                onOpen={() => setPanelOpen(true)}
                onBack={backToStreet}
              />
            )}
            <CameraRig
              mode={mode}
              focus={focused}
              motionPaused={motionPaused || panelOpen}
              onEntered={handleEntered}
              onLeft={handleLeft}
              onRoamStart={backToStreet}
              setFade={setFade}
              zoomApiRef={zoomApiRef}
            />
          </Suspense>
          {/* Low cool ambient — a floor that keeps blacks rich, not milky */}
          <ambientLight intensity={0.18} color="#1a2540" />
          {/* Moon key: cool, high, from the side — models the towers and
              catches the taxi roof/edges. The contrast against the low
              ambient is what makes the blacks read deep. */}
          <directionalLight position={[7, 18, 8]} intensity={2.2} color="#bcd0ff" />
          {/* Warm street bounce: low + opposite side — gives the taxi and
              props their pop and warmth without lifting the shadows. */}
          <directionalLight position={[-8, 3, -5]} intensity={0.7} color="#ff9d4d" />
          <EffectComposer disableNormalPass>
            <Bloom
              intensity={0.55}
              luminanceThreshold={0.75}
              luminanceSmoothing={0.3}
              mipmapBlur
            />
            {/* Grade the final image: deepen blacks + separate midtones, then
                enrich the colour so the taxi/neon/window tints pop. */}
            <BrightnessContrast brightness={-0.02} contrast={0.16} />
            <HueSaturation saturation={0.18} />
          </EffectComposer>
        </Canvas>

        {/* fade overlay for the cafe transition */}
        <div className="fade-overlay" style={{ opacity: fade }} aria-hidden="true" />

        <div className="zoom-controls">
          <button
            className="zoom-btn"
            onClick={() => zoomApiRef.current?.(-8)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            className="zoom-btn"
            onClick={() => zoomApiRef.current?.(8)}
            aria-label="Zoom out"
          >
            −
          </button>
        </div>
      </div>

      {panelOpen && focusedHotspot && (
        <SectionPanel
          key={focused}
          hotspotKey={focused}
          hotspot={focusedHotspot}
          onClose={() => setPanelOpen(false)}
        />
      )}

      <footer className="site-footer">
        City of Influence is an Interactive Portfolio created by Rae-Anne Richardson
      </footer>

      <Landing onEnter={() => setEntered(true)} hidden={entered} />
    </div>
  );
}
