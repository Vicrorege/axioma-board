import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Tldraw, createShapeId, getSnapshot, loadSnapshot, DefaultStylePanel } from 'tldraw';
import type { Editor, TLUiComponents, TLAssetStore } from 'tldraw';
import 'tldraw/tldraw.css';
import 'katex/dist/katex.min.css';

import { MathBlockShapeUtil } from './shapes/MathBlockShapeUtil';
import { TopBar } from './components/TopBar';
import { AISidebar } from './components/AISidebar';
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
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isDevUnlocked, setIsDevUnlocked] = useState<boolean>(checkIsUnlocked);
  const autoSaveTimerRef = useRef<any>(null);

  boardRef.current = board;
  editorRef.current = editor;

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

  const handleRefreshBoard = useCallback(async () => {
    const curBoard = boardRef.current;
    const curEditor = editorRef.current;
    if (!curBoard || !curEditor) return;
    try {
      const refreshed = await boardsApi.get(curBoard.id);
      setBoard(refreshed);
      syncBoardToCanvas(refreshed, curEditor);
      setIsSaved(true);
    } catch (e) {
      console.error('Refresh board failed', e);
    }
  }, [syncBoardToCanvas]);

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
      StylePanel: (props) => (isStylesOpen ? <DefaultStylePanel {...props} /> : null),
    }),
    [isStylesOpen]
  );

  if (!isDevUnlocked) {
    return <DevPlaceholder />;
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100 font-sans">
      {/* Top Header Control Bar */}
      <TopBar
        editor={editor}
        boardTitle={boardTitle}
        onUpdateTitle={handleUpdateTitle}
        onSave={() => executeSave(false)}
        isSaving={isSaving}
        isSaved={isSaved}
        onToggleAiDrawer={() => setIsAiDrawerOpen(!isAiDrawerOpen)}
        isAiDrawerOpen={isAiDrawerOpen}
        onLock={handleLock}
        boards={boardsList}
        activeBoardId={board?.id || null}
        onSelectBoard={handleSelectBoard}
        onCreateBoard={handleCreateBoard}
        onDeleteBoard={handleDeleteBoard}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        isStylesOpen={isStylesOpen}
        onToggleStyles={() => setIsStylesOpen(!isStylesOpen)}
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

      {/* AI Agent Drawer */}
      {board && (
        <AISidebar
          boardId={board.id}
          isOpen={isAiDrawerOpen}
          onClose={() => setIsAiDrawerOpen(false)}
          editor={editor}
          onRefreshBoard={handleRefreshBoard}
        />
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
