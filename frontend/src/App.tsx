import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Tldraw } from '@tldraw/tldraw';
import type { TldrawApp, TDDocument } from '@tldraw/tldraw';
import { TDShapeType } from '@tldraw/tldraw';
import 'katex/dist/katex.min.css';

import { TopBar } from './components/TopBar';
import { DevPlaceholder } from './components/DevPlaceholder';
import { AuthModal } from './components/AuthModal';
import { sendClientLog } from './services/telemetry';
import { boardsApi, authApi } from './services/api';
import type { Board, MathBlockData, ArrowConnection } from './types/math';
import type { User } from './types/auth';

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

export const App: React.FC = () => {
  const [isDevUnlocked, setIsDevUnlocked] = useState(checkIsUnlocked);
  const [board, setBoard] = useState<Board | null>(null);
  const [boardTitle, setBoardTitle] = useState('My Workspace');
  const [boardsList, setBoardsList] = useState<Array<{ id: string; title: string; created_at: string; updated_at: string }>>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [app, setApp] = useState<TldrawApp | null>(null);

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
      if (user) setCurrentUser(user);
    }
    loadUser();
  }, []);

  const syncBoardToCanvas = useCallback((currentBoard: Board, targetApp: TldrawApp) => {
    if (!targetApp || !currentBoard) return;
    try {
      if (currentBoard.snapshot?.canvas_state) {
        try {
          targetApp.loadDocument(currentBoard.snapshot.canvas_state as TDDocument);
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
    try {
      const list = await boardsApi.list();
      setBoardsList(list);
      if (list.length > 0) {
        const activeId = boardRef.current?.id;
        const exists = list.some((b) => b.id === activeId);
        const targetId = exists ? activeId! : list[0].id;
        const b = await boardsApi.get(targetId);
        setBoard(b);
        setBoardTitle(b.title);
        if (appRef.current) syncBoardToCanvas(b, appRef.current);
      } else {
        const newB = await boardsApi.create('Default Workspace');
        setBoard(newB);
        setBoardTitle(newB.title);
        setBoardsList([newB]);
        if (appRef.current) syncBoardToCanvas(newB, appRef.current);
      }
    } catch (e) {
      console.error('Failed to load boards', e);
    }
  }, [syncBoardToCanvas]);

  useEffect(() => {
    if (!isDevUnlocked) return;
    fetchBoards();
  }, [isDevUnlocked, currentUser, fetchBoards]);

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
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      executeSave(true);
    }, 1500);
  }, [executeSave]);

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

  const handleCreateBoard = async () => {
    await executeSave(true);
    try {
      const newB = await boardsApi.create(`Board ${boardsList.length + 1}`);
      setBoardsList((prev) => [newB, ...prev]);
      setBoard(newB);
      setBoardTitle(newB.title);
      if (appRef.current) {
        appRef.current.deleteAll();
      }
    } catch (e) {
      console.error('Failed to create board', e);
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
    fetchBoards();
  };

  if (!isDevUnlocked) {
    return <DevPlaceholder />;
  }

  return (
    <div className={`relative w-full h-full overflow-hidden select-none ${isDarkMode ? 'dark bg-slate-950' : 'bg-slate-50'}`}>
      <TopBar
        app={app}
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

      <div className="absolute inset-0 w-full h-full">
        <Tldraw
          autofocus
          darkMode={isDarkMode}
          onMount={handleMount}
          onChange={handleDocumentChange}
        />
      </div>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(user) => {
          setCurrentUser(user);
          setIsAuthOpen(false);
          sendClientLog({ level: 'info', message: 'auth_success', context: { username: user.username } });
          fetchBoards();
        }}
      />
    </div>
  );
};

export default App;
