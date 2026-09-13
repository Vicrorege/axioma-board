import React, { useMemo } from 'react';

export interface NumberLineProps {
  latex: string;
  isDarkMode?: boolean;
  className?: string;
}

interface IntervalData {
  leftOpen: boolean;
  leftVal: string;
  rightVal: string;
  rightOpen: boolean;
  sign: '+' | '-';
}

interface CriticalPoint {
  val: string;
  num: number;
  isOpen: boolean;
  x: number;
}

export const NumberLineChart: React.FC<NumberLineProps> = ({
  latex,
  isDarkMode = false,
  className = '',
}) => {
  const intervals = useMemo<IntervalData[]>(() => {
    if (!latex) return [];
    // Match patterns like: (-\infty, -4) \; [-], \quad (-4, 1) \; [+], (1, 4) [-]
    const regex = /([(\[])([^,]+),\s*([^\])]+)([)\]])\s*(?:\\;|\\quad|\s)*\[([+-])\]/g;
    const items: IntervalData[] = [];
    let match;

    while ((match = regex.exec(latex)) !== null) {
      const leftOpen = match[1] === '(';
      const leftVal = match[2].trim();
      const rightVal = match[3].trim();
      const rightOpen = match[4] === ')';
      const sign = match[5] as '+' | '-';

      items.push({
        leftOpen,
        leftVal,
        rightVal,
        rightOpen,
        sign,
      });
    }

    return items;
  }, [latex]);

  const points = useMemo<CriticalPoint[]>(() => {
    if (intervals.length === 0) return [];

    const rawPointsMap = new Map<string, boolean>();

    intervals.forEach((inv) => {
      if (!inv.leftVal.includes('\\infty') && !inv.leftVal.includes('infty')) {
        rawPointsMap.set(inv.leftVal, inv.leftOpen);
      }
      if (!inv.rightVal.includes('\\infty') && !inv.rightVal.includes('infty')) {
        rawPointsMap.set(inv.rightVal, inv.rightOpen);
      }
    });

    const parseNum = (str: string): number => {
      const clean = str.replace(/[{}\s]/g, '');
      if (clean.includes('\\frac')) {
        const m = clean.match(/\\frac(?:\{([^}]+)\}|(\d+))(?:\{([^}]+)\}|(\d+))/);
        if (m) {
          const num = parseFloat(m[1] || m[2]);
          const den = parseFloat(m[3] || m[4]);
          if (!isNaN(num) && !isNaN(den) && den !== 0) {
            return clean.startsWith('-') ? -Math.abs(num / den) : num / den;
          }
        }
      }
      const n = parseFloat(clean);
      return isNaN(n) ? 0 : n;
    };

    const sortedEntries = Array.from(rawPointsMap.entries()).sort(
      (a, b) => parseNum(a[0]) - parseNum(b[0])
    );

    const count = sortedEntries.length;
    if (count === 0) return [];

    // Distribute points along width: 390px total, margin left 60, margin right 60
    const startX = 65;
    const endX = 335;
    const span = count === 1 ? 0 : (endX - startX) / (count - 1);

    return sortedEntries.map(([val, isOpen], i) => {
      const x = count === 1 ? (startX + endX) / 2 : startX + i * span;
      return {
        val,
        num: parseNum(val),
        isOpen,
        x: Math.round(x),
      };
    });
  }, [intervals]);

  if (intervals.length === 0 || points.length === 0) {
    return null;
  }

  const svgWidth = 400;
  const svgHeight = 120;
  const axisY = 68;

  const axisColor = isDarkMode ? '#64748b' : '#94a3b8';
  const textColor = isDarkMode ? '#cbd5e1' : '#334155';

  // Build the interval curve (Method of Intervals snake wave)
  // For each interval, draw an arc above axis for +, below axis for -
  const wavePaths: React.ReactNode[] = [];
  const signBadges: React.ReactNode[] = [];

  const leftMarginX = 25;
  const rightMarginX = 375;

  // 1. Leftmost interval (-inf to point 0)
  const firstPt = points[0];
  const firstInv = intervals[0];
  if (firstInv) {
    const isPos = firstInv.sign === '+';
    const arcHeight = isPos ? 28 : -22;
    const midX = (leftMarginX + firstPt.x) / 2;
    const controlY = axisY - arcHeight * 1.5;

    wavePaths.push(
      <path
        key="wave-left"
        d={`M ${leftMarginX} ${axisY - arcHeight * 0.8} Q ${midX} ${controlY} ${firstPt.x} ${axisY}`}
        stroke={isPos ? '#10b981' : '#f43f5e'}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        className="opacity-90"
      />
    );

    signBadges.push(
      <g key="sign-left" transform={`translate(${midX}, ${axisY - (isPos ? 34 : -30)})`}>
        <circle
          r="11"
          fill={isPos ? 'rgba(16, 185, 129, 0.18)' : 'rgba(244, 63, 94, 0.18)'}
          stroke={isPos ? '#10b981' : '#f43f5e'}
          strokeWidth="1.5"
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="12"
          fontWeight="bold"
          fill={isPos ? '#10b981' : '#f43f5e'}
        >
          {firstInv.sign}
        </text>
      </g>
    );
  }

  // 2. Middle intervals between consecutive points
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const inv = intervals[i + 1];
    if (!inv) continue;

    const isPos = inv.sign === '+';
    const arcHeight = isPos ? 28 : -22;
    const midX = (p1.x + p2.x) / 2;
    const controlY = axisY - arcHeight * 1.5;

    wavePaths.push(
      <path
        key={`wave-mid-${i}`}
        d={`M ${p1.x} ${axisY} Q ${midX} ${controlY} ${p2.x} ${axisY}`}
        stroke={isPos ? '#10b981' : '#f43f5e'}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        className="opacity-90"
      />
    );

    signBadges.push(
      <g key={`sign-mid-${i}`} transform={`translate(${midX}, ${axisY - (isPos ? 34 : -30)})`}>
        <circle
          r="11"
          fill={isPos ? 'rgba(16, 185, 129, 0.18)' : 'rgba(244, 63, 94, 0.18)'}
          stroke={isPos ? '#10b981' : '#f43f5e'}
          strokeWidth="1.5"
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="12"
          fontWeight="bold"
          fill={isPos ? '#10b981' : '#f43f5e'}
        >
          {inv.sign}
        </text>
      </g>
    );
  }

  // 3. Rightmost interval (last point to +inf)
  const lastPt = points[points.length - 1];
  const lastInv = intervals[intervals.length - 1];
  if (lastInv) {
    const isPos = lastInv.sign === '+';
    const arcHeight = isPos ? 28 : -22;
    const midX = (lastPt.x + rightMarginX) / 2;
    const controlY = axisY - arcHeight * 1.5;

    wavePaths.push(
      <path
        key="wave-right"
        d={`M ${lastPt.x} ${axisY} Q ${midX} ${controlY} ${rightMarginX} ${axisY - arcHeight * 0.8}`}
        stroke={isPos ? '#10b981' : '#f43f5e'}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
        className="opacity-90"
      />
    );

    signBadges.push(
      <g key="sign-right" transform={`translate(${midX}, ${axisY - (isPos ? 34 : -30)})`}>
        <circle
          r="11"
          fill={isPos ? 'rgba(16, 185, 129, 0.18)' : 'rgba(244, 63, 94, 0.18)'}
          stroke={isPos ? '#10b981' : '#f43f5e'}
          strokeWidth="1.5"
        />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="12"
          fontWeight="bold"
          fill={isPos ? '#10b981' : '#f43f5e'}
        >
          {lastInv.sign}
        </text>
      </g>
    );
  }

  return (
    <div
      className={`w-full rounded-xl p-2 border flex flex-col items-center gap-1 my-1 transition-colors ${
        isDarkMode
          ? 'bg-slate-950/60 border-slate-800 text-slate-200'
          : 'bg-slate-50 border-slate-200 text-slate-800'
      } ${className}`}
    >
      <div className="w-full flex items-center justify-between text-[11px] font-semibold px-2 text-slate-400">
        <span>Числовая прямая (метод интервалов)</span>
        <span className="text-[10px] text-emerald-500 font-mono">+ / − знаки</span>
      </div>

      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full max-w-[390px] h-auto overflow-visible select-none"
      >
        <defs>
          <marker
            id="axis-arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="6"
            refY="4"
            orient="auto"
          >
            <path d="M 1 1.5 L 6 4 L 1 6.5 z" fill={axisColor} />
          </marker>
        </defs>

        {/* 1. Main Horizontal Axis */}
        <line
          x1={leftMarginX - 10}
          y1={axisY}
          x2={rightMarginX + 15}
          y2={axisY}
          stroke={axisColor}
          strokeWidth="2.5"
          markerEnd="url(#axis-arrowhead)"
        />

        {/* Axis Label 'x' */}
        <text
          x={rightMarginX + 18}
          y={axisY + 4}
          fontSize="13"
          fontStyle="italic"
          fontWeight="bold"
          fill={textColor}
        >
          x
        </text>

        {/* 2. Wave Curves across intervals */}
        {wavePaths}

        {/* 3. Sign Badges (+ / -) */}
        {signBadges}

        {/* 4. Critical Points on the axis */}
        {points.map((pt, idx) => (
          <g key={`pt-${idx}`}>
            {/* Small vertical tick on axis */}
            <line
              x1={pt.x}
              y1={axisY - 6}
              x2={pt.x}
              y2={axisY + 6}
              stroke={axisColor}
              strokeWidth="1.5"
            />

            {/* Point circle: open or filled */}
            <circle
              cx={pt.x}
              cy={axisY}
              r="5.5"
              fill={pt.isOpen ? (isDarkMode ? '#0f172a' : '#ffffff') : '#3b82f6'}
              stroke="#3b82f6"
              strokeWidth="2"
            />

            {/* Value label below point */}
            <text
              x={pt.x}
              y={axisY + 22}
              textAnchor="middle"
              fontSize="12"
              fontWeight="bold"
              fontFamily="monospace"
              fill={textColor}
            >
              {pt.val}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};
