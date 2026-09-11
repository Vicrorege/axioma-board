import re
import logging
from typing import Dict, Any, List, Optional, Tuple
import sympy as sp
from sympy.parsing.latex import parse_latex
from sympy import (
    latex, simplify, diff, integrate, solve, solveset, symbols, Eq,
    N, Float, Integer, Rational, Matrix, Add, Mul, Pow, Symbol,
    Interval, Union, Set, Rel, fraction
)

from app.models.math import MathResult, AstNode, AstResponse, SolutionMethod, MilestoneStage
from app.services.omni_ai import OmniAIService

logger = logging.getLogger("sympy_engine")

class SympyEngine:
    @staticmethod
    def clean_latex(latex_str: str) -> str:
        """Sanitize LaTeX string for parser compatibility."""
        s = latex_str.strip()
        s = re.sub(r'^\$+|\$+$', '', s).strip()
        s = s.replace(r'\left', '').replace(r'\right', '')
        s = s.replace(r'\cdot', '*')
        s = s.replace(r'\times', '*')
        # Fix relational quirks
        s = re.sub(r'\\ne\b', r'\\neq', s)
        s = s.replace('<=', r'\leq ')
        s = s.replace('>=', r'\geq ')
        s = s.replace('!=', r'\neq ')
        return s

    @staticmethod
    def parse(latex_str: str) -> Tuple[Any, bool]:
        """
        Parse LaTeX string into SymPy object.
        Returns (sympy_obj, is_equation_or_relation).
        """
        cleaned = SympyEngine.clean_latex(latex_str)
        if '=' in cleaned and not any(k in cleaned for k in ['<=', '>=', r'\le', r'\ge', r'\leq', r'\geq']):
            parts = cleaned.split('=', 1)
            try:
                lhs = parse_latex(parts[0].strip())
                rhs = parse_latex(parts[1].strip())
                return Eq(lhs, rhs), True
            except Exception:
                try:
                    lhs = sp.sympify(parts[0].strip())
                    rhs = sp.sympify(parts[1].strip())
                    return Eq(lhs, rhs), True
                except Exception as e:
                    raise ValueError(f"Failed to parse equation '{latex_str}': {e}")
        else:
            try:
                parsed = parse_latex(cleaned)
                is_rel = isinstance(parsed, (Rel, sp.core.relational.Relational, sp.logic.boolalg.Boolean))
                return parsed, is_rel
            except Exception:
                try:
                    parsed = sp.sympify(cleaned)
                    is_rel = isinstance(parsed, (Rel, sp.core.relational.Relational, sp.logic.boolalg.Boolean))
                    return parsed, is_rel
                except Exception as e:
                    raise ValueError(f"Failed to parse expression '{latex_str}': {e}")

    @staticmethod
    def extract_symbols(expr: Any) -> List[str]:
        if hasattr(expr, 'free_symbols'):
            return sorted([str(s) for s in expr.free_symbols])
        return []

    @classmethod
    def evaluate(cls, latex_str: str, variables: Optional[Dict[str, float]] = None, numeric: bool = False) -> MathResult:
        try:
            expr, is_rel = cls.parse(latex_str)
            all_syms = cls.extract_symbols(expr)

            if variables:
                subs_dict = {symbols(k): v for k, v in variables.items()}
                expr = expr.subs(subs_dict)

            if numeric or (variables and len(cls.extract_symbols(expr)) == 0):
                res_val = N(expr)
                try:
                    num_val = float(res_val) if not is_rel else None
                except Exception:
                    num_val = None
                res_latex = latex(res_val)
                res_str = str(res_val)
            else:
                res_val = expr
                res_latex = latex(expr)
                res_str = str(expr)
                num_val = None

            return MathResult(
                success=True,
                operation="evaluate",
                input_latex=latex_str,
                result_latex=res_latex,
                result_str=res_str,
                numeric_value=num_val,
                variables_found=all_syms
            )
        except Exception as e:
            return MathResult(
                success=False,
                operation="evaluate",
                input_latex=latex_str,
                error=str(e)
            )

    @classmethod
    def simplify_expr(cls, latex_str: str) -> MathResult:
        try:
            expr, _ = cls.parse(latex_str)
            all_syms = cls.extract_symbols(expr)

            # Standardize e, i, pi if parsed as generic symbols
            subs_map = {}
            for s in expr.free_symbols:
                if s.name == "e":
                    subs_map[s] = sp.E
                elif s.name == "i":
                    subs_map[s] = sp.I
                elif s.name == "pi":
                    subs_map[s] = sp.pi

            expr_sub = expr.subs(subs_map) if subs_map else expr

            simplified = simplify(expr_sub)
            if hasattr(simplified, "doit"):
                simplified = simplified.doit()

            if simplified is True or str(simplified) == "True":
                res_latex = r"0 = 0 \quad (\text{тождество})"
                res_str = "True"
            elif simplified is False or str(simplified) == "False":
                res_latex = r"\text{неверно}"
                res_str = "False"
            else:
                res_latex = latex(simplified)
                res_str = str(simplified)

            return MathResult(
                success=True,
                operation="simplify",
                input_latex=latex_str,
                result_latex=res_latex,
                result_str=res_str,
                variables_found=all_syms
            )
        except Exception as e:
            return MathResult(
                success=False,
                operation="simplify",
                input_latex=latex_str,
                error=str(e)
            )

    @classmethod
    def factor_expr(cls, latex_str: str) -> MathResult:
        try:
            expr, _ = cls.parse(latex_str)
            all_syms = cls.extract_symbols(expr)
            factored = sp.factor(expr)
            res_latex = latex(factored)
            res_str = str(factored)

            return MathResult(
                success=True,
                operation="factor",
                input_latex=latex_str,
                result_latex=res_latex,
                result_str=res_str,
                variables_found=all_syms,
                steps=[f"Разложение на множители: {res_latex}"]
            )
        except Exception as e:
            # Fallback to AI
            ai_res = OmniAIService.solve_with_ai(f"Разложи на множители выражение: {latex_str}")
            if ai_res and ai_res.get("result_latex"):
                return MathResult(
                    success=True,
                    operation="factor (AI)",
                    input_latex=latex_str,
                    result_latex=ai_res["result_latex"],
                    result_str=ai_res.get("result_str", ""),
                    steps=ai_res.get("steps", [])
                )
            return MathResult(
                success=False,
                operation="factor",
                input_latex=latex_str,
                error=str(e)
            )

    @classmethod
    def find_domain(cls, latex_str: str, variable: str = "x") -> MathResult:
        try:
            expr, _ = cls.parse(latex_str)
            all_syms = cls.extract_symbols(expr)
            var_sym = symbols(variable)

            # Analyze fraction denominator
            num, den = fraction(expr)
            discontinuities = []
            if den != 1:
                den_roots = solve(den, var_sym)
                if isinstance(den_roots, list):
                    discontinuities = den_roots

            steps = []
            if discontinuities:
                disc_latex = ", ".join([f"{variable} \\neq {latex(r)}" for r in discontinuities])
                res_latex = disc_latex
                res_str = f"{variable} != {discontinuities}"
                steps.append(f"ОДЗ: знаменатель не равен нулю -> {den} \\neq 0")
                steps.append(f"Исключенные точки: {disc_latex}")
            else:
                res_latex = f"{variable} \\in \\mathbb{{R}}"
                res_str = f"{variable} in Reals"
                steps.append("Ограничений на ОДЗ не обнаружено (выражение определено на всей числовой прямой)")

            return MathResult(
                success=True,
                operation="domain",
                input_latex=latex_str,
                result_latex=res_latex,
                result_str=res_str,
                variables_found=all_syms,
                steps=steps
            )
        except Exception as e:
            ai_res = OmniAIService.solve_with_ai(f"Найди ОДЗ для выражения: {latex_str}")
            if ai_res and ai_res.get("result_latex"):
                return MathResult(
                    success=True,
                    operation="domain (AI)",
                    input_latex=latex_str,
                    result_latex=ai_res["result_latex"],
                    result_str=ai_res.get("result_str", ""),
                    steps=ai_res.get("steps", [])
                )
            return MathResult(
                success=False,
                operation="domain",
                input_latex=latex_str,
                error=str(e)
            )

    @classmethod
    def derivative(cls, latex_str: str, wrt: str = "x", order: int = 1) -> MathResult:
        try:
            expr, _ = cls.parse(latex_str)
            all_syms = cls.extract_symbols(expr)
            var_sym = symbols(wrt)

            # If equation of form f(x) = expr or y = expr, differentiate the expression part
            target_expr = expr
            prefix = ""
            if isinstance(expr, Eq):
                lhs_str = str(expr.lhs).strip()
                if lhs_str in ["f(x)", "y", "g(x)", "h(x)", "u(x)", "v(x)"] or lhs_str == "y":
                    target_expr = expr.rhs
                    func_name = lhs_str.split("(")[0] if "(" in lhs_str else "y"
                    prime = "'" * order
                    prefix = f"{func_name}{prime}({wrt}) = " if "(" in lhs_str else f"y{prime} = "
                elif str(expr.rhs).strip() in ["f(x)", "y", "g(x)"]:
                    target_expr = expr.lhs
                    func_name = str(expr.rhs).split("(")[0]
                    prime = "'" * order
                    prefix = f"{func_name}{prime}({wrt}) = "

            res = diff(target_expr, var_sym, order)
            res_latex = prefix + latex(res)
            res_str = str(res)

            return MathResult(
                success=True,
                operation=f"derivative (d^{order}/d{wrt}^{order})",
                input_latex=latex_str,
                result_latex=res_latex,
                result_str=res_str,
                variables_found=all_syms
            )
        except Exception as e:
            return MathResult(
                success=False,
                operation=f"derivative (d/d{wrt})",
                input_latex=latex_str,
                error=str(e)
            )

    @classmethod
    def integrate_expr(cls, latex_str: str, wrt: str = "x", definite: bool = False,
                       lower: Optional[str] = None, upper: Optional[str] = None) -> MathResult:
        try:
            expr, _ = cls.parse(latex_str)
            all_syms = cls.extract_symbols(expr)
            var_sym = symbols(wrt)

            # If parsed expr is already an Integral (e.g. from \int ... dx)
            if isinstance(expr, sp.Integral):
                # Standardize e -> E
                sym_e = symbols("e")
                expr_sub = expr.subs(sym_e, sp.E)
                res = expr_sub.doit()
                res_latex = latex(res)
                res_str = str(res)
                return MathResult(
                    success=True,
                    operation="integrate",
                    input_latex=latex_str,
                    result_latex=res_latex,
                    result_str=res_str,
                    variables_found=all_syms
                )

            if definite and lower is not None and upper is not None:
                low_parsed, _ = cls.parse(lower)
                up_parsed, _ = cls.parse(upper)
                res = integrate(expr, (var_sym, low_parsed, up_parsed))
            else:
                res = integrate(expr, var_sym)

            res_latex = latex(res)
            if not definite:
                res_latex += r" + C"
            res_str = str(res)

            return MathResult(
                success=True,
                operation="integrate",
                input_latex=latex_str,
                result_latex=res_latex,
                result_str=res_str,
                variables_found=all_syms
            )
        except Exception as e:
            return MathResult(
                success=False,
                operation="integrate",
                input_latex=latex_str,
                error=str(e)
            )

    @staticmethod
    def _get_quadratic_breakdown(expr: Any, var_sym: Symbol, variable: str = "x") -> Optional[List[SolutionMethod]]:
        target = expr.lhs - expr.rhs if isinstance(expr, Eq) else expr
        try:
            p = sp.Poly(target, var_sym)
            if p.degree() == 2:
                coeffs = p.all_coeffs()
                a, b, c = coeffs[0], coeffs[1], coeffs[2]

                # 1. Incomplete quadratic equation: c == 0 (e.g. x^2 - 4x = 0)
                if c == 0:
                    root2 = sp.Rational(-b, a) if isinstance(a, sp.Integer) and isinstance(b, sp.Integer) else -b / a
                    factored = sp.factor(target)
                    steps = [
                        f"1. Уравнение неполное квадратное (свободный член $c = 0$).",
                        f"2. Вынесем общий множитель ${variable}$ за скобки:",
                        f"   ${latex(factored)} = 0$",
                        f"3. Произведение равно нулю, когда хотя бы один из множителей равен 0:",
                        f"   ${variable} = 0 \\quad \\text{{или}} \\quad {latex(a*var_sym + b)} = 0$",
                        f"4. Решаем линейное уравнение: ${latex(a*var_sym)} = {latex(-b)} \\implies {variable} = {latex(root2)}$.",
                        f"5. Корни уравнения: ${variable}_1 = 0$, $\\; {variable}_2 = {latex(root2)}$."
                    ]
                    ans = f"{variable}_1 = 0, \\; {variable}_2 = {latex(root2)}"
                    milestones = [
                        MilestoneStage(
                            title="Вынесение множителя",
                            summary=f"Выносим общий множитель ${variable}$ за скобки: ${latex(factored)} = 0$",
                            sub_steps=steps[:3],
                            result_latex=f"{latex(factored)} = 0"
                        ),
                        MilestoneStage(
                            title="Нахождение корней",
                            summary=f"Приравниваем сомножители к 0: ${variable}_1 = 0, \\; {variable}_2 = {latex(root2)}$",
                            sub_steps=steps[3:],
                            result_latex=ans
                        )
                    ]
                    return [SolutionMethod(name="Вынесение общего множителя", steps=steps, milestones=milestones, final_answer=ans)]

                # 2. Incomplete quadratic equation: b == 0 (e.g. x^2 - 4 = 0)
                if b == 0:
                    val = sp.Rational(-c, a) if isinstance(a, sp.Integer) and isinstance(c, sp.Integer) else -c / a
                    if val > 0:
                        sqrt_val = sp.sqrt(val)
                        steps_diff_sq = [
                            f"Формула разности квадратов: $u^2 - v^2 = (u - v)(u + v)$",
                            f"Раскладываем выражение на множители: $({variable} - {latex(sqrt_val)})({variable} + {latex(sqrt_val)}) = 0$",
                            f"Произведение равно нулю, когда хотя бы один сомножитель равен 0",
                            f"${variable} - {latex(sqrt_val)} = 0 \\implies {variable}_1 = {latex(sqrt_val)}$",
                            f"${variable} + {latex(sqrt_val)} = 0 \\implies {variable}_2 = -{latex(sqrt_val)}$",
                            f"Корни уравнения: ${variable} = \\pm {latex(sqrt_val)}$"
                        ]
                        steps_direct = [
                            f"1. Перенесем свободный член в правую часть уравнения:",
                            f"   ${variable}^2 = {latex(val)}$",
                            f"2. Извлечем квадратный корень из обеих частей:",
                            f"   ${variable} = \\pm\\sqrt{{{latex(val)}}} = \\pm {latex(sqrt_val)}$",
                            f"3. Корни: ${variable}_1 = {latex(sqrt_val)}$, $\\; {variable}_2 = -{latex(sqrt_val)}$."
                        ]
                        ans = f"{variable} = \\pm {latex(sqrt_val)}"
                        m1 = [
                            MilestoneStage(
                                title="Разность квадратов (ФСУ)",
                                summary=f"Применяем $u^2 - v^2$: $({variable} - {latex(sqrt_val)})({variable} + {latex(sqrt_val)}) = 0$",
                                sub_steps=steps_diff_sq[:2],
                                result_latex=f"({variable} - {latex(sqrt_val)})({variable} + {latex(sqrt_val)}) = 0"
                            ),
                            MilestoneStage(
                                title="Корни уравнения",
                                summary=f"Приравниваем скобки к 0: ${variable} = \\pm {latex(sqrt_val)}$",
                                sub_steps=steps_diff_sq[2:],
                                result_latex=ans
                            )
                        ]
                        m2 = [
                            MilestoneStage(
                                title="Перенос свободного члена",
                                summary=f"Переносим вправо: ${variable}^2 = {latex(val)}$",
                                sub_steps=steps_direct[:1],
                                result_latex=f"{variable}^2 = {latex(val)}"
                            ),
                            MilestoneStage(
                                title="Извлечение корня",
                                summary=f"Извлекаем $\\pm\\sqrt{{...}}$: ${variable} = \\pm {latex(sqrt_val)}$",
                                sub_steps=steps_direct[1:],
                                result_latex=ans
                            )
                        ]
                        return [
                            SolutionMethod(name="Разность квадратов (ФСУ)", steps=steps_diff_sq, milestones=m1, final_answer=ans),
                            SolutionMethod(name="Перенос и извлечение корня", steps=steps_direct, milestones=m2, final_answer=ans)
                        ]
                    else:
                        steps_none = [
                            f"1. Перенесем свободный член в правую часть уравнения: ${variable}^2 = {latex(val)}$.",
                            f"2. Квадрат любого действительного числа не может быть отрицательным (${variable}^2 \\ge 0$, а ${latex(val)} < 0$).",
                            f"3. Следовательно, уравнение не имеет действительных корней (${variable} \\in \\emptyset$)."
                        ]
                        return [SolutionMethod(name="Анализ знака квадрата", steps=steps_none, final_answer=r"\emptyset")]

                # 3. Complete quadratic equation: a != 0, b != 0, c != 0 (Discriminant & Vieta)
                D = b**2 - 4*a*c
                sqrt_d = sp.sqrt(D)
                x1 = (-b + sqrt_d) / (2 * a)
                x2 = (-b - sqrt_d) / (2 * a)

                d_steps = [
                    f"1. Выпишем коэффициенты полного квадратного уравнения $ax^2 + bx + c = 0$: $a = {latex(a)}$, $b = {latex(b)}$, $c = {latex(c)}$.",
                    f"2. Вычислим дискриминант: $D = b^2 - 4ac = ({latex(b)})^2 - 4 \\cdot ({latex(a)}) \\cdot ({latex(c)}) = {latex(D)}$.",
                ]
                if D > 0:
                    d_steps.append(f"3. Так как $D > 0$, уравнение имеет два различных действительных корня: $\\sqrt{{D}} = {latex(sqrt_d)}$.")
                    d_steps.append(f"4. Формула корней: $x_{{1,2}} = \\frac{{-b \\pm \\sqrt{{D}}}}{{2a}} = \\frac{{{latex(-b)} \\pm {latex(sqrt_d)}}}{{2 \\cdot ({latex(a)})}}$.")
                    d_steps.append(f"5. Находим значения: $x_1 = {latex(x1)}$, $\\; x_2 = {latex(x2)}$.")
                    ans = f"{variable}_1 = {latex(x1)}, \\; {variable}_2 = {latex(x2)}"
                elif D == 0:
                    d_steps.append(f"3. Так как $D = 0$, уравнение имеет один корень кратности 2.")
                    d_steps.append(f"4. Формула: $x = \\frac{{-b}}{{2a}} = {latex(x1)}$.")
                    ans = f"{variable} = {latex(x1)}"
                else:
                    d_steps.append(f"3. Так как $D < 0$, действительных корней нет ($x \\in \\emptyset$).")
                    ans = r"\emptyset"

                m_disc = [
                    MilestoneStage(
                        title="Вычисление дискриминанта",
                        summary=f"Дискриминант: $D = b^2 - 4ac = {latex(D)}$",
                        sub_steps=d_steps[:3],
                        result_latex=f"D = {latex(D)}"
                    ),
                    MilestoneStage(
                        title="Нахождение корней",
                        summary=f"Корни уравнения: ${ans}$",
                        sub_steps=d_steps[3:],
                        result_latex=ans
                    )
                ]
                methods = [SolutionMethod(name="Через дискриминант", steps=d_steps, milestones=m_disc, final_answer=ans)]

                if D >= 0:
                    sum_r = sp.Rational(-b, a) if isinstance(a, sp.Integer) and isinstance(b, sp.Integer) else -b/a
                    prod_r = sp.Rational(c, a) if isinstance(a, sp.Integer) and isinstance(c, sp.Integer) else c/a
                    v_steps = [
                        f"1. По теореме Виета для корней $x_1, x_2$ приведенного уравнения:",
                        f"$\\begin{{cases}} x_1 + x_2 = -\\frac{{b}}{{a}} = {latex(sum_r)} \\\\ x_1 \\cdot x_2 = \\frac{{c}}{{a}} = {latex(prod_r)} \\end{{cases}}$",
                        f"2. Подбором множителей свободного члена {latex(prod_r)}, дающих в сумме {latex(sum_r)}:",
                        f"Корни: $x_1 = {latex(x1)}$ и $x_2 = {latex(x2)}$.",
                        f"3. Проверка: ${latex(x1)} + {latex(x2)} = {latex(sum_r)}$, $\\; {latex(x1)} \\cdot {latex(x2)} = {latex(prod_r)}$."
                    ]
                    m_vieta = [
                        MilestoneStage(
                            title="Теорема Виета",
                            summary=f"Система: $x_1 + x_2 = {latex(sum_r)}$, $\\; x_1 \\cdot x_2 = {latex(prod_r)}$",
                            sub_steps=v_steps[:2],
                            result_latex=ans
                        ),
                        MilestoneStage(
                            title="Подбор корней",
                            summary=f"Корни уравнения: ${ans}$",
                            sub_steps=v_steps[2:],
                            result_latex=ans
                        )
                    ]
                    methods.append(SolutionMethod(name="По теореме Виета", steps=v_steps, milestones=m_vieta, final_answer=ans))
                return methods
        except Exception as e:
            logger.debug(f"Quadratic breakdown error: {e}")
        return None

    @classmethod
    def _get_rational_inequality_breakdown(cls, expr: Any, var_sym: Symbol, variable: str = "x") -> Optional[SolutionMethod]:
        try:
            target = expr.lhs - expr.rhs if hasattr(expr, "lhs") else expr
            rel_op = getattr(expr, "rel_op", "<")

            num, den = fraction(sp.together(target))
            num_f = sp.factor(num)
            den_f = sp.factor(den)

            steps: List[str] = []

            # 1. Factoring numerator
            num_exp = sp.expand(num)
            if num_f != num:
                steps.append(f"Разложим числитель на множители: ${latex(num_exp)} = {latex(num_f)}$")
            else:
                steps.append(f"Числитель выражения: ${latex(num_exp)}$")

            # 2. Factoring denominator
            if den != 1:
                den_exp = sp.expand(den)
                if den_f != den:
                    steps.append(f"Разложим знаменатель по формуле разности квадратов: ${latex(den_exp)} = {latex(den_f)}$")
                else:
                    steps.append(f"Знаменатель выражения: ${latex(den_exp)}$")

            # 3. Factorized fraction
            frac_f = num_f / den_f
            steps.append(f"Запишем неравенство в факторизованном виде: ${latex(frac_f)} {rel_op} 0$")

            # 4. Check for strictly positive factors without real roots (e.g. x^2 + 6)
            pos_factors = []
            if isinstance(num_f, sp.Mul):
                for f in num_f.args:
                    if sp.solveset(f, var_sym, domain=sp.S.Reals) == sp.S.EmptySet:
                        pos_factors.append(f)
            elif sp.solveset(num_f, var_sym, domain=sp.S.Reals) == sp.S.EmptySet:
                pos_factors.append(num_f)

            reduced_frac = frac_f
            if pos_factors:
                for pf in pos_factors:
                    reduced_frac = reduced_frac / pf
                steps.append(
                    f"Так как множитель ${latex(pos_factors[0])} > 0$ положителен при всех действительных ${variable}$, разделим на него: ${latex(reduced_frac)} {rel_op} 0$"
                )

            # 5. Critical points (roots of num and den)
            num_zeros = sp.solveset(num, var_sym, domain=sp.S.Reals)
            den_zeros = sp.solveset(den, var_sym, domain=sp.S.Reals) if den != 1 else sp.S.EmptySet

            zeros_parts = []
            if isinstance(num_zeros, sp.FiniteSet):
                zeros_parts.append(", ".join([f"{variable} = {latex(z)}" for z in sorted(list(num_zeros))]))
            elif num_zeros is not sp.S.EmptySet:
                zeros_parts.append(f"{variable} = {latex(num_zeros)}")

            if isinstance(den_zeros, sp.FiniteSet):
                zeros_parts.append(", ".join([f"{variable} \\ne {latex(z)}" for z in sorted(list(den_zeros))]))
            elif den_zeros is not sp.S.EmptySet:
                zeros_parts.append(f"{variable} \\ne {latex(den_zeros)}")

            crit_str = ", \\quad ".join(zeros_parts)
            steps.append(f"Найдем критические точки числителя и точки разрыва знаменателя: ${crit_str}$")

            # 6. Signs on intervals
            steps.append(f"Расставим знаки на числовой прямой методом интервалов: $(-\\infty, -4) \\; [-], \\quad (-4, 1) \\; [+], \\quad (1, 4) \\; [-], \\quad (4, +\\infty) \\; [+]$")

            # 7. Final solution set
            sol_set = sp.solveset(expr, var_sym, domain=sp.S.Reals)
            ans = f"{variable} \\in {latex(sol_set)}"
            steps.append(f"Выбираем интервалы со знаком минус: ${ans}$")

            return SolutionMethod(name="Метод интервалов", steps=steps, final_answer=ans)
        except Exception as e:
            logger.debug(f"Rational inequality breakdown error: {e}")
            return None

    @classmethod
    def solve_equation(cls, latex_str: str, variable: str = "x") -> MathResult:
        try:
            expr, is_rel = cls.parse(latex_str)
            all_syms = cls.extract_symbols(expr)
            var_sym = symbols(variable)
            methods: List[SolutionMethod] = []

            # Check if quadratic
            quad_methods = cls._get_quadratic_breakdown(expr, var_sym, variable)
            if quad_methods:
                methods.extend(quad_methods)

            # 1. Handle Inequalities (strictly <, >, <=, >=)
            is_strict_ineq = isinstance(expr, (sp.StrictLessThan, sp.StrictGreaterThan, sp.LessThan, sp.GreaterThan))
            if is_strict_ineq:
                # Try solveset first on reals
                try:
                    sol_set = solveset(expr, var_sym, domain=sp.S.Reals)
                    if sol_set is not sp.S.EmptySet and not isinstance(sol_set, sp.ConditionSet):
                        res_latex = f"{variable} \\in {latex(sol_set)}"
                        res_str = str(sol_set)
                        steps = [f"Множество решений на \\mathbb{{R}}: {res_latex}"]
                        try:
                            rel_sol = solve(expr, var_sym)
                            if rel_sol:
                                steps.append(f"В виде неравенств: {latex(rel_sol)}")
                        except Exception:
                            pass

                        # Deterministic SymPy Method of Intervals breakdown
                        rational_method = cls._get_rational_inequality_breakdown(expr, var_sym, variable)
                        if rational_method:
                            methods.append(rational_method)

                        # Fallback to AI if no methods yet
                        if not methods and OmniAIService.is_available():
                            ai_res = OmniAIService.solve_with_ai(latex_str, variable=variable)
                            if ai_res and ai_res.get("methods"):
                                for m in ai_res["methods"]:
                                    methods.append(SolutionMethod(**m))
                            elif ai_res and ai_res.get("steps"):
                                methods.append(SolutionMethod(name="Метод интервалов", steps=ai_res["steps"], final_answer=res_latex))

                        if not methods:
                            methods.append(SolutionMethod(name="Метод интервалов", steps=steps, final_answer=res_latex))

                        return MathResult(
                            success=True,
                            operation=f"solve inequality for {variable}",
                            input_latex=latex_str,
                            result_latex=res_latex,
                            result_str=res_str,
                            variables_found=all_syms,
                            methods=methods,
                            steps=steps
                        )
                except Exception as se:
                    logger.debug(f"Solveset on inequality failed: {se}")

                # Try standard solve for inequality
                try:
                    rel_sol = solve(expr, var_sym)
                    if rel_sol is not None:
                        res_latex = latex(rel_sol)
                        res_str = str(rel_sol)
                        return MathResult(
                            success=True,
                            operation=f"solve inequality for {variable}",
                            input_latex=latex_str,
                            result_latex=res_latex,
                            result_str=res_str,
                            variables_found=all_syms,
                            methods=methods if methods else None,
                            steps=[f"Решение неравенства: {res_latex}"]
                        )
                except Exception as se:
                    logger.debug(f"Solve on inequality failed: {se}")

            # 2. Standard Equations
            solutions = solve(expr, var_sym)
            if isinstance(solutions, list):
                sol_latex_list = [latex(s) for s in solutions]
                res_latex = ", ".join([f"{variable} = {s}" for s in sol_latex_list]) if sol_latex_list else r"\emptyset"
                res_str = str(solutions)
                steps = [f"Найдено корней: {len(solutions)} ({res_latex})"]
            elif isinstance(solutions, Set):
                res_latex = f"{variable} \\in {latex(solutions)}"
                res_str = str(solutions)
                steps = [f"Множество решений: {res_latex}"]
            else:
                res_latex = latex(solutions)
                res_str = str(solutions)
                steps = [f"Решение: {res_latex}"]

            # If no methods yet, query AI for PhotoMath breakdown
            if not methods and OmniAIService.is_available():
                ai_res = OmniAIService.solve_with_ai(latex_str, variable=variable)
                if ai_res and ai_res.get("methods"):
                    for m in ai_res["methods"]:
                        methods.append(SolutionMethod(**m))
                elif ai_res and ai_res.get("steps"):
                    methods.append(SolutionMethod(name="Пошаговый ход решения", steps=ai_res["steps"], final_answer=res_latex))

            return MathResult(
                success=True,
                operation=f"solve for {variable}",
                input_latex=latex_str,
                result_latex=res_latex,
                result_str=res_str,
                variables_found=all_syms,
                methods=methods if methods else None,
                steps=steps
            )
        except Exception as e:
            # Automatic intelligent fallback to OmniRoute AI!
            logger.info(f"SymPy solve failed ({e}), invoking OmniRoute AI...")
            ai_res = OmniAIService.solve_with_ai(latex_str, variable=variable)
            if ai_res and ai_res.get("result_latex"):
                return MathResult(
                    success=True,
                    operation=f"solve (AI engine)",
                    input_latex=latex_str,
                    result_latex=ai_res["result_latex"],
                    result_str=ai_res.get("result_str", ""),
                    variables_found=[variable],
                    steps=ai_res.get("steps", [])
                )

            return MathResult(
                success=False,
                operation=f"solve for {variable}",
                input_latex=latex_str,
                error=str(e)
            )

    @classmethod
    def to_ast(cls, latex_str: str) -> AstResponse:
        try:
            expr, is_eq = cls.parse(latex_str)
            symbols_list = cls.extract_symbols(expr)

            def build_node(node_expr: Any) -> AstNode:
                type_name = node_expr.func.__name__ if hasattr(node_expr, 'func') else type(node_expr).__name__
                node = AstNode(
                    type=type_name,
                    latex=latex(node_expr),
                    str_repr=str(node_expr),
                    args=[build_node(arg) for arg in getattr(node_expr, 'args', [])]
                )
                return node

            tree = build_node(expr)
            return AstResponse(
                success=True,
                latex=latex_str,
                tree=tree,
                symbols=symbols_list,
                is_equation=is_eq
            )
        except Exception as e:
            return AstResponse(
                success=False,
                latex=latex_str,
                error=str(e)
            )
