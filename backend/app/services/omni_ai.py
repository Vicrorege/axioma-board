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
        # Double single backslashes in LaTeX strings (e.g. \frac, \beta, \in)
        fixed = re.sub(r'\\(?![\\\"/])', r'\\\\', clean)
        return json.loads(fixed, strict=False)

class OmniAIService:
    @classmethod
    def is_available(cls) -> bool:
        return bool(OMNI_API_KEY)

    @classmethod
    def _call_chat(cls, messages: List[Dict[str, str]], json_mode: bool = True, timeout: float = 12.0) -> Optional[Dict[str, Any]]:
        if not cls.is_available():
            return None

        url = f"{OMNI_BASE_URL.rstrip('/')}/chat/completions"
        payload: Dict[str, Any] = {
            "model": OMNI_MODEL,
            "messages": messages,
            "temperature": 0.2,
        }
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
            logger.warning(f"OmniRoute request failed: {e}")
            return None

    @classmethod
    def suggest_actions(cls, latex_str: str) -> List[Dict[str, Any]]:
        """
        Dynamically suggest 4-5 relevant math action buttons tailored to the expression.
        """
        # Always return quick local heuristic first or combined with AI
        prompt = (
            f"LaTeX expression: {latex_str}\n"
            "Analyze this expression and determine the most useful 4 to 5 mathematical action buttons for a student or mathematician.\n"
            "Return JSON: {\"actions\": [{\"id\": str, \"label\": str, \"icon\": str, \"operation\": str, \"tooltip\": str}]}\n"
            "Allowed operations:\n"
            "- 'solve': solve equation or inequality\n"
            "- 'simplify': simplify/cancel terms\n"
            "- 'factor': factorize into polynomial roots/products\n"
            "- 'domain': analyze domain and restrictions (ОДЗ)\n"
            "- 'intervals': method of intervals for inequalities\n"
            "- 'differentiate': take derivative d/dx\n"
            "- 'integrate': compute indefinite or definite integral\n"
            "- 'evaluate': numerical calculation\n"
            "- 'ai_steps': step-by-step detailed solution by AI\n"
            "Labels should be concise in Russian (1-2 words), e.g.: 'Решить', 'ОДЗ', 'Разложить', 'd/dx', 'Метод интервалов', 'Упростить'."
        )

        res = cls._call_chat([
            {"role": "system", "content": "You are a UI math expert that suggests the most relevant action buttons for math cards. Output strict JSON only."},
            {"role": "user", "content": prompt}
        ], json_mode=True, timeout=4.0)

        if res and isinstance(res.get("actions"), list) and len(res["actions"]) > 0:
            return res["actions"]

        # Local fallback if AI times out or is offline
        return cls._local_heuristic_actions(latex_str)

    @classmethod
    def _local_heuristic_actions(cls, latex_str: str) -> List[Dict[str, Any]]:
        s = latex_str.lower()
        if any(op in s for op in ["<", ">", "\\le", "\\ge", "\\leq", "\\geq", "\\neq"]):
            return [
                {"id": "solve_ineq", "label": "Решить неравенство", "icon": "⚖️", "operation": "solve", "tooltip": "Найти интервалы решений"},
                {"id": "intervals", "label": "Метод интервалов", "icon": "📊", "operation": "ai_steps", "tooltip": "Пошаговый разбор метода интервалов"},
                {"id": "domain", "label": "ОДЗ", "icon": "🚫", "operation": "domain", "tooltip": "Область допустимых значений"},
                {"id": "factor", "label": "Разложить", "icon": "🧩", "operation": "factor", "tooltip": "Разложить числитель и знаменатель"},
                {"id": "simplify", "label": "Упростить", "icon": "🪄", "operation": "simplify", "tooltip": "Сократить дробь"},
            ]
        elif "=" in s:
            return [
                {"id": "solve_eq", "label": "Решить", "icon": "⚖️", "operation": "solve", "tooltip": "Найти корни уравнения"},
                {"id": "simplify", "label": "Упростить", "icon": "🪄", "operation": "simplify", "tooltip": "Упростить обе части"},
                {"id": "factor", "label": "Разложить", "icon": "🧩", "operation": "factor", "tooltip": "Разложить на множители"},
                {"id": "diff", "label": "d/dx", "icon": "📈", "operation": "differentiate", "tooltip": "Дифференцировать выражение"},
                {"id": "ai_steps", "label": "По шагам", "icon": "📝", "operation": "ai_steps", "tooltip": "Полное пошаговое решение"},
            ]
        elif "\\int" in s:
            return [
                {"id": "integrate", "label": "Вычислить ∫", "icon": "∫", "operation": "integrate", "tooltip": "Взять интеграл"},
                {"id": "by_parts", "label": "По частям", "icon": "🔄", "operation": "ai_steps", "tooltip": "Интегрирование по частям"},
                {"id": "simplify", "label": "Упростить", "icon": "🪄", "operation": "simplify", "tooltip": "Преобразовать подынтегральное"},
                {"id": "diff", "label": "d/dx", "icon": "📈", "operation": "differentiate", "tooltip": "Проверить дифференцированием"},
            ]
        elif any(kw in s for kw in ["\\frac{d}{dx}", "\\partial", "d/dx"]):
            return [
                {"id": "diff", "label": "Производная", "icon": "📈", "operation": "differentiate", "tooltip": "Взять производную"},
                {"id": "critical", "label": "Экстремумы", "icon": "🎯", "operation": "ai_steps", "tooltip": "Найти критические точки f'(x)=0"},
                {"id": "simplify", "label": "Упростить", "icon": "🪄", "operation": "simplify", "tooltip": "Упростить результат"},
            ]
        elif any(kw in s for kw in ["matrix", "pmatrix", "bmatrix"]):
            return [
                {"id": "det", "label": "Определитель", "icon": "det", "operation": "ai_steps", "tooltip": "Вычислить det(A)"},
                {"id": "inv", "label": "Обратная", "icon": "A⁻¹", "operation": "ai_steps", "tooltip": "Найти обратную матрицу"},
                {"id": "transpose", "label": "Транспонировать", "icon": "Aᵀ", "operation": "ai_steps", "tooltip": "Транспонирование"},
            ]
        else:
            return [
                {"id": "eval", "label": "Расчет", "icon": "⚡", "operation": "evaluate", "tooltip": "Численный или аналитический расчет"},
                {"id": "simplify", "label": "Упростить", "icon": "🪄", "operation": "simplify", "tooltip": "Привести подобные слагаемые"},
                {"id": "factor", "label": "Разложить", "icon": "🧩", "operation": "factor", "tooltip": "Разложить на множители"},
                {"id": "diff", "label": "d/dx", "icon": "📈", "operation": "differentiate", "tooltip": "Взять производную"},
                {"id": "integ", "label": "∫ dx", "icon": "∫", "operation": "integrate", "tooltip": "Взять первообразную"},
            ]

    @classmethod
    def solve_with_ai(cls, latex_str: str, variable: str = "x") -> Optional[Dict[str, Any]]:
        """
        Solves complex expressions, inequalities, or equations with step-by-step mathematical reasoning.
        """
        prompt = (
            f"Solve the mathematical expression or inequality: {latex_str}\n"
            f"Target variable: {variable}\n"
            "Provide the exact answer in clean LaTeX (result_latex) and a list of clear steps in Russian (steps).\n"
            "Format JSON: {\"result_latex\": str, \"result_str\": str, \"steps\": [str], \"summary\": str}"
        )

        return cls._call_chat([
            {"role": "system", "content": "You are a world-class mathematician. Output strict JSON with result_latex and steps."},
            {"role": "user", "content": prompt}
        ], json_mode=True, timeout=12.0)
