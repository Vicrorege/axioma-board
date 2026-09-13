import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Trash2, Layout, Check } from 'lucide-react';

interface BoardSwitcherProps {
  boards: Array<{ id: string; title: string; created_at: string; updated_at: string }>;
  activeBoardId: string | null;
  boardTitle: string;
  onUpdateTitle: (title: string) => void;
  onSelectBoard: (boardId: string) => void;
  onCreateBoard: () => void;
  onDeleteBoard: (boardId: string) => void;
  isDarkMode?: boolean;
}

export const BoardSwitcher: React.FC<BoardSwitcherProps> = ({
  boards,
  activeBoardId,
  boardTitle,
  onUpdateTitle,
  onSelectBoard,
  onCreateBoard,
  onDeleteBoard,
  isDarkMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative flex items-center" ref={dropdownRef}>
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all shadow-2xs"
        style={{
          backgroundColor: isDarkMode ? '#1e293b' : '#f1f5f9',
          borderColor: isDarkMode ? '#334155' : '#cbd5e1',
        }}
      >
        <Layout
          size={14}
          style={{ color: isDarkMode ? '#60a5fa' : '#2563eb' }}
          className="shrink-0"
        />
        <input
          type="text"
          value={boardTitle}
          onChange={(e) => onUpdateTitle(e.target.value)}
          className="board-title-input text-sm font-bold tracking-tight bg-transparent border-b border-transparent hover:border-slate-400 focus:border-blue-500 focus:outline-none min-w-[150px] max-w-[260px] truncate transition-colors"
          style={{
            color: isDarkMode ? '#ffffff' : '#0f172a',
          }}
          title="Нажмите для переименования доски"
        />
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setIsOpen(!isOpen)}
          className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
          title="Список досок"
        >
          <ChevronDown
            size={14}
            style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}
            className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {isOpen && (
        <div
          className="absolute top-full mt-2 left-0 w-72 rounded-2xl shadow-2xl border py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
          style={{
            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
            borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
          }}
        >
          <div className="px-3.5 py-1.5 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 mb-1">
            <span>Мои доски ({boards.length})</span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                onCreateBoard();
                setIsOpen(false);
              }}
              className="px-2 py-0.5 hover:bg-blue-50 dark:hover:bg-blue-950/60 text-blue-600 dark:text-blue-400 rounded-lg flex items-center gap-1 text-[11px] font-semibold transition cursor-pointer"
              title="Создать новую доску"
            >
              <Plus size={12} />
              <span>Создать</span>
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto py-1">
            {boards.map((b) => {
              const isActive = b.id === activeBoardId;
              return (
                <div
                  key={b.id}
                  className={`group flex items-center justify-between px-3.5 py-2 text-xs transition cursor-pointer ${
                    isActive
                      ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                  }`}
                  onClick={() => {
                    onSelectBoard(b.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 truncate mr-2">
                    <Layout size={13} className={isActive ? 'text-blue-500' : 'text-slate-400'} />
                    <span className="truncate">{b.title || 'Untitled Board'}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isActive && <Check size={13} className="text-blue-500" />}
                    {boards.length > 1 && (
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Удалить доску "${b.title}"?`)) {
                            onDeleteBoard(b.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 dark:hover:bg-red-950/50 text-slate-400 hover:text-red-500 rounded transition"
                        title="Удалить доску"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
