import React from 'react';

export default function Shell({
  motionPaused,
  onToggleMotion,
  hoveredLabel,
  focusedLabel,
  inCafe,
  onExitCafe,
  onBackToStreet,
  isFullscreen,
  onToggleFullscreen,
}) {
  return (
    <>
      <header className="site-header">
        <div className="brand">
          <span className="eyebrow">Interactive Portfolio</span>
          <h1>City of Influence</h1>
        </div>
        <nav className="site-nav" aria-label="Primary">
          <a href="#home">Home</a>
          <a href="#contact">Contact</a>
        </nav>
        <button className="motion-toggle" onClick={onToggleMotion} aria-pressed={motionPaused}>
          {motionPaused ? 'Resume motion' : 'Pause motion'}
        </button>
        <button
          className="fullscreen-toggle"
          onClick={onToggleFullscreen}
          aria-pressed={isFullscreen}
        >
          {isFullscreen ? '⤡ Exit fullscreen' : '⤢ Fullscreen'}
        </button>
      </header>

      <div className="prompt-bar" role="status" aria-live="polite">
        {inCafe ? (
          <>
            <span>Welcome in — take a look around.</span>
            <button className="link-btn" onClick={onExitCafe}>
              ← Back to the street
            </button>
          </>
        ) : focusedLabel ? (
          <>
            <span className="prompt-hot">{focusedLabel}</span>
            <button className="link-btn" onClick={onBackToStreet}>
              ← Back to the street
            </button>
          </>
        ) : hoveredLabel ? (
          <span className="prompt-hot">{hoveredLabel} — click to walk over</span>
        ) : (
          <span>Select an illuminated object to explore — or use WASD to walk around.</span>
        )}
      </div>
    </>
  );
}
