import React, { useState, useRef, useEffect } from 'react';
import type { TldrawApp } from '@tldraw/tldraw';
import { DashStyle, TDShapeType } from '@tldraw/tldraw';
import {
  MousePointer2,
  Sigma,
  Pencil,
  Eraser,
  ArrowUpRight,
  Square,
  Circle,
  Triangle,
  Minus,
  Diamond,
  Star,
  Hexagon,
  Cloud,
  Heart,
  Type,
  StickyNote,
  Undo2,
  Redo2,
  Trash2,
  ChevronUp,
  Lock,
  Unlock,
  Variable,
} from 'lucide-react';
import { V1StylePanel } from './V1StylePanel';

interface V1BottomToolbarProps {
  app: TldrawApp | null;
  activeTool: string;
  isDarkMode?: boolean;
  onSelectTool?: (toolId: string) => void;
  onSelectFormulaTool?: (type?: 'full' | 'formula') => void;
  formulaSubtool?: 'full' | 'formula';
  onSetFormulaSubtool?: (type: 'full' | 'formula') => void;
  isToolLocked?: boolean;
  onToggleToolLock?: () => void;
}

const SHAPE_OPTIONS = [
  { id: 'rectangle', label: 'Прямоугольник (R)', icon: Square },
  { id: 'ellipse', label: 'Круг / Овал (O)', icon: Circle },
  { id: 'triangle', label: 'Треугольник (G)', icon: Triangle },
  { id: 'line', label: 'Прямая линия (L)', icon: Minus },
  { id: 'diamond', label: 'Ромб', icon: Diamond },
  { id: 'star', label: 'Звезда', icon: Star },
  { id: 'hexagon', label: 'Шестиугольник', icon: Hexagon },
  { id: 'cloud', label: 'Облако', icon: Cloud },
  { id: 'heart', label: 'Сердце', icon: Heart },
];

