import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tldraw } from '@tldraw/tldraw';
import type { TldrawApp, TDDocument } from '@tldraw/tldraw';
import { TDShapeType } from '@tldraw/tldraw';
import 'katex/dist/katex.min.css';

import { TopBar } from './components/TopBar';
import { V1BottomToolbar } from './components/V1BottomToolbar';
import { TemplatesSidebar } from './components/TemplatesSidebar';
import { DevPlaceholder } from './components/DevPlaceholder';
import { AuthModal } from './components/AuthModal';
import { UserDashboard } from './components/UserDashboard';
import { sendClientLog } from './services/telemetry';
import { boardsApi, authApi } from './services/api';
import { installV1MathShapePatch } from './shapes/v1/installV1MathShapePatch';
import type { Board, MathBlockData, ArrowConnection } from './types/math';
import type { User } from './types/auth';

installV1MathShapePatch();

const COOKIE_NAME = 'axioma_dev_token';
const CONFIGURED_DEV_TOKEN = import.meta.env.VITE_DEV_TOKEN;
const VALID_DEV_TOKENS = CONFIGURED_DEV_TOKEN ? [CONFIGURED_DEV_TOKEN] : [];

function getCookie(name: string): string | null {
  try {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

function setTokenStorage(value: string) {
  try {
    const d = new Date();
    d.setTime(d.getTime() + 30 * 24 * 60 * 60 * 1000);
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)};expires=${d.toUTCString()};path=/;SameSite=Lax`;
    localStorage.setItem(COOKIE_NAME, value);
  } catch (e) {
    console.warn('Could not set storage', e);
  }
}

function clearTokenStorage() {
  try {
    document.cookie = `${COOKIE_NAME}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
    localStorage.removeItem(COOKIE_NAME);
  } catch (e) {
    console.warn('Could not clear storage', e);
  }
}

