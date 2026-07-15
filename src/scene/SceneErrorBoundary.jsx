import React from 'react';
import { Html } from '@react-three/drei';

export default class SceneErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <Html center>
          <div style={{ textAlign: 'center', color: '#e8ecf5', width: 'max-content' }}>
            <p>Scene model not found — add city_scene.glb to public/models/</p>
            <p style={{ fontSize: '0.75em', opacity: 0.7 }}>
              {String(this.state.error?.message ?? this.state.error)}
            </p>
          </div>
        </Html>
      );
    }
    return this.props.children;
  }
}
