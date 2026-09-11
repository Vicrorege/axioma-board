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

    return () => {
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
      {/* Interactive WYSIWYG Math Field */}
      <div className="relative border-2 border-blue-500 rounded-xl bg-white p-2.5 shadow-sm transition-all focus-within:ring-2 focus-within:ring-blue-400/30">
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

        <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span>Tab — след. блок</span>
            <span>•</span>
            <span>Enter — готово</span>
          </div>

          <button
            type="button"
            onClick={toggleVirtualKeyboard}
            title="Экранная клавиатура"
            className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded-md border border-slate-200 cursor-pointer shadow-2xs transition"
          >
            <Keyboard size={12} />
            <span>Клавиатура</span>
          </button>
        </div>
      </div>
    </div>
  );
};
