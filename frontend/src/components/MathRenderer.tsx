import React, { useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
  fontSize?: string;
  isDarkMode?: boolean;
}

export const MathRenderer: React.FC<MathRendererProps> = ({
  latex,
  displayMode = true,
  className = '',
  fontSize = '1.25rem',
  isDarkMode,
}) => {
  const isDark =
    isDarkMode !== undefined
      ? isDarkMode
      : typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const html = useMemo(() => {
    if (!latex || !latex.trim()) return '';
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
      });
    } catch {
      return latex;
    }
  }, [latex, displayMode]);

  if (!latex || !latex.trim()) {
    return (
      <span className="text-slate-400 dark:text-slate-500 font-medium text-sm flex items-center gap-1.5 select-none">
        <span>✎ Введите математическое выражение...</span>
      </span>
    );
  }

  return (
    <div
      className={`overflow-x-auto overflow-y-hidden py-1 font-semibold ${className}`}
      style={{
        fontSize,
        color: isDark ? '#f8fafc' : '#0f172a',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export const FormattedStepText: React.FC<{
  text: string;
  className?: string;
  isDarkMode?: boolean;
}> = ({ text, className = '', isDarkMode }) => {
  const isDark =
    isDarkMode !== undefined
      ? isDarkMode
      : typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const elements = useMemo(() => {
    if (!text) return null;

    // Matches $$...$$ (block) or $...$ (inline)
    const regex = /(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const math = part.slice(2, -2).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: true,
            throwOnError: false,
          });
          return (
            <span
              key={index}
              className="my-1.5 block overflow-x-auto font-semibold"
              style={{ color: isDark ? '#60a5fa' : '#2563eb' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index}>{part}</span>;
        }
      } else if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1).trim();
        try {
          const html = katex.renderToString(math, {
            displayMode: false,
            throwOnError: false,
          });
          return (
            <span
              key={index}
              className="inline-block px-1 align-baseline font-bold"
              style={{ color: isDark ? '#93c5fd' : '#1d4ed8' }}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index}>{part}</span>;
        }
      } else {
        return (
          <span
            key={index}
            style={{ color: isDark ? '#cbd5e1' : '#334155' }}
          >
            {part}
          </span>
        );
      }
    });
  }, [text, isDark]);

  return (
    <div
      className={`leading-relaxed text-xs break-words font-sans ${className}`}
      style={{ color: isDark ? '#cbd5e1' : '#334155' }}
    >
      {elements}
    </div>
  );
};
