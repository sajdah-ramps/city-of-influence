import React, { useEffect, useRef } from 'react';

/**
 * The content overlay for a clicked hotspot. Content per section is
 * placeholder for now — replace the body of each case with real content
 * (or drive it from a content config / CMS later).
 */
export default function SectionPanel({ hotspotKey, hotspot, onClose }) {
  const panelRef = useRef(null);

  useEffect(() => {
    panelRef.current?.focus();
  }, [hotspotKey]);

  return (
    <div className="panel-backdrop" onClick={onClose}>
      <section
        ref={panelRef}
        className="section-panel"
        role="dialog"
        aria-modal="true"
        aria-label={hotspot.title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="panel-header">
          <div>
            <span className="eyebrow">{hotspot.label}</span>
            <h2>{hotspot.title}</h2>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close panel">
            ✕
          </button>
        </header>

        <div className="panel-body">
          <PanelContent hotspotKey={hotspotKey} />
        </div>
      </section>
    </div>
  );
}

function PanelContent({ hotspotKey }) {
  switch (hotspotKey) {
    case 'screen_billboard':
      return <Placeholder text="Case studies grid goes here — each project as a card with imagery, role, and outcome." />;
    case 'screen_newsstand':
      return <Placeholder text="Press mentions and features — headlines styled like newspaper clippings." />;
    case 'screen_shelter':
      return <Placeholder text="Current projects and ideas in motion." />;
    case 'screen_payphone':
      return <Placeholder text="Contact form / email / socials. The payphone rings both ways." />;
    case 'screen_plaque':
      return <Placeholder text="About, résumé, experience, skills — the formal front door." />;
    case 'screen_menu':
      return <Placeholder text="Fun facts, written as a café menu." />;
    case 'screen_photos':
      return <Placeholder text="Personal photos and moments." />;
    default:
      return <Placeholder text="Content coming soon." />;
  }
}

function Placeholder({ text }) {
  return <p className="placeholder">{text}</p>;
}
