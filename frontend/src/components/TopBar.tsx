import React, { useState } from 'react';
import type { Editor } from 'tldraw';
import { createShapeId } from 'tldraw';
import {
  Plus,
  BookOpen,
  Save,
  Check,
  Lock,
  LogOut,
  LogIn,
} from 'lucide-react';
import { BoardSwitcher } from './BoardSwitcher';
import type { User } from '../types/auth';

interface TopBarProps {
  editor: Editor | null;
  boardTitle: string;
  onUpdateTitle: (title: string) => void;
  onSave: () => void;
  isSaving: boolean;
  isSaved: boolean;
  onLock: () => void;
  boards: Array<{ id: string; title: string; created_at: string; updated_at: string }>;
  activeBoardId: string | null;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: () => void;
  onDeleteBoard: (boardId: string) => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}

const MATH_PRESETS = [
  { name: 'Квадратное уравнение', title: 'Квадратное', latex: 'x^2 - 5x + 6 = 0', color: '#3b82f6' },
  { name: 'Рациональное неравенство', title: 'Неравенство', latex: '\\frac{x^3 - x^2 + 6x - 6}{x^2 - 16} < 0', color: '#6366f1' },
  { name: 'Разность квадратов (ФСУ)', title: 'Разность квадратов', latex: 'x^2 - 9 = 0', color: '#10b981' },
  { name: 'Производная произведения', title: 'Производная', latex: 'f(x) = x^3 \\cdot \\sin(x)', color: '#ec4899' },
  { name: 'Определенный интеграл', title: 'Интеграл Гаусса', latex: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx', color: '#059669' },
  { name: 'Тригонометрическое тождество', title: 'Тригонометрия', latex: '\\sin^2(x) + \\cos^2(x)', color: '#f59e0b' },
  { name: 'Тождество Эйлера', title: 'Эйлер', latex: 'e^{i \\pi} + 1 = 0', color: '#8b5cf6' },
];

export const TopBar: React.FC<TopBarProps> = ({
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
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const addMathBlock = (preset?: { title: string; latex: string; color: string }) => {
    if (!editor) return;
    const center = editor.getViewportPageBounds().center;
    const id = createShapeId();

    editor.createShape({
      id,
      type: 'math-block' as any,
      x: center.x - 220,
      y: center.y - 180,
      props: {
        w: 440,
        h: 360,
        title: preset ? preset.title : 'Выражение',
        latex: preset ? preset.latex : '',
        resultLatex: '',
        comment: '',
        color: preset ? preset.color : '#3b82f6',
        isEditing: true,
        error: '',
      },
    });

    editor.select(id);
    setShowPresets(false);
  };

  return (
    <header className="absolute top-3 left-3 right-3 z-30 flex items-center justify-between px-4 py-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-lg border border-slate-200 pointer-events-auto">
      {/* Brand & Board Switcher */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
            ∑
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 tracking-tight text-sm">AxiomaBoard</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                SymPy Engine
              </span>
            </div>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* Board Switcher dropdown */}
        <BoardSwitcher
          boards={boards}
          activeBoardId={activeBoardId}
          boardTitle={boardTitle}
          onUpdateTitle={onUpdateTitle}
          onSelectBoard={onSelectBoard}
          onCreateBoard={onCreateBoard}
          onDeleteBoard={onDeleteBoard}
        />
      </div>

      {/* Center Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => addMathBlock()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-sm shadow-blue-600/20 cursor-pointer"
        >
          <Plus size={14} />
          <span>Формула</span>
        </button>

        {/* Presets dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowPresets(!showPresets)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
          >
            <span>Шаблоны</span>
            <span className="text-[10px]">▼</span>
          </button>

          {showPresets && (
            <div className="absolute top-full mt-1.5 left-0 w-52 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50">
              <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Быстрая вставка
              </div>
              {MATH_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => addMathBlock(p)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-blue-50 text-slate-700 flex items-center justify-between cursor-pointer"
                >
                  <span>{p.name}</span>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Tools & User Profile */}
      <div className="flex items-center gap-2">
        <a
          href="/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition cursor-pointer"
          title="OpenAPI / Swagger documentation"
        >
          <BookOpen size={13} />
          <span>Open API</span>
        </a>

        <button
          onClick={onSave}
          disabled={isSaving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
        >
          {isSaved ? <Check size={13} className="text-emerald-400" /> : <Save size={13} />}
          <span>{isSaving ? 'Сохранение...' : isSaved ? 'Сохранено' : 'Сохранить'}</span>
        </button>

        <div className="h-4 w-px bg-slate-200 mx-0.5" />

        {/* User Account Button */}
        {currentUser ? (
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 pl-2 pr-1.5 py-1 rounded-xl text-xs">
            <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
              {currentUser.username[0].toUpperCase()}
            </div>
            <span className="font-semibold text-slate-800 max-w-[90px] truncate">
              {currentUser.username}
            </span>
            <button
              onClick={onLogout}
              className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition cursor-pointer"
              title="Выйти из аккаунта"
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-semibold transition cursor-pointer"
          >
            <LogIn size={13} />
            <span>Войти</span>
          </button>
        )}

        <button
          onClick={onLock}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
          title="Заблокировать доступ (вернуть плейсхолдер)"
        >
          <Lock size={15} />
        </button>
      </div>
    </header>
  );
};
