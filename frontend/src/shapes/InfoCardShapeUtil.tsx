import React, { useRef, useEffect } from 'react';
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
} from 'tldraw';
import type { Editor, TLBaseShape } from 'tldraw';
import { GripHorizontal, Trash2, Info, AlertTriangle, CheckCircle, Flame } from 'lucide-react';
import { FormattedStepText, MathRenderer } from '../components/MathRenderer';

export const INFO_CARD_TYPE = 'info-card' as const;

export interface InfoCardShapeProps {
  w: number;
  h: number;
  title: string;
  content: string;
  latex?: string;
  badge?: string;
  variant?: 'info' | 'warning' | 'success' | 'danger' | 'neutral';
  color?: string;
}

export type InfoCardShape = TLBaseShape<typeof INFO_CARD_TYPE, InfoCardShapeProps>;

interface InfoCardProps {
  shape: InfoCardShape;
  editor: Editor;
}

const VARIANT_CONFIGS: Record<string, {
  bg: string;
  border: string;
  headerBg: string;
  text: string;
  accent: string;
  icon: React.ComponentType<any>;
}> = {
  info: {
    bg: 'bg-blue-50/90 dark:bg-blue-950/40',
    border: 'border-blue-200 dark:border-blue-800/60',
    headerBg: 'bg-blue-100/70 dark:bg-blue-900/50',
    text: 'text-blue-900 dark:text-blue-200',
    accent: '#3b82f6',
    icon: Info,
  },
  warning: {
    bg: 'bg-amber-50/90 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800/60',
    headerBg: 'bg-amber-100/70 dark:bg-amber-900/50',
    text: 'text-amber-900 dark:text-amber-200',
    accent: '#f59e0b',
    icon: AlertTriangle,
  },
  success: {
    bg: 'bg-emerald-50/90 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800/60',
    headerBg: 'bg-emerald-100/70 dark:bg-emerald-900/50',
    text: 'text-emerald-900 dark:text-emerald-200',
    accent: '#10b981',
    icon: CheckCircle,
  },
  danger: {
    bg: 'bg-rose-50/90 dark:bg-rose-950/40',
    border: 'border-rose-200 dark:border-rose-800/60',
    headerBg: 'bg-rose-100/70 dark:bg-rose-900/50',
    text: 'text-rose-900 dark:text-rose-200',
    accent: '#ef4444',
    icon: Flame,
  },
  neutral: {
    bg: 'bg-slate-50/90 dark:bg-slate-900/80',
    border: 'border-slate-200 dark:border-slate-800',
    headerBg: 'bg-slate-100/80 dark:bg-slate-800',
    text: 'text-slate-800 dark:text-slate-100',
    accent: '#64748b',
    icon: Info,
  },
};

const InfoCardComponent: React.FC<InfoCardProps> = ({ shape, editor }) => {
  const { h, title, content, latex, badge, variant = 'info', color } = shape.props;
  const cfg = VARIANT_CONFIGS[variant || 'info'] || VARIANT_CONFIGS.info;
  const accentColor = color || cfg.accent;
  const Icon = cfg.icon;

  const innerRef = useRef<HTMLDivElement>(null);
  const hoverStartTimeRef = useRef(0);

  // Auto-fit height to custom content
  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;

    const measureHeight = () => {
      const neededHeight = Math.max(el.scrollHeight, el.getBoundingClientRect().height);
      if (neededHeight > 0 && Math.abs(neededHeight - h) > 4) {
        editor.updateShape({
          id: shape.id,
          type: INFO_CARD_TYPE as any,
          props: { h: Math.max(100, Math.ceil(neededHeight) + 4) },
        });
      }
    };

    const timer = setTimeout(measureHeight, 30);
    const ro = new ResizeObserver(measureHeight);
    ro.observe(el);

    return () => {
      clearTimeout(timer);
      ro.disconnect();
    };
  }, [shape.id, title, content, latex, badge, h]);

  const handleDelete = () => {
    const bindings = editor.getBindingsInvolvingShape(shape.id, 'arrow');
    const arrowIdsToKill = bindings.map((b) => b.fromId);
    editor.deleteShapes([shape.id, ...arrowIdsToKill]);
  };

  const handleCardWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) return;
    const now = performance.now();
    if (now - hoverStartTimeRef.current < 220) return;
    e.stopPropagation();
  };

  return (
    <div
      data-info-card="true"
      onMouseEnter={() => {
        hoverStartTimeRef.current = performance.now();
      }}
      onWheel={handleCardWheel}
      onWheelCapture={handleCardWheel}
      className={`w-full h-full rounded-2xl shadow-md border overflow-hidden font-sans select-none transition-shadow hover:shadow-lg cursor-default flex flex-col ${cfg.bg} ${cfg.border}`}
      style={{ borderTop: `5px solid ${accentColor}` }}
    >
      <div ref={innerRef} className="w-full flex flex-col">
        {/* Header */}
        <div
          className={`flex items-center justify-between px-3 py-2 border-b cursor-grab active:cursor-grabbing transition ${cfg.headerBg} ${cfg.border}`}
          title="Потяните за шапку, чтобы переместить служебную карточку"
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
            <GripHorizontal size={14} className="text-slate-400 shrink-0" />
            <Icon size={14} style={{ color: accentColor }} className="shrink-0" />
            <span className={`text-xs font-bold truncate ${cfg.text}`}>
              {title || 'Служебная карточка'}
            </span>
            {badge && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0"
                style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
              >
                {badge}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
            <button
              onClick={handleDelete}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-950/50 text-slate-400 hover:text-red-600 rounded-lg transition cursor-pointer"
              title="Удалить карточку"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Custom Content Body (Text + Markdown/LaTeX, NO actions) */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          className="p-3 flex flex-col gap-2 select-text"
        >
          {content && (
            <div className={`text-xs leading-relaxed ${cfg.text}`}>
              <FormattedStepText text={content} />
            </div>
          )}

          {latex && (
            <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-700/60">
              <MathRenderer latex={latex} fontSize="1.15rem" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export class InfoCardShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = INFO_CARD_TYPE;

  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    content: T.string,
    latex: T.optional(T.string),
    badge: T.optional(T.string),
    variant: T.optional(T.string),
    color: T.optional(T.string),
  };

  override getDefaultProps(): InfoCardShapeProps {
    return {
      w: 360,
      h: 140,
      title: 'Служебная карточка',
      content: '',
      latex: '',
      badge: 'SYSTEM',
      variant: 'info',
      color: '#3b82f6',
    };
  }

  override canResize() {
    return true;
  }

  override canScroll() {
    return true;
  }

  override canBind() {
    return true;
  }

  override getIndicatorPath() {
    return undefined;
  }

  override component(shape: InfoCardShape) {
    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: 'all',
        }}
      >
        <InfoCardComponent shape={shape} editor={this.editor} />
      </HTMLContainer>
    );
  }

  override indicator(_shape: InfoCardShape) {
    return null;
  }
}
