import React, { useState, useEffect } from 'react';
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  createShapeId,
} from 'tldraw';
import type { TLShape, Editor } from 'tldraw';
import { GripHorizontal, Edit3, Check, Trash2, ArrowRight } from 'lucide-react';
import { MathRenderer } from '../components/MathRenderer';
import { VisualMathEditor } from '../components/VisualMathEditor';
import { mathApi } from '../services/api';

export const MATH_BLOCK_TYPE = 'math-block' as const;

declare module 'tldraw' {
  export interface TLGlobalShapePropsMap {
    'math-block': {
      w: number;
      h: number;
      title: string;
      latex: string;
      resultLatex: string;
      comment: string;
      color: string;
      isEditing: boolean;
      error: string;
    };
  }
}

export type MathBlockShape = TLShape<typeof MATH_BLOCK_TYPE>;

interface MathBlockCardProps {
  shape: MathBlockShape;
  editor: Editor;
}

interface DynamicAction {
  id: string;
  label: string;
  icon: string;
  operation: string;
  tooltip?: string;
}

function getInitialActions(rawLatex: string): DynamicAction[] {
  const s = (rawLatex || '').toLowerCase();
  const isIneq =
    s.includes('<') ||
    s.includes('>') ||
    s.includes('\\le') ||
    s.includes('\\ge') ||
    s.includes('\\leq') ||
    s.includes('\\geq') ||
    s.includes('\\neq') ||
    s.includes('\\ne');

  if (isIneq) {
    return [
      { id: 'solve', label: 'Решить', icon: '⚖️', operation: 'solve', tooltip: 'Решить неравенство' },
      { id: 'intervals', label: 'Интервалы', icon: '📊', operation: 'ai_steps', tooltip: 'Метод интервалов' },
      { id: 'domain', label: 'ОДЗ', icon: '🚫', operation: 'domain', tooltip: 'Область допустимых значений' },
      { id: 'factor', label: 'Разложить', icon: '🧩', operation: 'factor', tooltip: 'Разложить числитель и знаменатель' },
      { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить' },
    ];
  }

  if (s.includes('=')) {
    return [
      { id: 'solve', label: 'Решить', icon: '⚖️', operation: 'solve', tooltip: 'Найти корни уравнения' },
      { id: 'factor', label: 'Разложить', icon: '🧩', operation: 'factor', tooltip: 'Разложить на множители' },
      { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить' },
      { id: 'diff', label: 'd/dx', icon: '📈', operation: 'diff', tooltip: 'Дифференцировать' },
      { id: 'ai_steps', label: 'По шагам', icon: '📝', operation: 'ai_steps', tooltip: 'Пошаговый разбор' },
    ];
  }

  if (s.includes('\\int')) {
    return [
      { id: 'integrate', label: 'Вычислить ∫', icon: '∫', operation: 'integrate', tooltip: 'Взять интеграл' },
      { id: 'by_parts', label: 'По частям', icon: '🔄', operation: 'ai_steps', tooltip: 'Интегрирование по частям' },
      { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить подынтегральное' },
      { id: 'diff', label: 'd/dx', icon: '📈', operation: 'diff', tooltip: 'Производная' },
    ];
  }

  if (s.includes('d/dx') || s.includes('\\frac{d}{dx}')) {
    return [
      { id: 'diff', label: 'Производная', icon: '📈', operation: 'diff', tooltip: 'Взять производную' },
      { id: 'critical', label: 'Экстремумы', icon: '🎯', operation: 'ai_steps', tooltip: 'Критические точки f\'(x)=0' },
      { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить' },
    ];
  }

  return [
    { id: 'eval', label: 'Расчет', icon: '⚡', operation: 'eval', tooltip: 'Численный или аналитический расчет' },
    { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить выражение' },
    { id: 'factor', label: 'Разложить', icon: '🧩', operation: 'factor', tooltip: 'Разложить на множители' },
    { id: 'diff', label: 'd/dx', icon: '📈', operation: 'diff', tooltip: 'Производная' },
    { id: 'integrate', label: '∫ dx', icon: '∫', operation: 'integrate', tooltip: 'Интеграл' },
  ];
}

const MathBlockCard: React.FC<MathBlockCardProps> = ({ shape, editor }) => {
  const { w, h, title, latex, resultLatex, comment, color, isEditing, error } = shape.props;
  const [loadingOp, setLoadingOp] = useState<string | null>(null);
  const [actions, setActions] = useState<DynamicAction[]>(() => getInitialActions(latex));
  const [steps, setSteps] = useState<string[]>([]);
  const [showSteps, setShowSteps] = useState(false);

  // Dynamic Context-Aware Action Adaptation
  useEffect(() => {
    // 1. Instant heuristic update
    setActions(getInitialActions(latex));

    // 2. Debounced deep AI action suggestions from OmniRoute
    if (!latex || latex.trim().length < 2) return;
    const timer = setTimeout(async () => {
      try {
        const res = await mathApi.getSuggestedActions(latex);
        if (res && res.actions && res.actions.length > 0) {
          setActions(res.actions);
        }
      } catch {
        // Fallback already in place
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [latex]);

  const updateProps = (newProps: Partial<MathBlockShape['props']>) => {
    editor.updateShape({
      id: shape.id,
      type: 'math-block',
      props: { ...newProps },
    });
  };

  const handleOp = async (op: string) => {
    setLoadingOp(op);
    updateProps({ error: '' });
    setSteps([]);
    try {
      let res;
      if (op === 'eval' || op === 'evaluate') {
        res = await mathApi.evaluate(latex, undefined, true);
      } else if (op === 'simplify') {
        res = await mathApi.simplify(latex);
      } else if (op === 'diff' || op === 'differentiate') {
        res = await mathApi.derivative(latex, 'x', 1);
      } else if (op === 'integrate') {
        res = await mathApi.integrate(latex, 'x', false);
      } else if (op === 'solve' || op === 'solve_ineq' || op === 'solve_eq') {
        res = await mathApi.solve(latex, 'x');
      } else if (op === 'factor') {
        res = await mathApi.factor(latex);
      } else if (op === 'domain') {
        res = await mathApi.domain(latex, 'x');
      } else if (op === 'ai_steps' || op === 'intervals') {
        res = await mathApi.solve(latex, 'x');
      }

      if (res && res.success) {
        updateProps({
          resultLatex: res.result_latex || res.result_str || '',
          error: '',
        });
        if (res.steps && res.steps.length > 0) {
          setSteps(res.steps);
          setShowSteps(true);
        }
      } else {
        updateProps({
          error: res?.error || 'Computation failed',
        });
      }
    } catch (err: any) {
      updateProps({
        error: err.response?.data?.detail || err.message || 'API request error',
      });
    } finally {
      setLoadingOp(null);
    }
  };

  const handleBranchOut = () => {
    if (!resultLatex) return;
    const newBlockId = createShapeId();
    const newX = shape.x + w + 80;
    const newY = shape.y;

    editor.createShape({
      id: newBlockId,
      type: 'math-block' as any,
      x: newX,
      y: newY,
      props: {
        w: 400,
        h: 320,
        title: `Шаг из ${title}`,
        latex: resultLatex,
        resultLatex: '',
        comment: `Выведено из: ${latex}`,
        color: '#10b981',
        isEditing: false,
        error: '',
      },
    });

    try {
      const arrowId = createShapeId();
      editor.createShape({
        id: arrowId,
        type: 'arrow',
        x: shape.x + w,
        y: shape.y + h / 2,
      });
      editor.updateShape({
        id: arrowId,
        type: 'arrow',
        props: {
          start: { x: 0, y: 0 },
          end: { x: 80, y: 0 },
        },
      });
    } catch (e) {
      console.warn('Could not create arrow', e);
    }
  };

  const handleToggleEditing = () => {
    if (isEditing) {
      try {
        const kb = (window as any).mathVirtualKeyboard;
        if (kb?.visible) {
          kb.hide();
        }
      } catch {}
    }
    updateProps({ isEditing: !isEditing });
  };

  const handleDelete = () => {
    try {
      const kb = (window as any).mathVirtualKeyboard;
      if (kb?.visible) {
        kb.hide();
      }
    } catch {}
    editor.deleteShapes([shape.id]);
  };

  return (
    <div
      data-math-card="true"
      onWheel={(e) => {
        e.stopPropagation();
      }}
      onWheelCapture={(e) => {
        e.stopPropagation();
      }}
      className="w-full h-full flex flex-col bg-white rounded-2xl shadow-lg border border-slate-200/90 overflow-hidden font-sans select-none text-slate-800 transition-shadow hover:shadow-xl cursor-default"
      style={{ borderTop: `6px solid ${color}` }}
    >
      {/* Draggable Card Header */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-slate-50/90 border-b border-slate-100 cursor-grab active:cursor-grabbing text-slate-500 hover:text-slate-800 transition"
        title="Потяните за шапку, чтобы переместить карточку"
      >
        <div className="flex items-center gap-1.5 flex-1 min-w-0 pr-2">
          <GripHorizontal size={15} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={title}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Backspace' || e.key === 'Delete') {
                e.stopPropagation();
              }
            }}
            onChange={(e) => updateProps({ title: e.target.value })}
            className="text-xs font-bold text-slate-700 bg-transparent border-none focus:outline-none focus:ring-1 focus:ring-blue-400 rounded px-1 w-full truncate cursor-text"
            placeholder="Название карточки"
          />
        </div>

        {/* Header Action Icons */}
        <div className="flex items-center gap-1 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          <button
            onClick={handleToggleEditing}
            className={`p-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
              isEditing
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800'
            }`}
            title={isEditing ? 'Сохранить и закрыть' : 'Редактировать формулу'}
          >
            {isEditing ? <Check size={14} /> : <Edit3 size={14} />}
            <span className="text-[11px]">{isEditing ? 'Готово' : 'Формула'}</span>
          </button>
          <button
            onClick={handleDelete}
            className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition cursor-pointer"
            title="Удалить карточку"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Card Content with isolated scroll events */}
      <div
        onWheel={(e) => e.stopPropagation()}
        className="flex-1 flex flex-col p-3 gap-2.5 overflow-y-auto"
      >
        {/* MathLive Formula Input or Render Mode */}
        {isEditing ? (
          <VisualMathEditor
            value={latex}
            onChange={(val) => updateProps({ latex: val })}
            onEnter={handleToggleEditing}
          />
        ) : (
          <div
            onClick={() => updateProps({ isEditing: true })}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 min-h-[64px] flex items-center justify-center p-3 rounded-xl bg-slate-50/80 border border-dashed border-slate-200 cursor-pointer hover:bg-blue-50/40 hover:border-blue-300 transition"
            title="Нажмите для редактирования формулы"
          >
            <MathRenderer latex={latex} fontSize="1.35rem" />
          </div>
        )}

        {/* Dynamic Context-Aware Operations Toolbar */}
        <div
          className="flex flex-wrap gap-1.5 pt-0.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {actions.map((act) => (
            <button
              key={act.id || act.label}
              disabled={loadingOp !== null}
              onClick={() => handleOp(act.operation)}
              className="flex-1 min-w-[62px] py-1.5 px-2 text-xs font-semibold bg-slate-50 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 rounded-xl border border-slate-200 transition disabled:opacity-50 cursor-pointer shadow-2xs text-center flex items-center justify-center gap-1"
              title={act.tooltip || act.label}
            >
              {loadingOp === act.operation ? (
                <span className="text-xs">⟳</span>
              ) : (
                <>
                  <span className="text-[11px]">{act.icon}</span>
                  <span className="truncate">{act.label}</span>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="p-2 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs break-words font-medium"
          >
            ⚠ {error}
          </div>
        )}

        {/* Computed Result Box with Steps & Branching */}
        {resultLatex && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-1 p-2.5 rounded-xl bg-emerald-50/90 border border-emerald-200 flex flex-col gap-1.5"
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              <span>Результат</span>
              <button
                onClick={handleBranchOut}
                className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-sm cursor-pointer"
                title="Создать связанную дочернюю карточку с результатом"
              >
                <span>Ветвить</span>
                <ArrowRight size={11} />
              </button>
            </div>
            <div className="overflow-x-auto text-emerald-950 py-1">
              <MathRenderer latex={resultLatex} fontSize="1.2rem" />
            </div>

            {/* Collapsible Step-by-Step Breakdown */}
            {steps.length > 0 && (
              <div className="pt-1.5 border-t border-emerald-200/80">
                <button
                  type="button"
                  onClick={() => setShowSteps(!showSteps)}
                  className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer flex items-center gap-1"
                >
                  <span>{showSteps ? '▼ Скрыть шаги' : '▶ Показать шаги решения'} ({steps.length})</span>
                </button>
                {showSteps && (
                  <ol className="mt-1.5 space-y-1 text-[11px] text-emerald-950 pl-4 list-decimal max-h-40 overflow-y-auto">
                    {steps.map((st, i) => (
                      <li key={i} className="leading-snug">
                        {st}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>
        )}

        {/* Note / Step Comment Footer */}
        <input
          type="text"
          value={comment}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' || e.key === 'Delete') {
              e.stopPropagation();
            }
          }}
          onChange={(e) => updateProps({ comment: e.target.value })}
          placeholder="Пояснение шага или комментарий..."
          className="mt-auto text-xs text-slate-500 bg-transparent border-t border-slate-100 pt-1.5 focus:outline-none focus:text-slate-800 cursor-text"
        />
      </div>
    </div>
  );
};

export class MathBlockShapeUtil extends BaseBoxShapeUtil<any> {
  static override type = MATH_BLOCK_TYPE;

  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    latex: T.string,
    resultLatex: T.string,
    comment: T.string,
    color: T.string,
    isEditing: T.boolean,
    error: T.string,
  };

  override getDefaultProps(): MathBlockShape['props'] {
    return {
      w: 400,
      h: 330,
      title: 'Математическое выражение',
      latex: 'f(x) = \\frac{x^2 - 1}{x - 1}',
      resultLatex: '',
      comment: '',
      color: '#3b82f6',
      isEditing: false,
      error: '',
    };
  }

  override canResize() {
    return true;
  }

  override canScroll() {
    return true;
  }

  override getIndicatorPath() {
    return undefined;
  }

  override component(shape: MathBlockShape) {
    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: shape.props.w,
          height: shape.props.h,
          pointerEvents: 'all',
        }}
      >
        <MathBlockCard shape={shape} editor={this.editor} />
      </HTMLContainer>
    );
  }

  override indicator(_shape: MathBlockShape) {
    return null;
  }
}
