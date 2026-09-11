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
    return <span className="text-gray-400 italic text-sm">(empty expression)</span>;
  }

  return (
    <div
      className={`overflow-x-auto overflow-y-hidden py-1 ${className}`}
      style={{ fontSize }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
