import axios from 'axios';
import type { MathResult, AstResponse, Board, MathBlockData, ArrowConnection } from '../types/math';
import type { User, AuthResponse } from '../types/auth';

const API_BASE = '/api';

// Attach auth token if available in localStorage
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('axioma_auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: async (username: string, password: string): Promise<AuthResponse> => {
    const res = await axios.post(`${API_BASE}/auth/login`, { username, password });
    if (res.data.token) {
      localStorage.setItem('axioma_auth_token', res.data.token);
    }
    return res.data;
  },

  register: async (username: string, password: string): Promise<AuthResponse> => {
    const res = await axios.post(`${API_BASE}/auth/register`, { username, password });
    if (res.data.token) {
      localStorage.setItem('axioma_auth_token', res.data.token);
    }
    return res.data;
  },

  me: async (): Promise<User | null> => {
    try {
      const res = await axios.get(`${API_BASE}/auth/me`);
      return res.data;
    } catch {
      return null;
    }
  },

  logout: async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`);
    } finally {
      localStorage.removeItem('axioma_auth_token');
    }
  },
};

export const mathApi = {
  evaluate: async (latex: string, variables?: Record<string, number>, numeric = false): Promise<MathResult> => {
    const res = await axios.post(`${API_BASE}/math/evaluate`, { latex, variables, numeric });
    return res.data;
  },

  simplify: async (latex: string): Promise<MathResult> => {
    const res = await axios.post(`${API_BASE}/math/simplify`, { latex });
    return res.data;
  },

  derivative: async (latex: string, wrt = 'x', order = 1): Promise<MathResult> => {
    const res = await axios.post(`${API_BASE}/math/derivative`, { latex, wrt, order });
    return res.data;
  },

  integrate: async (latex: string, wrt = 'x', definite = false, lower?: string, upper?: string): Promise<MathResult> => {
    const res = await axios.post(`${API_BASE}/math/integrate`, {
      latex,
      wrt,
      definite,
      lower_limit: lower,
      upper_limit: upper,
    });
    return res.data;
  },

  solve: async (latex: string, variable = 'x'): Promise<MathResult> => {
    const res = await axios.post(`${API_BASE}/math/solve`, { latex, variable });
    return res.data;
  },

  factor: async (latex: string): Promise<MathResult> => {
    const res = await axios.post(`${API_BASE}/math/factor`, { latex });
    return res.data;
  },

  domain: async (latex: string, variable = 'x'): Promise<MathResult> => {
    const res = await axios.post(`${API_BASE}/math/domain`, { latex, variable });
    return res.data;
  },

  getSuggestedActions: async (
    latex: string
  ): Promise<{
    expression_type: string;
    actions: Array<{ id: string; label: string; icon: string; operation: string; tooltip?: string }>;
  }> => {
    const res = await axios.post(`${API_BASE}/math/suggested-actions`, { latex });
    return res.data;
  },

  ast: async (latex: string): Promise<AstResponse> => {
    const res = await axios.post(`${API_BASE}/math/ast?latex=${encodeURIComponent(latex)}`);
    return res.data;
  },

  reportSolution: async (latex: string, operation = 'solve', reason = 'Пользователь отправил решение на пересмотр'): Promise<{ success: boolean; message: string }> => {
    const res = await axios.post(`${API_BASE}/math/report`, { latex, operation, reason });
    return res.data;
  },
};

export const boardsApi = {
  uploadAsset: async (file: File): Promise<{ src: string; id: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axios.post(`${API_BASE}/boards/assets`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  list: async (): Promise<Array<{ id: string; title: string; user_id?: string; created_at: string; updated_at: string }>> => {
    const res = await axios.get(`${API_BASE}/boards`);
    return res.data;
  },

  get: async (boardId: string): Promise<Board> => {
    const res = await axios.get(`${API_BASE}/boards/${boardId}`);
    return res.data;
  },

  create: async (title = 'Untitled Math Board', description?: string): Promise<Board> => {
    const res = await axios.post(`${API_BASE}/boards`, { title, description });
    return res.data;
  },

  update: async (boardId: string, payload: { title?: string; description?: string; snapshot?: any }): Promise<Board> => {
    const res = await axios.put(`${API_BASE}/boards/${boardId}`, payload);
    return res.data;
  },

  delete: async (boardId: string): Promise<boolean> => {
    const res = await axios.delete(`${API_BASE}/boards/${boardId}`);
    return res.data.success;
  },

  addBlock: async (boardId: string, block: MathBlockData): Promise<Board> => {
    const res = await axios.post(`${API_BASE}/boards/${boardId}/blocks`, block);
    return res.data;
  },

  addArrow: async (boardId: string, arrow: ArrowConnection): Promise<Board> => {
    const res = await axios.post(`${API_BASE}/boards/${boardId}/arrows`, arrow);
    return res.data;
  },
};

export const aiApi = {
  getContext: async (boardId: string) => {
    const res = await axios.get(`${API_BASE}/ai/board-context/${boardId}`);
    return res.data;
  },

  addFormula: async (boardId: string, latex: string, title?: string, comment?: string, x?: number, y?: number) => {
    const res = await axios.post(`${API_BASE}/ai/add-formula`, {
      board_id: boardId,
      latex,
      title,
      comment,
      x,
      y,
    });
    return res.data;
  },

  connect: async (boardId: string, fromId: string, toId: string, label?: string) => {
    const res = await axios.post(`${API_BASE}/ai/connect`, {
      board_id: boardId,
      from_block_id: fromId,
      to_block_id: toId,
      label,
    });
    return res.data;
  },

  solveSteps: async (boardId: string, latex: string, variable = 'x', originX = 150, originY = 150) => {
    const res = await axios.post(`${API_BASE}/ai/solve-steps`, {
      board_id: boardId,
      latex,
      variable,
      origin_x: originX,
      origin_y: originY,
    });
    return res.data;
  },
};
