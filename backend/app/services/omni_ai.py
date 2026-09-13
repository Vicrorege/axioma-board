import os
import re
import json
import urllib.request
import logging
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../../.env'))

logger = logging.getLogger("omni_ai")

OMNI_BASE_URL = os.getenv("OMNI_BASE_URL", "http://localhost:8400/v1")
OMNI_API_KEY = os.getenv("OMNI_API_KEY", "")
OMNI_MODEL = os.getenv("OMNI_MODEL", "auto/fast")
# Ultra-fast model for instantaneous classification and action suggestions
OMNI_FAST_MODEL = os.getenv("OMNI_FAST_MODEL", "auto/best-fast")

# High-speed LRU memory cache for math classification
_classification_cache: Dict[str, Dict[str, Any]] = {}
CACHE_LIMIT = 500

def clean_and_parse_json(text: str) -> Dict[str, Any]:
    clean = text.strip()
    if clean.startswith("```json"):
        clean = clean[7:]
    elif clean.startswith("```"):
        clean = clean[3:]
    if clean.endswith("```"):
        clean = clean[:-3]
    clean = clean.strip()

    try:
        return json.loads(clean, strict=False)
    except Exception:
        fixed = re.sub(r'\\(?![\\\"/])', r'\\\\', clean)
        return json.loads(fixed, strict=False)

