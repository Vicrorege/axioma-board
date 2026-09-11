import React, { useState, useEffect } from 'react';
import type { Editor } from 'tldraw';
import { Sparkles, ArrowRight, RefreshCw, CheckCircle2 } from 'lucide-react';
import { aiApi } from '../services/api';

interface AISidebarProps {
  boardId: string;
  isOpen: boolean;
  onClose: () => void;
  editor: Editor | null;
  onRefreshBoard: () => void;
}

export const AISidebar: React.FC<AISidebarProps> = ({
  boardId,
  isOpen,
  onClose,
  editor,
  onRefreshBoard,
}) => {
  const [activeTab, setActiveTab] = useState<'solver' | 'inject' | 'context' | 'api'>('solver');
  
  // Solver state
  const [eqInput, setEqInput] = useState('x^2 - 5x + 6 = 0');
  const [targetVar, setTargetVar] = useState('x');
  const [isSolving, setIsSolving] = useState(false);
  const [solveSuccess, setSolveSuccess] = useState(false);

  // Inject state
  const [injectTitle, setInjectTitle] = useState('Newton Law');
  const [injectLatex, setInjectLatex] = useState('F = m \\cdot a');
  const [injectComment, setInjectComment] = useState('Derived from classical mechanics');
  const [isInjecting, setIsInjecting] = useState(false);

  // Context state
  const [contextMd, setContextMd] = useState('');
  const [isLoadingContext, setIsLoadingContext] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'context') {
      loadContext();
    }
  }, [isOpen, activeTab, boardId]);

  const loadContext = async () => {
    setIsLoadingContext(true);
    try {
      const data = await aiApi.getContext(boardId);
      setContextMd(data.context_markdown || JSON.stringify(data, null, 2));
    } catch (e: any) {
      setContextMd('Failed to load context: ' + e.message);
    } finally {
      setIsLoadingContext(false);
    }
  };

  const handleStepSolve = async () => {
    setIsSolving(true);
    setSolveSuccess(false);
    try {
      const center = editor?.getViewportPageBounds().center || { x: 200, y: 200 };
      await aiApi.solveSteps(boardId, eqInput, targetVar, center.x - 300, center.y - 100);
      setSolveSuccess(true);
      onRefreshBoard();
    } catch (e: any) {
      alert('Error: ' + (e.response?.data?.detail || e.message));
    } finally {
      setIsSolving(false);
    }
  };

  const handleInject = async () => {
    setIsInjecting(true);
    try {
      const center = editor?.getViewportPageBounds().center || { x: 200, y: 200 };
      await aiApi.addFormula(
        boardId,
        injectLatex,
        injectTitle,
        injectComment,
        center.x - 180,
        center.y - 120
      );
      onRefreshBoard();
    } catch (e: any) {
      alert('Error: ' + (e.response?.data?.detail || e.message));
    } finally {
      setIsInjecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute top-20 right-3 bottom-6 w-96 bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-slate-200 z-30 flex flex-col pointer-events-auto overflow-hidden text-slate-800">
      {/* Header */}
      <div className="p-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={18} />
          <h3 className="font-bold text-sm tracking-tight">AI & Agent Playground</h3>
        </div>
        <button
          onClick={onClose}
          className="w-6 h-6 rounded-full hover:bg-white/20 flex items-center justify-center text-xs font-bold cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50 text-xs">
        <button
          onClick={() => setActiveTab('solver')}
          className={`flex-1 py-2 font-medium text-center border-b-2 transition cursor-pointer ${
            activeTab === 'solver'
              ? 'border-purple-600 text-purple-700 bg-white font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Auto-Solve
        </button>
        <button
          onClick={() => setActiveTab('inject')}
          className={`flex-1 py-2 font-medium text-center border-b-2 transition cursor-pointer ${
            activeTab === 'inject'
              ? 'border-purple-600 text-purple-700 bg-white font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Inject
        </button>
        <button
          onClick={() => setActiveTab('context')}
          className={`flex-1 py-2 font-medium text-center border-b-2 transition cursor-pointer ${
            activeTab === 'context'
              ? 'border-purple-600 text-purple-700 bg-white font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          LLM View
        </button>
        <button
          onClick={() => setActiveTab('api')}
          className={`flex-1 py-2 font-medium text-center border-b-2 transition cursor-pointer ${
            activeTab === 'api'
              ? 'border-purple-600 text-purple-700 bg-white font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Curl/Python
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* TAB 1: Auto-Solver Pipeline */}
        {activeTab === 'solver' && (
          <div className="space-y-3">
            <p className="text-slate-500 leading-relaxed">
              Generate an automated pipeline of connected derivation blocks directly onto the canvas using the SymPy engine:
            </p>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Equation (LaTeX):</label>
              <input
                type="text"
                value={eqInput}
                onChange={(e) => setEqInput(e.target.value)}
                placeholder="e.g. x^2 - 5x + 6 = 0"
                className="w-full p-2 border rounded-xl border-slate-300 font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <div className="w-1/2">
                <label className="block text-slate-700 font-semibold mb-1">Variable:</label>
                <input
                  type="text"
                  value={targetVar}
                  onChange={(e) => setTargetVar(e.target.value)}
                  className="w-full p-2 border rounded-xl border-slate-300 font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={handleStepSolve}
              disabled={isSolving}
              className="w-full py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 shadow-md shadow-purple-600/20 cursor-pointer"
            >
              {isSolving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  <span>Computing derivation...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Generate Connected Pipeline</span>
                </>
              )}
            </button>

            {solveSuccess && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>Added 3 connected derivation blocks to canvas!</span>
              </div>
            )}

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="font-semibold text-slate-700">What this does:</div>
              <div>1. Submits equation to <code>/api/ai/solve-steps</code></div>
              <div>2. Solves and simplifies analytically via SymPy</div>
              <div>3. Creates 3 blocks and links them with arrows automatically</div>
            </div>
          </div>
        )}

        {/* TAB 2: AI Inject Formula */}
        {activeTab === 'inject' && (
          <div className="space-y-3">
            <p className="text-slate-500 leading-relaxed">
              Simulate an AI agent inserting a single mathematical insight onto the board:
            </p>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Title:</label>
              <input
                type="text"
                value={injectTitle}
                onChange={(e) => setInjectTitle(e.target.value)}
                className="w-full p-2 border rounded-xl border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Formula LaTeX:</label>
              <input
                type="text"
                value={injectLatex}
                onChange={(e) => setInjectLatex(e.target.value)}
                className="w-full p-2 border rounded-xl border-slate-300 font-mono text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Explanation / Comment:</label>
              <textarea
                value={injectComment}
                onChange={(e) => setInjectComment(e.target.value)}
                rows={2}
                className="w-full p-2 border rounded-xl border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
              />
            </div>

            <button
              onClick={handleInject}
              disabled={isInjecting}
              className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              <ArrowRight size={14} />
              <span>Inject Block to Canvas</span>
            </button>
          </div>
        )}

        {/* TAB 3: LLM Context View */}
        {activeTab === 'context' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-700">Prompt Context for LLM:</span>
              <button
                onClick={loadContext}
                disabled={isLoadingContext}
                className="p-1 hover:bg-slate-100 rounded text-slate-500 cursor-pointer"
                title="Refresh context"
              >
                <RefreshCw size={12} className={isLoadingContext ? 'animate-spin' : ''} />
              </button>
            </div>
            <p className="text-slate-500 text-[11px]">
              This structured summary is produced by <code>GET /api/ai/board-context/{boardId}</code> for zero-shot LLM reasoning:
            </p>
            <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[10px] overflow-x-auto whitespace-pre-wrap max-h-72">
              {contextMd}
            </pre>
          </div>
        )}

        {/* TAB 4: API Code Snippet */}
        {activeTab === 'api' && (
          <div className="space-y-3">
            <span className="font-semibold text-slate-700">Python Agent Integration:</span>
            <pre className="p-2.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[10px] overflow-x-auto whitespace-pre-wrap">
{`import requests

BOARD_ID = "${boardId}"
API = "http://localhost:8200"

# 1. Read board state
context = requests.get(f"{API}/api/ai/board-context/{BOARD_ID}").json()

# 2. Add an expression
requests.post(f"{API}/api/ai/add-formula", json={
    "board_id": BOARD_ID,
    "latex": r"\\int x^2 dx",
    "title": "Agent Result",
    "comment": "Calculated by LLM"
})`}
            </pre>

            <span className="font-semibold text-slate-700">cURL Command:</span>
            <pre className="p-2 bg-slate-900 text-amber-300 rounded-xl font-mono text-[9px] overflow-x-auto whitespace-pre-wrap">
{`curl -X POST "http://localhost:8200/api/ai/solve-steps" \\
  -H "Content-Type: application/json" \\
  -d '{"board_id":"${boardId}","latex":"x^2-4=0"}'`}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
