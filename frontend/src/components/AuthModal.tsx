import React, { useState } from 'react';
import { User, Lock, ArrowRight, UserPlus, LogIn } from 'lucide-react';
import { authApi } from '../services/api';
import type { User as UserType } from '../types/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserType) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let res;
      if (isRegister) {
        res = await authApi.register(username.trim(), password);
      } else {
        res = await authApi.login(username.trim(), password);
      }
      onSuccess(res.user);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка авторизации. Проверьте данные.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
      <div
        className="w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col text-slate-800 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50 text-xs">
          <button
            onClick={() => {
              setIsRegister(false);
              setError('');
            }}
            className={`flex-1 py-3 font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
              !isRegister
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LogIn size={14} />
            <span>Вход</span>
          </button>
          <button
            onClick={() => {
              setIsRegister(true);
              setError('');
            }}
            className={`flex-1 py-3 font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
              isRegister
                ? 'bg-white text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserPlus size={14} />
            <span>Регистрация</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {isRegister ? 'Создать аккаунт' : 'С возвращением'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isRegister
                ? 'Зарегистрируйтесь, чтобы сохранять свои доски'
                : 'Войдите для доступа к вашим доскам'}
            </p>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Имя пользователя</label>
            <div className="relative flex items-center">
              <User size={15} className="absolute left-3 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                required
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-slate-50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-700">Пароль</label>
            <div className="relative flex items-center">
              <Lock size={15} className="absolute left-3 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 bg-slate-50"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/25 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Секунду...' : isRegister ? 'Создать' : 'Войти'}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
