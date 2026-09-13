import React, { useState, useMemo } from 'react';

export interface FunctionGraphProps {
  expression?: string;
  isDarkMode?: boolean;
  width?: number;
  height?: number;
  rangeX?: [number, number];
  rangeY?: [number, number];
}

export const FunctionGraphViewer: React.FC<FunctionGraphProps> = ({
  expression = 'x^2 - 4',
  isDarkMode = false,
  width = 380,
  height = 220,
  rangeX = [-6, 6],
  rangeY = [-5, 7],
}) => {
  const [hoverPt, setHoverPt] = useState<{ x: number; y: number } | null>(null);

  // Compile mathematical expression into a JS evaluator safely
  const evaluate = useMemo(() => {
    let jsExpr = expression
      .replace(/\^/g, '**')
      .replace(/(\d+)([a-zA-Z])/g, '$1*$2')
      .replace(/\\cdot/g, '*')
      .replace(/\\left/g, '')
      .replace(/\\right/g, '')
      .replace(/\\frac{([^}]+)}{([^}]+)}/g, '($1)/($2)')
      .replace(/sin/g, 'Math.sin')
      .replace(/cos/g, 'Math.cos')
      .replace(/tan/g, 'Math.tan')
      .replace(/sqrt/g, 'Math.sqrt')
      .replace(/abs/g, 'Math.abs')
      .replace(/ln/g, 'Math.log')
      .replace(/log/g, 'Math.log10')
      .replace(/pi/g, 'Math.PI')
      .replace(/e\b/g, 'Math.E');

    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('x', `"use strict"; return (${jsExpr});`);
      // quick test
      fn(1);
      return fn;
    } catch {
      return (x: number) => x * x - 4;
    }
  }, [expression]);

  const [minX, maxX] = rangeX;
  const [minY, maxY] = rangeY;

  const toSvgX = (x: number) => ((x - minX) / (maxX - minX)) * width;
  const toSvgY = (y: number) => height - ((y - minY) / (maxY - minY)) * height;

  const originX = toSvgX(0);
  const originY = toSvgY(0);

  // Generate curve path
  const curvePath = useMemo(() => {
    const steps = 140;
    const dx = (maxX - minX) / steps;
    const segments: string[][] = [];
    let currentSegment: string[] = [];

    for (let i = 0; i <= steps; i++) {
      const x = minX + i * dx;
      let y: number;
      try {
        y = evaluate(x);
      } catch {
        y = NaN;
      }

      if (!isNaN(y) && isFinite(y) && y >= minY - 10 && y <= maxY + 10) {
        const sx = toSvgX(x).toFixed(1);
        const sy = toSvgY(y).toFixed(1);
        currentSegment.push(`${currentSegment.length === 0 ? 'M' : 'L'} ${sx} ${sy}`);
      } else {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
      }
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    return segments.map((seg) => seg.join(' ')).join(' ');
  }, [evaluate, minX, maxX, minY, maxY, width, height]);

  // Grid tick marks
  const xTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let x = Math.ceil(minX); x <= Math.floor(maxX); x += 2) {
      if (x !== 0) ticks.push(x);
    }
    return ticks;
  }, [minX, maxX]);

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    for (let y = Math.ceil(minY); y <= Math.floor(maxY); y += 2) {
      if (y !== 0) ticks.push(y);
    }
    return ticks;
  }, [minY, maxY]);

  const axisColor = isDarkMode ? '#64748b' : '#94a3b8';
  const gridColor = isDarkMode ? 'rgba(51, 65, 85, 0.4)' : 'rgba(226, 232, 240, 0.8)';
  const textColor = isDarkMode ? '#94a3b8' : '#64748b';

  return (
    <div
      className={`w-full rounded-xl border p-2 flex flex-col items-center gap-1 my-1 transition-colors select-none ${
        isDarkMode
          ? 'bg-slate-950/70 border-slate-800 text-slate-200'
          : 'bg-slate-50 border-slate-200 text-slate-800'
      }`}
    >
      <div className="w-full flex items-center justify-between text-[11px] font-semibold px-1 text-slate-400">
        <span>График функции</span>
        <span className="font-mono text-[10px] text-blue-500">y = f(x)</span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-[390px] h-auto overflow-hidden rounded-lg cursor-crosshair border"
        style={{
          borderColor: isDarkMode ? '#1e293b' : '#e2e8f0',
          backgroundColor: isDarkMode ? '#0b0f19' : '#ffffff',
        }}
        onPointerMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = (e.clientX - rect.left) / rect.width;
          const x = minX + px * (maxX - minX);
          try {
            const y = evaluate(x);
            if (!isNaN(y) && isFinite(y)) {
              setHoverPt({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
            }
          } catch {}
        }}
        onPointerLeave={() => setHoverPt(null)}
      >
        <defs>
          <marker id="graph-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M 0 1 L 5 3 L 0 5 z" fill={axisColor} />
          </marker>
        </defs>

        {/* Subtle Background Grid */}
        {xTicks.map((x) => (
          <line
            key={`grid-x-${x}`}
            x1={toSvgX(x)}
            y1={0}
            x2={toSvgX(x)}
            y2={height}
            stroke={gridColor}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        ))}
        {yTicks.map((y) => (
          <line
            key={`grid-y-${y}`}
            x1={0}
            y1={toSvgY(y)}
            x2={width}
            y2={toSvgY(y)}
            stroke={gridColor}
            strokeWidth="1"
            strokeDasharray="2 2"
          />
        ))}

        {/* X Axis */}
        <line
          x1={4}
          y1={originY}
          x2={width - 8}
          y2={originY}
          stroke={axisColor}
          strokeWidth="1.5"
          markerEnd="url(#graph-arrow)"
        />
        <text x={width - 12} y={originY - 5} fontSize="10" fontStyle="italic" fill={textColor}>
          x
        </text>

        {/* Y Axis */}
        <line
          x1={originX}
          y1={height - 4}
          x2={originX}
          y2={8}
          stroke={axisColor}
          strokeWidth="1.5"
          markerEnd="url(#graph-arrow)"
        />
        <text x={originX + 6} y={12} fontSize="10" fontStyle="italic" fill={textColor}>
          y
        </text>

        {/* Tick labels */}
        {xTicks.map((x) => (
          <text
            key={`tick-x-${x}`}
            x={toSvgX(x)}
            y={originY + 12}
            textAnchor="middle"
            fontSize="8"
            fill={textColor}
          >
            {x}
          </text>
        ))}

        {/* Function Curve */}
        {curvePath && (
          <path
            d={curvePath}
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}

        {/* Interactive Hover Point */}
        {hoverPt && (
          <g>
            <circle
              cx={toSvgX(hoverPt.x)}
              cy={toSvgY(hoverPt.y)}
              r="4"
              fill="#ef4444"
              stroke="#ffffff"
              strokeWidth="1.5"
            />
            <text
              x={Math.min(toSvgX(hoverPt.x) + 8, width - 65)}
              y={Math.max(toSvgY(hoverPt.y) - 8, 15)}
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
              fill={isDarkMode ? '#f8fafc' : '#0f172a'}
            >
              ({hoverPt.x}, {hoverPt.y})
            </text>
          </g>
        )}
      </svg>
    </div>
  );
};
