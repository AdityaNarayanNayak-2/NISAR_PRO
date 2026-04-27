import React from 'react';
import { LUXURY } from '../core/Theme';
import { Activity, Map } from 'lucide-react';

export function WavePhysicsSim() {
  return (
    <div style={{
      padding: '40px',
      background: LUXURY.charcoal,
      border: `1px solid ${LUXURY.gold}30`,
      borderRadius: '16px',
      textAlign: 'center',
      marginBottom: '24px'
    }}>
      <Activity size={48} color={LUXURY.gold} style={{ marginBottom: '16px' }} />
      <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '8px' }}>Wave Physics Playground</h3>
      <p style={{ color: LUXURY.platinum }}>Interactive simulation engine coming in Phase 2.</p>
    </div>
  );
}

export function GeometrySim() {
  return (
    <div style={{
      padding: '40px',
      background: LUXURY.charcoal,
      border: `1px solid ${LUXURY.emerald}30`,
      borderRadius: '16px',
      textAlign: 'center',
      marginBottom: '24px'
    }}>
      <Map size={48} color={LUXURY.emerald} style={{ marginBottom: '16px' }} />
      <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: '8px' }}>Geometry Visualizer</h3>
      <p style={{ color: LUXURY.platinum }}>3D orbit simulation coming in Phase 2.</p>
    </div>
  );
}
