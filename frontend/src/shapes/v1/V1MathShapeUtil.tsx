import { TLShapeUtil } from '@tldraw/core';
import type { TLBounds } from '@tldraw/core';
import type { RectangleShape, TDMeta } from '@tldraw/tldraw';

export interface V1MathShape extends RectangleShape {
  latex: string;
  resultLatex: string;
  title: string;
  comment: string;
  error?: string;
  methodsJson?: string;
}

export class V1MathShapeUtil extends TLShapeUtil<V1MathShape, HTMLDivElement, TDMeta> {
  type = 'rectangle';

  canBind = true;
  canClone = true;
  canEdit = true;

  getShape = (props: Partial<V1MathShape>): V1MathShape => {
    return {
      id: props.id || 'math_' + Math.random().toString(36).slice(2, 9),
      type: 'rectangle' as any,
      name: 'MathBlock',
      parentId: 'page',
      childIndex: 1,
      point: props.point || [0, 0],
      size: props.size || [440, 360],
      rotation: 0,
      latex: props.latex || '',
      resultLatex: props.resultLatex || '',
      title: props.title || 'Выражение',
      comment: props.comment || '',
      error: props.error || '',
      methodsJson: props.methodsJson || '',
      style: {
        color: 'blue',
        size: 'medium',
        dash: 'draw',
        isFilled: false,
      } as any,
    };
  };

  Component = TLShapeUtil.Component<V1MathShape, HTMLDivElement, TDMeta>(
    ({ shape }, ref) => {
      return (
        <div
          ref={ref}
          style={{
            width: shape.size[0],
            height: shape.size[1],
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '2px solid #3b82f6',
            boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
            padding: '16px',
            boxSizing: 'border-box',
            pointerEvents: 'all',
          }}
        >
          <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1e293b' }}>
            {shape.title || 'Выражение'}
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>
            Latex: {shape.latex || '(введите выражение)'}
          </div>
        </div>
      );
    }
  );

  Indicator = TLShapeUtil.Indicator<V1MathShape>(({ bounds }) => {
    return (
      <rect
        width={bounds.width}
        height={bounds.height}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
        rx={16}
        ry={16}
      />
    );
  });

  getBounds = (shape: V1MathShape): TLBounds => {
    const [width, height] = shape.size;
    return {
      minX: shape.point[0],
      minY: shape.point[1],
      maxX: shape.point[0] + width,
      maxY: shape.point[1] + height,
      width,
      height,
    };
  };
}
