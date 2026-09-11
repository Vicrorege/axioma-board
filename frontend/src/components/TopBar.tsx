import React, { useState } from 'react';
import type { TldrawApp } from '@tldraw/tldraw';
import { TDShapeType } from '@tldraw/tldraw';
import { BoardSwitcher } from './BoardSwitcher';
import type { User } from '../types/auth';

interface TopBarProps {
  app?: TldrawApp | null;
  editor?: any;
  boardTitle: string;
  onUpdateTitle: (title: string) => void;
  onSave: () => void;
  isSaving: boolean;
  isSaved: boolean;
  onLock: () => void;
  boards: Array<{ id: string; title: string; created_at: string; updated_at: string }>;
  activeBoardId: string | null;
  onSelectBoard: (id: string) => void;
  onCreateBoard: () => void;
  onDeleteBoard: (id: string) => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  app,
  editor,
  boardTitle,
  onUpdateTitle,
  onSave,
  isSaving,
  isSaved,
  onLock,
  boards,
  activeBoardId,
  onSelectBoard,
  onCreateBoard,
  onDeleteBoard,
  currentUser,
  onOpenAuth,
  onLogout,
  isDarkMode,
  onToggleDarkMode,
}) => {
  void currentUser;
  void onOpenAuth;
  void onLogout;
  void editor;
  const [showPresets, setShowPresets] = useState(false);

  const addMathBlock = (preset?: { title: string; latex: string; color: string }) => {
    if (!app) return;
    const center = app.centerPoint;
    const id = 'math_' + Math.random().toString(36).slice(2, 9);

    app.createShapes({
      id,
      type: TDShapeType.Rectangle,
      point: [center[0] - 220, center[1] - 180],
      size: [440, 360],
      title: preset ? preset.title : 'Выражение',
      latex: preset ? preset.latex : '',
      resultLatex: '',
      comment: '',
      color: preset ? preset.color : '#3b82f6',
      error: '',
    } as any);

    app.select(id);
    setShowPresets(false);
  };

  return (
    <header className={`absolute top-3 left-3 right-3 z-30 flex items-center justify-between px-4 py-2 backdrop-blur-md rounded-2xl shadow-lg border pointer-events-auto transition-colors ${
      isDarkMode
        ? 'bg-slate-900/90 border-slate-800 text-slate-100'
        : 'bg-white/95 border-slate-200 text-slate-800'
    }`}>
      {/* Brand & Board Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
            ∑
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-sm tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent dark:from-blue-400 dark:to-indigo-300">
                Axioma
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                MIT Core
              </span>
            </div>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-700" />

        <BoardSwitcher
          boards={boards}
          activeBoardId={activeBoardId}
          onSelectBoard={onSelectBoard}
          onCreateBoard={onCreateBoard}
          onDeleteBoard={onDeleteBoard}
          boardTitle={boardTitle}
          onUpdateTitle={onUpdateTitle}
        />
      </div>

      {/* Center Actions */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => addMathBlock()}
            className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-xl shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition cursor-pointer"
          >
            <span>+ Формула</span>
          </button>
        </div>

        {/* Math Presets Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 transition cursor-pointer"
          >
            <span>Примеры</span>
            <span className="text-[10px]">▼</span>
          </button>

          {showPresets && (
            <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-2 z-50 flex flex-col gap-1">
              <div className="px-2 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Готовые формулы
              </div>
              <button
                onClick={() => addMathBlock({ title: 'Квадратное уравнение', latex: '2x^2 + 5x - 3 = 0', color: '#3b82f6' })}
                className="text-left px-2.5 py-1.5 text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
              >
                2x² + 5x - 3 = 0
              </button>
              <button
                onClick={() => addMathBlock({ title: 'Метод интервалов', latex: '\\frac{x^3 - x^2 + 6x - 6}{x^2 - 16} < 0', color: '#8b5cf6' })}
                className="text-left px-2.5 py-1.5 text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
              >
                (x³ - x² + 6x - 6)/(x² - 16) &lt; 0
              </button>
              <button
                onClick={() => addMathBlock({ title: 'Разность квадратов', latex: 'x^2 - 4 = 0', color: '#10b981' })}
                className="text-left px-2.5 py-1.5 text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
              >
                x² - 4 = 0
              </button>
              <button
                onClick={() => addMathBlock({ title: 'Производная произведения', latex: 'f(x) = x^3 \\sin(x)', color: '#ec4899' })}
                className="text-left px-2.5 py-1.5 text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
              >
                f(x) = x³ sin(x)
              </button>
              <button
                onClick={() => addMathBlock({ title: 'Интеграл Гаусса', latex: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}', color: '#f59e0b' })}
                className="text-left px-2.5 py-1.5 text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
              >
                ∫ e^(-x²) dx = √π
              </button>
              <button
                onClick={() => addMathBlock({ title: 'Тождество Эйлера', latex: 'e^{i\\pi} + 1 = 0', color: '#06b6d4' })}
                className="text-left px-2.5 py-1.5 text-xs rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
              >
                e^(iπ) + 1 = 0
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Tools */}
      <div className="flex items-center gap-2">
        {onToggleDarkMode && (
          <button
            onClick={onToggleDarkMode}
            className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            title={isDarkMode ? 'Светлая тема' : 'Тёмная тема'}
          >
            {isDarkMode ? '☀️' : '🌙'}
          </button>
        )}

        <button
          onClick={onSave}
          disabled={isSaving}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer ${
            isSaved
              ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <span>{isSaving ? 'Сохранение...' : isSaved ? 'Сохранено ✓' : 'Сохранить'}</span>
        </button>

        <button
          onClick={onLock}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          title="Заблокировать доску"
        >
          🔒
        </button>
      </div>
    </header>
  );
};
