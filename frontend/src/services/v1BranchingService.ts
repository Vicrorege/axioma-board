import type { TldrawApp, ArrowBinding } from '@tldraw/tldraw';
import { TDShapeType } from '@tldraw/tldraw';

function extractFormulaAndExplanation(text: string): { explanation: string; formula: string } {
  const s = (text || '').trim().replace(/^(?:\d+[\.\)]\s*|Шаг\s*\d+:\s*)/i, '').trim();

  const matches = [...s.matchAll(/\${1,2}([^\$]+)\${1,2}/g)].map((m) => m[1].trim());
  if (matches.length > 0) {
    const formula = matches.reduce((a, b) => (b.length > a.length ? b : a), matches[0]);
    let expl = s.replace(/\${1,2}[^\$]+\${1,2}/g, '').trim();
    expl = expl.replace(/[:\s\.]+$/, '').trim();
    return { explanation: expl, formula };
  }

  if (s.includes(':')) {
    const colonIdx = s.indexOf(':');
    const p1 = s.slice(0, colonIdx).trim();
    const p2 = s.slice(colonIdx + 1).trim();
    if (['=', '<', '>', '\\le', '\\ge', '\\in', '\\pm', '->', '→'].some((op) => p2.includes(op))) {
      return { explanation: p1, formula: p2.replace(/^\$+|\$+$/g, '').trim() };
    }
  }

  return { explanation: s, formula: '' };
}

function estimateCardHeight(latexStr: string, commentStr: string): number {
  const l = (latexStr || '').trim();
  const c = (commentStr || '').trim();

  const baseH = 46;
  let formulaH = 0;
  if (l) {
    if (l.includes('\\frac') || l.includes('\\int') || l.includes('\\sum') || l.includes('\\begin')) {
      formulaH = 75;
    } else {
      formulaH = 50;
    }
  }

  let textH = 0;
  if (c) {
    const charsPerLine = 40;
    const lines = Math.max(1, Math.ceil(c.length / charsPerLine));
    textH = 20 + lines * 22;
  }

  return Math.max(140, baseH + formulaH + textH + 34);
}

export function branchOutV1Steps(
  app: TldrawApp,
  parentShape: { id: string; point: number[]; size: number[] },
  steps: string[],
  finalResultLatex: string
) {
  if (!steps || steps.length === 0) return;

  const stepWidth = 430;
  const spacingX = 90;
  const spacingY = 36;
  const maxRowsPerCol = steps.length > 4 ? 3 : 2;
  const numCols = Math.ceil(steps.length / maxRowsPerCol);

  const colRunningY = new Array(numCols).fill(parentShape.point[1]);
  const stepCards: { id: string; point: [number, number]; size: [number, number] }[] = [];
  const shapesToCreate: any[] = [];
  const bindingsToCreate: ArrowBinding[] = [];

  steps.forEach((stepText, idx) => {
    const stepCardId = 'step_' + Math.random().toString(36).slice(2, 9);
    const col = Math.floor(idx / maxRowsPerCol);

    const { explanation, formula } = extractFormulaAndExplanation(stepText);
    const cardLatex = formula || (idx === steps.length - 1 ? finalResultLatex : '');
    const cardComment = explanation;
    const cardHeight = estimateCardHeight(cardLatex, cardComment);

    const nextX = parentShape.point[0] + parentShape.size[0] + spacingX + col * (stepWidth + spacingX);
    const nextY = colRunningY[col];
    colRunningY[col] += cardHeight + spacingY;

    stepCards.push({
      id: stepCardId,
      point: [nextX, nextY],
      size: [stepWidth, cardHeight],
    });

    const isLast = idx === steps.length - 1;

    shapesToCreate.push({
      id: stepCardId,
      type: 'rectangle' as any,
      name: `Шаг ${idx + 1}`,
      point: [nextX, nextY],
      size: [stepWidth, cardHeight],
      title: `Шаг ${idx + 1}`,
      latex: cardLatex,
      resultLatex: isLast ? (finalResultLatex || cardLatex) : '',
      comment: cardComment,
      color: isLast ? '#10b981' : '#8b5cf6',
      error: '',
    });
  });

  // Create connecting magnetic arrows
  // 1. Parent to Step 1
  if (stepCards.length > 0) {
    const arrow1Id = 'arrow_' + Math.random().toString(36).slice(2, 9);
    const firstStep = stepCards[0];

    shapesToCreate.push({
      id: arrow1Id,
      type: TDShapeType.Arrow,
      point: [parentShape.point[0] + parentShape.size[0], parentShape.point[1] + 60],
      handles: {
        start: { id: 'start', index: 0, point: [0, 0], canBind: true },
        bend: { id: 'bend', index: 1, point: [spacingX / 2, 0] },
        end: { id: 'end', index: 2, point: [spacingX, firstStep.point[1] - parentShape.point[1]], canBind: true },
      },
      style: {
        color: 'purple',
        size: 'small',
        dash: 'draw',
      },
    });

    bindingsToCreate.push({
      id: 'bind_' + Math.random().toString(36).slice(2, 9),
      toId: parentShape.id,
      fromId: arrow1Id,
      handleId: 'start',
      distance: 16,
      point: [1, 0.2],
    });

    bindingsToCreate.push({
      id: 'bind_' + Math.random().toString(36).slice(2, 9),
      toId: firstStep.id,
      fromId: arrow1Id,
      handleId: 'end',
      distance: 16,
      point: [0, 0.2],
    });
  }

  // 2. Sequential Step-to-Step arrows
  for (let i = 0; i < stepCards.length - 1; i++) {
    const fromCard = stepCards[i];
    const toCard = stepCards[i + 1];
    const arrowId = 'arrow_' + Math.random().toString(36).slice(2, 9);

    const isNextCol = Math.floor((i + 1) / maxRowsPerCol) > Math.floor(i / maxRowsPerCol);

    const startPt = isNextCol
      ? [fromCard.point[0] + fromCard.size[0], fromCard.point[1] + 50]
      : [fromCard.point[0] + fromCard.size[0] / 2, fromCard.point[1] + fromCard.size[1]];

    const endDelta = isNextCol
      ? [toCard.point[0] - startPt[0], toCard.point[1] - startPt[1] + 50]
      : [0, toCard.point[1] - startPt[1]];

    shapesToCreate.push({
      id: arrowId,
      type: TDShapeType.Arrow,
      point: startPt,
      handles: {
        start: { id: 'start', index: 0, point: [0, 0], canBind: true },
        bend: { id: 'bend', index: 1, point: [endDelta[0] / 2, endDelta[1] / 2] },
        end: { id: 'end', index: 2, point: endDelta, canBind: true },
      },
      style: {
        color: 'purple',
        size: 'small',
        dash: 'draw',
      },
    });

    bindingsToCreate.push({
      id: 'bind_' + Math.random().toString(36).slice(2, 9),
      toId: fromCard.id,
      fromId: arrowId,
      handleId: 'start',
      distance: 16,
      point: isNextCol ? [1, 0.5] : [0.5, 1],
    });

    bindingsToCreate.push({
      id: 'bind_' + Math.random().toString(36).slice(2, 9),
      toId: toCard.id,
      fromId: arrowId,
      handleId: 'end',
      distance: 16,
      point: isNextCol ? [0, 0.5] : [0.5, 0],
    });
  }

  // Atomically create all step cards and bound arrows in tldraw v1!
  app.create(shapesToCreate, bindingsToCreate);
}
