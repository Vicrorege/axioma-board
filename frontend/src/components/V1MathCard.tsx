import React, { useState, useEffect, useMemo } from 'react';
import {
  Check,
  Edit3,
  Trash2,
  Scale,
  TrendingUp,
  Wand2,
  Grid,
  BarChart2,
  AlertCircle,
  Zap,
  Sparkles,
  Flag,
  ListOrdered,
  ArrowRight,
} from 'lucide-react';
import type { SolutionMethod, MathCardType, CustomCardOptions } from '../types/math';
import { MathRenderer, FormattedStepText } from './MathRenderer';
import { VisualMathEditor } from './VisualMathEditor';
import { NumberLineChart } from './NumberLineChart';
import { StepExplanationModal } from './StepExplanationModal';
import type { StepExplanationData } from './StepExplanationModal';
import { mathApi } from '../services/api';

export interface V1MathCardProps {
  id: string;
  latex: string;
  resultLatex: string;
  title: string;
  comment: string;
  cardType?: MathCardType;
  customOptions?: CustomCardOptions;
  color?: string;
  error?: string;
  methodsJson?: string;
  isDarkMode?: boolean;
  isStepCard?: boolean;
  onUpdate: (props: Partial<V1MathCardProps>) => void;
  onBranchOut?: (method: any, resultLatex: string) => void;
  onDelete?: () => void;
}

export interface DynamicAction {
  id: string;
  label: string;
  icon: string;
  operation: string;
  tooltip?: string;
}

const renderActionIcon = (op: string) => {
  const s = op.toLowerCase();
  if (s.includes('solve') || s.includes('calc') || s.includes('equal')) return <Scale size={13} className="text-blue-500" />;
  if (s.includes('diff') || s.includes('deriv') || s.includes('trend')) return <TrendingUp size={13} className="text-indigo-500" />;
  if (s.includes('integ')) return <span className="font-serif italic font-bold text-xs text-amber-500">∫</span>;
  if (s.includes('factor') || s.includes('grid')) return <Grid size={13} className="text-purple-500" />;
  if (s.includes('interval') || s.includes('timeline')) return <BarChart2 size={13} className="text-emerald-500" />;
  if (s.includes('domain') || s.includes('warn')) return <AlertCircle size={13} className="text-rose-500" />;
  if (s.includes('simp') || s.includes('magic')) return <Wand2 size={13} className="text-pink-500" />;
  if (s.includes('eval') || s.includes('bolt') || s.includes('flash')) return <Zap size={13} className="text-amber-500" />;
  return <Sparkles size={13} className="text-blue-500" />;
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
      { id: 'solve', label: 'Решить неравенство', icon: 'solve', operation: 'solve', tooltip: 'Найти интервалы решений' },
      { id: 'intervals', label: 'Метод интервалов', icon: 'intervals', operation: 'ai_steps', tooltip: 'Пошаговый разбор метода интервалов' },
      { id: 'domain', label: 'ОДЗ', icon: 'domain', operation: 'domain', tooltip: 'Область допустимых значений' },
      { id: 'factor', label: 'Разложить на множители', icon: 'factor', operation: 'factor', tooltip: 'Разложить числитель и знаменатель' },
      { id: 'simplify', label: 'Упростить', icon: 'simplify', operation: 'simplify', tooltip: 'Упростить выражение' },
    ];
  }

  if (s.includes('x^2') || s.includes('x^{2}') || s.includes('=')) {
    return [
      { id: 'solve', label: 'Решить уравнение', icon: 'solve', operation: 'solve', tooltip: 'Найти корни уравнения' },
      { id: 'factor', label: 'Разложить на множители', icon: 'factor', operation: 'factor', tooltip: 'Разложить на множители' },
      { id: 'diff', label: 'Производная d/dx', icon: 'diff', operation: 'diff', tooltip: 'Дифференцировать' },
      { id: 'simplify', label: 'Упростить', icon: 'simplify', operation: 'simplify', tooltip: 'Упростить' },
    ];
  }

  if (s.includes('\\int')) {
    return [
      { id: 'integrate', label: 'Вычислить интеграл', icon: 'integrate', operation: 'integrate', tooltip: 'Взять интеграл' },
      { id: 'by_parts', label: 'По частям', icon: 'intervals', operation: 'ai_steps', tooltip: 'Интегрирование по частям' },
      { id: 'simplify', label: 'Упростить', icon: 'simplify', operation: 'simplify', tooltip: 'Упростить подынтегральное' },
    ];
  }

  return [
    { id: 'eval', label: 'Расчет', icon: 'eval', operation: 'eval', tooltip: 'Численный или аналитический расчет' },
    { id: 'simplify', label: 'Упростить', icon: 'simplify', operation: 'simplify', tooltip: 'Упростить выражение' },
    { id: 'factor', label: 'Разложить', icon: 'factor', operation: 'factor', tooltip: 'Разложить на множители' },
    { id: 'diff', label: 'Производная d/dx', icon: 'diff', operation: 'diff', tooltip: 'Взять производную' },
    { id: 'integrate', label: 'Интеграл ∫ dx', icon: 'integrate', operation: 'integrate', tooltip: 'Взять интеграл' },
  ];
}

