import type { TldrawApp } from '@tldraw/tldraw';
import { TDShapeType } from '@tldraw/tldraw';
import type { SolutionMethod, MilestoneStage } from '../types/math';

interface CleanStepCard {
  title: string;
  latex: string;
  comment: string;
  isLast: boolean;
}

function parseMethodIntoCards(
  methodOrSteps: SolutionMethod | string[],
  finalResultLatex: string
): CleanStepCard[] {
  // If structured milestones are present, prefer them for clean high-signal display
  if (
    typeof methodOrSteps === 'object' &&
    methodOrSteps !== null &&
    'milestones' in methodOrSteps &&
    Array.isArray(methodOrSteps.milestones) &&
    methodOrSteps.milestones.length > 0
  ) {
    const msList = methodOrSteps.milestones as MilestoneStage[];
    return msList.map((m, idx) => {
      const isLast = idx === msList.length - 1;
      let formula = (m.result_latex || '').trim();
      let comment = (m.summary || '').trim();

      if (formula && comment.includes(formula)) {
        comment = comment.replace(formula, '').replace(/\${1,2}/g, '').replace(/[:\s\.]+$/, '').trim();
      }

      if (m.sub_steps && m.sub_steps.length > 0) {
        const cleanSubs = m.sub_steps.map((s) => s.replace(/^(?:\d+[\.\)]\s*)/, '').trim());
        if (cleanSubs.length > 0) {
          comment = (comment ? `${comment}\n\n` : '') + cleanSubs.join('\n');
        }
      }

      return {
        title: `Этап ${idx + 1}: ${m.title}`,
        latex: formula || (isLast ? finalResultLatex : ''),
        comment,
        isLast,
      };
    });
  }

  // Fallback to raw steps
  const steps: string[] = Array.isArray(methodOrSteps)
    ? methodOrSteps
    : (methodOrSteps as SolutionMethod)?.steps || [];

  return steps.map((stepText, idx) => {
    const isLast = idx === steps.length - 1;
    const s = (stepText || '').trim().replace(/^(?:\d+[\.\)]\s*|Шаг\s*\d+:\s*)/i, '').trim();

    const matches = [...s.matchAll(/\${1,2}([^\$]+)\${1,2}/g)].map((m) => m[1].trim());
    let formula = '';
    let explanation = '';

    if (matches.length > 0) {
      const eq = matches.find((f) => f.includes('=') && !f.startsWith('ax^2'));
      formula = eq || matches[matches.length - 1];
      explanation = s.replace(/\${1,2}[^\$]+\${1,2}/g, '').replace(/[:\s\.]+$/, '').trim();
    } else if (s.includes(':')) {
      const parts = s.split(':', 2);
      explanation = parts[0].trim();
      formula = parts[1].replace(/^\$+|\$+$/g, '').trim();
    } else {
      explanation = s;
      formula = isLast ? finalResultLatex : '';
    }

    return {
      title: `Шаг ${idx + 1}`,
      latex: formula,
      comment: explanation,
      isLast,
    };
  });
}

function estimateCardHeight(latexStr: string, commentStr: string, isLast: boolean): number {
  const l = (latexStr || '').trim();
  const c = (commentStr || '').trim();

  // Header (44px) + actions (72px) + formula (68px) + padding/border (34px) + gaps (36px) = base ~254px
  let h = 254;
  if (l.includes('\\frac')) h += 30;
  if (c) {
    const lines = Math.max(1, Math.ceil(c.length / 32));
    h += 38 + lines * 22;
  }
  if (isLast) h += 70; // Final answer block

  return Math.max(300, h);
}

