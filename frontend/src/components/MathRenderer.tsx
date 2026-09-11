import React, { useMemo } from 'react';
import katex from 'katex';

interface MathRendererProps {
  latex: string;
  displayMode?: boolean;
  className?: string;
  fontSize?: string;
}

export const MathRenderer: React.FC<MathRendererProps> = ({
  latex,
  displayMode = true,
  className = '',
  fontSize = '1.15rem',
}) => {
  const html = useMemo(() => {
    if (!latex || !latex.trim()) return '';
    try {
      return katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        trust: true,
      });
    } catch (e: any) {
      return `<span style="color: #ef4444; font-size: 0.85rem;">[LaTeX error: ${e.message}]</span>`;
    }
  }, [latex, displayMode]);

  if (!latex || !latex.trim()) {
    return (
      <span className="text-slate-400 dark:text-slate-500 font-medium text-sm flex items-center gap-1.5">
        <span>✎ Введите математическое выражение...</span>
      </span>
    );
  }

  return (
    <div
      className={`overflow-x-auto overflow-y-hidden py-1 text-slate-800 dark:text-slate-100 ${className}`}
      style={{ fontSize }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export const FormattedStepText: React.FC<{ text: string; className?: string }> = ({
  text,
  className = '',
}) => {
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
              className="my-1.5 block overflow-x-auto text-emerald-950 font-medium"
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
              className="inline-block px-1 align-baseline text-emerald-950 font-semibold"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        } catch {
          return <span key={index}>{part}</span>;
        }
      } else {
        return <span key={index}>{part}</span>;
      }
    });
  }, [text]);

  return <div className={`leading-relaxed text-xs text-slate-800 break-words ${className}`}>{elements}</div>;
};
