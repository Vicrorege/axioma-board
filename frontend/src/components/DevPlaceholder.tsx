import React from 'react';
import { Sparkles, ShieldCheck, Lock } from 'lucide-react';
import { MathRenderer } from './MathRenderer';

export const DevPlaceholder: React.FC = () => {
  return (
    <div className="relative min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 overflow-hidden select-none">
      {/* Background Math Formulas Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 flex flex-wrap gap-12 justify-around items-center blur-[1px]">
        <div className="text-3xl text-blue-400 font-mono"><MathRenderer latex="e^{i\pi} + 1 = 0" /></div>
        <div className="text-3xl text-indigo-400 font-mono"><MathRenderer latex="\oint_C \vec{B} \cdot d\vec{\ell} = \mu_0 I_{\text{enc}}" /></div>
        <div className="text-4xl text-purple-400 font-mono"><MathRenderer latex="\int_{-\infty}^{\infty} e^{-x^2} dx = \sqrt{\pi}" /></div>
        <div className="text-3xl text-emerald-400 font-mono"><MathRenderer latex="\nabla \times \vec{E} = -\frac{\partial \vec{B}}{\partial t}" /></div>
        <div className="text-3xl text-cyan-400 font-mono"><MathRenderer latex="\mathcal{L} = \sqrt{-g} \, R" /></div>
        <div className="text-3xl text-amber-400 font-mono"><MathRenderer latex="f'(x) = \lim_{h \to 0} \frac{f(x+h) - f(x)}{h}" /></div>
      </div>

      {/* Subtle radial glow */}
      <div className="absolute w-[600px] h-[600px] bg-gradient-to-tr from-blue-600/15 via-indigo-600/15 to-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Card */}
      <div className="relative z-10 max-w-lg w-full bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-3xl shadow-2xl text-center flex flex-col items-center">
        {/* Logo Badge */}
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-blue-500/25 mb-6">
          ∑
        </div>

        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
          <Sparkles size={13} />
          <span>Private Alpha Preview</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-3">
          AxiomaBoard
        </h1>

        <p className="text-slate-400 text-sm leading-relaxed mb-6">
          Бесконечный холст для визуального вывода математических выражений, символьных вычислений и взаимодействия с ИИ-агентами.
        </p>

        <div className="w-full p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-center gap-2.5 text-xs text-slate-400 font-medium">
          <Lock size={15} className="text-indigo-400 shrink-0" />
          <span>Доступ ограничен. Вход открыт только по персональной ссылке.</span>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-xs text-slate-600 flex items-center gap-2">
        <ShieldCheck size={14} className="text-slate-500" />
        <span>Powered by SymPy Engine & Open API</span>
      </div>
    </div>
  );
};
