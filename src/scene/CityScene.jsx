import React from 'react';
import { useGLTF } from '@react-three/drei';
import InteractiveModel from './InteractiveModel.jsx';
import { HOTSPOTS, MODELS } from '../config/hotspots.js';

export default function CityScene({ onHotspotClick, onHover, interactive }) {
  return (
    <InteractiveModel
      url={MODELS.city}
      hotspots={HOTSPOTS}
      onHotspotClick={onHotspotClick}
      onHover={onHover}
      interactive={interactive}
    />
  );
}

// Start fetching the city immediately (same Draco decoder path as InteractiveModel)
useGLTF.preload(MODELS.city, 'https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