export function branchOutV1Steps(
  app: TldrawApp,
  parentShape: { id: string; point: number[]; size: number[] },
  methodOrSteps: SolutionMethod | string[],
  finalResultLatex: string
) {
  if (!methodOrSteps || !app) return;

  const cardsData = parseMethodIntoCards(methodOrSteps, finalResultLatex);
  if (cardsData.length === 0) return;

  const stepWidth = 430;
  const spacingX = 130;
  const spacingY = 90;

  const startX = Math.round(parentShape.point[0] + parentShape.size[0] + spacingX);
  const startY = Math.round(parentShape.point[1]);

  const cards: Array<{
    id: string;
    point: [number, number];
    size: [number, number];
    col: number;
    row: number;
    isLast: boolean;
  }> = [];
  const shapesToCreate: any[] = [];

  // Track dynamic cumulative height per column to prevent ANY vertical overlap
  const colRunningY = new Map<number, number>();

  cardsData.forEach((cd, idx) => {
    const cardId = 'step_' + Math.random().toString(36).slice(2, 9);
    const col = Math.floor(idx / 2);
    const row = idx % 2;

    const cardH = estimateCardHeight(cd.latex, cd.comment, cd.isLast);

    const cardX = startX + col * (stepWidth + spacingX);
    const currentY = colRunningY.get(col) ?? startY;
    const cardY = currentY;

    // Advance this column's running bottom
    colRunningY.set(col, currentY + cardH + spacingY);

    cards.push({
      id: cardId,
      point: [cardX, cardY],
      size: [stepWidth, cardH],
      col,
      row,
      isLast: cd.isLast,
    });

    shapesToCreate.push({
      id: cardId,
      type: TDShapeType.Rectangle,
      point: [cardX, cardY],
      size: [stepWidth, cardH],
      title: cd.title,
      latex: cd.latex,
      resultLatex: cd.isLast && cd.latex !== finalResultLatex ? finalResultLatex : '',
      comment: cd.comment,
      cardType: cd.isLast ? 'answer' : 'explanation',
      isLast: cd.isLast,
      color: cd.isLast ? '#10b981' : '#8b5cf6',
      isMathBlock: true,
      error: '',
      style: {
        color: 'black',
        size: 'small',
        isFilled: false,
        dash: 'draw',
        scale: 1,
      },
    });
  });

  // Connecting vector conduit arrows with zero gaps:
  // 1. Initial arrow from Parent Card to Step 1
  const firstCard = cards[0];
  const pStartX = Math.round(parentShape.point[0] + parentShape.size[0]);
  const pStartY = Math.round(parentShape.point[1] + 60);
  const pEndX = Math.round(firstCard.point[0]);
  const pdx = pEndX - pStartX;

  shapesToCreate.push({
    id: 'arrow_' + Math.random().toString(36).slice(2, 9),
    type: TDShapeType.Rectangle,
    fromId: parentShape.id,
    toId: firstCard.id,
    point: [pStartX, pStartY - 15],
    size: [Math.max(pdx, 20), 30],
    isConduit: true,
    conduitPath: `M 0 15 H ${pdx}`,
    color: '#3b82f6',
    style: {
      color: 'blue',
      size: 'small',
      isFilled: false,
      dash: 'solid',
    },
  });

  // 2. Sequential connecting arrows between step cards
  for (let i = 0; i < cards.length - 1; i++) {
    const cur = cards[i];
    const nxt = cards[i + 1];
    const arrowId = 'arrow_' + Math.random().toString(36).slice(2, 9);
    const isLastArrow = i === cards.length - 2;

    if (cur.col === nxt.col) {
      // Downward vertical connection inside same column (e.g. Step 1 -> Step 2)
      const startX = cur.point[0] + Math.round(stepWidth / 2);
      const startY = cur.point[1] + cur.size[1];
      const endY = nxt.point[1];
      const dy = endY - startY;

      shapesToCreate.push({
        id: arrowId,
        type: TDShapeType.Rectangle,
        fromId: cur.id,
        toId: nxt.id,
        point: [startX - 15, startY],
        size: [30, Math.max(dy, 10)],
        isConduit: true,
        conduitPath: `M 15 0 V ${dy}`,
        color: isLastArrow ? '#10b981' : '#8b5cf6',
        style: {
          color: 'purple',
          size: 'small',
          isFilled: false,
          dash: 'solid',
        },
      });
    } else {
      // Column transition (e.g. bottom card of Col k to top card of Col k+1)
      const startX = cur.point[0] + cur.size[0];
      const startY = cur.point[1] + 60;
      const endX = nxt.point[0];
      const endY = nxt.point[1] + 60;

      const minX = Math.min(startX, endX);
      const minY = Math.min(startY, endY);

      const sx = startX - minX;
      const sy = startY - minY;
      const ex = endX - minX;
      const ey = endY - minY;

      const mx = Math.round((sx + ex) / 2);
      const r = 16;

      const conduitPath = `M ${sx} ${sy} H ${mx - r} Q ${mx} ${sy} ${mx} ${sy - r} V ${ey + r} Q ${mx} ${ey} ${mx + r} ${ey} H ${ex}`;

      shapesToCreate.push({
        id: arrowId,
        type: TDShapeType.Rectangle,
        fromId: cur.id,
        toId: nxt.id,
        point: [minX, minY],
        size: [Math.max(sx, ex, 30), Math.max(sy, ey, 30)],
        isConduit: true,
        conduitPath,
        color: isLastArrow ? '#10b981' : '#8b5cf6',
        style: {
          color: 'purple',
          size: 'small',
          isFilled: false,
          dash: 'solid',
        },
      });
    }
  }

  app.createShapes(...shapesToCreate);
}
