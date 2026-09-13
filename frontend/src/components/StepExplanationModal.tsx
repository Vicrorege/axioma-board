import React from 'react';
import { Sparkles, BookOpen, Check, X } from 'lucide-react';
import { FormattedStepText, MathRenderer } from './MathRenderer';

export interface StepExplanationData {
  title: string;
  rule_name: string;
  summary: string;
  explanation_points: string[];
  formatted_explanation?: string;
  latex_formula?: string;
}

interface StepExplanationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: StepExplanationData | null;
  isDarkMode?: boolean;
}

export const StepExplanationModal: React.FC<StepExplanationModalProps> = ({
  isOpen,
  onClose,
  data,
  isDarkMode = false,
}) => {
  if (!isOpen || !data) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-3xl border shadow-2xl p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 transition-colors ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800 text-slate-100 shadow-black/60'
            : 'bg-white border-slate-100 text-slate-800 shadow-slate-300/40'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-500 flex items-center justify-center">
              <Sparkles size={18} />
            </div>
            <div className="flex flex-col">
              <h3 className="font-bold text-sm leading-tight text-white">{data.title}</h3>
              <span className="text-[11px] font-semibold text-blue-500 flex items-center gap-1">
                <BookOpen size={11} />
                <span>{data.rule_name}</span>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Formula Box if available */}
        {data.latex_formula && (
          <div
            className="p-3 rounded-2xl border flex items-center justify-center overflow-x-auto max-w-full"
            style={{
              backgroundColor: isDarkMode ? '#0b0f19' : '#f8fafc',
              borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
            }}
          >
            <MathRenderer latex={data.latex_formula} isDarkMode={isDarkMode} fontSize="1.3rem" />
          </div>
        )}

        {/* Summary */}
        {data.summary && (
          <div
            className="p-3.5 rounded-2xl border text-xs leading-relaxed"
            style={{
              backgroundColor: isDarkMode ? 'rgba(30, 58, 138, 0.2)' : '#eff6ff',
              borderColor: isDarkMode ? 'rgba(30, 58, 138, 0.4)' : '#bfdbfe',
              color: isDarkMode ? '#bfdbfe' : '#1e3a8a',
            }}
          >
            <div className="font-bold text-[10px] uppercase tracking-wider text-blue-500 mb-1">
              Суть преобразования
            </div>
            <FormattedStepText text={data.summary} isDarkMode={isDarkMode} />
          </div>
        )}

        {/* Detailed Points */}
        {data.explanation_points && data.explanation_points.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
              Пошаговый разбор и правила
            </div>
            <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
              {data.explanation_points.map((point, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-2.5 rounded-xl border text-xs leading-relaxed"
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : '#fafafa',
                    borderColor: isDarkMode ? '#1e293b' : '#f1f5f9',
                  }}
                >
                  <span className="w-5 h-5 rounded-full bg-blue-500/15 text-blue-500 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <FormattedStepText text={point} isDarkMode={isDarkMode} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div
          className="pt-3 border-t flex items-center justify-between text-xs"
          style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}
        >
          <span className="text-[11px] text-slate-400">Axioma &middot; Математический движок</span>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition cursor-pointer shadow-md shadow-blue-500/25"
          >
            <Check size={14} />
            <span>Понятно</span>
          </button>
        </div>
      </div>
    </div>
  );
};