function checkIsUnlocked(): boolean {
  if (VALID_DEV_TOKENS.length === 0) return true;
  try {
    const params = new URLSearchParams(window.location.search);
    const keyFromUrl = params.get('dev_key');
    if (keyFromUrl && VALID_DEV_TOKENS.includes(keyFromUrl)) {
      setTokenStorage(keyFromUrl);
      const cleanUrl = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, cleanUrl);
      return true;
    }
    const tokenCookie = getCookie(COOKIE_NAME);
    if (tokenCookie && VALID_DEV_TOKENS.includes(tokenCookie)) return true;
    const tokenLocal = localStorage.getItem(COOKIE_NAME);
    if (tokenLocal && VALID_DEV_TOKENS.includes(tokenLocal)) {
      setTokenStorage(tokenLocal);
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

function sanitizeTDDocument(doc: any): any {
  if (!doc || !doc.pages) return doc;
  const cleanDoc = { ...doc, pages: { ...doc.pages } };

  for (const [pageId, page] of Object.entries(cleanDoc.pages as Record<string, any>)) {
    if (!page || !page.shapes) continue;
    const cleanShapes: Record<string, any> = {};
    const validShapeIds = new Set<string>();

    for (const [shapeId, rawShape] of Object.entries(page.shapes as Record<string, any>)) {
      if (!rawShape || typeof rawShape !== 'object') continue;

      const pt = rawShape.point;
      if (!Array.isArray(pt) || pt.length < 2 || typeof pt[0] !== 'number' || typeof pt[1] !== 'number' || isNaN(pt[0]) || isNaN(pt[1])) {
        console.warn(`[Sanitizer] Dropping shape ${shapeId} with invalid point:`, pt);
        continue;
      }

      const parentId = rawShape.parentId || pageId;
      const defaultStyle = { color: 'black', size: 'small', isFilled: false, dash: 'draw', scale: 1 };
      const style = rawShape.style && typeof rawShape.style === 'object' ? { ...defaultStyle, ...rawShape.style } : defaultStyle;
      const childIndex = typeof rawShape.childIndex === 'number' ? rawShape.childIndex : 1;

      let handles = rawShape.handles;
      if (rawShape.type === 'arrow') {
        if (!handles || typeof handles !== 'object') {
          handles = {
            start: { id: 'start', index: 0, point: [0, 0] },
            bend: { id: 'bend', index: 1, point: [50, 0] },
            end: { id: 'end', index: 2, point: [100, 0] },
          };
        } else {
          handles = { ...handles };
          for (const hid of ['start', 'bend', 'end']) {
            const h = handles[hid];
            if (!h || !Array.isArray(h.point) || typeof h.point[0] !== 'number' || isNaN(h.point[0])) {
              handles[hid] = { id: hid, index: hid === 'start' ? 0 : hid === 'bend' ? 1 : 2, point: [0, 0] };
            }
          }
        }
      }

      cleanShapes[shapeId] = {
        ...rawShape,
        parentId,
        childIndex,
        style,
        handles,
      };
      validShapeIds.add(shapeId);
    }

    const cleanBindings: Record<string, any> = {};
    if (page.bindings && typeof page.bindings === 'object') {
      for (const [bindId, bind] of Object.entries(page.bindings as Record<string, any>)) {
        if (bind && validShapeIds.has(bind.toId) && validShapeIds.has(bind.fromId)) {
          cleanBindings[bindId] = bind;
        }
      }
    }

    // Drop ghost bindingIds on arrows
    for (const [, s] of Object.entries(cleanShapes)) {
      if (s.type === 'arrow' && s.handles) {
        for (const hid of ['start', 'end']) {
          if (s.handles[hid]?.bindingId && !cleanBindings[s.handles[hid].bindingId]) {
            delete s.handles[hid].bindingId;
          }
        }
      }
    }

    cleanDoc.pages[pageId] = {
      ...page,
      shapes: cleanShapes,
      bindings: cleanBindings,
    };
  }

  return cleanDoc;
}

export const App: React.FC = () => {
  const [isDevUnlocked, setIsDevUnlocked] = useState(checkIsUnlocked);
  const [board, setBoard] = useState<Board | null>(null);
  const [isBoardLoading, setIsBoardLoading] = useState(true);
  const [boardTitle, setBoardTitle] = useState('My Workspace');
  const [boardsList, setBoardsList] = useState<Array<{ id: string; title: string; created_at: string; updated_at: string }>>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [app, setApp] = useState<TldrawApp | null>(null);
  const [activeTool, setActiveTool] = useState('select');
  const [formulaSubtool, setFormulaSubtool] = useState<'full' | 'formula'>('full');
  const [isToolLocked, setIsToolLocked] = useState(false);
  const [viewMode, setViewMode] = useState<'board' | 'dashboard'>('board');

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('axioma_theme');
      if (saved) return saved === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  const appRef = useRef<TldrawApp | null>(null);
  const boardRef = useRef<Board | null>(null);
  boardRef.current = board;
  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    try {
      localStorage.setItem('axioma_theme', isDarkMode ? 'dark' : 'light');
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      if (appRef.current && appRef.current.settings.isDarkMode !== isDarkMode) {
        appRef.current.toggleDarkMode();
      }
    } catch (e) {
      console.warn('Theme switch error', e);
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode((prev) => !prev);

  const handleLock = () => {
    clearTokenStorage();
    setIsDevUnlocked(false);
  };

  useEffect(() => {
    async function loadUser() {
      const user = await authApi.me();
      if (user) {
        setCurrentUser(user);
        // Authenticated user lands directly on Dashboard!
        setViewMode('dashboard');
      } else {
        // Unauthenticated user lands on DemoBoard!
        setViewMode('board');
      }
    }
    loadUser();
  }, []);

  const syncBoardToCanvas = useCallback((currentBoard: Board, targetApp: TldrawApp) => {
    if (!targetApp || !currentBoard) return;
    try {
      if (currentBoard.snapshot?.canvas_state) {
        try {
          const sanitizedDoc = sanitizeTDDocument(currentBoard.snapshot.canvas_state);
          targetApp.loadDocument(sanitizedDoc as TDDocument);
          setTimeout(() => {
            if (targetApp.shapes.length > 0) {
              targetApp.zoomToContent();
            }
          }, 150);
          return;
        } catch (err) {
          console.warn('Could not load full canvas document, fallback to blocks', err);
        }
      }

      if (currentBoard.snapshot?.blocks) {
        const shapesToCreate: any[] = [];
        currentBoard.snapshot.blocks.forEach((block) => {
          shapesToCreate.push({
            id: 'math_' + block.id,
            type: TDShapeType.Rectangle,
            point: [block.x || 150, block.y || 150],
            size: [440, 360],
            title: block.title || 'Выражение',
            latex: block.latex || '',
            resultLatex: block.result_latex || '',
            comment: block.comment || '',
            color: block.color || '#3b82f6',
            error: '',
          });
        });
        targetApp.createShapes(...shapesToCreate);
      }
    } catch (e) {
      console.warn('General sync error', e);
    }
  }, []);

  const fetchBoards = useCallback(async () => {
    setIsBoardLoading(true);
    try {
      const cachedId = localStorage.getItem('axioma_active_board_id');
      const [list, cachedBoard] = await Promise.all([
        boardsApi.list().catch(() => []),
        cachedId ? boardsApi.get(cachedId).catch(() => null) : Promise.resolve(null),
      ]);

      setBoardsList(list);

      let targetBoard = cachedBoard;
      if (!targetBoard && list.length > 0) {
        targetBoard = await boardsApi.get(list[0].id).catch(() => null);
      }

      if (targetBoard) {
        setBoard(targetBoard);
        setBoardTitle(targetBoard.title);
        localStorage.setItem('axioma_active_board_id', targetBoard.id);
        if (appRef.current) syncBoardToCanvas(targetBoard, appRef.current);
      } else if (list.length === 0) {
        const newB = await boardsApi.create('Default Workspace');
        setBoard(newB);
        setBoardTitle(newB.title);
        setBoardsList([newB]);
        localStorage.setItem('axioma_active_board_id', newB.id);
        if (appRef.current) syncBoardToCanvas(newB, appRef.current);
      }
    } catch (e) {
      console.error('Failed to load boards', e);
    } finally {
      setIsBoardLoading(false);
    }
  }, [syncBoardToCanvas]);

  useEffect(() => {
    if (!isDevUnlocked) return;
    fetchBoards();
  }, [isDevUnlocked, fetchBoards]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'MATH-FIELD' ||
          target.isContentEditable ||
          target.closest('input, textarea, math-field, [contenteditable="true"]') ||
          target.closest('.ML__keyboard'))
      ) {
        return;
      }

      // Undo: Ctrl+Z or Cmd+Z (supports English 'z', Russian 'я', and hardware KeyZ)
      const isZKey = e.key === 'z' || e.key === 'Z' || e.key === 'я' || e.key === 'Я' || e.code === 'KeyZ';
      const isYKey = e.key === 'y' || e.key === 'Y' || e.key === 'н' || e.key === 'Н' || e.code === 'KeyY';

      if ((e.ctrlKey || e.metaKey) && isZKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        const curApp = appRef.current;
        if (curApp) {
          curApp.undo();
          const curTool = (curApp as any).currentTool?.type || curApp.appState.activeTool || 'select';
          setActiveTool(curTool);
        }
        return;
      }

      // Redo: Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y / Cmd+Y
      if ((e.ctrlKey || e.metaKey) && ((isZKey && e.shiftKey) || isYKey)) {
        e.preventDefault();
        e.stopPropagation();
        const curApp = appRef.current;
        if (curApp) {
          curApp.redo();
          const curTool = (curApp as any).currentTool?.type || curApp.appState.activeTool || 'select';
          setActiveTool(curTool);
        }
        return;
      }

      if (e.key === 'q' || e.key === 'Q' || e.key === 'й' || e.key === 'Й') {
        const curApp = appRef.current;
        if (curApp) {
          e.preventDefault();
          curApp.toggleToolLock();
          setIsToolLocked(Boolean(curApp.appState.isToolLocked));
        }
        return;
      }

      if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
        e.preventDefault();
        setActiveTool((prev) => (prev === 'formula' ? 'select' : 'formula'));
        return;
      }

      if (e.key !== 'Delete' && e.key !== 'Backspace') return;

      const curApp = appRef.current;
      if (curApp && curApp.selectedIds.length > 0) {
        e.preventDefault();
        e.stopPropagation();

        const toDelete = [...curApp.selectedIds];
        const page = curApp.page;
        if (page?.bindings) {
          Object.values(page.bindings).forEach((b: any) => {
            if (toDelete.includes(b.toId) || toDelete.includes(b.fromId)) {
              if (b.fromId && !toDelete.includes(b.fromId)) {
                toDelete.push(b.fromId);
              }
            }
          });
        }

        curApp.delete(toDelete);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Click on canvas to stamp a new formula card exactly at pointer location
  useEffect(() => {
    if (activeTool !== 'formula') return;

    const handleCanvasPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.closest('[data-toolbar]') ||
        target.closest('header') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('.fixed')
      ) {
        return;
      }

      const curApp = appRef.current;
      if (!curApp) return;

      const pagePoint = curApp.getPagePoint([e.clientX, e.clientY]);
      const id = 'math_' + Math.random().toString(36).slice(2, 9);
      const isPure = formulaSubtool === 'formula';
      const cardSize: [number, number] = isPure ? [360, 110] : [440, 340];
      const cardPoint: [number, number] = [
        Math.round(pagePoint[0] - cardSize[0] / 2),
        Math.round(pagePoint[1] - cardSize[1] / 2),
      ];

      curApp.createShapes({
        id,
        type: TDShapeType.Rectangle,
        point: cardPoint,
        size: cardSize,
        title: isPure ? 'Формула' : 'Выражение',
        latex: '',
        resultLatex: '',
        comment: '',
        cardType: isPure ? 'formula' : 'full',
        color: '#3b82f6',
        isMathBlock: true,
        error: '',
        style: {
          color: 'black',
          size: 'small',
          isFilled: false,
          dash: 'draw',
          scale: 1,
        },
      } as any);

      curApp.select(id);

      if (!curApp.appState.isToolLocked) {
        setActiveTool('select');
        curApp.selectTool('select' as any);
      }
    };

    window.addEventListener('pointerdown', handleCanvasPointerDown, true);
    return () => {
      window.removeEventListener('pointerdown', handleCanvasPointerDown, true);
    };
  }, [activeTool, formulaSubtool]);

  const extractSnapshotData = (currentApp: TldrawApp) => {
    const fullDoc = currentApp.document;
    const allShapes = currentApp.shapes;

    const blocks: MathBlockData[] = [];
    const arrows: ArrowConnection[] = [];

    allShapes.forEach((s: any) => {
      if (s.type === TDShapeType.Rectangle && (s.latex !== undefined || s.title !== undefined)) {
        blocks.push({
          id: s.id.replace('math_', ''),
          x: s.point[0],
          y: s.point[1],
          title: s.title || 'Выражение',
          latex: s.latex || '',
          result_latex: s.resultLatex || '',
          comment: s.comment || '',
          color: s.color || '#3b82f6',
        });
      }
    });

    currentApp.bindings.forEach((b: any) => {
      arrows.push({
        id: b.id,
        from_id: b.fromId,
        to_id: b.toId,
      });
    });

    return {
      blocks,
      arrows,
      canvas_state: fullDoc,
    };
  };

  const executeSave = useCallback(async (silent = false) => {
    const curApp = appRef.current;
    const curBoard = boardRef.current;
    if (!curApp || !curBoard) return;

    if (!silent) setIsSaving(true);
    try {
      const snapshot = extractSnapshotData(curApp);
      const updated = await boardsApi.update(curBoard.id, {
        title: curBoard.title,
        snapshot,
      });
      setBoard(updated);
      setIsSaved(true);
    } catch (e) {
      console.error('Save failed', e);
    } finally {
      if (!silent) setIsSaving(false);
    }
  }, []);

  const handleMount = useCallback(
    (currentApp: TldrawApp) => {
      setApp(currentApp);
      appRef.current = currentApp;
      (window as any).__tldrawApp = currentApp;

      // Fix phantom tool desync: wrap setSelectedIds so when activeTool is set to select, currentTool actually becomes SelectTool
      const origSetSelectedIds = (currentApp as any).setSelectedIds.bind(currentApp);
      (currentApp as any).setSelectedIds = (ids: any, others: any) => {
        const res = origSetSelectedIds(ids, others);
        if (currentApp.appState.activeTool === 'select' && (currentApp as any).currentTool?.type !== 'select') {
          currentApp.selectTool('select' as any);
        }
        return res;
      };

      // Wrap selectTool to track and sync state
      const origSelectTool = currentApp.selectTool.bind(currentApp);
      currentApp.selectTool = (toolId: any) => {
        const res = origSelectTool(toolId);
        setActiveTool(currentApp.currentTool?.type || toolId);
        setIsToolLocked(Boolean(currentApp.appState.isToolLocked));
        return res;
      };

      // Wrap currentApp.delete to cascade-delete any connected arrows automatically
      const origDelete = currentApp.delete.bind(currentApp);
      currentApp.delete = (ids = currentApp.selectedIds) => {
        if (!ids || ids.length === 0) return currentApp;
        const toDelete = new Set(ids);
        const allShapes = currentApp.shapes;

        allShapes.forEach((s: any) => {
          if (s.type === TDShapeType.Arrow || s.isConduit || s.fromId || s.toId) {
            if (toDelete.has(s.fromId) || toDelete.has(s.toId)) {
              toDelete.add(s.id);
            }
          }
        });

        const page = currentApp.page;
        if (page?.bindings) {
          Object.values(page.bindings).forEach((b: any) => {
            if (toDelete.has(b.toId) || toDelete.has(b.fromId)) {
              if (b.fromId) toDelete.add(b.fromId);
            }
          });
        }

        return origDelete(Array.from(toDelete));
      };

      // Enable Miro-style dot grid pattern
      try {
        currentApp.patchState({ settings: { showGrid: true } }, 'init_grid');
      } catch {}

      if (boardRef.current) {
        syncBoardToCanvas(boardRef.current, currentApp);
      }

      // Expose console API for info cards
      (window as any).spawnInfoCard = (options: {
        title?: string;
        content?: string;
        latex?: string;
        badge?: string;
        variant?: 'info' | 'warning' | 'success' | 'danger' | 'neutral';
        point?: [number, number];
      } = {}) => {
        const center = currentApp.centerPoint;
        const id = 'info_' + Math.random().toString(36).slice(2, 9);
        currentApp.createShapes({
          id,
          type: TDShapeType.Rectangle,
          point: options.point || [center[0] - 180, center[1] - 70],
          size: [360, 220],
          title: options.title || 'Служебное уведомление',
          content: options.content || 'Информационное сообщение',
          latex: options.latex || '',
          badge: options.badge || 'INFO',
          variant: options.variant || 'info',
        } as any);
        currentApp.select(id);
        return id;
      };
    },
    [syncBoardToCanvas]
  );

  const handleDocumentChange = useCallback(() => {
    setIsSaved(false);
    if (appRef.current) {
      const curTool = (appRef.current as any).currentTool?.type || appRef.current.appState.activeTool || 'select';
      setActiveTool(curTool);
      setIsToolLocked(Boolean(appRef.current.appState.isToolLocked));
    }
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      executeSave(true);
    }, 1500);
  }, [executeSave]);

  const handlePatch = useCallback((curApp: TldrawApp, patch: any) => {
    if (!patch.appState) return;
    if (patch.appState.activeTool !== undefined) {
      if ((curApp as any).currentTool?.type !== patch.appState.activeTool) {
        curApp.selectTool(patch.appState.activeTool as any);
      }
      setActiveTool(patch.appState.activeTool);
    }
    if (patch.appState.isToolLocked !== undefined) {
      setIsToolLocked(Boolean(patch.appState.isToolLocked));
    }
  }, []);

  const handleCommand = useCallback((curApp: TldrawApp) => {
    if (curApp) {
      const curTool = (curApp as any).currentTool?.type || curApp.appState.activeTool || 'select';
      setActiveTool(curTool);
      setIsToolLocked(Boolean(curApp.appState.isToolLocked));
    }
  }, []);

  const handleSelectBoard = async (id: string) => {
    if (id === board?.id) return;
    await executeSave(true);
    try {
      const nextBoard = await boardsApi.get(id);
      setBoard(nextBoard);
      setBoardTitle(nextBoard.title);
      if (appRef.current) syncBoardToCanvas(nextBoard, appRef.current);
    } catch (e) {
      console.error('Failed to switch board', e);
    }
  };

  const handleCreateBoard = async (customTitle?: string) => {
    await executeSave(true);
    try {
      const title = customTitle || `Board ${boardsList.length + 1}`;
      const newB = await boardsApi.create(title);
      setBoardsList((prev) => [newB, ...prev]);
      setBoard(newB);
      setBoardTitle(newB.title);
      if (appRef.current) {
        appRef.current.deleteAll();
      }
      return newB;
    } catch (e) {
      console.error('Failed to create board', e);
      return null;
    }
  };

  const handleDeleteBoard = async (id: string) => {
    if (boardsList.length <= 1) return;
    try {
      await boardsApi.delete(id);
      const updatedList = boardsList.filter((b) => b.id !== id);
      setBoardsList(updatedList);
      if (board?.id === id) {
        handleSelectBoard(updatedList[0].id);
      }
    } catch (e) {
      console.error('Failed to delete board', e);
    }
  };

  const handleUpdateTitle = async (newTitle: string) => {
    setBoardTitle(newTitle);
    if (board) {
      setBoard({ ...board, title: newTitle });
      setBoardsList((prev) => prev.map((b) => (b.id === board.id ? { ...b, title: newTitle } : b)));
      await boardsApi.update(board.id, { title: newTitle });
    }
  };

  const handleLogout = async () => {
    await authApi.logout();
    setCurrentUser(null);
    setViewMode('board');
    fetchBoards();
  };

  // 5. Global Console API for Custom Cards (not available in UI, callable via console)
  useEffect(() => {
    (window as any).axioma = {
      createCustomCard: (options: {
        title?: string;
        latex?: string;
        comment?: string;
        badge?: string;
        color?: string;
        buttons?: Array<{ id: string; label: string; action?: string; onClick?: () => void }>;
        customHtml?: string;
        hideHeader?: boolean;
        point?: [number, number];
        size?: [number, number];
      }) => {
        const curApp = appRef.current;
        if (!curApp) {
          console.error('[Axioma] Canvas not initialized yet.');
          return null;
        }

        const center = curApp.getPagePoint(curApp.centerPoint);
        const cardSize: [number, number] = options.size || [440, 300];
        const cardPoint: [number, number] = options.point || [
          Math.round(center[0] - cardSize[0] / 2),
          Math.round(center[1] - cardSize[1] / 2),
        ];
        const id = 'custom_' + Math.random().toString(36).slice(2, 9);

        curApp.createShapes({
          id,
          type: TDShapeType.Rectangle,
          point: cardPoint,
          size: cardSize,
          title: options.title || 'Пользовательская карточка',
          latex: options.latex || '',
          resultLatex: '',
          comment: options.comment || '',
          cardType: 'custom',
          customOptions: {
            title: options.title,
            badge: options.badge,
            latex: options.latex,
            comment: options.comment,
            color: options.color,
            buttons: options.buttons,
            customHtml: options.customHtml,
            hideHeader: options.hideHeader,
          },
          color: options.color || '#8b5cf6',
          isMathBlock: true,
          error: '',
          style: {
            color: 'purple',
            size: 'small',
            isFilled: false,
            dash: 'draw',
            scale: 1,
          },
        } as any);

        curApp.select(id);
        console.log(`[Axioma] Created custom card [id=${id}]:`, options);
        return id;
      },

      createCard: (
        type: 'full' | 'explanation' | 'answer' | 'formula' | 'custom' = 'custom',
        options: any = {}
      ) => {
        const curApp = appRef.current;
        if (!curApp) return null;

        const center = curApp.getPagePoint(curApp.centerPoint);
        const cardSize: [number, number] = options.size || (type === 'formula' ? [360, 110] : [440, 320]);
        const cardPoint: [number, number] = options.point || [
          Math.round(center[0] - cardSize[0] / 2),
          Math.round(center[1] - cardSize[1] / 2),
        ];
        const id = 'math_' + Math.random().toString(36).slice(2, 9);

        curApp.createShapes({
          id,
          type: TDShapeType.Rectangle,
          point: cardPoint,
          size: cardSize,
          title: options.title || (type === 'formula' ? 'Формула' : type === 'answer' ? 'ОТВЕТ' : 'Выражение'),
          latex: options.latex || '',
          resultLatex: options.resultLatex || '',
          comment: options.comment || '',
          cardType: type,
          customOptions: type === 'custom' ? options : undefined,
          color: type === 'answer' ? '#10b981' : '#3b82f6',
          isMathBlock: true,
          error: '',
          style: {
            color: type === 'answer' ? 'green' : 'black',
            size: 'small',
            isFilled: false,
            dash: 'draw',
            scale: 1,
          },
        } as any);

        curApp.select(id);
        console.log(`[Axioma] Created card of type "${type}" [id=${id}]`);
        return id;
      },
    };

    console.info('[Axioma] Console API ready. Call window.axioma.createCustomCard({...}) for arbitrary custom cards.');
  }, []);

  if (!isDevUnlocked) {
    return <DevPlaceholder />;
  }

  if (viewMode === 'dashboard' && currentUser) {
    return (
      <UserDashboard
        user={currentUser}
        boards={boardsList}
        activeBoardId={board?.id || null}
        onOpenBoard={(id) => {
          handleSelectBoard(id);
          setViewMode('board');
        }}
        onCreateBoard={handleCreateBoard}
        onDeleteBoard={handleDeleteBoard}
        onRenameBoard={handleUpdateTitle}
        onOpenDemoBoard={() => {
          const demo = boardsList.find((b: any) => !b.user_id) || boardsList[0];
          if (demo) handleSelectBoard(demo.id);
          setViewMode('board');
        }}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />
    );
  }

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${isDarkMode ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
      <TopBar
        app={app}
        boardTitle={boardTitle}
        onUpdateTitle={handleUpdateTitle}
        onSave={() => executeSave(false)}
        isSaving={isSaving || isBoardLoading}
        isSaved={isSaved && !isBoardLoading}
        onLock={handleLock}
        boards={boardsList}
        activeBoardId={board?.id || null}
        onSelectBoard={handleSelectBoard}
        onCreateBoard={handleCreateBoard}
        onDeleteBoard={handleDeleteBoard}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onOpenDashboard={() => setViewMode('dashboard')}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      <TemplatesSidebar
        app={app}
        isDarkMode={isDarkMode}
      />

      <div className={`absolute inset-0 w-full h-full ${activeTool === 'formula' ? 'cursor-crosshair' : ''}`}>
        <Tldraw
          autofocus
          darkMode={isDarkMode}
          showMenu={false}
          showPages={false}
          showMultiplayerMenu={false}
          showStyles={false}
          showZoom={false}
          showTools={false}
          onMount={handleMount}
          onChange={handleDocumentChange}
          onPatch={handlePatch}
          onCommand={handleCommand}
        />
      </div>

      <V1BottomToolbar
        app={app}
        activeTool={activeTool}
        isDarkMode={isDarkMode}
        onSelectTool={setActiveTool}
        formulaSubtool={formulaSubtool}
        onSetFormulaSubtool={setFormulaSubtool}
        onSelectFormulaTool={(type) => {
          if (type) setFormulaSubtool(type);
          setActiveTool((prev) => (prev === 'formula' ? 'select' : 'formula'));
        }}
        isToolLocked={isToolLocked}
        onToggleToolLock={() => {
          if (appRef.current) {
            appRef.current.toggleToolLock();
            setIsToolLocked(Boolean(appRef.current.appState.isToolLocked));
          }
        }}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        isDarkMode={isDarkMode}
        onSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthOpen(false);
          setViewMode('dashboard');
          sendClientLog({ level: 'info', message: 'auth_success', context: { username: user.username } });
          fetchBoards();
        }}
      />
    </div>
  );
};

export default App;
