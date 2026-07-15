import React from 'react';
import InteractiveModel from './InteractiveModel.jsx';
import { CAFE_HOTSPOTS, MODELS } from '../config/hotspots.js';

/**
 * The cafe interior. NOT preloaded — it only downloads when the user clicks
 * the cafe, keeping the initial page load light. Suspense in App.jsx covers
 * the load; the entering fade hides any pop-in.
 */
export default function CafeScene({ onHotspotClick, onHover, interactive }) {
  return (
    <InteractiveModel
      url={MODELS.cafe}
      hotspots={CAFE_HOTSPOTS}
      onHotspotClick={onHotspotClick}
      onHover={onHover}
      interactive={interactive}
    />
  );
}