export const V1MathCard: React.FC<V1MathCardProps> = ({
  latex,
  resultLatex,
  title,
  comment,
  cardType = 'full',
  customOptions,
  error,
  isDarkMode,
  onUpdate,
  onBranchOut,
  onDelete,
}) => {
  const [loadingOp, setLoadingOp] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [solutionMethods, setSolutionMethods] = useState<SolutionMethod[]>([]);
  const [aiActions, setAiActions] = useState<DynamicAction[] | null>(null);
  const [detectedType, setDetectedType] = useState<string | null>(null);

  const instantActions = useMemo(() => getInitialActions(latex), [latex]);
  const actions = aiActions && aiActions.length > 0 ? aiActions : instantActions;

  // Snappy AI action suggestions via ultra-fast model (only on full cards)
  useEffect(() => {
    if (cardType !== 'full' || !latex || !latex.trim()) {
      setAiActions(null);
      setDetectedType(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await mathApi.getSuggestedActions(latex);
        if (res) {
          if (res.actions && res.actions.length > 0) {
            setAiActions(res.actions);
          }
          if (res.expression_type && res.expression_type !== 'general' && res.expression_type !== 'detected') {
            setDetectedType(res.expression_type);
          }
        }
      } catch {}
    }, 250);
    return () => clearTimeout(timer);
  }, [latex, cardType]);

  const handleOp = async (op: string) => {
    setLoadingOp(op);
    setReportSuccess(false);
    onUpdate({ error: '' });
    setSolutionMethods([]);

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
      } else if (op === 'solve' || op === 'solve_ineq' || op === 'solve_eq' || op === 'ai_steps' || op === 'intervals') {
        res = await mathApi.solve(latex, 'x');
      } else if (op === 'factor') {
        res = await mathApi.factor(latex);
      } else if (op === 'domain') {
        res = await mathApi.domain(latex, 'x');
      }

      if (res && res.success) {
        const rLatex = res.result_latex || res.result_str || '';
        onUpdate({
          resultLatex: rLatex,
          error: '',
        });
        if (res.methods && res.methods.length > 0) {
          setSolutionMethods(res.methods);
        } else if (res.steps && res.steps.length > 0) {
          setSolutionMethods([{ name: 'Ход решения', steps: res.steps, final_answer: rLatex }]);
        }
      } else {
        onUpdate({ error: res?.error || 'Computation failed' });
      }
    } catch (err: any) {
      onUpdate({ error: err.response?.data?.detail || err.message || 'API request error' });
    } finally {
      setLoadingOp(null);
    }
  };

  const handleReport = async () => {
    if (!latex || isReporting) return;
    setIsReporting(true);
    try {
      await mathApi.reportSolution(latex, 'solve', 'Пользователь отправил решение на пересмотр');
      setReportSuccess(true);
      setTimeout(() => handleOp('solve'), 700);
    } catch (e) {
      console.warn('Could not report solution', e);
    } finally {
      setIsReporting(false);
    }
  };

  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationData, setExplanationData] = useState<StepExplanationData | null>(null);
  const [isExplanationModalOpen, setIsExplanationModalOpen] = useState(false);

  const handleExplainStep = async () => {
    if (isExplaining) return;
    setIsExplaining(true);
    try {
      const data = await mathApi.explainStep(latex, title, comment);
      if (data) {
        setExplanationData(data);
        setIsExplanationModalOpen(true);
        if (data.summary && (!comment || !comment.includes(data.summary))) {
          onUpdate({
            comment: comment ? `${comment}\n\n💡 ${data.summary}` : `💡 ${data.summary}`,
          });
        }
      }
    } catch (err) {
      console.warn('Explain step error:', err);
    } finally {
      setIsExplaining(false);
    }
  };

  // 4. FORMULA CARD: Pure formula input & display without computation engine or header
  if (cardType === 'formula') {
    return (
      <div
        data-math-card="true"
        className="w-full rounded-2xl border shadow-lg backdrop-blur-md p-3 transition-colors flex flex-col gap-2 select-none cursor-grab active:cursor-grabbing overscroll-contain"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
          borderColor: isDarkMode ? '#334155' : '#e2e8f0',
          color: isDarkMode ? '#f8fafc' : '#0f172a',
        }}
      >
        <div
          className="flex items-center justify-between pb-1 cursor-grab active:cursor-grabbing border-b"
          style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-xs" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Формула</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(!isEditing);
              }}
              className="px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer text-slate-400 hover:text-blue-500"
            >
              {isEditing ? 'Готово' : 'Изменить'}
            </button>
            {onDelete && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1 rounded text-slate-400 hover:text-red-500 transition cursor-pointer"
                title="Удалить"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col">
          {isEditing ? (
            <VisualMathEditor
              value={latex}
              isDarkMode={isDarkMode}
              onChange={(val) => onUpdate({ latex: val })}
              onEnter={() => setIsEditing(false)}
            />
          ) : (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="p-3 rounded-xl border border-dashed hover:border-blue-400 cursor-pointer transition min-h-[50px] flex items-center justify-center overflow-x-auto max-w-full overscroll-contain"
              style={{
                backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc',
                borderColor: isDarkMode ? '#1e293b' : '#cbd5e1',
                color: isDarkMode ? '#f8fafc' : '#0f172a',
              }}
            >
              <MathRenderer latex={latex || 'x'} isDarkMode={isDarkMode} fontSize="1.35rem" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Determine styling based on card type:
  // 3. ANSWER CARD: green theme, no action buttons
  const isAnswer = cardType === 'answer';
  // 2. EXPLANATION CARD: intermediate step with only "Пояснить шаг"
  const isExplanation = cardType === 'explanation';
  // 5. CUSTOM CARD: arbitrary options
  const isCustom = cardType === 'custom';

  const cardBorderColor = isAnswer
    ? (isDarkMode ? '#059669' : '#10b981')
    : isCustom && customOptions?.color
    ? customOptions.color
    : (isDarkMode ? '#334155' : '#e2e8f0');

  const cardDotColor = isAnswer ? 'bg-emerald-500 shadow-emerald-500/50' : 'bg-blue-500 shadow-blue-500/50';

  return (
    <div
      data-math-card="true"
      className="w-full rounded-2xl border shadow-xl backdrop-blur-md p-4 transition-colors flex flex-col gap-3 select-none cursor-grab active:cursor-grabbing overscroll-contain"
      style={{
        width: '100%',
        boxSizing: 'border-box',
        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
        borderColor: cardBorderColor,
        color: isDarkMode ? '#f8fafc' : '#0f172a',
        overscrollBehavior: 'contain',
      }}
    >
      {/* Header / Drag Handle */}
      {(!isCustom || !customOptions?.hideHeader) && (
        <div
          className="flex items-center justify-between border-b pb-2 cursor-grab active:cursor-grabbing"
          style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}
        >
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${cardDotColor} shadow-xs`} />
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: isAnswer ? '#10b981' : isDarkMode ? '#94a3b8' : '#64748b' }}
            >
              {isCustom ? (customOptions?.title || title || 'Кастомная карточка') : isAnswer ? (title || 'ОТВЕТ') : (title || 'Выражение')}
            </span>
            {isAnswer ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400">
                ОТВЕТ
              </span>
            ) : isCustom && customOptions?.badge ? (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-purple-500/15 border-purple-500 text-purple-600 dark:text-purple-400">
                {customOptions.badge}
              </span>
            ) : !isExplanation && detectedType ? (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.45)' : '#eff6ff',
                  borderColor: isDarkMode ? '#1e40af' : '#bfdbfe',
                  color: isDarkMode ? '#93c5fd' : '#1d4ed8',
                }}
              >
                {detectedType}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                const nextState = !isEditing;
                setIsEditing(nextState);
                onUpdate({ isEditing: nextState } as any);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg transition cursor-pointer"
              style={{
                backgroundColor: isEditing
                  ? (isDarkMode ? '#1e3a8a' : '#dbeafe')
                  : (isDarkMode ? '#1e293b' : '#f1f5f9'),
                color: isEditing
                  ? (isDarkMode ? '#93c5fd' : '#1d4ed8')
                  : (isDarkMode ? '#94a3b8' : '#64748b'),
              }}
              title={isEditing ? 'Готово' : 'Редактировать'}
            >
              {isEditing ? (
                <>
                  <Check size={13} className="text-blue-500" />
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Готово</span>
                </>
              ) : (
                <Edit3 size={13} />
              )}
            </button>
            {onDelete && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="p-1.5 rounded-lg transition cursor-pointer hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500"
                title="Удалить карточку"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Expression Area - Only render if formula exists, or user is editing, or no explanation exists */}
      {(Boolean(latex && latex.trim()) || isEditing || !comment) && (
        <div className="flex flex-col gap-1.5">
          {isEditing ? (
            <VisualMathEditor
              value={latex}
              isDarkMode={isDarkMode}
              onChange={(val) => onUpdate({ latex: val })}
              onEnter={() => setIsEditing(false)}
            />
          ) : (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              className="p-3 rounded-xl border border-dashed hover:border-blue-400 cursor-pointer transition min-h-[54px] flex items-center justify-center overflow-x-auto max-w-full overscroll-contain"
              style={{
                backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc',
                borderColor: isAnswer ? (isDarkMode ? '#065f46' : '#a7f3d0') : isDarkMode ? '#1e293b' : '#cbd5e1',
                color: isAnswer ? (isDarkMode ? '#34d399' : '#059669') : isDarkMode ? '#f8fafc' : '#0f172a',
              }}
            >
              <MathRenderer latex={latex} isDarkMode={isDarkMode} fontSize="1.3rem" />
            </div>
          )}
        </div>
      )}

      {/* Real Visual Number Line for Method of Intervals */}
      {latex && (latex.includes('[-]') || latex.includes('[+]')) && (
        <NumberLineChart latex={latex} isDarkMode={isDarkMode} />
      )}

      {/* Buttons Area:
          - ANSWER CARD (3): COMPLETELY CUT ALL BUTTONS
          - EXPLANATION CARD (2): ONLY KEEP "Пояснить шаг"
          - CUSTOM CARD (5): RENDER CUSTOM BUTTONS IF PROVIDED
          - FULL CARD (1): RENDER FULL DYNAMIC ACTIONS
      */}
      {isExplanation ? (
        <div className="flex items-center gap-1.5 pt-1">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleExplainStep();
            }}
            disabled={isExplaining}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition cursor-pointer shadow-xs hover:border-blue-400"
            style={{
              backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
              borderColor: isDarkMode ? '#334155' : '#cbd5e1',
              color: isDarkMode ? '#93c5fd' : '#1d4ed8',
            }}
          >
            <Sparkles size={13} className="text-blue-500" />
            <span>{isExplaining ? 'Анализируем...' : 'Пояснить шаг'}</span>
          </button>
        </div>
      ) : isCustom && customOptions?.buttons ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {customOptions.buttons.map((btn: any) => (
            <button
              key={btn.id}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (btn.onClick) btn.onClick();
                else if (btn.action) handleOp(btn.action);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition cursor-pointer shadow-xs"
              style={{
                backgroundColor: isDarkMode ? '#1e293b' : '#ffffff',
                borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                color: isDarkMode ? '#f1f5f9' : '#334155',
              }}
            >
              <Sparkles size={13} className="text-purple-500" />
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      ) : !isAnswer && latex && latex.trim().length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {actions.map((act) => (
            <button
              key={act.id}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                handleOp(act.operation);
              }}
              disabled={loadingOp !== null}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition cursor-pointer shadow-xs"
              style={{
                backgroundColor: loadingOp === act.operation
                  ? (isDarkMode ? '#1e3a8a' : '#dbeafe')
                  : (isDarkMode ? '#1e293b' : '#ffffff'),
                borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                color: isDarkMode ? '#f1f5f9' : '#334155',
              }}
            >
              {renderActionIcon(act.operation)}
              <span>{act.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Result Display */}
      {resultLatex && (
        <div
          className="mt-1 p-3 rounded-xl border flex flex-col gap-2 transition-colors"
          style={{
            backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.25)' : '#eff6ff',
            borderColor: isDarkMode ? 'rgba(30, 58, 138, 0.5)' : '#bfdbfe',
          }}
        >
          <div className="flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
            <span>Результат:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleReport();
                }}
                disabled={isReporting}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-500 transition cursor-pointer"
              >
                <Flag size={11} />
                <span>{reportSuccess ? 'Отправлено ✓' : 'Пожаловаться'}</span>
              </button>
              {solutionMethods.length > 0 && onBranchOut && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onBranchOut(solutionMethods[0], resultLatex);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold transition cursor-pointer shadow-sm"
                >
                  <ListOrdered size={12} />
                  <span>По шагам</span>
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto py-1 max-w-full overscroll-contain">
            <MathRenderer latex={resultLatex} isDarkMode={isDarkMode} fontSize="1.3rem" />
          </div>
        </div>
      )}

      {/* Explanation Comment */}
      {comment && (
        <div
          className="text-xs p-2.5 rounded-xl border leading-relaxed font-sans"
          style={{
            backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
            borderColor: isDarkMode ? '#1e293b' : '#f1f5f9',
            color: isDarkMode ? '#94a3b8' : '#64748b',
          }}
        >
          <div className="font-semibold text-[10px] mb-1 opacity-75 uppercase tracking-wider text-blue-500">
            Пояснение
          </div>
          <FormattedStepText text={comment} isDarkMode={isDarkMode} />
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-200 dark:border-red-900/50 flex items-center gap-1.5">
          <AlertCircle size={13} />
          <span>{error}</span>
        </div>
      )}

      {/* Rich Step Explanation Modal with Human-Readable KaTeX Formulas */}
      <StepExplanationModal
        isOpen={isExplanationModalOpen}
        onClose={() => setIsExplanationModalOpen(false)}
        data={explanationData}
        isDarkMode={isDarkMode}
      />
    </div>
  );
};
