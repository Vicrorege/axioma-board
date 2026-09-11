import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  createShapeId,
} from 'tldraw';
import type { TLShape, Editor } from 'tldraw';
import { GripHorizontal, Edit3, Check, Trash2, ArrowRight } from 'lucide-react';
import { MathRenderer, FormattedStepText } from '../components/MathRenderer';
import { VisualMathEditor } from '../components/VisualMathEditor';
import { mathApi } from '../services/api';
import type { SolutionMethod } from '../types/math';

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
      methodsJson?: string;
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

const renderActionIcon = (iconStr: string, op: string) => {
  const icon = (iconStr || '').trim();
  if (['⚖️', '🪄', '📈', '∫', '⚡', '🚫', '🧩', '📊', '📝', '🎯', '🔄', '📐'].includes(icon)) {
    return <span className="text-xs">{icon}</span>;
  }
  const s = (icon + ' ' + op).toLowerCase();
  if (s.includes('solve') || s.includes('calc') || s.includes('equal')) return <span className="text-xs">⚖️</span>;
  if (s.includes('diff') || s.includes('deriv') || s.includes('trend')) return <span className="text-xs">📈</span>;
  if (s.includes('integ')) return <span className="text-xs">∫</span>;
  if (s.includes('factor') || s.includes('grid')) return <span className="text-xs">🧩</span>;
  if (s.includes('interval') || s.includes('timeline')) return <span className="text-xs">📊</span>;
  if (s.includes('domain') || s.includes('warn')) return <span className="text-xs">🚫</span>;
  if (s.includes('step') || s.includes('psych') || s.includes('note')) return <span className="text-xs">📝</span>;
  if (s.includes('simp') || s.includes('magic')) return <span className="text-xs">🪄</span>;
  if (s.includes('eval') || s.includes('bolt') || s.includes('flash')) return <span className="text-xs">⚡</span>;
  return <span className="text-xs">✨</span>;
};

