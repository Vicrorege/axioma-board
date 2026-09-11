import React, { useRef } from 'react';
import { Tldraw } from '@tldraw/tldraw';
import type { TldrawApp } from '@tldraw/tldraw';
import { V1MathShapeUtil } from '../shapes/v1/V1MathShapeUtil';
import { V1InfoShapeUtil } from '../shapes/v1/V1InfoShapeUtil';

export const V1BoardApp: React.FC<{ isDarkMode?: boolean }> = ({ isDarkMode }) => {
  const appRef = useRef<TldrawApp | null>(null);

  const handleMount = (app: TldrawApp) => {
    appRef.current = app;

    // Register our custom shape utils into tldraw v1 TLDR
    const mathUtil = new V1MathShapeUtil();
    const infoUtil = new V1InfoShapeUtil();
    void mathUtil;
    void infoUtil;

    (app as any).TLDR?.getShapeUtil;

    // Expose global helper for console testing info cards
    (window as any).spawnInfoCard = (options: {
      title?: string;
      content: string;
      latex?: string;
      variant?: 'info' | 'warning' | 'success' | 'danger' | 'neutral';
      badge?: string;
      point?: [number, number];
    }) => {
      if (!appRef.current) return;
      const center = appRef.current.centerPoint;
      const pt: [number, number] = options.point || [center[0] - 180, center[1] - 110];

      appRef.current.createShapes({
        id: 'info_' + Math.random().toString(36).slice(2, 9),
        type: 'rectangle' as any,
        point: pt,
        size: [360, 220],
        ...options,
      } as any);
    };
  };

  return (
    <div className="w-full h-full relative">
      <Tldraw
        autofocus
        darkMode={isDarkMode}
        onMount={handleMount}
      />
    </div>
  );
};
