import React, { useRef, useEffect } from 'react';
import { shapeUtils } from '@tldraw/tldraw';
import { HTMLContainer } from '@tldraw/core';
import { V1MathCard } from '../../components/V1MathCard';
import { branchOutV1Steps } from '../../services/v1BranchingService';

let isPatchInstalled = false;

export function installV1MathShapePatch() {
  if (isPatchInstalled) return;

  const rectUtil = shapeUtils.rectangle;
  if (!rectUtil) return;

  const OriginalComponent = rectUtil.Component;

  // Enhance the rectangle Component to render V1MathCard when math props are present
  (rectUtil as any).Component = React.forwardRef((props: any, ref: any) => {
    const shape = props.shape;
    const cardRef = useRef<HTMLDivElement>(null);

    // If shape has math properties or is designated as a math block
    const isMathBlock = Boolean(
      shape && (
        shape.latex !== undefined ||
        shape.resultLatex !== undefined ||
        shape.title !== undefined ||
        (shape.id && shape.id.startsWith('math_')) ||
        (shape.id && shape.id.startsWith('step_'))
      )
    );

    // Dynamic height measurement with ResizeObserver to keep shape.size matching true outer DOM card height
    useEffect(() => {
      if (!isMathBlock) return;
      const el = cardRef.current;
      if (!el) return;

      const targetEl = (el.firstElementChild as HTMLElement) || el;

      const ro = new ResizeObserver(() => {
        const app = (window as any).__tldrawApp;
        const zoom = app?.pageState?.camera?.zoom || 1;
        // targetEl.offsetHeight is completely immune to CSS transforms & camera zoom.
        // If fallback to getBoundingClientRect, divide by zoom to remain in world coordinates.
        const unscaledHeight = targetEl.offsetHeight || (targetEl.getBoundingClientRect().height / zoom);
        const exactHeight = Math.ceil(unscaledHeight);

        if (exactHeight > 80 && Math.abs(exactHeight - shape.size[1]) > 2) {
          if (app) {
            app.updateShapes({
              id: shape.id,
              size: [shape.size[0], exactHeight],
            });

            // Keep connected downstream vertical arrow strictly synced
            try {
              const shapes = Object.values(app.state.document.pages[app.currentPageId].shapes) as any[];
              for (const s of shapes) {
                if (s.isConduit && s.fromId === shape.id) {
                  const toShape = s.toId ? app.getShape(s.toId) : null;
                  if (toShape) {
                    const isSameCol = Math.abs(shape.point[0] - toShape.point[0]) < 40;
                    if (isSameCol) {
                      const newStartY = shape.point[1] + exactHeight;
                      const newEndY = toShape.point[1];
                      const newDy = Math.max(newEndY - newStartY, 4);
                      app.updateShapes({
                        id: s.id,
                        point: [s.point[0], newStartY],
                        size: [s.size[0], newDy],
                        conduitPath: `M 15 0 V ${newDy}`,
                      });
                    }
                  }
                }
              }
            } catch {
              // ignore
            }
          }
        }
      });

      ro.observe(targetEl);
      return () => ro.disconnect();
    }, [isMathBlock, shape?.id, shape?.size]);

    if (isMathBlock) {
      const isDarkMode = Boolean(props.meta?.isDarkMode);

      return (
        <HTMLContainer
          ref={ref}
          {...(props.events as any)}
          className="tl-math-card-container"
          style={{
            width: '100%',
            height: '100%',
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          <div
            ref={cardRef}
            {...(props.events || {})}
            className="w-full select-none"
            style={{ pointerEvents: 'auto' }}
          >
            <V1MathCard
              id={shape.id}
              title={shape.title || 'Выражение'}
              latex={shape.latex || ''}
              resultLatex={shape.resultLatex || ''}
              comment={shape.comment || ''}
              cardType={shape.cardType || (shape.id.startsWith('step_') ? (shape.isLast ? 'answer' : 'explanation') : 'full')}
              customOptions={shape.customOptions}
              color={shape.color || '#3b82f6'}
              error={shape.error}
              isDarkMode={isDarkMode}
              isStepCard={shape.id.startsWith('step_')}
              onUpdate={(updated) => {
                props.onShapeChange?.({
                  id: shape.id,
                  ...updated,
                });
              }}
              onBranchOut={(methodOrSteps, resultLatex) => {
                const app = (window as any).__tldrawApp;
                if (app) {
                  branchOutV1Steps(app, shape, methodOrSteps, resultLatex);
                }
              }}
              onDelete={() => {
                const app = (window as any).__tldrawApp;
                if (app) {
                  app.delete([shape.id]);
                }
              }}
            />
          </div>
        </HTMLContainer>
      );
    }

    // Extended polygon shape support (diamond, star, hexagon, cloud, heart)
    if (shape && shape.polygonType) {
      const [w, h] = shape.size || [140, 140];
      const isDarkMode = Boolean(props.meta?.isDarkMode);
      const strokeColor = shape.style?.color === 'white'
        ? (isDarkMode ? '#ffffff' : '#0f172a')
        : shape.style?.color || '#3b82f6';
      const isFilled = Boolean(shape.style?.isFilled);
      const fillColor = isFilled ? `${strokeColor}25` : 'transparent';
      const strokeWidth = shape.style?.size === 'large' ? 3.5 : shape.style?.size === 'medium' ? 2.5 : 2;

      let shapeSvg = null;
      if (shape.polygonType === 'diamond') {
        shapeSvg = (
          <polygon
            points={`${w / 2},3 ${w - 3},${h / 2} ${w / 2},${h - 3} 3,${h / 2}`}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        );
      } else if (shape.polygonType === 'star') {
        const cx = w / 2;
        const cy = h / 2;
        const rOut = Math.min(w, h) / 2 - 4;
        const rIn = rOut * 0.42;
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? rOut : rIn;
          pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        shapeSvg = (
          <polygon
            points={pts.join(' ')}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        );
      } else if (shape.polygonType === 'hexagon') {
        const cx = w / 2;
        const cy = h / 2;
        const r = Math.min(w, h) / 2 - 3;
        const pts = [];
        for (let i = 0; i < 6; i++) {
          const angle = (i * Math.PI) / 3 - Math.PI / 6;
          pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        shapeSvg = (
          <polygon
            points={pts.join(' ')}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        );
      } else if (shape.polygonType === 'cloud') {
        shapeSvg = (
          <path
            d={`M ${w * 0.18},${h * 0.65} a ${w * 0.15},${h * 0.2} 0 0,1 ${w * 0.25},-${h * 0.2} a ${w * 0.25},${h * 0.25} 0 0,1 ${w * 0.35},0 a ${w * 0.18},${h * 0.18} 0 0,1 ${w * 0.15},${h * 0.2} a ${w * 0.15},${h * 0.15} 0 0,1 -${w * 0.08},${h * 0.25} h -${w * 0.67} a ${w * 0.15},${h * 0.15} 0 0,1 0,-${h * 0.25} z`}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        );
      } else if (shape.polygonType === 'heart') {
        const s = Math.min(w, h) / 28;
        shapeSvg = (
          <path
            d="M 12,21.35 l -1.45,-1.32 C 5.4,15.36 2,12.28 2,8.5 C 2,5.42 4.42,3 7.5,3 c 1.74,0 3.41,0.81 4.5,2.09 C 13.09,3.81 14.76,3 16.5,3 C 19.58,3 22,5.42 22,8.5 c 0,3.78 -3.4,6.86 -8.55,11.54 L 12,21.35 Z"
            transform={`scale(${s}) translate(${w / (2 * s) - 12}, ${h / (2 * s) - 12})`}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        );
      }

      return (
        <svg
          ref={ref}
          {...(props.events || {})}
          style={{ width: '100%', height: '100%', overflow: 'visible', pointerEvents: 'all' }}
        >
          {shapeSvg}
        </svg>
      );
    }

    // Vector Conduit Connector (Live-anchored to connected shapes with clean gap)
    if (shape && shape.isConduit) {
      const isDarkMode = Boolean(props.meta?.isDarkMode);
      const strokeColor = shape.color || (shape.style?.color === 'blue' ? '#3b82f6' : isDarkMode ? '#a78bfa' : '#7c3aed');
      const strokeWidth = 2.5;

      const app = (window as any).__tldrawApp;
      const fromShape = shape.fromId && app ? app.getShape(shape.fromId) : null;
      const toShape = shape.toId && app ? app.getShape(shape.toId) : null;

      let d = shape.conduitPath || '';
      let w = shape.size?.[0] || 120;
      let h = shape.size?.[1] || 120;
      let transform = '';

      if (fromShape && toShape) {
        const fromBounds = {
          minX: fromShape.point[0],
          minY: fromShape.point[1],
          maxX: fromShape.point[0] + fromShape.size[0],
          maxY: fromShape.point[1] + fromShape.size[1],
          width: fromShape.size[0],
          height: fromShape.size[1],
        };
        const toBounds = {
          minX: toShape.point[0],
          minY: toShape.point[1],
          maxX: toShape.point[0] + toShape.size[0],
          maxY: toShape.point[1] + toShape.size[1],
          width: toShape.size[0],
          height: toShape.size[1],
        };

        const isSameColumn = Math.abs(fromBounds.minX - toBounds.minX) < 40;

        if (isSameColumn) {
          // Vertical downward arrow strictly from bottom of upper card to top of lower card
          const startX = fromBounds.minX + Math.round(fromBounds.width / 2);
          const startY = fromBounds.maxY;
          const endY = toBounds.minY;
          const dy = Math.max(endY - startY, 4);

          const offsetX = (startX - 15) - shape.point[0];
          const offsetY = startY - shape.point[1];

          transform = `translate(${offsetX}px, ${offsetY}px)`;
          w = 30;
          h = dy;
          d = `M 15 0 V ${dy}`;
        } else if (Math.abs(fromBounds.minY - toBounds.minY) < 80) {
          // Horizontal arrow strictly from right edge of parent to left edge of Step 1
          const startX = fromBounds.maxX;
          const startY = fromBounds.minY + 60;
          const endX = toBounds.minX;
          const dx = Math.max(endX - startX, 4);

          const offsetX = startX - shape.point[0];
          const offsetY = (startY - 15) - shape.point[1];

          transform = `translate(${offsetX}px, ${offsetY}px)`;
          w = dx;
          h = 30;
          d = `M 0 15 H ${dx}`;
        } else {
          // S-conduit transition between columns strictly from right edge of Col k to left edge of Col k+1
          const startX = fromBounds.maxX;
          const startY = fromBounds.minY + 60;
          const endX = toBounds.minX;
          const endY = toBounds.minY + 60;

          const minX = Math.min(startX, endX);
          const minY = Math.min(startY, endY);
          const sx = startX - minX;
          const sy = startY - minY;
          const ex = endX - minX;
          const ey = endY - minY;

          const mx = Math.round((sx + ex) / 2);
          const r = 16;

          const offsetX = minX - shape.point[0];
          const offsetY = minY - shape.point[1];

          transform = `translate(${offsetX}px, ${offsetY}px)`;
          w = Math.max(sx, ex, 30);
          h = Math.max(sy, ey, 30);
          d = `M ${sx} ${sy} H ${mx - r} Q ${mx} ${sy} ${mx} ${sy - r} V ${ey + r} Q ${mx} ${ey} ${mx + r} ${ey} H ${ex}`;
        }
      }

      return (
        <svg
          ref={ref}
          {...(props.events || {})}
          className="tl-conduit-arrow pointer-events-stroke"
          style={{
            position: 'absolute',
            overflow: 'visible',
            width: w,
            height: h,
            transform: transform || undefined,
          }}
        >
          <defs>
            <marker
              id={`conduit-arrowhead-${shape.id}`}
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="4"
              orient="auto"
            >
              <path d="M 0 1.5 L 6 4 L 0 6.5 z" fill={strokeColor} />
            </marker>
          </defs>
          <path
            d={d}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd={`url(#conduit-arrowhead-${shape.id})`}
          />
        </svg>
      );
    }

    // Otherwise render standard tldraw v1 Rectangle shape
    return <OriginalComponent {...props} ref={ref} />;
  });

  isPatchInstalled = true;
  console.log('[Axioma] V1 Math Shape patch installed with HTMLContainer');
}
