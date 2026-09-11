import React, { useEffect, useRef } from 'react';
import 'mathlive';
import { Keyboard } from 'lucide-react';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any;
    }
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'math-field': any;
    }
  }
}

interface VisualMathEditorProps {
  value: string;
  onChange: (latex: string) => void;
  onEnter?: () => void;
  autoFocus?: boolean;
}

const ESSENTIAL_MATH_TOOLS = [
  { label: '½', latex: '\\frac{#@}{#?}', title: 'Обыкновенная дробь' },
  { label: 'xⁿ', latex: '^{#?}', title: 'Степень' },
  { label: 'x²', latex: '^2', title: 'Квадрат' },
  { label: '√x', latex: '\\sqrt{#?}', title: 'Квадратный корень' },
  { label: '( )', latex: '\\left(#?\\right)', title: 'Скобки' },
  { label: '≤', latex: '\\le ', title: 'Меньше либо равно' },
  { label: '≥', latex: '\\ge ', title: 'Больше либо равно' },
  { label: 'π', latex: '\\pi', title: 'Число Пи' },
];

export const VisualMathEditor: React.FC<VisualMathEditorProps> = ({
  value,
  onChange,
  onEnter,
  autoFocus = true,
}) => {
  const mfRef = useRef<any>(null);

  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;

    // Set initial LaTeX value
    if (mf.value !== value) {
      mf.setValue(value || '', { silenceNotifications: true });
    }

    // Configure mathfield options
    mf.mathVirtualKeyboardPolicy = 'manual';
    mf.mathModeSpace = '\\;';
    mf.smartSuperscript = true;
    mf.fractionNavigationOrder = 'numerator-denominator';

    // Override "/" keybinding so it inserts a regular division "/" instead of converting into a vertical fraction
    if (Array.isArray(mf.keybindings)) {
      mf.keybindings = [
        ...mf.keybindings.filter((kb: any) => kb.key !== '/'),
        { key: '/', ifMode: 'math', command: ['insert', '/'] },
      ];
    }

    const handleInput = (e: any) => {
      const newLatex = e.target.value;
      onChange(newLatex);
    };

    // Only handle Enter here; let MathLive process Backspace/Delete internally
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        onEnter?.();
        return;
      }
    };

    const handleBlur = () => {
      try {
        const kb = (window as any).mathVirtualKeyboard;
        if (kb?.visible) {
          kb.hide();
        }
      } catch {}
    };

    mf.addEventListener('input', handleInput);
    mf.addEventListener('keydown', handleKeyDown);
    mf.addEventListener('blur', handleBlur);

    if (autoFocus) {
      setTimeout(() => mf.focus(), 50);
    }

    // Adapt math-field color scheme dynamically
    const updateMfTheme = () => {
      const isDark = document.documentElement.classList.contains('dark');
      mf.style.setProperty('--caret-color', isDark ? '#60a5fa' : '#2563eb');
      mf.style.setProperty('--selection-background-color', isDark ? '#2563eb' : '#bfdbfe');
      mf.style.setProperty('--selection-color', '#ffffff');
      mf.style.color = isDark ? '#f8fafc' : '#0f172a';
    };
    updateMfTheme();

    const obs = new MutationObserver(updateMfTheme);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      obs.disconnect();
      mf.removeEventListener('input', handleInput);
      mf.removeEventListener('keydown', handleKeyDown);
      mf.removeEventListener('blur', handleBlur);
      try {
        const kb = (window as any).mathVirtualKeyboard;
        if (kb?.visible) {
          kb.hide();
        }
      } catch {}
    };
  }, []);

  // Update value if changed externally
  useEffect(() => {
    const mf = mfRef.current;
    if (mf && mf.value !== value) {
      mf.setValue(value || '', { silenceNotifications: true });
    }
  }, [value]);

  const insertTemplate = (templateLatex: string) => {
    const mf = mfRef.current;
    if (!mf) return;
    mf.executeCommand(['insert', templateLatex]);
    mf.focus();
  };

  const toggleVirtualKeyboard = () => {
    try {
      const kb = (window as any).mathVirtualKeyboard;
      if (kb) {
        if (kb.visible) kb.hide();
        else kb.show();
      }
    } catch {}
  };

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      className="flex flex-col gap-2 w-full select-text"
    >
      {/* Sleek Convenient Quick Math Toolbar */}
      <div className="flex items-center justify-between gap-1 p-1 bg-slate-50/90 dark:bg-slate-800/80 rounded-xl border border-slate-200/80 dark:border-slate-700">
        <div className="flex items-center gap-1 overflow-x-auto">
          {ESSENTIAL_MATH_TOOLS.map((tool) => (
            <button
              key={tool.label}
              type="button"
              onClick={() => insertTemplate(tool.latex)}
              title={tool.title}
              className="px-2 py-0.5 text-xs font-semibold bg-white dark:bg-slate-700/80 hover:bg-blue-50 dark:hover:bg-slate-600 hover:text-blue-700 dark:hover:text-blue-300 text-slate-700 dark:text-slate-200 rounded-lg border border-slate-200/80 dark:border-slate-600 shadow-2xs transition cursor-pointer"
            >
              {tool.label}
            </button>
          ))}
        </div>

        {/* Sole Single Keyboard Toggle Button */}
        <button
          type="button"
          onClick={toggleVirtualKeyboard}
          title="Экранная клавиатура"
          className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-white dark:bg-slate-700/80 hover:bg-indigo-50 dark:hover:bg-slate-600 hover:text-indigo-600 dark:hover:text-indigo-300 text-slate-600 dark:text-slate-200 rounded-lg border border-slate-200/80 dark:border-slate-600 cursor-pointer shadow-2xs transition shrink-0 ml-1"
        >
          <Keyboard size={12} />
          <span>Клавиатура</span>
        </button>
      </div>

      {/* Interactive WYSIWYG Math Field */}
      <div className="relative border-2 border-blue-500 rounded-xl bg-white dark:bg-slate-950 p-2.5 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-400/30">
        <math-field
          ref={mfRef}
          math-virtual-keyboard-policy="manual"
          style={{
            display: 'block',
            width: '100%',
            fontSize: '1.25rem',
            outline: 'none',
            minHeight: '2.5rem',
            cursor: 'text',
          }}
        >
          {value}
        </math-field>

        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 pt-1.5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span>Tab — след. блок</span>
            <span>•</span>
            <span>Enter — готово</span>
          </div>
        </div>
      </div>
    </div>
  );
};
