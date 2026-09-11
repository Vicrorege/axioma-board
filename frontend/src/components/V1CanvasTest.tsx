import React from 'react';
import { Tldraw } from '@tldraw/tldraw';

export const V1CanvasTest: React.FC = () => {
  return (
    <div style={{ width: '100%', height: '100vh', position: 'relative' }}>
      <Tldraw />
    </div>
  );
};