export const V1BottomToolbar: React.FC<V1BottomToolbarProps> = ({
  app,
  activeTool,
  isDarkMode,
  onSelectTool,
  onSelectFormulaTool,
  formulaSubtool = 'full',
  onSetFormulaSubtool,
  isToolLocked,
  onToggleToolLock,
}) => {
  const [isStyleOpen, setIsStyleOpen] = useState(false);
  const [isArrowMenuOpen, setIsArrowMenuOpen] = useState(false);
  const [isShapesMenuOpen, setIsShapesMenuOpen] = useState(false);
  const [isFormulaMenuOpen, setIsFormulaMenuOpen] = useState(false);
  const [selectedShapeId, setSelectedShapeId] = useState<string>('rectangle');
  const [internalToolLocked, setInternalToolLocked] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);

  const toolLocked = isToolLocked !== undefined ? isToolLocked : (app?.appState?.isToolLocked ?? internalToolLocked);

  // Sync selectedShapeId if activeTool is one of the shapes
  useEffect(() => {
    if (SHAPE_OPTIONS.some((s) => s.id === activeTool)) {
      setSelectedShapeId(activeTool);
    }
  }, [activeTool]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) {
        setIsStyleOpen(false);
        setIsArrowMenuOpen(false);
        setIsShapesMenuOpen(false);
        setIsFormulaMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentShape = SHAPE_OPTIONS.find((s) => s.id === selectedShapeId) || SHAPE_OPTIONS[0];
  const CurrentShapeIcon = currentShape.icon;
  const isAnyShapeActive = SHAPE_OPTIONS.some((s) => s.id === activeTool);

  const tools = [
    { id: 'select', label: 'Выделение (V)', icon: MousePointer2 },
    {
      id: 'formula',
      label: formulaSubtool === 'formula'
        ? 'Чистая формула — кликните на холст (ПКМ для выбора типа)'
        : 'Формула (F) — кликните на холст (ПКМ для выбора типа)',
      icon: formulaSubtool === 'formula' ? Variable : Sigma,
      hasMenu: true,
    },
    { id: 'draw', label: 'Карандаш (D)', icon: Pencil },
    { id: 'eraser', label: 'Ластик (E)', icon: Eraser },
    { id: 'arrow', label: 'Стрелка (A)', icon: ArrowUpRight, hasMenu: true },
    {
      id: 'shapes',
      label: `Фигуры: ${currentShape.label}`,
      icon: CurrentShapeIcon,
      hasMenu: true,
      isShape: true,
    },
    { id: 'text', label: 'Текст (T)', icon: Type },
    { id: 'sticky', label: 'Заметка (S)', icon: StickyNote },
  ];

  const handleToggleToolLock = () => {
    if (!app) return;
    if (onToggleToolLock) {
      onToggleToolLock();
    } else {
      app.toggleToolLock();
      setInternalToolLocked(Boolean(app.appState.isToolLocked));
    }
  };

  const handlePickFormulaSubtool = (type: 'full' | 'formula') => {
    onSetFormulaSubtool?.(type);
    setIsFormulaMenuOpen(false);
    if (onSelectFormulaTool) {
      onSelectFormulaTool(type);
    }
  };

  const handleSelectShape = (shapeId: string) => {
    if (!app) return;
    setSelectedShapeId(shapeId);
    setIsShapesMenuOpen(false);

    if (['rectangle', 'ellipse', 'triangle', 'line'].includes(shapeId)) {
      app.selectTool(shapeId as any);
      onSelectTool?.(shapeId);
    } else {
      // Extended geometric shapes (diamond, star, hexagon, cloud, heart)
      const center = app.getPagePoint(app.centerPoint);
      const id = 'polygon_' + Math.random().toString(36).slice(2, 9);
      app.createShapes({
        id,
        type: TDShapeType.Rectangle,
        polygonType: shapeId,
        point: [Math.round(center[0] - 70), Math.round(center[1] - 70)],
        size: [140, 140],
        style: {
          color: 'blue',
          size: 'small',
          isFilled: false,
          dash: 'solid',
          scale: 1,
        },
      } as any);
      app.select(id);
    }
  };

  const handleSelectTool = (toolId: string) => {
    if (!app) return;

    if (toolId === 'formula') {
      const isCurrentlyFormula = activeTool === 'formula' || activeTool === 'pure_formula';
      if (isCurrentlyFormula) {
        // Secondary click on already active formula tool -> toggle subtool flyout
        setIsFormulaMenuOpen((prev) => !prev);
      } else {
        if (onSelectFormulaTool) {
          onSelectFormulaTool(formulaSubtool);
        }
      }
      setIsStyleOpen(false);
      setIsArrowMenuOpen(false);
      setIsShapesMenuOpen(false);
      return;
    }

    if (toolId === 'shapes') {
      if (isAnyShapeActive) {
        // Already on a shape -> toggle shapes popup menu
        setIsShapesMenuOpen((prev) => !prev);
      } else {
        // Activate current shape tool
        handleSelectShape(selectedShapeId);
      }
      setIsArrowMenuOpen(false);
      setIsStyleOpen(false);
      return;
    }

    const isCurrentlyActive =
      activeTool === toolId || (toolId === 'eraser' && activeTool === 'erase');

    if (isCurrentlyActive) {
      // Secondary click on already active tool -> toggle style/color palette or arrow menu
      if (toolId === 'arrow') {
        setIsArrowMenuOpen((prev) => !prev);
      } else if (toolId !== 'select' && toolId !== 'eraser' && toolId !== 'formula') {
        setIsStyleOpen((prev) => !prev);
      }
      return;
    }

    // Primary click -> switch tool
    setIsStyleOpen(false);
    setIsArrowMenuOpen(false);
    setIsShapesMenuOpen(false);
    const t = toolId === 'eraser' ? 'erase' : toolId;
    app.selectTool(t as any);
    onSelectTool?.(t);
  };

  const handleSetArrowType = (dash: DashStyle) => {
    if (!app) return;
    app.selectTool('arrow' as any);
    app.style({ dash });
    setIsArrowMenuOpen(false);
    onSelectTool?.('arrow');
  };

  const handleUndo = () => {
    if (!app) return;
    try {
      app.undo();
    } catch {}
  };

  const handleRedo = () => {
    if (!app) return;
    try {
      app.redo();
    } catch {}
  };

  const handleDelete = () => {
    if (!app) return;
    try {
      if (app.selectedIds.length > 0) {
        const toDelete = [...app.selectedIds];
        const page = app.page;
        if (page?.bindings) {
          Object.values(page.bindings).forEach((b: any) => {
            if (toDelete.includes(b.toId) || toDelete.includes(b.fromId)) {
              if (b.fromId && !toDelete.includes(b.fromId)) {
                toDelete.push(b.fromId);
              }
            }
          });
        }
        app.delete(toDelete);
      }
    } catch {}
  };

  return (
    <div
      ref={toolbarRef}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 pointer-events-auto select-none"
    >
      {/* Static Tool Lock Button on the RIGHT (Always anchored statically above undo/redo/trash, independent of panels) */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={handleToggleToolLock}
        title={
          toolLocked
            ? 'Заморозка инструмента: ВКЛ (Q)'
            : 'Заморозить инструмент (Q)'
        }
        className={`absolute -top-11 right-1 p-2 rounded-xl border shadow-lg backdrop-blur-md transition-all cursor-pointer flex items-center justify-center z-10 ${
          toolLocked
            ? 'bg-amber-500 text-white border-amber-400 shadow-amber-500/30 ring-2 ring-amber-400/40'
            : isDarkMode
            ? 'bg-slate-900/95 hover:bg-slate-800 text-slate-300 border-slate-800 shadow-black/40'
            : 'bg-white/95 hover:bg-slate-100 text-slate-700 border-slate-200 shadow-slate-300/40'
        }`}
      >
        {toolLocked ? <Lock size={15} /> : <Unlock size={15} />}
      </button>

      {/* Floating Style Panel (Opens on secondary click or right click) */}
      {isStyleOpen && app && (
        <div className="absolute bottom-full mb-2.5 left-1/2 -translate-x-1/2 animate-in fade-in zoom-in-95 duration-100 z-20">
          <V1StylePanel
            app={app}
            isDarkMode={isDarkMode}
            onClose={() => setIsStyleOpen(false)}
          />
        </div>
      )}

      {/* Floating Formula Sub-Tool Flyout (Opens on secondary click or right click on Formula tool) */}
      {isFormulaMenuOpen && (
        <div
          className="absolute bottom-full mb-2.5 left-14 -translate-x-1/2 rounded-2xl shadow-xl border p-1.5 flex flex-col gap-1 animate-in fade-in zoom-in-95 duration-100 z-20 min-w-[200px]"
          style={{
            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
            borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
          }}
        >
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handlePickFormulaSubtool('full')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition cursor-pointer text-left ${
              formulaSubtool === 'full'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Sigma size={16} className={formulaSubtool === 'full' ? 'text-white' : 'text-blue-500'} />
            <div className="flex flex-col">
              <span>Полная карточка</span>
              <span className={`text-[10px] ${formulaSubtool === 'full' ? 'text-blue-100' : 'text-slate-400'}`}>Решение и вычисления</span>
            </div>
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handlePickFormulaSubtool('formula')}
            className={`flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-xl transition cursor-pointer text-left ${
              formulaSubtool === 'formula'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <Variable size={16} className={formulaSubtool === 'formula' ? 'text-white' : 'text-purple-500'} />
            <div className="flex flex-col">
              <span>Чистая формула</span>
              <span className={`text-[10px] ${formulaSubtool === 'formula' ? 'text-blue-100' : 'text-slate-400'}`}>Только поле ввода</span>
            </div>
          </button>
        </div>
      )}

      {/* Floating Arrow Sub-Tool Flyout */}
      {isArrowMenuOpen && app && (
        <div
          className="absolute bottom-full mb-2.5 left-32 -translate-x-1/2 rounded-2xl shadow-xl border p-1.5 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-100 z-20"
          style={{
            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
            borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
          }}
        >
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handleSetArrowType(DashStyle.Solid)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            <span>➔</span>
            <span>Прямая</span>
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => handleSetArrowType(DashStyle.Draw)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition cursor-pointer"
          >
            <span>⤹</span>
            <span>Изогнутая</span>
          </button>
        </div>
      )}

      {/* Floating Shapes Menu (Compact rectangular grid of pure icons, no text) */}
      {isShapesMenuOpen && app && (
        <div
          className="absolute bottom-full mb-2.5 left-40 -translate-x-1/2 rounded-2xl shadow-xl border p-2 grid grid-cols-5 gap-1.5 animate-in fade-in zoom-in-95 duration-100 z-20"
          style={{
            backgroundColor: isDarkMode ? '#0f172a' : '#ffffff',
            borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
          }}
        >
          {SHAPE_OPTIONS.map((shape) => {
            const SIcon = shape.icon;
            const isChosen = activeTool === shape.id || selectedShapeId === shape.id;
            return (
              <button
                key={shape.id}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => handleSelectShape(shape.id)}
                title={shape.label}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition cursor-pointer ${
                  isChosen
                    ? 'bg-blue-600 text-white shadow-xs'
                    : isDarkMode
                    ? 'hover:bg-slate-800 text-slate-300 hover:text-white'
                    : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
                }`}
              >
                <SIcon size={16} />
              </button>
            );
          })}
        </div>
      )}

      {/* Main Bottom Toolbar */}
      <div
        className={`flex items-center gap-1 p-1 rounded-2xl shadow-xl backdrop-blur-md border transition-colors ${
          isDarkMode
            ? 'bg-slate-900/90 border-slate-800 shadow-black/50 text-slate-200'
            : 'bg-white/95 border-slate-200/90 shadow-slate-300/40 text-slate-700'
        }`}
      >
        {/* Primary Draw Tools */}
        <div className="flex items-center gap-0.5">
          {tools.map((tool) => {
            const Icon = tool.icon;
            const isSelected = tool.isShape
              ? isAnyShapeActive
              : activeTool === tool.id || (tool.id === 'eraser' && activeTool === 'erase');

            return (
              <div key={tool.id} className="relative flex items-center">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => handleSelectTool(tool.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (tool.id === 'formula') {
                      setIsFormulaMenuOpen((prev) => !prev);
                    } else if (tool.isShape) {
                      setIsShapesMenuOpen(true);
                    } else if (tool.id === 'arrow') {
                      setIsArrowMenuOpen(true);
                    } else if (tool.id !== 'select' && tool.id !== 'eraser') {
                      if (!isSelected) handleSelectTool(tool.id);
                      setIsStyleOpen(true);
                    }
                  }}
                  title={
                    isSelected
                      ? `${tool.label} (кликните повторно для меню)`
                      : tool.label
                  }
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center justify-center ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                      : isDarkMode
                      ? 'hover:bg-slate-800 text-slate-300 hover:text-white'
                      : 'hover:bg-slate-100 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon size={16} />
                </button>
                {tool.hasMenu && isSelected && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      if (tool.isShape) {
                        setIsShapesMenuOpen((prev) => !prev);
                      } else {
                        setIsArrowMenuOpen((prev) => !prev);
                      }
                    }}
                    className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-blue-700 text-white flex items-center justify-center shadow-xs cursor-pointer"
                    title={tool.isShape ? 'Выбор фигуры' : 'Выбор типа стрелки'}
                  >
                    <ChevronUp size={9} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1" />

        {/* Undo / Redo / Delete */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleUndo}
            title="Отменить (Ctrl+Z)"
            className={`p-2 rounded-xl transition cursor-pointer ${
              isDarkMode
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
          >
            <Undo2 size={16} />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleRedo}
            title="Повторить (Ctrl+Y)"
            className={`p-2 rounded-xl transition cursor-pointer ${
              isDarkMode
                ? 'hover:bg-slate-800 text-slate-400 hover:text-white'
                : 'hover:bg-slate-100 text-slate-500 hover:text-slate-900'
            }`}
          >
            <Redo2 size={16} />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={handleDelete}
            title="Удалить выбранное (Delete)"
            className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-slate-400 hover:text-red-500 transition cursor-pointer"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
