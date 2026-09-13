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
  isDarkMode?: boolean;
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
  isDarkMode,
}) => {
  const mfRef = useRef<any>(null);
  const isDark = isDarkMode !== undefined ? isDarkMode : (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const mf = mfRef.current;
    if (!mf) return;

    if (mf.value !== value) {
      mf.setValue(value || '', { silenceNotifications: true });
    }

    mf.mathVirtualKeyboardPolicy = 'manual';
    mf.mathModeSpace = '\\;';
    mf.smartSuperscript = true;
    mf.fractionNavigationOrder = 'numerator-denominator';

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

    const updateMfTheme = () => {
      const darkActive = isDarkMode !== undefined ? isDarkMode : document.documentElement.classList.contains('dark');
      mf.style.setProperty('--caret-color', darkActive ? '#60a5fa' : '#2563eb');
      mf.style.setProperty('--selection-background-color', darkActive ? '#2563eb' : '#bfdbfe');
      mf.style.setProperty('--selection-color', '#ffffff');
      mf.style.backgroundColor = 'transparent';
      mf.style.color = darkActive ? '#f8fafc' : '#0f172a';

      if (mf.shadowRoot) {
        const container = mf.shadowRoot.querySelector('.ML__container') || mf.shadowRoot.querySelector(':host');
        if (container) {
          (container as HTMLElement).style.backgroundColor = 'transparent';
        }
      }
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
  }, [isDark]);

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
      <div
        className="flex items-center justify-between gap-1 p-1 rounded-xl border transition-colors"
        style={{
          backgroundColor: isDark ? '#1e293b' : '#f8fafc',
          borderColor: isDark ? '#334155' : '#e2e8f0',
        }}
      >
        <div className="flex items-center gap-1 overflow-x-auto">
          {ESSENTIAL_MATH_TOOLS.map((tool) => (
            <button
              key={tool.label}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => insertTemplate(tool.latex)}
              title={tool.title}
              className="px-2 py-0.5 text-xs font-semibold rounded-lg border shadow-xs transition cursor-pointer"
              style={{
                backgroundColor: isDark ? '#334155' : '#ffffff',
                borderColor: isDark ? '#475569' : '#cbd5e1',
                color: isDark ? '#f1f5f9' : '#334155',
              }}
            >
              {tool.label}
            </button>
          ))}
        </div>

        {/* Sole Single Keyboard Toggle Button */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggleVirtualKeyboard}
          title="Экранная клавиатура"
          className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-lg border cursor-pointer shadow-xs transition shrink-0 ml-1"
          style={{
            backgroundColor: isDark ? '#334155' : '#ffffff',
            borderColor: isDark ? '#475569' : '#cbd5e1',
            color: isDark ? '#cbd5e1' : '#475569',
          }}
        >
          <Keyboard size={12} />
          <span>Клавиатура</span>
        </button>
      </div>

      {/* Interactive WYSIWYG Math Field Container */}
      <div
        className="relative border-2 rounded-xl p-2.5 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-400/30"
        style={{
          borderColor: '#3b82f6',
          backgroundColor: isDark ? '#0f172a' : '#ffffff',
          color: isDark ? '#f8fafc' : '#0f172a',
        }}
      >
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
            backgroundColor: 'transparent',
            color: isDark ? '#f8fafc' : '#0f172a',
          }}
        >
          {value}
        </math-field>

        <div
          className="mt-1 flex items-center justify-between text-[11px] pt-1.5 border-t"
          style={{
            borderColor: isDark ? '#1e293b' : '#f1f5f9',
            color: isDark ? '#64748b' : '#94a3b8',
          }}
        >
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