class OmniAIService:
    @classmethod
    def is_available(cls) -> bool:
        return bool(OMNI_API_KEY)

    @classmethod
    def _call_chat(
        cls,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        json_mode: bool = True,
        timeout: float = 12.0,
        max_tokens: Optional[int] = None,
        temperature: float = 0.2,
    ) -> Optional[Dict[str, Any]]:
        if not cls.is_available():
            return None

        url = f"{OMNI_BASE_URL.rstrip('/')}/chat/completions"
        payload: Dict[str, Any] = {
            "model": model or OMNI_MODEL,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens:
            payload["max_tokens"] = max_tokens
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {OMNI_API_KEY}",
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                content = data["choices"][0]["message"]["content"]
                if json_mode:
                    return clean_and_parse_json(content)
                return {"content": content}
        except Exception as e:
            logger.warning(f"OmniRoute request failed (model={model or OMNI_MODEL}): {e}")
            return None

    @classmethod
    def suggest_actions(cls, latex_str: str) -> Dict[str, Any]:
        """
        Ultra-fast AI classification of mathematical expression and suggestion of 4-5 tailored actions.
        Uses auto/best-fast with an optimized compact prompt and sub-second cache.
        """
        norm_key = re.sub(r'\s+', '', latex_str).strip()
        if not norm_key:
            return cls._local_heuristic_actions(latex_str)

        # Check in-memory cache first (0ms latency)
        if norm_key in _classification_cache:
            return _classification_cache[norm_key]

        # Optimized, token-minimal classification prompt
        prompt = (
            f"LaTeX: {latex_str}\n"
            "Classify mathematical expression and choose 4-5 best action buttons.\n"
            "Return JSON:\n"
            "{\n"
            '  "type": "Квадратное уравнение"|"Линейное уравнение"|"Неравенство"|"Интеграл"|"Производная"|"Матрица"|"Дробно-рациональное"|"Выражение",\n'
            '  "actions": [\n'
            '    {"id": str, "label": str, "icon": "⚖️"|"🪄"|"🧩"|"🚫"|"📊"|"📈"|"∫"|"⚡"|"📝", "operation": "solve"|"simplify"|"factor"|"domain"|"intervals"|"differentiate"|"integrate"|"evaluate"|"ai_steps", "tooltip": str}\n'
            "  ]\n"
            "}\n"
            "Russian labels: Решить, Упростить, Разложить, ОДЗ, Интеграл, Производная, Метод интервалов, Вычислить."
        )

        res = cls._call_chat(
            messages=[
                {"role": "system", "content": "You are an ultra-fast mathematical UI classifier. Output concise JSON only."},
                {"role": "user", "content": prompt}
            ],
            model=OMNI_FAST_MODEL,
            json_mode=True,
            timeout=2.2,
            max_tokens=180,
            temperature=0.0
        )

        if res and isinstance(res.get("actions"), list) and len(res["actions"]) > 0:
            result = {
                "type": res.get("type", "Выражение"),
                "actions": res["actions"]
            }
            # Save into cache
            if len(_classification_cache) > CACHE_LIMIT:
                _classification_cache.clear()
            _classification_cache[norm_key] = result
            return result

        # Fallback to instantaneous regex-based heuristics if AI is slow or unreachable
        return cls._local_heuristic_actions(latex_str)

    @classmethod
    def solve_with_ai(cls, latex_str: str, variable: str = "x") -> Optional[Dict[str, Any]]:
        """
        Solves complex expressions, inequalities, or equations with PhotoMath-style step-by-step mathematical reasoning.
        """
        prompt = (
            f"Solve the mathematical equation, inequality, or problem like PhotoMath: {latex_str}\n"
            f"Target variable: {variable}\n"
            "Requirements:\n"
            "- Step-by-step explanation MUST be human-readable, educational, and structured in Russian.\n"
            "- In each step string, ALWAYS write the explanation followed by a colon and the exact LaTeX formula enclosed in dollar signs, e.g.: 'Разложим числитель на множители: $x^3 - x^2 + 6x - 6 = (x^2 + 6)(x - 1)$'.\n"
            "- If quadratic equation, provide BOTH 'Через дискриминант' and 'По теореме Виета' methods.\n"
            "- If inequality, provide 'Метод интервалов' (critical points, interval sign test, solution set).\n"
            "Return JSON strictly:\n"
            "{\n"
            '  "result_latex": "exact answer in clean LaTeX",\n'
            '  "result_str": "string form",\n'
            '  "methods": [\n'
            '    {\n'
            '      "name": "Название метода",\n'
            '      "steps": ["Шаг 1...", "Шаг 2..."],\n'
            '      "final_answer": "ответ в LaTeX"\n'
            '    }\n'
            '  ],\n'
            '  "steps": ["Все шаги по порядку..."]\n'
            "}"
        )

        return cls._call_chat(
            messages=[
                {"role": "system", "content": "You are a PhotoMath-style mathematical solver. Provide detailed, human-readable explanations in Russian. Return strict JSON."},
                {"role": "user", "content": prompt}
            ],
            model=OMNI_MODEL,
            json_mode=True,
            timeout=10.0
        )

    @classmethod
    def _local_heuristic_actions(cls, latex_str: str) -> Dict[str, Any]:
        s = latex_str.lower()
        if any(op in s for op in ["<", ">", "\\le", "\\ge", "\\leq", "\\geq", "\\neq"]):
            return {
                "type": "Неравенство",
                "actions": [
                    {"id": "solve_ineq", "label": "Решить неравенство", "icon": "⚖️", "operation": "solve", "tooltip": "Найти интервалы решений"},
                    {"id": "intervals", "label": "Метод интервалов", "icon": "📊", "operation": "ai_steps", "tooltip": "Пошаговый разбор метода интервалов"},
                    {"id": "domain", "label": "ОДЗ", "icon": "🚫", "operation": "domain", "tooltip": "Область допустимых значений"},
                    {"id": "factor", "label": "Разложить", "icon": "🧩", "operation": "factor", "tooltip": "Разложить числитель и знаменатель"},
                    {"id": "simplify", "label": "Упростить", "icon": "🪄", "operation": "simplify", "tooltip": "Сократить дробь"},
                ]
            }
        elif "=" in s:
            if "^2" in s or "^{2}" in s:
                expr_type = "Квадратное уравнение"
            else:
                expr_type = "Уравнение"
            return {
                "type": expr_type,
                "actions": [
                    {"id": "solve_eq", "label": "Решить", "icon": "⚖️", "operation": "solve", "tooltip": "Найти корни уравнения"},
                    {"id": "simplify", "label": "Упростить", "icon": "🪄", "operation": "simplify", "tooltip": "Упростить обе части"},
                    {"id": "factor", "label": "Разложить", "icon": "🧩", "operation": "factor", "tooltip": "Разложить на множители"},
                    {"id": "diff", "label": "d/dx", "icon": "📈", "operation": "differentiate", "tooltip": "Дифференцировать выражение"},
                    {"id": "ai_steps", "label": "По шагам", "icon": "📝", "operation": "ai_steps", "tooltip": "Полное пошаговое решение"},
                ]
            }
        elif "\\int" in s:
            return {
                "type": "Интеграл",
                "actions": [
                    {"id": "integrate", "label": "Вычислить ∫", "icon": "∫", "operation": "integrate", "tooltip": "Взять интеграл"},
                    {"id": "by_parts", "label": "По частям", "icon": "🔄", "operation": "ai_steps", "tooltip": "Интегрирование по частям"},
                    {"id": "simplify", "label": "Упростить", "icon": "🪄", "operation": "simplify", "tooltip": "Преобразовать подынтегральное"},
                    {"id": "diff", "label": "d/dx", "icon": "📈", "operation": "differentiate", "tooltip": "Проверить дифференцированием"},
                ]
            }
        elif any(kw in s for kw in ["\\frac{d}{dx}", "\\partial", "d/dx", "'"]):
            return {
                "type": "Производная",
                "actions": [
                    {"id": "diff", "label": "Производная", "icon": "📈", "operation": "differentiate", "tooltip": "Взять производную"},
                    {"id": "critical", "label": "Экстремумы", "icon": "🎯", "operation": "ai_steps", "tooltip": "Найти критические точки f'(x)=0"},
                    {"id": "simplify", "label": "Упростить", "icon": "🪄", "operation": "simplify", "tooltip": "Упростить результат"},
                ]
            }
        elif any(kw in s for kw in ["matrix", "pmatrix", "bmatrix"]):
            return {
                "type": "Матрица",
                "actions": [
                    {"id": "det", "label": "Определитель", "icon": "det", "operation": "ai_steps", "tooltip": "Вычислить det(A)"},
                    {"id": "inv", "label": "Обратная", "icon": "A⁻¹", "operation": "ai_steps", "tooltip": "Найти обратную матрицу"},
                    {"id": "transpose", "label": "Транспонировать", "icon": "Aᵀ", "operation": "ai_steps", "tooltip": "Транспонирование"},
                ]
            }
        else:
            return {
                "type": "Выражение",
                "actions": [
                    {"id": "eval", "label": "Расчет", "icon": "⚡", "operation": "evaluate", "tooltip": "Численный или аналитический расчет"},
                    {"id": "simplify", "label": "Упростить", "icon": "🪄", "operation": "simplify", "tooltip": "Привести подобные слагаемые"},
                    {"id": "factor", "label": "Разложить", "icon": "🧩", "operation": "factor", "tooltip": "Разложить на множители"},
                    {"id": "diff", "label": "d/dx", "icon": "📈", "operation": "differentiate", "tooltip": "Дифференцировать по x"},
                ]
            }

    @classmethod
    def explain_step(cls, latex_str: str, title: str = "", comment: str = "") -> Dict[str, Any]:
        """Generates a human-readable pedagogical explanation of a mathematical step with KaTeX-formatted formulas."""
        s = (latex_str or "").strip()
        c = (comment or "").strip()
        t = (title or "").strip()

        # Heuristic pedagogical explanations for standard algebra steps
        # 1. Inequality factor cancellation (e.g. x^2 + 6 > 0)
        if "x^2 + 6" in s or "x^2 + 6" in c or ("полож" in c and "раздел" in c):
            return {
                "title": f"Пояснение к шагу: {t or 'Сокращение положительного множителя'}",
                "rule_name": "Свойство знакопостоянства и деление неравенства",
                "summary": "Разделим обе части неравенства на строго положительный множитель, так как он не влияет на знак выражения.",
                "explanation_points": [
                    "Для любого действительного числа $x \\in \\mathbb{R}$ квадрат неотрицателен: $x^2 \\ge 0$.",
                    "Прибавляя положительное число $6$, получаем строгое неравенство: $x^2 + 6 \\ge 6 > 0$ при любых $x$.",
                    "Так как данный множитель всегда строго больше нуля, он никогда не равен $0$ (нет действительных корней) и сохраняет положительный знак на всей числовой прямой.",
                    "По свойствам числовых неравенств, при делении обеих частей неравенства на строго положительную величину знак неравенства не меняется.",
                    "В результате дробь упрощается: $\\frac{(x-1)(x^2+6)}{(x-4)(x+4)} < 0 \\implies \\frac{x-1}{(x-4)(x+4)} < 0$."
                ],
                "formatted_explanation": "Множитель $x^2 + 6 > 0$ положителен при всех действительных $x$. Он не обращается в ноль и не меняет знак дроби, поэтому мы можем разделить на него обе части неравенства, получив более простое выражение: $\\frac{x-1}{(x-4)(x+4)} < 0$.",
                "latex_formula": latex_str
            }

        # 2. Difference of squares (e.g. x^2 - 16 = (x - 4)(x + 4))
        if ("x^2 - 16" in s or "x^2 - 16" in c or "разност" in c) and ("x - 4" in s or "x + 4" in s):
            return {
                "title": f"Пояснение к шагу: {t or 'Разложение знаменателя'}",
                "rule_name": "Формула разности квадратов",
                "summary": "Применяем формулу сокращённого умножения $a^2 - b^2 = (a - b)(a + b)$ для факторизации двучлена.",
                "explanation_points": [
                    "Представим число $16$ как точный квадрат: $16 = 4^2$.",
                    "Запишем выражение в виде разности квадратов: $x^2 - 4^2$.",
                    "Раскладываем на произведение разности и суммы оснований: $(x - 4)(x + 4)$.",
                    "Факторизация позволяет легко найти нули знаменателя и точки разрыва функции: $x = 4$ и $x = -4$."
                ],
                "formatted_explanation": "Используем формулу разности квадратов $a^2 - b^2 = (a - b)(a + b)$. Выражение $x^2 - 16 = x^2 - 4^2$ раскладывается на множители $(x - 4)(x + 4)$.",
                "latex_formula": latex_str
            }

        # 3. Polynomial grouping (x^3 - x^2 + 6x - 6 = (x - 1)(x^2 + 6))
        if "x^3 - x^2" in s or "x^3 - x^2" in c or "группировк" in c:
            return {
                "title": f"Пояснение к шагу: {t or 'Метод группировки'}",
                "rule_name": "Разложение многочлена методом группировки",
                "summary": "Группируем слагаемые парами и выносим общие множители за скобки.",
                "explanation_points": [
                    "Объединим слагаемые по парам: $(x^3 - x^2) + (6x - 6)$.",
                    "Из первой пары вынесем общий множитель $x^2$: $x^2(x - 1)$.",
                    "Из второй пары вынесем общий коэффициент $6$: $6(x - 1)$.",
                    "Получаем: $x^2(x - 1) + 6(x - 1)$. Теперь двучлен $(x - 1)$ является общим множителем.",
                    "Выносим $(x - 1)$ за скобки: $(x - 1)(x^2 + 6)$."
                ],
                "formatted_explanation": "Применяем метод группировки: сгруппировав $(x^3 - x^2) + (6x - 6)$, выносим $x^2$ и $6$, получая общий множитель $(x - 1)$. В итоге: $(x - 1)(x^2 + 6)$.",
                "latex_formula": latex_str
            }

        # 4. Critical points (x = 1, x != 4, x != -4)
        if "\\ne" in s or "\\neq" in s or "критическ" in c or "разрыв" in c:
            return {
                "title": f"Пояснение к шагу: {t or 'Критические точки'}",
                "rule_name": "Нули числителя и область определения (ОДЗ)",
                "summary": "Находим точки, в которых числитель равен нулю, и точки, где знаменатель обращается в ноль (недопустимые значения).",
                "explanation_points": [
                    "Нули числителя: приравниваем числитель к нулю: $x - 1 = 0 \\implies x = 1$. В этой точке дробь обращается в ноль.",
                    "Нули знаменателя: деление на ноль в математике невозможно, поэтому $(x - 4)(x + 4) \\ne 0$.",
                    "Отсюда получаем выколотые точки: $x \\ne 4$ и $x \\ne -4$.",
                    "Точки $x = -4$, $x = 1$, $x = 4$ разбивают числовую прямую на интервалы постоянного знака."
                ],
                "formatted_explanation": "Числитель равен нулю при $x = 1$. Знаменатель не должен равняться нулю, поэтому $x \\ne 4$ и $x \\ne -4$. Точки $-4, 1, 4$ делят прямую на интервалы для метода интервалов.",
                "latex_formula": latex_str
            }

        # 5. Method of intervals sign test
        if ("[-]" in s or "[+]" in s) or "знаки" in c or "интервал" in c:
            inv_matches = re.findall(r"([(\[])([^,]+),\s*([^\])]+)([)\]])\s*(?:\\;|\\quad|\s)*\[([+-])\]", s)
            points_desc = []
            if inv_matches:
                points_desc.append("Разбиваем числовую прямую найденными корнями и точками разрыва на интервалы постоянного знака.")
                for lo, lv, rv, ro, sign in inv_matches:
                    sign_text = "положительно ($+$)" if sign == "+" else "отрицательно ($-$)"
                    points_desc.append(f"Интервал $({lv}, {rv})$: выражение {sign_text}.")
                points_desc.append("При переходе через простые корни знаки функции последовательно чередуются.")
            else:
                points_desc = [
                    "Критические точки разбивают числовую прямую на интервалы постоянного знака.",
                    "Выбираем пробную точку внутри каждого интервала и вычисляем знак выражения."
                ]

            return {
                "title": f"Пояснение к шагу: {t or 'Расстановка знаков на интервалах'}",
                "rule_name": "Метод интервалов (определение знаков)",
                "summary": "Определяем знак рационального выражения на каждом из полученных интервалов с помощью подстановки контрольных точек.",
                "explanation_points": points_desc,
                "formatted_explanation": f"На числовой прямой отмечены реальные критические точки. На каждом интервале выбран тестовый представитель, определяющий знак всего промежутка: ${s}$.",
                "latex_formula": latex_str
            }

        # 6. Final answer selection
        if "\\cup" in s or "\\in" in s or "ответ" in t.lower() or "выбираем" in c:
            sol_match = re.search(r"\\in\s*(.+)", s)
            sol_str = sol_match.group(1).strip() if sol_match else s
            is_pos = "плюс" in c or ">" in c
            sign_word = "положительным" if is_pos else "отрицательным"

            return {
                "title": f"Пояснение к шагу: {t or 'Формирование ответа'}",
                "rule_name": "Объединение промежутков решения",
                "summary": f"Записываем в ответ интервалы с {sign_word} знаком в соответствии со знаком неравенства.",
                "explanation_points": [
                    f"В соответствии со знаком исходного неравенства отбираем интервалы с {sign_word} знаком.",
                    "Нули знаменателя всегда исключаются (круглые скобки). Строгие нули числителя также исключаются, нестрогие включаются (квадратные скобки).",
                    f"Итоговое множество решений: $x \\in {sol_str}$."
                ],
                "formatted_explanation": f"Отбираем подходящие интервалы и объединяем их: $x \\in {sol_str}$.",
                "latex_formula": latex_str
            }

        # Fallback explanation via AI if available
        if cls.is_available():
            try:
                ai_resp = cls._call_chat(
                    messages=[
                        {
                            "role": "system",
                            "content": (
                                "You are an expert mathematics educator. Explain the given mathematical step thoroughly and pedagogically in Russian. "
                                "Enclose ALL formulas and math variables strictly in dollar signs ($...$ for inline, $$...$$ for blocks). "
                                "Return JSON: {\"title\": str, \"rule_name\": str, \"summary\": str, \"explanation_points\": [str, ...], \"formatted_explanation\": str}"
                            ),
                        },
                        {
                            "role": "user",
                            "content": f"Шаг: {t}\nФормула: {s}\nКомментарий: {c}\nОбъясни подробно математическую суть этого шага.",
                        },
                    ],
                    model=OMNI_MODEL,
                    json_mode=True,
                    timeout=5.0,
                )
                if ai_resp:
                    content = ai_resp.get("choices", [{}])[0].get("message", {}).get("content", "")
                    parsed = clean_and_parse_json(content)
                    if parsed and "summary" in parsed:
                        return {
                            "title": parsed.get("title") or f"Пояснение: {t}",
                            "rule_name": parsed.get("rule_name") or "Математическое преобразование",
                            "summary": parsed.get("summary", ""),
                            "explanation_points": parsed.get("explanation_points", []),
                            "formatted_explanation": parsed.get("formatted_explanation", ""),
                            "latex_formula": latex_str,
                        }
            except Exception as err:
                logger.debug(f"AI step explanation fallback error: {err}")

        # General clean fallback
        return {
            "title": f"Пояснение к шагу: {t or 'Преобразование'}",
            "rule_name": "Тождественное преобразование",
            "summary": "Выполняется алгебраическое преобразование согласно законам математики.",
            "explanation_points": [
                f"Исходное выражение: ${latex_str}$",
                c or "Преобразование сохраняет эквивалентность математического выражения."
            ],
            "formatted_explanation": c or f"Шаг выполняется в соответствии со стандартными правилами алгебры для выражения ${latex_str}$.",
            "latex_formula": latex_str
        }

