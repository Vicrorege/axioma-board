import type { TDDocument } from '@tldraw/tldraw';

/**
 * Validates and cleans canvas document data before passing to tldraw.
 * Drops any shape with NaN/null coordinates or broken handles that would crash
 * tldraw bounds calculations when scrolled into view.
 */
export function sanitizeCanvasDocument(doc: any): TDDocument {
  if (!doc || !doc.pages || typeof doc.pages !== 'object') {
    return doc;
  }

  try {
    const cleanDoc = JSON.parse(JSON.stringify(doc));

    for (const pageId of Object.keys(cleanDoc.pages)) {
      const page = cleanDoc.pages[pageId];
      if (!page || !page.shapes || typeof page.shapes !== 'object') continue;

      const validShapeIds = new Set<string>();

      for (const [shapeId, shape] of Object.entries(page.shapes) as [string, any][]) {
        if (!shape || typeof shape !== 'object') {
          delete page.shapes[shapeId];
          continue;
        }

        const pt = shape.point;
        if (!Array.isArray(pt) || pt.length < 2 || !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])) {
          console.warn(`[Sanitizer] Removing shape ${shapeId} with invalid point:`, pt);
          delete page.shapes[shapeId];
          continue;
        }

        // Validate size
        if (shape.size && Array.isArray(shape.size)) {
          if (!Number.isFinite(shape.size[0]) || !Number.isFinite(shape.size[1])) {
            shape.size = [440, 360];
          }
        }

        // Validate arrows specifically
        if (shape.type === 'arrow') {
          const handles = shape.handles;
          if (!handles || !handles.start || !handles.end) {
            console.warn(`[Sanitizer] Removing arrow ${shapeId} with missing handles`);
            delete page.shapes[shapeId];
            continue;
          }

          const sPt = handles.start.point;
          const ePt = handles.end.point;
          if (
            !Array.isArray(sPt) ||
            !Number.isFinite(sPt[0]) ||
            !Number.isFinite(sPt[1]) ||
            !Array.isArray(ePt) ||
            !Number.isFinite(ePt[0]) ||
            !Number.isFinite(ePt[1])
          ) {
            console.warn(`[Sanitizer] Removing arrow ${shapeId} with invalid handle points:`, { sPt, ePt });
            delete page.shapes[shapeId];
            continue;
          }

          if (handles.bend && handles.bend.point) {
            const bPt = handles.bend.point;
            if (!Array.isArray(bPt) || !Number.isFinite(bPt[0]) || !Number.isFinite(bPt[1])) {
              handles.bend.point = [
                Math.round((sPt[0] + ePt[0]) / 2),
                Math.round((sPt[1] + ePt[1]) / 2),
              ];
            }
          }
        }

        validShapeIds.add(shapeId);
      }

      // Remove orphaned bindings
      if (page.bindings && typeof page.bindings === 'object') {
        for (const [bindId, binding] of Object.entries(page.bindings) as [string, any][]) {
          if (!binding || !validShapeIds.has(binding.fromId) || !validShapeIds.has(binding.toId)) {
            delete page.bindings[bindId];
          }
        }
      }
    }

    return cleanDoc;
  } catch (err) {
    console.error('[Sanitizer] Failed to sanitize document:', err);
    return doc;
  }
}
