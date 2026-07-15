import React from 'react';

/**
 * Cinematic intro shown before the 3D city. The Canvas mounts behind it and
 * loads while this is up, so "Enter the City" reveals a ready scene.
 * Stays mounted (fades out) so the transition reads as a dissolve.
 */
export default function Landing({ onEnter, hidden }) {
  return (
    <div className={`landing${hidden ? ' landing--hidden' : ''}`} aria-hidden={hidden}>
      <div className="landing__coords">10.6918° N&nbsp;&nbsp;•&nbsp;&nbsp;61.2225° W</div>

      <div className="landing__inner">
        <p className="landing__eyebrow">
          <span className="landing__eyebrow-line" aria-hidden="true" />
          Interactive Portfolio
        </p>

        <h1 className="landing__name">
          Rae-Anne
          <br />
          Richardson
        </h1>

        <p className="landing__role">Sr. Marketing Strategist</p>

        <hr className="landing__divider" />

        <p className="landing__lede">
          Enter to explore the <strong>City of Influence</strong>.
        </p>

        <button className="landing__enter" onClick={onEnter} autoFocus>
          <span>Enter the City</span>
          <span className="landing__enter-icon" aria-hidden="true">
            →
          </span>
        </button>

        <p className="landing__tags">Strategy. Story. Movement.</p>
      </div>

      <div className="landing__watermark" aria-hidden="true">
        City of Influence
      </div>
      <div className="landing__footer-tags">Shape • Influence • Impact</div>
    </div>
  );
}
