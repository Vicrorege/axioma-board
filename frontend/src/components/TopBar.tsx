import React from 'react';
import type { TldrawApp } from '@tldraw/tldraw';
import {
  Sun,
  Moon,
  Lock,
  Check,
  RefreshCw,
  LayoutDashboard,
  LogIn,
} from 'lucide-react';
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
  onOpenDashboard?: () => void;
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
  onOpenDashboard,
  isDarkMode,
  onToggleDarkMode,
}) => {
  void app;
  void onLogout;
  void editor;

  return (
    <header className="absolute top-3 left-3 right-3 z-30 pointer-events-auto select-none">
      <div
        className={`flex items-center justify-between px-3.5 py-2 rounded-2xl border shadow-lg backdrop-blur-xl transition-colors ${
          isDarkMode
            ? 'bg-slate-900/90 border-slate-800/80 text-slate-100 shadow-black/20'
            : 'bg-white/95 border-slate-200/80 text-slate-800 shadow-slate-200/40'
        }`}
      >
        {/* Left: Brand & Workspace Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white font-serif font-bold text-sm shadow-xs shadow-blue-500/25">
              ∑
            </div>
            <span
              className="brand-title font-black text-sm tracking-tight select-none"
              style={{
                color: isDarkMode ? '#ffffff' : '#0f172a',
                WebkitTextFillColor: isDarkMode ? '#ffffff' : '#0f172a',
              }}
            >
              Axioma
            </span>
            {!currentUser && (
              <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30">
                Demo
              </span>
            )}
          </div>

          {currentUser && onOpenDashboard && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onOpenDashboard}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-300'
                  : 'bg-slate-100 border-slate-200 hover:bg-slate-200 text-slate-700'
              }`}
              title="Вернуться в дашборд"
            >
              <LayoutDashboard size={13} className="text-blue-500" />
              <span>Дашборд</span>
            </button>
          )}

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800" />

          <BoardSwitcher
            boards={boards}
            activeBoardId={activeBoardId}
            onSelectBoard={onSelectBoard}
            onCreateBoard={onCreateBoard}
            onDeleteBoard={onDeleteBoard}
            boardTitle={boardTitle}
            onUpdateTitle={onUpdateTitle}
            isDarkMode={isDarkMode}
          />
        </div>

        {/* Right: Save Status & Utilities */}
        <div className="flex items-center gap-2">
          {/* Save Status / Button */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onSave}
            disabled={isSaving}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer ${
              isSaved
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : isSaving
                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                : 'bg-slate-100/80 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border-slate-200/60 dark:border-slate-700/60 hover:bg-slate-200/70 dark:hover:bg-slate-700/70'
            }`}
          >
            {isSaving ? (
              <>
                <RefreshCw size={12} className="animate-spin text-blue-500" />
                <span>Сохранение</span>
              </>
            ) : isSaved ? (
              <>
                <Check size={12} className="text-emerald-500" />
                <span>Сохранено</span>
              </>
            ) : (
              <span>Сохранить</span>
            )}
          </button>

          <div className="h-4 w-[1px] bg-slate-200 dark:bg-slate-800 mx-0.5" />

          {/* Theme Toggle */}
          {onToggleDarkMode && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onToggleDarkMode}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center"
              title={isDarkMode ? 'Светлая тема' : 'Тёмная тема'}
            >
              {isDarkMode ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} />}
            </button>
          )}

          {/* Lock Canvas */}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onLock}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center"
            title="Заблокировать холст"
          >
            <Lock size={15} />
          </button>

          {/* Auth Button or User info */}
          {!currentUser ? (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-md shadow-blue-500/25 ml-1"
            >
              <LogIn size={13} />
              <span>Войти</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 pl-1.5 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50" />
              <span className="font-semibold text-slate-400 max-w-[100px] truncate">{currentUser.username}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
