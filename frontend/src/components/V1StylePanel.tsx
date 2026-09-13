import React from 'react';
import type { TldrawApp } from '@tldraw/tldraw';
import { ColorStyle, DashStyle, SizeStyle } from '@tldraw/tldraw';

interface V1StylePanelProps {
  app: TldrawApp;
  isDarkMode?: boolean;
  onClose?: () => void;
}

const COLORS: Array<{ id: ColorStyle; bg: string; label: string }> = [
  { id: ColorStyle.Black, bg: '#1e293b', label: 'Черный' },
  { id: ColorStyle.Gray, bg: '#64748b', label: 'Серый' },
  { id: ColorStyle.Blue, bg: '#2563eb', label: 'Синий' },
  { id: ColorStyle.Green, bg: '#10b981', label: 'Зеленый' },
  { id: ColorStyle.Yellow, bg: '#eab308', label: 'Желтый' },
  { id: ColorStyle.Orange, bg: '#f97316', label: 'Оранжевый' },
  { id: ColorStyle.Red, bg: '#ef4444', label: 'Красный' },
  { id: ColorStyle.Violet, bg: '#8b5cf6', label: 'Фиолетовый' },
  { id: ColorStyle.White, bg: '#ffffff', label: 'Белый' },
];

const SIZES: Array<{ id: SizeStyle; label: string; height: number }> = [
  { id: SizeStyle.Small, label: 'S', height: 2 },
  { id: SizeStyle.Medium, label: 'M', height: 3.5 },
  { id: SizeStyle.Large, label: 'L', height: 5 },
];

const DASHES: Array<{ id: DashStyle; label: string }> = [
  { id: DashStyle.Draw, label: 'От руки' },
  { id: DashStyle.Solid, label: 'Сплошная' },
  { id: DashStyle.Dashed, label: 'Пунктир' },
  { id: DashStyle.Dotted, label: 'Точки' },
];

export const V1StylePanel: React.FC<V1StylePanelProps> = ({
  app,
  isDarkMode,
}) => {
  const currentStyle = app.appState.currentStyle;

  const handleColor = (c: ColorStyle) => {
    app.style({ color: c });
  };

  const handleSize = (s: SizeStyle) => {
    app.style({ size: s });
  };

  const handleDash = (d: DashStyle) => {
    app.style({ dash: d });
  };

  const handleFill = (filled: boolean) => {
    app.style({ isFilled: filled });
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="rounded-2xl shadow-2xl border p-3 flex flex-col gap-3 min-w-[260px] animate-in fade-in zoom-in-95 duration-100 select-none"
      style={{
        backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
        borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
      }}
    >
      {/* Color Palette */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
          Цвет
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {COLORS.map((c) => {
            const isSelected = currentStyle.color === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleColor(c.id)}
                title={c.label}
                className={`w-6 h-6 rounded-full border transition-transform cursor-pointer flex items-center justify-center ${
                  isSelected ? 'scale-120 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-110'
                }`}
                style={{
                  backgroundColor: c.bg,
                  borderColor: isDarkMode ? '#334155' : '#cbd5e1',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Stroke Width / Size */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
          Толщина линии
        </div>
        <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
          {SIZES.map((s) => {
            const isSelected = currentStyle.size === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleSize(s.id)}
                className={`py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  isSelected
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <div
                  className="rounded-full bg-current"
                  style={{ width: 14, height: s.height }}
                />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Dash Style */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
          Тип линии
        </div>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
          {DASHES.map((d) => {
            const isSelected = currentStyle.dash === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => handleDash(d.id)}
                className={`py-1 px-2 rounded-lg text-xs font-medium transition cursor-pointer text-center ${
                  isSelected
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fill Mode */}
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5">
          Заливка
        </div>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-slate-800/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => handleFill(false)}
            className={`py-1 px-2 rounded-lg text-xs font-medium transition cursor-pointer ${
              !currentStyle.isFilled
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            Контур
          </button>
          <button
            type="button"
            onClick={() => handleFill(true)}
            className={`py-1 px-2 rounded-lg text-xs font-medium transition cursor-pointer ${
              currentStyle.isFilled
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-semibold shadow-xs'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            С заливкой
          </button>
        </div>
      </div>
    </div>
  );
};
