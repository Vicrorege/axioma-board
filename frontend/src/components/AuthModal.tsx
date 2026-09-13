import React, { useState } from 'react';
import { User, Lock, Mail, ArrowRight, LogIn, KeyRound, RefreshCw, CheckCircle2, AlertCircle } from 'lucide-react';
import { authApi } from '../services/api';
import type { User as UserType } from '../types/auth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserType) => void;
  isDarkMode?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isDarkMode = false,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'verify'>('login');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  if (!isOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim() || !password.trim()) {
      setError('Заполните все поля');
      return;
    }

    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const res = await authApi.login(loginIdentifier.trim(), password);
      if (res.needs_verification) {
        setEmail(res.email || loginIdentifier.trim());
        setMode('verify');
        setInfoMessage(res.message || 'Введите 6-значный код, отправленный на вашу почту');
      } else if (res.user) {
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Неверный логин или пароль');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !username.trim() || !password.trim()) {
      setError('Заполните все поля');
      return;
    }

    if (!email.includes('@') || !email.includes('.')) {
      setError('Введите корректный email адрес');
      return;
    }

    if (password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    setLoading(true);
    setError('');
    setInfoMessage('');

    try {
      const res = await authApi.requestRegister(email.trim(), username.trim(), password);
      setMode('verify');
      setInfoMessage(res.message || `Код подтверждения отправлен на ${email}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Ошибка регистрации. Попробуйте другой логин или почту.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || code.trim().length < 4) {
      setError('Введите 6-значный код подтверждения');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await authApi.verifyEmail(email.trim(), code.trim());
      if (res.user) {
        onSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Неверный код или срок его действия истёк');
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email || resending) return;
    setResending(true);
    setError('');
    try {
      const res = await authApi.resendCode(email.trim());
      setInfoMessage(res.message || 'Новый код отправлен на почту');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Не удалось отправить код повторно');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm pointer-events-auto">
      <div
        className={`w-full max-w-sm rounded-3xl shadow-2xl border overflow-hidden flex flex-col transition-colors animate-in fade-in zoom-in-95 duration-150 ${
          isDarkMode
            ? 'bg-slate-900 border-slate-800 text-slate-100'
            : 'bg-white border-slate-100 text-slate-800'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Tabs */}
        {mode !== 'verify' && (
          <div
            className={`flex border-b text-xs ${
              isDarkMode ? 'border-slate-800 bg-slate-950/60' : 'border-slate-100 bg-slate-50'
            }`}
          >
            <button
              onClick={() => {
                setMode('login');
                setError('');
                setInfoMessage('');
              }}
              className={`flex-1 py-3 font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'login'
                  ? isDarkMode
                    ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-500'
                    : 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LogIn size={14} />
              <span>Вход</span>
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError('');
                setInfoMessage('');
              }}
              className={`flex-1 py-3 font-semibold text-center transition cursor-pointer flex items-center justify-center gap-1.5 ${
                mode === 'register'
                  ? isDarkMode
                    ? 'bg-slate-900 text-blue-400 border-b-2 border-blue-500'
                    : 'bg-white text-blue-600 border-b-2 border-blue-600'
                  : isDarkMode
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Mail size={14} />
              <span>Регистрация</span>
            </button>
          </div>
        )}

        <div className="p-6">
          {mode === 'verify' ? (
            /* Email Verification Form (OTP) */
            <form onSubmit={handleVerifyCode} className="flex flex-col gap-4">
              <div className="flex flex-col items-center text-center gap-1.5 mb-1">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center mb-1">
                  <KeyRound size={24} />
                </div>
                <h3 className="font-bold text-base">Подтверждение почты</h3>
                <p className="text-xs text-slate-400">
                  Мы отправили 6-значный код на <span className="font-semibold text-blue-400">{email}</span>
                </p>
              </div>

              {infoMessage && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs">
                  <CheckCircle2 size={15} className="shrink-0" />
                  <span>{infoMessage}</span>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider text-center">
                  Код из письма
                </label>
                <input
                  type="text"
                  maxLength={8}
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  autoFocus
                  required
                  className={`w-full text-center tracking-[8px] font-mono text-2xl font-bold py-2.5 rounded-xl border outline-none transition focus:ring-2 focus:ring-blue-500 ${
                    isDarkMode
                      ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600'
                      : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-300'
                  }`}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Проверка...' : 'Подтвердить и войти'}
                <ArrowRight size={14} />
              </button>

              <div className="flex items-center justify-between text-xs pt-2">
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={resending}
                  className="text-blue-500 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={11} className={resending ? 'animate-spin' : ''} />
                  <span>{resending ? 'Отправка...' : 'Отправить код ещё раз'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  className="text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  Изменить данные
                </button>
              </div>
            </form>
          ) : mode === 'register' ? (
            /* Registration Form */
            <form onSubmit={handleRequestRegister} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1 mb-1">
                <h3 className="font-bold text-base">Создание аккаунта</h3>
                <p className="text-xs text-slate-400">
                  Сохраняйте свои доски, настройки и историю вычислений
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Email
                </label>
                <div className="relative flex items-center">
                  <Mail size={15} className="absolute left-3 text-slate-400" />
                  <input
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Имя пользователя
                </label>
                <div className="relative flex items-center">
                  <User size={15} className="absolute left-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="student_42"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Пароль
                </label>
                <div className="relative flex items-center">
                  <Lock size={15} className="absolute left-3 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Минимум 6 символов"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Отправка кода...' : 'Зарегистрироваться'}
                <ArrowRight size={14} />
              </button>
            </form>
          ) : (
            /* Login Form */
            <form onSubmit={handleLogin} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1 mb-1">
                <h3 className="font-bold text-base">Вход в аккаунт</h3>
                <p className="text-xs text-slate-400">
                  Доступ к вашим доскам и персональному дашборду
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Email или логин
                </label>
                <div className="relative flex items-center">
                  <User size={15} className="absolute left-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="name@example.com или логин"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    required
                    autoFocus
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Пароль
                </label>
                <div className="relative flex items-center">
                  <Lock size={15} className="absolute left-3 text-slate-400" />
                  <input
                    type="password"
                    placeholder="Ваш пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className={`w-full pl-9 pr-3 py-2 text-xs rounded-xl border outline-none transition focus:ring-2 focus:ring-blue-500 ${
                      isDarkMode
                        ? 'bg-slate-950 border-slate-800 text-white placeholder-slate-600'
                        : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                    }`}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 mt-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition cursor-pointer shadow-md shadow-blue-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Вход...' : 'Войти'}
                <ArrowRight size={14} />
              </button>
            </form>
          )}

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <span>AxiomaBoard &mdash; персональные доски</span>
            <button
              type="button"
              onClick={onClose}
              className="hover:underline text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
