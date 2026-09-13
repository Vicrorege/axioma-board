import React, { useState } from 'react';
import {
  Plus,
  LayoutDashboard,
  LogOut,
  FolderPlus,
  Search,
  Calendar,
  Edit2,
  Trash2,
  CheckCircle2,
  Moon,
  Sun,
  Settings,
  Sparkles,
  Command,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import type { User } from '../types/auth';

export interface UserDashboardProps {
  user: User;
  boards: any[];
  activeBoardId: string | null;
  onOpenBoard: (boardId: string) => void;
  onCreateBoard: (title?: string) => Promise<any>;
  onDeleteBoard: (boardId: string) => Promise<void>;
  onRenameBoard: (boardId: string, newTitle: string) => Promise<void>;
  onOpenDemoBoard: () => void;
  onLogout: () => void;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  user,
  boards,
  activeBoardId: _activeBoardId,
  onOpenBoard,
  onCreateBoard,
  onDeleteBoard,
  onRenameBoard,
  onOpenDemoBoard,
  onLogout,
  isDarkMode,
  onToggleDarkMode,
}) => {
  const [activeTab, setActiveTab] = useState<'boards' | 'settings' | 'shortcuts'>('boards');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [editingBoardId, setEditingBoardId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const filteredBoards = boards.filter((b) =>
    (b.title || '').toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newBoardTitle.trim() || 'Новая доска';
    setIsCreating(false);
    setNewBoardTitle('');
    const created = await onCreateBoard(title);
    if (created && created.id) {
      onOpenBoard(created.id);
    }
  };

  const handleRenameSubmit = async (boardId: string) => {
    if (!editingTitle.trim()) return;
    await onRenameBoard(boardId, editingTitle.trim());
    setEditingBoardId(null);
    setEditingTitle('');
  };

  return (
    <div
      className={`min-h-screen w-full flex flex-col transition-colors ${
        isDarkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800'
      }`}
    >
      {/* Top Navigation Bar */}
      <header
        className={`w-full px-6 py-4 border-b flex items-center justify-between backdrop-blur-md sticky top-0 z-20 ${
          isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-extrabold text-lg shadow-md shadow-blue-500/25">
            A
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-lg text-white">
                Axioma<span className="text-blue-500">Board</span>
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-500 text-blue-500">
                Дашборд
              </span>
            </div>
            <span className="text-xs text-slate-400">Личный кабинет &middot; Ваши доски</span>
          </div>
        </div>

        {/* User Chip & Actions */}
        <div className="flex items-center gap-2.5">
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
              isDarkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center font-bold text-xs uppercase">
              {user.username.slice(0, 2)}
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs font-semibold leading-tight">{user.username}</span>
              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                {user.email || 'Email верифицирован'}
                <CheckCircle2 size={10} className="text-emerald-500" />
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleDarkMode}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isDarkMode
                ? 'bg-slate-950 border-slate-800 hover:bg-slate-800 text-slate-300'
                : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
            }`}
            title="Сменить тему"
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <button
            type="button"
            onClick={onLogout}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border transition cursor-pointer ${
              isDarkMode
                ? 'bg-slate-950 border-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-400 hover:border-red-900/50'
                : 'bg-white border-slate-200 hover:bg-red-50 text-slate-600 hover:text-red-600 hover:border-red-200'
            }`}
            title="Выйти из аккаунта"
          >
            <LogOut size={14} />
            <span>Выйти</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: isDarkMode ? '#1e293b' : '#e2e8f0' }}>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('boards')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'boards'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : isDarkMode
                  ? 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <LayoutDashboard size={15} />
              <span>Мои доски ({boards.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : isDarkMode
                  ? 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Settings size={15} />
              <span>Настройки аккаунта</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('shortcuts')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                activeTab === 'shortcuts'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : isDarkMode
                  ? 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Command size={15} />
              <span>Горячие клавиши</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenDemoBoard}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                isDarkMode
                  ? 'bg-slate-900 border-slate-800 hover:bg-slate-800 text-slate-300'
                  : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-700'
              }`}
            >
              <Sparkles size={14} className="text-amber-500" />
              <span>Открыть DemoBoard</span>
            </button>
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer shadow-md shadow-blue-500/25"
            >
              <Plus size={15} />
              <span>Новая доска</span>
            </button>
          </div>
        </div>

        {/* Tab 1: BOARDS LIST */}
        {activeTab === 'boards' && (
          <div className="flex flex-col gap-6">
            {/* Search Bar */}
            <div className="flex items-center justify-between gap-4">
              <div
                className={`relative flex-1 max-w-md flex items-center rounded-xl border px-3 py-2 ${
                  isDarkMode ? 'bg-slate-900/60 border-slate-800 text-white' : 'bg-white border-slate-200 text-slate-900'
                }`}
              >
                <Search size={15} className="text-slate-400 mr-2 shrink-0" />
                <input
                  type="text"
                  placeholder="Поиск по названию доски..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-xs"
                />
              </div>
              <span className="text-xs text-slate-400">
                Всего досок: <strong className="text-blue-500">{filteredBoards.length}</strong>
              </span>
            </div>

            {/* Modal for creating a new board */}
            {isCreating && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <form
                  onSubmit={handleCreateSubmit}
                  className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150 ${
                    isDarkMode ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-slate-100 text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-base">
                    <FolderPlus className="text-blue-500" size={20} />
                    <span>Создание новой доски</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Укажите название вашего математического воркспейса.
                  </p>
                  <input
                    type="text"
                    placeholder="Например: Квадратные уравнения, Геометрия 10 класс"
                    value={newBoardTitle}
                    onChange={(e) => setNewBoardTitle(e.target.value)}
                    autoFocus
                    required
                    className={`w-full px-3 py-2 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}
                  />
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCreating(false)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/25 cursor-pointer"
                    >
                      Создать и открыть
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Boards Grid */}
            {filteredBoards.length === 0 ? (
              <div
                className={`w-full rounded-3xl border-2 border-dashed p-12 flex flex-col items-center justify-center text-center gap-3 ${
                  isDarkMode ? 'border-slate-800 bg-slate-900/20 text-slate-400' : 'border-slate-200 bg-white/50 text-slate-500'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
                  <LayoutDashboard size={28} />
                </div>
                <h3 className="font-bold text-base text-slate-200">
                  {searchQuery ? 'Ничего не найдено' : 'У вас пока нет досок'}
                </h3>
                <p className="text-xs max-w-sm">
                  {searchQuery
                    ? 'Попробуйте изменить поисковый запрос'
                    : 'Создайте свою первую интерактивную доску для решения уравнений, формул и визуализации графиков.'}
                </p>
                {!searchQuery && (
                  <button
                    type="button"
                    onClick={() => setIsCreating(true)}
                    className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/25 cursor-pointer"
                  >
                    <Plus size={15} />
                    <span>Создать первую доску</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredBoards.map((b) => {
                  const isEditingThis = editingBoardId === b.id;

                  return (
                    <div
                      key={b.id}
                      className={`group relative rounded-2xl border p-5 flex flex-col justify-between gap-4 transition-all duration-150 hover:shadow-xl ${
                        isDarkMode
                          ? 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                          : 'bg-white border-slate-200 hover:border-blue-200 hover:shadow-blue-500/5'
                      }`}
                    >
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                            Воркспейс
                          </span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBoardId(b.id);
                                setEditingTitle(b.title || '');
                              }}
                              className="p-1 rounded text-slate-400 hover:text-blue-500 transition cursor-pointer"
                              title="Переименовать"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm(`Удалить доску "${b.title}"?`)) {
                                  onDeleteBoard(b.id);
                                }
                              }}
                              className="p-1 rounded text-slate-400 hover:text-red-500 transition cursor-pointer"
                              title="Удалить"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {isEditingThis ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <input
                              type="text"
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              autoFocus
                              className={`w-full px-2 py-1 text-xs rounded-lg border outline-none ${
                                isDarkMode ? 'bg-slate-950 border-slate-800 text-white' : 'bg-slate-50 border-slate-200'
                              }`}
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameSubmit(b.id)}
                              className="px-2 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                            >
                              OK
                            </button>
                          </div>
                        ) : (
                          <h4
                            onClick={() => onOpenBoard(b.id)}
                            className="font-bold text-sm leading-snug cursor-pointer group-hover:text-blue-500 transition"
                          >
                            {b.title || 'Безымянная доска'}
                          </h4>
                        )}

                        <p className="text-xs text-slate-400 line-clamp-2">
                          {b.description || 'Личное математическое пространство для расчётов и формул.'}
                        </p>
                      </div>

                      <div
                        className="pt-3 border-t flex items-center justify-between text-[11px] text-slate-400"
                        style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}
                      >
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>
                            {b.updated_at
                              ? new Date(b.updated_at).toLocaleDateString('ru-RU', {
                                  day: 'numeric',
                                  month: 'short',
                                })
                              : 'Недавно'}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => onOpenBoard(b.id)}
                          className="flex items-center gap-1 text-blue-500 font-semibold hover:gap-1.5 transition-all cursor-pointer"
                        >
                          <span>Открыть</span>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl flex flex-col gap-6">
            <div
              className={`rounded-2xl border p-6 flex flex-col gap-4 ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <h3 className="font-bold text-base flex items-center gap-2">
                <ShieldCheck className="text-blue-500" size={18} />
                <span>Данные аккаунта</span>
              </h3>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="flex flex-col gap-1 p-3 rounded-xl border" style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Имя пользователя</span>
                  <span className="font-semibold text-sm">{user.username}</span>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded-xl border" style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Почта (Email)</span>
                  <span className="font-semibold text-sm flex items-center gap-1.5">
                    {user.email || 'Не указана'}
                    <CheckCircle2 size={13} className="text-emerald-500" />
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded-xl border" style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Статус верификации</span>
                  <span className="font-semibold text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    Подтверждена через SMTP
                  </span>
                </div>

                <div className="flex flex-col gap-1 p-3 rounded-xl border" style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                  <span className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">ID Аккаунта</span>
                  <span className="font-mono text-slate-400">{user.id}</span>
                </div>
              </div>
            </div>

            <div
              className={`rounded-2xl border p-6 flex flex-col gap-4 ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <h3 className="font-bold text-base flex items-center gap-2">
                <Zap className="text-amber-500" size={18} />
                <span>Интерфейс и предпочтения</span>
              </h3>

              <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">Тема оформления</span>
                  <span className="text-[11px] text-slate-400">Светлая или темная высококонтрастная тема</span>
                </div>
                <button
                  type="button"
                  onClick={onToggleDarkMode}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer flex items-center gap-1.5"
                >
                  {isDarkMode ? <Sun size={13} /> : <Moon size={13} />}
                  <span>{isDarkMode ? 'Тёмная' : 'Светлая'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold">Точечная сетка</span>
                  <span className="text-[11px] text-slate-400">Тактильная сетка Miro / Linear 32px</span>
                </div>
                <span className="text-xs font-mono text-emerald-500 font-bold">Включена</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: SHORTCUTS */}
        {activeTab === 'shortcuts' && (
          <div className="max-w-2xl flex flex-col gap-4">
            <div
              className={`rounded-2xl border p-6 flex flex-col gap-4 ${
                isDarkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <h3 className="font-bold text-base flex items-center gap-2">
                <Command className="text-blue-500" size={18} />
                <span>Горячие клавиши платформы</span>
              </h3>

              <div className="flex flex-col divide-y text-xs" style={{ borderColor: isDarkMode ? '#1e293b' : '#f1f5f9' }}>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-400">Вставка формулы на доску</span>
                  <kbd className="px-2 py-1 rounded-md bg-slate-800 text-slate-200 font-mono font-bold">F / А</kbd>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-400">Заморозка инструмента (Tool Lock)</span>
                  <kbd className="px-2 py-1 rounded-md bg-slate-800 text-slate-200 font-mono font-bold">Q / Й</kbd>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-400">Отмена действия (Undo)</span>
                  <kbd className="px-2 py-1 rounded-md bg-slate-800 text-slate-200 font-mono font-bold">Ctrl + Z / Cmd + Z</kbd>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-400">Повтор действия (Redo)</span>
                  <kbd className="px-2 py-1 rounded-md bg-slate-800 text-slate-200 font-mono font-bold">Ctrl + Shift + Z / Ctrl + Y</kbd>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-400">Удаление карточки / связи</span>
                  <kbd className="px-2 py-1 rounded-md bg-slate-800 text-slate-200 font-mono font-bold">Delete / Backspace</kbd>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-400">Палитра стилей и толщин</span>
                  <span className="text-slate-300 font-semibold">Повторный клик или ПКМ по инструменту</span>
                </div>
                <div className="py-2.5 flex items-center justify-between">
                  <span className="text-slate-400">Подменю формулы (чистая / полная)</span>
                  <span className="text-slate-300 font-semibold">ПКМ по кнопке «Формула»</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
