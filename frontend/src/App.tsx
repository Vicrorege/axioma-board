import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Tldraw, createShapeId, getSnapshot, loadSnapshot, DefaultStylePanel, DefaultToolbar } from 'tldraw';
import type { Editor, TLUiComponents, TLAssetStore } from 'tldraw';
import 'tldraw/tldraw.css';
import 'katex/dist/katex.min.css';

import { MathBlockShapeUtil } from './shapes/MathBlockShapeUtil';
import { TopBar } from './components/TopBar';
import { DevPlaceholder } from './components/DevPlaceholder';
import { AuthModal } from './components/AuthModal';
import { sendClientLog } from './services/telemetry';
import { boardsApi, authApi } from './services/api';
import type { Board, MathBlockData, ArrowConnection } from './types/math';
import type { User } from './types/auth';

const customShapeUtils = [MathBlockShapeUtil];

const customAssetStore: TLAssetStore = {
  async upload(_asset, file) {
    try {
      const res = await boardsApi.uploadAsset(file);
      return { src: res.src };
    } catch (e) {
      console.warn('Backend asset upload failed, falling back to data URL', e);
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      return { src: dataUrl };
    }
  },
  resolve(asset) {
    return asset.props.src;
  },
};
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
  // If no dev token is configured in environment, allow open access
  if (VALID_DEV_TOKENS.length === 0) {
    return true;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const keyFromUrl = params.get('dev_key');
    if (keyFromUrl && VALID_DEV_TOKENS.includes(keyFromUrl)) {
      setTokenStorage(keyFromUrl);
      window.history.replaceState({}, '', window.location.pathname);
      return true;
    }
    const tokenCookie = getCookie(COOKIE_NAME);
    if (tokenCookie && VALID_DEV_TOKENS.includes(tokenCookie)) {
      return true;
    }
    const tokenLocal = localStorage.getItem(COOKIE_NAME);
    if (tokenLocal && VALID_DEV_TOKENS.includes(tokenLocal)) {
      return true;
    }
  } catch (e) {
    console.warn('Token check error', e);
  }
  return false;
}

