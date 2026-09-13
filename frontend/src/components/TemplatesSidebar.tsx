import React, { useState, useMemo, useRef, useEffect } from 'react';
import type { TldrawApp } from '@tldraw/tldraw';
import { TDShapeType } from '@tldraw/tldraw';
import {
  LayoutTemplate,
  X,
  Search,
  BookOpen,
} from 'lucide-react';
import { MathRenderer } from './MathRenderer';

export interface PresetItem {
  id: string;
  category: string;
  title: string;
  latex: string;
  preview: string;
  color: string;
  description?: string;
}

export const PRESETS_LIBRARY: PresetItem[] = [
  {
    id: 'quad_eq',
    category: 'Алгебра',
    title: 'Квадратное уравнение',
    latex: '2x^2 + 5x - 3 = 0',
    preview: '2x² + 5x - 3 = 0',
    color: '#3b82f6',
    description: 'Нахождение дискриминанта и корней через формулу',
  },
  {
    id: 'diff_squares',
    category: 'Алгебра',
    title: 'Разность квадратов',
    latex: 'x^2 - 4 = 0',
    preview: 'x² - 4 = 0',
    color: '#10b981',
    description: 'Разложение на множители (x - 2)(x + 2) = 0',
  },
  {
    id: 'intervals',
    category: 'Неравенства',
    title: 'Метод интервалов',
    latex: '\\frac{x^3 - x^2 + 6x - 6}{x^2 - 16} < 0',
    preview: '(x³ - x² + 6x - 6)/(x² - 16) < 0',
    color: '#8b5cf6',
    description: 'Дробно-рациональное алгебраическое неравенство',
  },
  {
    id: 'derivative',
    category: 'Анализ',
    title: 'Производная функции',
    latex: 'f(x) = x^3 \\sin(x)',
    preview: 'f(x) = x³ · sin(x)',
    color: '#ec4899',
    description: 'Дифференцирование произведения функций',
  },
  {
    id: 'gauss_int',
    category: 'Интегралы',
    title: 'Интеграл Гаусса',
    latex: '\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}',
    preview: '∫ e^(-x²) dx = √π',
    color: '#f59e0b',
    description: 'Классический несобственный интеграл Пуассона-Гаусса',
  },
  {
    id: 'euler_identity',
    category: 'Анализ',
    title: 'Тождество Эйлера',
    latex: 'e^{i\\pi} + 1 = 0',
    preview: 'e^(iπ) + 1 = 0',
    color: '#06b6d4',
    description: 'Связь фундаментальных констант e, i, π, 1, 0',
  },
  {
    id: 'trig_id',
    category: 'Тригонометрия',
    title: 'Основное тождество',
    latex: '\\sin^2(x) + \\cos^2(x) = 1',
    preview: 'sin²(x) + cos²(x) = 1',
    color: '#6366f1',
    description: 'Теорема Пифагора для тригонометрических функций',
  },
  {
    id: 'pythagoras',
    category: 'Геометрия',
    title: 'Теорема Пифагора',
    latex: 'a^2 + b^2 = c^2',
    preview: 'a² + b² = c²',
    color: '#14b8a6',
    description: 'Соотношение сторон прямоугольного треугольника',
  },
  {
    id: 'limit_sinc',
    category: 'Анализ',
    title: 'Первый замечательный предел',
    latex: '\\lim_{x \\to 0} \\frac{\\sin(x)}{x} = 1',
    preview: 'lim (sin x / x) = 1',
    color: '#f43f5e',
    description: 'Базовый предел дифференциального исчисления',
  },
];

interface TemplatesSidebarProps {
  app: TldrawApp | null;
  isDarkMode?: boolean;
}