function getInitialActions(rawLatex: string): DynamicAction[] {
  const s = (rawLatex || '').toLowerCase().trim();
  if (!s) return [];

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
      { id: 'solve', label: 'Решить неравенство', icon: '⚖️', operation: 'solve', tooltip: 'Найти интервалы решений' },
      { id: 'intervals', label: 'Метод интервалов', icon: '📊', operation: 'ai_steps', tooltip: 'Пошаговый разбор метода интервалов' },
      { id: 'domain', label: 'ОДЗ', icon: '🚫', operation: 'domain', tooltip: 'Область допустимых значений' },
      { id: 'factor', label: 'Разложить на множители', icon: '🧩', operation: 'factor', tooltip: 'Разложить числитель и знаменатель' },
      { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить выражение' },
    ];
  }

  // Check quadratic
  if (s.includes('x^2') || s.includes('x^{2}')) {
    return [
      { id: 'solve', label: 'Решить уравнение', icon: '⚖️', operation: 'solve', tooltip: 'Найти корни уравнения' },
      { id: 'factor', label: 'Разложить на множители', icon: '🧩', operation: 'factor', tooltip: 'Разложить на множители' },
      { id: 'diff', label: 'Производная d/dx', icon: '📈', operation: 'diff', tooltip: 'Дифференцировать' },
      { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить' },
    ];
  }

  if (s.includes('=')) {
    return [
      { id: 'solve', label: 'Решить уравнение', icon: '⚖️', operation: 'solve', tooltip: 'Найти корни уравнения' },
      { id: 'factor', label: 'Разложить на множители', icon: '🧩', operation: 'factor', tooltip: 'Разложить на множители' },
      { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить обе части' },
      { id: 'diff', label: 'Производная d/dx', icon: '📈', operation: 'diff', tooltip: 'Дифференцировать' },
    ];
  }

  if (s.includes('\\int')) {
    return [
      { id: 'integrate', label: 'Вычислить интеграл', icon: '∫', operation: 'integrate', tooltip: 'Взять интеграл' },
      { id: 'by_parts', label: 'По частям', icon: '🔄', operation: 'ai_steps', tooltip: 'Интегрирование по частям' },
      { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить подынтегральное' },
      { id: 'diff', label: 'Производная d/dx', icon: '📈', operation: 'diff', tooltip: 'Проверить производной' },
    ];
  }

  if (s.includes('d/dx') || s.includes('\\frac{d}{dx}')) {
    return [
      { id: 'diff', label: 'Взять производную', icon: '📈', operation: 'diff', tooltip: 'Взять производную' },
      { id: 'critical', label: 'Экстремумы', icon: '🎯', operation: 'ai_steps', tooltip: 'Критические точки f\'(x)=0' },
      { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить' },
    ];
  }

  return [
    { id: 'eval', label: 'Расчет', icon: '⚡', operation: 'eval', tooltip: 'Численный или аналитический расчет' },
    { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить выражение' },
    { id: 'factor', label: 'Разложить', icon: '🧩', operation: 'factor', tooltip: 'Разложить на множители' },
    { id: 'diff', label: 'Производная d/dx', icon: '📈', operation: 'diff', tooltip: 'Взять производную' },
    { id: 'integrate', label: 'Интеграл ∫ dx', icon: '∫', operation: 'integrate', tooltip: 'Взять интеграл' },
  ];
}

const MathBlockCard: React.FC<MathBlockCardProps> = ({ shape, editor }) => {
  const { w, h, title, latex, resultLatex, comment, color, isEditing, error, methodsJson } = shape.props;
  const [loadingOp, setLoadingOp] = useState<string | null>(null);

  // Instant 0ms synchronous heuristic actions
  const instantActions = useMemo(() => getInitialActions(latex), [latex]);
  const [aiActions, setAiActions] = useState<DynamicAction[] | null>(null);
  const actions = aiActions && aiActions.length > 0 ? aiActions : instantActions;

  const [solutionMethods, setSolutionMethods] = useState<SolutionMethod[]>([]);
  const [activeMethodIndex, setActiveMethodIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const hoverStartTimeRef = useRef(0);

  const handleCardWheel = (e: React.WheelEvent) => {
    const now = performance.now();
    // If mouse entered during active trackpad panning (< 220ms ago), pass through to canvas
    if (now - hoverStartTimeRef.current < 220) {
      return;
    }
    // Stationary cursor on card: stop propagation to scroll card
    e.stopPropagation();
  };

  const hasExpression = Boolean(latex && latex.trim().length > 0);

  // Parse branched methods if this card is a step-breakdown child
  const branchedMethods: SolutionMethod[] = useMemo(() => {
    if (methodsJson) {
      try {
        const parsed = JSON.parse(methodsJson);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }, [methodsJson]);

  // Debounced deep AI action suggestions from OmniRoute
  useEffect(() => {
    if (!hasExpression) {
      setAiActions(null);
      return;
    }

    // Clear previous AI override on new input so instantActions take over with 0ms delay
    setAiActions(null);

    const timer = setTimeout(async () => {
      try {
        const res = await mathApi.getSuggestedActions(latex);
        if (res && res.actions && res.actions.length > 0) {
          setAiActions(res.actions);
        }
      } catch {
        // Instant heuristic fallback remains in place
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [latex, hasExpression]);

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
    setSolutionMethods([]);
    setActiveMethodIndex(0);

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

        if (res.methods && res.methods.length > 0) {
          setSolutionMethods(res.methods);
        } else if (res.steps && res.steps.length > 0) {
          setSolutionMethods([{ name: 'Ход решения', steps: res.steps, final_answer: res.result_latex }]);
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

  // Branch out: milestones or wrapped 2-column step flow
  const handleBranchOut = () => {
    if (!resultLatex) return;

    const activeMethod = solutionMethods[activeMethodIndex] || solutionMethods[0];
    const milestones = activeMethod?.milestones;

    // IF MILESTONES: Spawn major chunks in a 2-column or 2-row layout!
    if (milestones && milestones.length > 0) {
      const stepWidth = 390;
      const stepHeight = 230;
      const spacingX = 90;
      const spacingY = 50;

      let prevId = shape.id;
      let prevX = shape.x;
      let prevY = shape.y;
      let prevW = w;
      let prevH = h;

      milestones.forEach((m, idx) => {
        const stepCardId = createShapeId();
        const col = Math.floor(idx / 2);
        const row = idx % 2;

        const nextX = shape.x + w + spacingX + col * (stepWidth + spacingX);
        const nextY = shape.y + row * (stepHeight + spacingY);

        const isLast = idx === milestones.length - 1;

        const subStepsText =
          m.sub_steps && m.sub_steps.length > 0
            ? `\n\n---DETAILED_STEPS---\n` + m.sub_steps.join('\n')
            : '';

        editor.createShape({
          id: stepCardId,
          type: 'math-block' as any,
          x: nextX,
          y: nextY,
          props: {
            w: stepWidth,
            h: stepHeight,
            title: `Этап ${idx + 1}: ${m.title}`,
            latex: m.result_latex || '',
            resultLatex: isLast ? resultLatex : '',
            comment: m.summary + subStepsText,
            color: isLast ? '#10b981' : '#6366f1',
            isEditing: false,
            error: '',
          },
        });

        try {
          const arrowId = createShapeId();
          const isCurved = row !== 0 || col !== 0;
          editor.createShape({
            id: arrowId,
            type: 'arrow',
            x: prevX + prevW,
            y: prevY + prevH / 2,
            props: {
              start: { x: 0, y: 0 },
              end: { x: nextX - (prevX + prevW), y: nextY + stepHeight / 2 - (prevY + prevH / 2) },
              bend: isCurved ? 24 : 0,
              color: isLast ? 'green' : 'violet',
              arrowheadEnd: 'arrow',
            },
          });

          editor.createBinding({
            type: 'arrow',
            fromId: arrowId,
            toId: prevId,
            props: {
              terminal: 'start',
              normalizedAnchor: { x: 1, y: 0.5 },
              isPrecise: true,
              isExact: false,
            },
          });

          editor.createBinding({
            type: 'arrow',
            fromId: arrowId,
            toId: stepCardId,
            props: {
              terminal: 'end',
              normalizedAnchor: { x: 0, y: 0.5 },
              isPrecise: true,
              isExact: false,
            },
          });
        } catch (e) {
          console.warn('Could not create milestone arrow', e);
        }

        prevId = stepCardId;
        prevX = nextX;
        prevY = nextY;
        prevW = stepWidth;
        prevH = stepHeight;
      });
      return;
    }

    // IF RAW STEPS (Fallback): 2-column wrapped layout instead of one giant straight line
    const stepsList = activeMethod?.steps || [];
    if (stepsList.length > 0) {
      const stepWidth = 380;
      const stepHeight = 210;
      const spacingX = 80;
      const spacingY = 50;

      let prevId = shape.id;
      let prevX = shape.x;
      let prevY = shape.y;
      let prevW = w;
      let prevH = h;

      stepsList.forEach((stepText, idx) => {
        const stepCardId = createShapeId();
        const col = Math.floor(idx / 2);
        const row = idx % 2;

        const nextX = shape.x + w + spacingX + col * (stepWidth + spacingX);
        const nextY = shape.y + row * (stepHeight + spacingY);

        const isLast = idx === stepsList.length - 1;

        editor.createShape({
          id: stepCardId,
          type: 'math-block' as any,
          x: nextX,
          y: nextY,
          props: {
            w: stepWidth,
            h: stepHeight,
            title: `Шаг ${idx + 1}: ${activeMethod.name}`,
            latex: '',
            resultLatex: isLast ? resultLatex : '',
            comment: stepText,
            color: isLast ? '#10b981' : '#6366f1',
            isEditing: false,
            error: '',
          },
        });

        try {
          const arrowId = createShapeId();
          const isCurved = row !== 0 || col !== 0;
          editor.createShape({
            id: arrowId,
            type: 'arrow',
            x: prevX + prevW,
            y: prevY + prevH / 2,
            props: {
              start: { x: 0, y: 0 },
              end: { x: nextX - (prevX + prevW), y: nextY + stepHeight / 2 - (prevY + prevH / 2) },
              bend: isCurved ? 20 : 0,
              color: isLast ? 'green' : 'violet',
              arrowheadEnd: 'arrow',
            },
          });

          editor.createBinding({
            type: 'arrow',
            fromId: arrowId,
            toId: prevId,
            props: {
              terminal: 'start',
              normalizedAnchor: { x: 1, y: 0.5 },
              isPrecise: true,
              isExact: false,
            },
          });

          editor.createBinding({
            type: 'arrow',
            fromId: arrowId,
            toId: stepCardId,
            props: {
              terminal: 'end',
              normalizedAnchor: { x: 0, y: 0.5 },
              isPrecise: true,
              isExact: false,
            },
          });
        } catch (e) {
          console.warn('Could not create step arrow', e);
        }

        prevId = stepCardId;
        prevX = nextX;
        prevY = nextY;
        prevW = stepWidth;
        prevH = stepHeight;
      });
      return;
    }

    // Fallback: single child card if no multi-step breakdown
    const newBlockId = createShapeId();
    const newX = shape.x + w + 120;
    const newY = shape.y;

    editor.createShape({
      id: newBlockId,
      type: 'math-block' as any,
      x: newX,
      y: newY,
      props: {
        w: 440,
        h: 340,
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
        props: {
          start: { x: 0, y: 0 },
          end: { x: 120, y: 0 },
          bend: 0,
          color: 'green',
          arrowheadEnd: 'arrow',
        },
      });

      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: shape.id,
        props: {
          terminal: 'start',
          normalizedAnchor: { x: 1, y: 0.5 },
          isPrecise: true,
          isExact: false,
        },
      });

      editor.createBinding({
        type: 'arrow',
        fromId: arrowId,
        toId: newBlockId,
        props: {
          terminal: 'end',
          normalizedAnchor: { x: 0, y: 0.5 },
          isPrecise: true,
          isExact: false,
        },
      });
    } catch (e) {
      console.warn('Could not create bound arrow', e);
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

    // Find all bound arrows connected to this card and kill them together!
    const bindings = editor.getBindingsInvolvingShape(shape.id, 'arrow');
    const arrowIdsToKill = bindings.map((b) => b.fromId);
    editor.deleteShapes([shape.id, ...arrowIdsToKill]);
  };

  return (
    <div
      data-math-card="true"
      onMouseEnter={() => {
        hoverStartTimeRef.current = performance.now();
      }}
      onWheel={handleCardWheel}
      onWheelCapture={handleCardWheel}
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
            className={`p-1 px-2 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
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
            title="Удалить карточку и привязанные стрелки"
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
            className="flex-1 min-h-[56px] flex items-center justify-center p-3 rounded-xl bg-slate-50/80 border border-dashed border-slate-200 cursor-pointer hover:bg-blue-50/40 hover:border-blue-300 transition"
            title="Нажмите для редактирования формулы"
          >
            <MathRenderer latex={latex} fontSize="1.35rem" />
          </div>
        )}

        {/* Dynamic Context-Aware Operations Toolbar (ONLY when expression is non-empty) */}
        {hasExpression && actions.length > 0 && (
          <div
            className="flex flex-wrap gap-2 pt-1"
            onPointerDown={(e) => e.stopPropagation()}
          >
            {actions.map((act) => (
              <button
                key={act.id || act.label}
                disabled={loadingOp !== null}
                onClick={() => handleOp(act.operation)}
                className="px-3 py-1.5 text-xs font-medium rounded-xl border border-slate-200 bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 shadow-2xs transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                title={act.tooltip || act.label}
              >
                {loadingOp === act.operation ? (
                  <span className="animate-spin text-xs">⟳</span>
                ) : (
                  <>
                    {renderActionIcon(act.icon, act.operation)}
                    <span>{act.label}</span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="p-2.5 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs break-words font-medium"
          >
            ⚠ {error}
          </div>
        )}

        {/* Computed Result Box with Branching */}
        {resultLatex && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-1 p-3 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              <span>Результат</span>
              <button
                onClick={handleBranchOut}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition shadow-sm cursor-pointer"
                title="Разветвить решение: каждый шаг появится отдельной карточкой со стрелками"
              >
                <span>{solutionMethods.length > 0 ? 'Ветвить ход решения' : 'Ветвить'}</span>
                <ArrowRight size={12} />
              </button>
            </div>

            <div className="overflow-x-auto text-emerald-950 py-1 font-medium">
              <MathRenderer latex={resultLatex} fontSize="1.25rem" />
            </div>
          </div>
        )}

        {/* Step Breakdown Display on Branched Child Card */}
        {branchedMethods.length > 0 && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200 flex flex-col gap-2.5"
          >
            {/* Method Tabs if multiple methods exist */}
            {branchedMethods.length > 1 && (
              <div className="flex items-center gap-1.5 bg-emerald-100/70 p-1 rounded-xl">
                {branchedMethods.map((m, idx) => (
                  <button
                    key={m.name}
                    type="button"
                    onClick={() => setActiveMethodIndex(idx)}
                    className={`flex-1 py-1 px-2 text-xs font-bold rounded-lg transition cursor-pointer text-center ${
                      activeMethodIndex === idx
                        ? 'bg-white text-emerald-900 shadow-2xs'
                        : 'text-emerald-700 hover:text-emerald-900'
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}

            {/* Step list for active method */}
            <div className="flex flex-col gap-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                {branchedMethods[activeMethodIndex]?.name || 'Ход решения'}:
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {branchedMethods[activeMethodIndex]?.steps.map((st, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-xl bg-white/95 border border-emerald-100/90 text-xs text-slate-800 shadow-2xs leading-relaxed"
                  >
                    <FormattedStepText text={st} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Formatted Step / Milestone Explanation */}
        {comment && (() => {
          const parts = comment.split('\n\n---DETAILED_STEPS---\n');
          const mainSummary = parts[0];
          const subSteps = parts[1] ? parts[1].split('\n').filter(Boolean) : [];

          return (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 text-xs text-slate-800 leading-relaxed shadow-2xs space-y-2"
            >
              <FormattedStepText text={mainSummary} />

              {subSteps.length > 0 && (
                <div className="pt-2 border-t border-slate-200/80">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setShowDetails((prev) => !prev)}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{showDetails ? '▲ Свернуть подробности' : `▼ Подробнее (${subSteps.length} мелких шага)`}</span>
                    </button>
                  </div>

                  {showDetails && (
                    <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-blue-400">
                      {subSteps.map((st, i) => (
                        <div key={i} className="p-1.5 rounded-lg bg-white border border-slate-200/70 shadow-2xs">
                          <FormattedStepText text={st} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

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
    methodsJson: T.optional(T.string),
  };

  override getDefaultProps(): MathBlockShape['props'] {
    return {
      w: 440,
      h: 360,
      title: 'Выражение',
      latex: '', // Empty by default! No templates!
      resultLatex: '',
      comment: '',
      color: '#3b82f6',
      isEditing: true, // Focus immediately ready for typing!
      error: '',
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