// Error boundary to protect the canvas and forward error details to server
class CanvasErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorText: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorText: '' };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorText: error?.message || String(error) };
  }
  componentDidCatch(error: any, info: React.ErrorInfo) {
    console.error('Canvas crash caught by boundary:', error, info);
    sendClientLog({
      level: 'error',
      message: error?.message || String(error),
      stack: error?.stack,
      component_stack: info?.componentStack || undefined,
      context: { source: 'CanvasErrorBoundary' },
    });
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-700 gap-3 p-6 text-center select-text">
          <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-bold text-xl">
            ⚠
          </div>
          <h3 className="font-bold text-slate-900 text-base">Ошибка отображения холста</h3>
          <p className="font-mono text-xs text-red-600 bg-red-50 p-3 rounded-xl max-w-lg break-words border border-red-200">
            {this.state.errorText}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => this.setState({ hasError: false, errorText: '' })}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-md cursor-pointer transition"
            >
              Повторить попытку
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-semibold rounded-xl cursor-pointer transition"
            >
              Перезагрузить страницу
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const boardRef = useRef<Board | null>(null);
  const [boardTitle, setBoardTitle] = useState('My Math Board');
  const [boardsList, setBoardsList] = useState<Array<{ id: string; title: string; created_at: string; updated_at: string }>>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isStylesOpen, setIsStylesOpen] = useState(false);
  const [arrowFlyout, setArrowFlyout] = useState<{ left: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('axioma_dark_mode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });
  const [isDevUnlocked, setIsDevUnlocked] = useState<boolean>(checkIsUnlocked);
  const autoSaveTimerRef = useRef<any>(null);

  boardRef.current = board;
  editorRef.current = editor;

  // Synchronize dark mode with document element and editor user preferences
  useEffect(() => {
    try {
      localStorage.setItem('axioma_dark_mode', String(isDarkMode));
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch {}

    if (editorRef.current) {
      editorRef.current.user.updateUserPreferences({
        colorScheme: isDarkMode ? 'dark' : 'light',
      });
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const handleLock = () => {
    clearTokenStorage();
    setIsDevUnlocked(false);
  };

  // Load user profile on startup
  useEffect(() => {
    async function loadUser() {
      const user = await authApi.me();
      if (user) {
        setCurrentUser(user);
      }
    }
    loadUser();
  }, []);

  const syncBoardToCanvas = useCallback((currentBoard: Board, targetEditor: Editor) => {
    if (!targetEditor || !currentBoard) return;

    try {
      if (currentBoard.snapshot?.canvas_state) {
        try {
          loadSnapshot(targetEditor.store, currentBoard.snapshot.canvas_state);
          targetEditor.updateInstanceState({ isGridMode: true });
    targetEditor.user.updateUserPreferences({
      colorScheme: isDarkMode ? 'dark' : 'light',
    });
          targetEditor.clearHistory();
          return;
        } catch (err) {
          console.warn('Could not load full canvas state, falling back to block sync', err);
        }
      }

      // If no canvas_state yet, populate math blocks safely
      if (currentBoard.snapshot?.blocks) {
        currentBoard.snapshot.blocks.forEach((block) => {
          try {
            const shapeId = createShapeId(block.id);
            const existing = targetEditor.getShape(shapeId);
            if (!existing) {
              targetEditor.createShape({
                id: shapeId,
                type: 'math-block' as any,
                x: block.x || 150,
                y: block.y || 150,
                props: {
                  w: 360,
                  h: 290,
                  title: block.title || 'Expression',
                  latex: block.latex || '',
                  resultLatex: block.result_latex || '',
                  comment: block.comment || '',
                  color: block.color || '#3b82f6',
                  isEditing: false,
                  error: '',
                },
              });
            }
          } catch (e) {
            console.warn('Block sync error', e);
          }
        });
      }

      // Populate arrows safely
      if (currentBoard.snapshot?.arrows) {
        currentBoard.snapshot.arrows.forEach((arrow) => {
          try {
            const arrowId = createShapeId(arrow.id);
            if (!targetEditor.getShape(arrowId)) {
              const startShape = targetEditor.getShape(createShapeId(arrow.from_id));
              const endShape = targetEditor.getShape(createShapeId(arrow.to_id));
              if (startShape && endShape) {
                targetEditor.createShape({
                  id: arrowId,
                  type: 'arrow',
                  x: startShape.x + 360,
                  y: startShape.y + 140,
                });
                targetEditor.updateShape({
                  id: arrowId,
                  type: 'arrow',
                  props: {
                    start: { x: 0, y: 0 },
                    end: {
                      x: endShape.x - (startShape.x + 360),
                      y: endShape.y - startShape.y,
                    },
                  },
                });
              }
            }
          } catch (e) {
            console.warn('Arrow sync error', e);
          }
        });
      }
    } catch (e) {
      console.warn('General sync error', e);
    }
  }, []);

  // Fetch boards for current session or user
  const fetchBoards = useCallback(async () => {
    try {
      const list = await boardsApi.list();
      setBoardsList(list);
      if (list.length > 0) {
        // Load first board if no active board or if active board not in list
        const activeId = boardRef.current?.id;
        const exists = list.some((b) => b.id === activeId);
        const targetId = exists ? activeId! : list[0].id;
        const b = await boardsApi.get(targetId);
        setBoard(b);
        setBoardTitle(b.title);
        if (editorRef.current) {
          syncBoardToCanvas(b, editorRef.current);
        }
      } else {
        const newB = await boardsApi.create('Default Workspace');
        setBoard(newB);
        setBoardTitle(newB.title);
        setBoardsList([newB]);
        if (editorRef.current) {
          syncBoardToCanvas(newB, editorRef.current);
        }
      }
    } catch (e) {
      console.error('Failed to load boards', e);
    }
  }, [syncBoardToCanvas]);

  useEffect(() => {
    if (!isDevUnlocked) return;
    fetchBoards();
  }, [isDevUnlocked, currentUser, fetchBoards]);

  // Extract full snapshot: both tldraw canvas state AND structured formulas
  const extractSnapshotData = (ed: Editor) => {
    const fullSnapshot = getSnapshot(ed.store);
    const allShapes = ed.getCurrentPageShapes();

    const blocks: MathBlockData[] = [];
    const arrows: ArrowConnection[] = [];

    allShapes.forEach((s) => {
      if ((s.type as any) === 'math-block') {
        const p = (s as any).props;
        blocks.push({
          id: s.id.replace('shape:', ''),
          x: s.x,
          y: s.y,
          title: p.title,
          latex: p.latex,
          result_latex: p.resultLatex,
          comment: p.comment,
          color: p.color,
        });
      } else if (s.type === 'arrow') {
        const p = (s as any).props;
        if (p.start?.boundShapeId && p.end?.boundShapeId) {
          arrows.push({
            id: s.id.replace('shape:', ''),
            from_id: p.start.boundShapeId.replace('shape:', ''),
            to_id: p.end.boundShapeId.replace('shape:', ''),
            label: p.text || undefined,
          });
        }
      }
    });

    return {
      blocks,
      arrows,
      canvas_state: fullSnapshot,
    };
  };

  const executeSave = useCallback(async (silent = false) => {
    const curEditor = editorRef.current;
    const curBoard = boardRef.current;
    if (!curEditor || !curBoard) return;

    if (!silent) setIsSaving(true);
    try {
      const snapshot = extractSnapshotData(curEditor);
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

  // STABLE mount handler with automated debounced save
  const handleMount = useCallback(
    (ed: Editor) => {
      setEditor(ed);
      editorRef.current = ed;

      // Enable Miro-style dot grid pattern on blank board
      ed.updateInstanceState({ isGridMode: true });

      if (boardRef.current) {
        syncBoardToCanvas(boardRef.current, ed);
      }

      // Auto-save debounce on any shape, binding, or asset edits
      ed.store.listen((entry: any) => {
        if (entry?.changes) {
          const added = entry.changes.added || {};
          const updated = entry.changes.updated || {};
          const removed = entry.changes.removed || {};
          const hasChanges =
            Object.keys(added).some((k) => k.startsWith('shape:') || k.startsWith('binding:') || k.startsWith('asset:')) ||
            Object.keys(updated).some((k) => k.startsWith('shape:') || k.startsWith('binding:') || k.startsWith('asset:')) ||
            Object.keys(removed).some((k) => k.startsWith('shape:') || k.startsWith('binding:') || k.startsWith('asset:'));

          if (hasChanges) {
            setIsSaved(false);
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
            autoSaveTimerRef.current = setTimeout(() => {
              executeSave(true);
            }, 800);
          }

          // Dynamically calculate bend for bound arrows when cards move
          if (entry.changes.updated) {
            const updatedKeys = Object.keys(entry.changes.updated);
            if (updatedKeys.some((k) => k.startsWith('shape:'))) {
              const allArrows = ed.getCurrentPageShapes().filter((s) => s.type === 'arrow') as any[];
              allArrows.forEach((arrow) => {
                const bindings = ed.getBindingsFromShape(arrow.id, 'arrow');
                const startB = bindings.find((b) => b.props.terminal === 'start');
                const endB = bindings.find((b) => b.props.terminal === 'end');
                if (startB && endB) {
                  const fromShape = ed.getShape(startB.toId) as any;
                  const toShape = ed.getShape(endB.toId) as any;
                  if (fromShape && toShape) {
                    const fromCenterY = fromShape.y + (fromShape.props.h || 0) / 2;
                    const toCenterY = toShape.y + (toShape.props.h || 0) / 2;
                    const dy = toCenterY - fromCenterY;
                    // Horizontal -> 0 (straight). Displaced -> curvy arc!
                    const targetBend = Math.round(Math.max(-55, Math.min(55, dy * 0.22)));
                    if (Math.abs((arrow.props.bend || 0) - targetBend) >= 2) {
                      ed.updateShape({
                        id: arrow.id,
                        type: 'arrow',
                        props: { bend: targetBend },
                      });
                    }
                  }
                }
              });
            }
          }

          // Cascade kill arrows connected to any deleted card!
          if (entry.changes.removed) {
            const removedKeys = Object.keys(entry.changes.removed);
            const removedCardIds = removedKeys
              .filter((k) => k.startsWith('shape:'))
              .map((k) => k.replace('shape:', ''));

            if (removedCardIds.length > 0) {
              const allArrows = ed.getCurrentPageShapes().filter((s) => s.type === 'arrow') as any[];
              const arrowsToKill: any[] = [];
              allArrows.forEach((arrow) => {
                const bindings = ed.getBindingsFromShape(arrow.id, 'arrow');
                if (bindings.some((b) => removedCardIds.includes(b.toId.replace('shape:', '')))) {
                  arrowsToKill.push(arrow.id);
                }
              });
              if (arrowsToKill.length > 0) {
                ed.deleteShapes(arrowsToKill);
              }
            }
          }
        }
      });
    },
    [syncBoardToCanvas, executeSave]
  );

  const handleSelectBoard = async (boardId: string) => {
    // Save current before switching
    if (editorRef.current && boardRef.current) {
      await executeSave(true);
    }
    try {
      const target = await boardsApi.get(boardId);
      setBoard(target);
      setBoardTitle(target.title);
      if (editorRef.current) {
        editorRef.current.selectAll().deleteShapes(editorRef.current.getSelectedShapeIds());
        syncBoardToCanvas(target, editorRef.current);
      }
      setIsSaved(true);
    } catch (e) {
      console.error('Switch board error', e);
    }
  };

  const handleCreateBoard = async () => {
    try {
      const newB = await boardsApi.create(`Math Board ${boardsList.length + 1}`);
      setBoardsList((prev) => [newB, ...prev]);
      setBoard(newB);
      setBoardTitle(newB.title);
      if (editorRef.current) {
        editorRef.current.selectAll().deleteShapes(editorRef.current.getSelectedShapeIds());
        syncBoardToCanvas(newB, editorRef.current);
      }
      setIsSaved(true);
    } catch (e) {
      console.error('Create board error', e);
    }
  };

  const handleDeleteBoard = async (boardId: string) => {
    try {
      await boardsApi.delete(boardId);
      const remaining = boardsList.filter((b) => b.id !== boardId);
      setBoardsList(remaining);
      if (boardRef.current?.id === boardId && remaining.length > 0) {
        handleSelectBoard(remaining[0].id);
      }
    } catch (e) {
      console.error('Delete board error', e);
    }
  };

  const handleUpdateTitle = (newTitle: string) => {
    setBoardTitle(newTitle);
    if (boardRef.current) {
      boardRef.current.title = newTitle;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      executeSave(true);
    }, 800);
  };

  const handleAuthSuccess = (user: User) => {
    setCurrentUser(user);
    fetchBoards();
  };

  const handleLogout = async () => {
    await authApi.logout();
    setCurrentUser(null);
    fetchBoards();
  };

  // Custom UI components config: style panel appears on demand
  const tldrawComponents: TLUiComponents = useMemo(
    () => ({
      PageMenu: null,
      MainMenu: null,
      QuickActions: null,
      TopPanel: null,
      MenuPanel: null,
      DebugMenu: null,
      DebugPanel: null,
      SharePanel: null,
      StylePanel: (props) => {
        if (!isStylesOpen) return null;
        return (
          <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-auto animate-toolPopOut">
            <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 p-1">
              <DefaultStylePanel {...props} />
            </div>
          </div>
        );
      },
      Toolbar: (props) => (
        <div
          className="relative"
          onClickCapture={(e) => {
            const btn = (e.target as HTMLElement).closest('button');
            if (!btn || !editorRef.current) return;
            const testId = (btn.getAttribute('data-testid') || '').toLowerCase();
            const title = (btn.getAttribute('title') || '').toLowerCase();
            const isArrow = testId.includes('arrow') || title.includes('arrow') || title.includes('стрелк');

            const currentTool = editorRef.current.getCurrentToolId();
            const isAlreadyActive =
              (isArrow && currentTool === 'arrow') ||
              (testId.includes(currentTool) && currentTool !== 'select');

            if (isAlreadyActive) {
              if (isArrow) {
                // Secondary click on Arrow tool: toggle curved arrow popup
                const rect = btn.getBoundingClientRect();
                setArrowFlyout((prev) => (prev ? null : { left: rect.left + rect.width / 2 }));
              } else {
                // Secondary click on other tool: toggle style panel!
                setIsStylesOpen((prev) => !prev);
              }
            } else {
              setArrowFlyout(null);
            }
          }}
        >
          <DefaultToolbar {...props} />
        </div>
      ),
    }),
    [isStylesOpen]
  );

  if (!isDevUnlocked) {
    return <DevPlaceholder />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100 dark:bg-slate-950 font-sans transition-colors">
      {/* Top Header Control Bar */}
      <TopBar
        editor={editor}
        boardTitle={boardTitle}
        onUpdateTitle={handleUpdateTitle}
        onSave={() => executeSave(false)}
        isSaving={isSaving}
        isSaved={isSaved}
        onLock={handleLock}
        boards={boardsList}
        activeBoardId={board?.id || null}
        onSelectBoard={handleSelectBoard}
        onCreateBoard={handleCreateBoard}
        onDeleteBoard={handleDeleteBoard}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      {/* Tldraw Canvas wrapped in Error Boundary */}
      <div className="absolute inset-0 w-full h-full">
        <CanvasErrorBoundary>
          <Tldraw
            shapeUtils={customShapeUtils}
            components={tldrawComponents}
            assets={customAssetStore}
            onMount={handleMount}
            autoFocus
          />
        </CanvasErrorBoundary>
      </div>

      {/* Curved Arrow Sub-Tool Flyout (emerges from Arrow tool on secondary click) */}
      {arrowFlyout && (
        <div
          style={{ left: arrowFlyout.left, transform: 'translateX(-50%)' }}
          className="fixed bottom-18 z-50 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/90 p-1.5 flex items-center gap-1.5 animate-toolPopOut pointer-events-auto"
        >
          <button
            onClick={() => {
              if (editorRef.current) {
                editorRef.current.setCurrentTool('arrow');
              }
              setArrowFlyout(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <span className="text-sm">➔</span>
            <span>Прямая</span>
          </button>
          <button
            onClick={() => {
              if (editorRef.current) {
                editorRef.current.setCurrentTool('arrow');
                const center = editorRef.current.getViewportPageBounds().center;
                const arrowId = createShapeId();
                editorRef.current.createShape({
                  id: arrowId,
                  type: 'arrow',
                  x: center.x - 70,
                  y: center.y - 35,
                  props: {
                    start: { x: 0, y: 0 },
                    end: { x: 140, y: 70 },
                    bend: 32, // Curved arc!
                    color: 'blue',
                  },
                });
                editorRef.current.select(arrowId);
              }
              setArrowFlyout(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition cursor-pointer shadow-2xs"
          >
            <span className="text-sm font-bold">⤹</span>
            <span>Кривая</span>
          </button>
        </div>
      )}

      {/* User Login / Register Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
