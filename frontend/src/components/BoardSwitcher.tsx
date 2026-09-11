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
}

export const BoardSwitcher: React.FC<BoardSwitcherProps> = ({
  boards,
  activeBoardId,
  boardTitle,
  onUpdateTitle,
  onSelectBoard,
  onCreateBoard,
  onDeleteBoard,
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
      <div className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200/80 rounded-xl px-2.5 py-1 transition">
        <input
          type="text"
          value={boardTitle}
          onChange={(e) => onUpdateTitle(e.target.value)}
          className="text-xs font-semibold text-slate-800 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 focus:outline-none w-36 truncate"
          title="Нажмите для переименования"
        />
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-0.5 text-slate-500 hover:text-slate-800 rounded transition cursor-pointer"
          title="Список досок"
        >
          <ChevronDown size={14} className={isOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full mt-2 left-0 w-64 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3.5 py-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
            <span>Мои доски ({boards.length})</span>
            <button
              onClick={() => {
                onCreateBoard();
                setIsOpen(false);
              }}
              className="p-1 hover:bg-blue-50 text-blue-600 rounded-lg flex items-center gap-1 text-[11px] font-semibold transition cursor-pointer"
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
                    isActive ? 'bg-blue-50/80 text-blue-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                  }`}
                  onClick={() => {
                    onSelectBoard(b.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-center gap-2 truncate mr-2">
                    <Layout size={13} className={isActive ? 'text-blue-600' : 'text-slate-400'} />
                    <span className="truncate">{b.title || 'Untitled Board'}</span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isActive && <Check size={13} className="text-blue-600" />}
                    {boards.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Удалить доску "${b.title}"?`)) {
                            onDeleteBoard(b.id);
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded transition"
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
