import { TLShapeUtil } from '@tldraw/core';
import type { TLBounds } from '@tldraw/core';
import type { RectangleShape, TDMeta } from '@tldraw/tldraw';

export interface V1InfoShape extends RectangleShape {
  title: string;
  content: string;
  latex?: string;
  variant?: 'info' | 'warning' | 'success' | 'danger' | 'neutral';
  badge?: string;
}

const VARIANT_STYLES: Record<string, { bg: string; border: string; accent: string; badgeBg: string; badgeText: string }> = {
  info: {
    bg: 'bg-sky-500/10 dark:bg-sky-500/15',
    border: 'border-sky-500/40 dark:border-sky-500/50',
    accent: 'text-sky-600 dark:text-sky-400',
    badgeBg: 'bg-sky-500/20 text-sky-700 dark:text-sky-300',
    badgeText: 'ИНФО',
  },
  warning: {
    bg: 'bg-amber-500/10 dark:bg-amber-500/15',
    border: 'border-amber-500/40 dark:border-amber-500/50',
    accent: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
    badgeText: 'ВНИМАНИЕ',
  },
  success: {
    bg: 'bg-emerald-500/10 dark:bg-emerald-500/15',
    border: 'border-emerald-500/40 dark:border-emerald-500/50',
    accent: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300',
    badgeText: 'УСПЕХ',
  },
  danger: {
    bg: 'bg-rose-500/10 dark:bg-rose-500/15',
    border: 'border-rose-500/40 dark:border-rose-500/50',
    accent: 'text-rose-600 dark:text-rose-400',
    badgeBg: 'bg-rose-500/20 text-rose-700 dark:text-rose-300',
    badgeText: 'ВАЖНО',
  },
  neutral: {
    bg: 'bg-slate-500/10 dark:bg-slate-500/15',
    border: 'border-slate-500/30 dark:border-slate-500/40',
    accent: 'text-slate-600 dark:text-slate-300',
    badgeBg: 'bg-slate-500/20 text-slate-700 dark:text-slate-300',
    badgeText: 'ЗАМЕТКА',
  },
};

export class V1InfoShapeUtil extends TLShapeUtil<V1InfoShape, HTMLDivElement, TDMeta> {
  type = 'rectangle';

  canBind = true;
  canClone = true;
  canEdit = true;

  getShape = (props: Partial<V1InfoShape>): V1InfoShape => {
    return {
      id: props.id || 'info_' + Math.random().toString(36).slice(2, 9),
      type: 'rectangle' as any,
      name: 'InfoCard',
      parentId: 'page',
      childIndex: 1,
      point: props.point || [0, 0],
      size: props.size || [360, 220],
      rotation: 0,
      title: props.title || 'Справка',
      content: props.content || '',
      latex: props.latex || '',
      variant: props.variant || 'info',
      badge: props.badge || '',
      style: {
        color: 'blue',
        size: 'medium',
        dash: 'draw',
        isFilled: false,
      } as any,
    };
  };

  Component = TLShapeUtil.Component<V1InfoShape, HTMLDivElement, TDMeta>(
    ({ shape, onShapeChange }, ref) => {
      const v = VARIANT_STYLES[shape.variant || 'info'] || VARIANT_STYLES.info;

      return (
        <div
          ref={ref}
          className={`rounded-2xl border shadow-lg backdrop-blur-md p-4 transition-colors flex flex-col gap-2.5 select-none ${v.bg} ${v.border}`}
          style={{
            width: shape.size[0],
            minHeight: shape.size[1],
            pointerEvents: 'all',
          }}
          onWheel={(e) => {
            if (e.ctrlKey || e.metaKey) return;
            e.stopPropagation();
          }}
        >
          <div className="flex items-center justify-between border-b pb-2 border-black/5 dark:border-white/10">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${v.badgeBg}`}>
                {shape.badge || v.badgeText}
              </span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                {shape.title}
              </span>
            </div>
            <button
              onClick={() => onShapeChange?.({ ...shape, id: shape.id })}
              className="text-xs opacity-50 hover:opacity-100 transition"
            >
              ✕
            </button>
          </div>

          <div className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
            {shape.content}
          </div>

          {shape.latex && (
            <div className="mt-1 p-2 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-black/5 dark:border-white/5 overflow-x-auto text-xs">
              <code>{shape.latex}</code>
            </div>
          )}
        </div>
      );
    }
  );

  Indicator = TLShapeUtil.Indicator<V1InfoShape>(({ bounds }) => {
    return (
      <rect
        width={bounds.width}
        height={bounds.height}
        fill="none"
        stroke="#0ea5e9"
        strokeWidth={2}
        rx={16}
        ry={16}
      />
    );
  });

  getBounds = (shape: V1InfoShape): TLBounds => {
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
