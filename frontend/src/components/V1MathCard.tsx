import React, { useState, useEffect, useMemo } from 'react';
import type { SolutionMethod } from '../types/math';
import { MathRenderer } from './MathRenderer';
import { VisualMathEditor } from './VisualMathEditor';
import { mathApi } from '../services/api';

export interface V1MathCardProps {
  id: string;
  latex: string;
  resultLatex: string;
  title: string;
  comment: string;
  error?: string;
  methodsJson?: string;
  isDarkMode?: boolean;
  onUpdate: (props: Partial<V1MathCardProps>) => void;
  onBranchOut?: (steps: string[], resultLatex: string) => void;
  onDelete?: () => void;
}

export interface DynamicAction {
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

  if (s.includes('x^2') || s.includes('x^{2}') || s.includes('=')) {
    return [
      { id: 'solve', label: 'Решить уравнение', icon: '⚖️', operation: 'solve', tooltip: 'Найти корни уравнения' },
      { id: 'factor', label: 'Разложить на множители', icon: '🧩', operation: 'factor', tooltip: 'Разложить на множители' },
      { id: 'diff', label: 'Производная d/dx', icon: '📈', operation: 'diff', tooltip: 'Дифференцировать' },
      { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить' },
    ];
  }

  if (s.includes('\\int')) {
    return [
      { id: 'integrate', label: 'Вычислить интеграл', icon: '∫', operation: 'integrate', tooltip: 'Взять интеграл' },
      { id: 'by_parts', label: 'По частям', icon: '🔄', operation: 'ai_steps', tooltip: 'Интегрирование по частям' },
      { id: 'simplify', label: 'Упростить', icon: '🪄', operation: 'simplify', tooltip: 'Упростить подынтегральное' },
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

export const V1MathCard: React.FC<V1MathCardProps> = ({
  latex,
  resultLatex,
  title,
  comment,
  error,
  isDarkMode,
  onUpdate,
  onBranchOut,
  onDelete,
}) => {
  const [loadingOp, setLoadingOp] = useState<string | null>(null);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [isEditing, setIsEditing] = useState(!latex);
  const [solutionMethods, setSolutionMethods] = useState<SolutionMethod[]>([]);
  const [aiActions, setAiActions] = useState<DynamicAction[] | null>(null);

  const instantActions = useMemo(() => getInitialActions(latex), [latex]);
  const actions = aiActions && aiActions.length > 0 ? aiActions : instantActions;

  // Debounced AI action suggestions
  useEffect(() => {
    if (!latex || !latex.trim()) {
      setAiActions(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await mathApi.getSuggestedActions(latex);
        if (res && res.actions && res.actions.length > 0) {
          setAiActions(res.actions);
        }
      } catch {
        // fallback to heuristics
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [latex]);

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

  return (
    <div
      className={`rounded-2xl border shadow-lg backdrop-blur-sm p-4 text-slate-800 transition-colors flex flex-col gap-3 select-none ${
        isDarkMode
          ? 'bg-slate-900/95 border-slate-700/80 text-slate-100 shadow-black/40'
          : 'bg-white/95 border-slate-200/90 text-slate-900 shadow-slate-200/60'
      }`}
      style={{ minWidth: 380, maxWidth: 460 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-2 border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title || 'Выражение'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition"
            title={isEditing ? 'Готово' : 'Редактировать'}
          >
            {isEditing ? <span className="text-xs font-semibold text-blue-500">Готово</span> : <span className="text-xs">✏️</span>}
          </button>
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 transition"
              title="Удалить карточку"
            >
              <span className="text-xs">🗑️</span>
            </button>
          )}
        </div>
      </div>

      {/* Expression Area */}
      <div className="flex flex-col gap-1.5">
        {isEditing ? (
          <VisualMathEditor
            value={latex}
            onChange={(val) => onUpdate({ latex: val })}
            onEnter={() => setIsEditing(false)}
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 hover:border-blue-400 cursor-pointer transition min-h-[50px] flex items-center justify-center bg-slate-50/50 dark:bg-slate-950/40"
          >
            <MathRenderer latex={latex} />
          </div>
        )}
      </div>

      {/* Dynamic Action Buttons */}
      {latex && latex.trim().length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {actions.map((act) => (
            <button
              key={act.id}
              onClick={() => handleOp(act.operation)}
              disabled={loadingOp !== null}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition cursor-pointer ${
                loadingOp === act.operation
                  ? 'bg-blue-50 border-blue-400 text-blue-600 animate-pulse dark:bg-blue-950/40 dark:border-blue-500'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 text-slate-700 dark:text-slate-200 hover:text-blue-600 shadow-sm'
              }`}
            >
              {renderActionIcon(act.icon, act.operation)}
              <span>{act.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Result Display */}
      {resultLatex && (
        <div className="mt-1 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
            <span>Результат:</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReport}
                disabled={isReporting}
                className="text-[10px] text-slate-400 hover:text-red-500 underline transition"
              >
                {reportSuccess ? 'Отправлено ✓' : 'Пожаловаться'}
              </button>
              {solutionMethods.length > 0 && onBranchOut && (
                <button
                  onClick={() => onBranchOut(solutionMethods[0].steps, resultLatex)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-medium transition cursor-pointer shadow-sm"
                >
                  <span>По шагам</span>
                  <span>➔</span>
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto py-1">
            <MathRenderer latex={resultLatex} />
          </div>
        </div>
      )}

      {/* Explanation Comment */}
      {comment && (
        <div className="text-xs text-slate-600 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800">
          {comment}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg border border-red-200 dark:border-red-900/50">
          {error}
        </div>
      )}
    </div>
  );
};