export const TemplatesSidebar: React.FC<TemplatesSidebarProps> = ({
  app,
  isDarkMode,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('Все');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside the panel
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Keyboard shortcut Alt+T to toggle
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey && (e.key === 't' || e.key === 'T' || e.key === 'е' || e.key === 'Е')) {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(PRESETS_LIBRARY.map((p) => p.category)));
    return ['Все', ...cats];
  }, []);

  const filteredPresets = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return PRESETS_LIBRARY.filter((p) => {
      const matchCat = activeCategory === 'Все' || p.category === activeCategory;
      const matchQuery =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.latex.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q));
      return matchCat && matchQuery;
    });
  }, [searchQuery, activeCategory]);

  const handleApplyPreset = (preset: PresetItem) => {
    if (!app) return;
    const pageCenter = app.getPagePoint(app.centerPoint);
    const id = 'math_' + Math.random().toString(36).slice(2, 9);

    app.createShapes({
      id,
      type: TDShapeType.Rectangle,
      point: [Math.round(pageCenter[0] - 220), Math.round(pageCenter[1] - 180)],
      size: [440, 360],
      title: preset.title,
      latex: preset.latex,
      resultLatex: '',
      comment: preset.description || '',
      color: preset.color,
      isMathBlock: true,
      error: '',
      style: {
        color: 'black',
        size: 'small',
        isFilled: false,
        dash: 'draw',
        scale: 1,
      },
    } as any);

    app.select(id);
    setIsOpen(false);
  };

  return (
    <div ref={panelRef} className="select-none">
      {/* Floating Side Rail Trigger Button */}
      <div className="fixed left-3 top-18 z-30 pointer-events-auto">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => setIsOpen((prev) => !prev)}
          title="Шаблоны формул и задач (Alt+T)"
          className={`flex items-center gap-2 px-3 py-2 rounded-2xl shadow-lg border backdrop-blur-md transition-all duration-200 cursor-pointer active:scale-95 group ${
            isOpen
              ? 'bg-blue-600 text-white border-blue-500 shadow-blue-500/30'
              : isDarkMode
              ? 'bg-slate-900/90 hover:bg-slate-800 text-slate-200 border-slate-800 hover:border-slate-700 shadow-black/40'
              : 'bg-white/95 hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 shadow-slate-300/40'
          }`}
        >
          <LayoutTemplate
            size={16}
            className={`transition-transform duration-200 ${isOpen ? 'rotate-90 text-white' : 'group-hover:scale-110 text-blue-500'}`}
          />
          <span className="text-xs font-bold tracking-tight">Шаблоны</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
              isOpen
                ? 'bg-white/20 text-white'
                : isDarkMode
                ? 'bg-slate-800 text-slate-400'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {PRESETS_LIBRARY.length}
          </span>
        </button>
      </div>

      {/* Slide-out Templates Drawer */}
      {isOpen && (
        <div
          className={`fixed left-3 top-29 z-30 w-84 rounded-3xl shadow-2xl border backdrop-blur-xl flex flex-col pointer-events-auto animate-in fade-in slide-in-from-left-4 duration-200 ${
            isDarkMode
              ? 'bg-slate-900/95 border-slate-800 shadow-black/60 text-slate-200'
              : 'bg-white/95 border-slate-200 shadow-slate-400/30 text-slate-800'
          }`}
          style={{ maxHeight: 'calc(100vh - 140px)' }}
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <BookOpen size={15} />
              </div>
              <div>
                <h3 className="text-xs font-bold leading-tight">Библиотека шаблонов</h3>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight mt-0.5">
                  Кликните, чтобы вставить на холст
                </p>
              </div>
            </div>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
            >
              <X size={15} />
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-3 pb-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-colors ${
                isDarkMode
                  ? 'bg-slate-950/60 border-slate-800 focus-within:border-blue-500'
                  : 'bg-slate-50 border-slate-200 focus-within:border-blue-500'
              }`}
            >
              <Search size={13} className="text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по названию или формуле..."
                className="w-full bg-transparent text-xs outline-hidden placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 text-xs"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* Category Pills */}
          <div className="px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setActiveCategory(cat)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg transition-all shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isDarkMode
                      ? 'bg-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-750'
                      : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200/80'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Presets List */}
          <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-2">
            {filteredPresets.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                Ничего не найдено
              </div>
            ) : (
              filteredPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => handleApplyPreset(preset)}
                  className={`group w-full text-left p-3 rounded-2xl border transition-all duration-150 cursor-pointer flex flex-col gap-1.5 hover:scale-[1.01] hover:shadow-md ${
                    isDarkMode
                      ? 'bg-slate-950/40 hover:bg-slate-800/80 border-slate-800/80 hover:border-slate-700'
                      : 'bg-white hover:bg-slate-50/90 border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {preset.title}
                    </span>
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                      style={{
                        backgroundColor: `${preset.color}15`,
                        color: preset.color,
                      }}
                    >
                      {preset.category}
                    </span>
                  </div>

                  {/* Math Formula Render Preview */}
                  <div
                    className={`py-1 px-2 rounded-xl text-center flex items-center justify-center overflow-x-auto ${
                      isDarkMode ? 'bg-slate-900/60' : 'bg-slate-50'
                    }`}
                  >
                    <MathRenderer
                      latex={preset.latex}
                      displayMode={false}
                      fontSize="1.05rem"
                      isDarkMode={isDarkMode}
                    />
                  </div>

                  {preset.description && (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 line-clamp-1">
                      {preset.description}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
