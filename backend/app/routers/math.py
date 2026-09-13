from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from app.models.math import (
    EvaluateRequest, SimplifyRequest, DerivativeRequest,
    IntegrateRequest, SolveRequest, FactorRequest, DomainRequest,
    SuggestedActionsRequest, SuggestedActionsResponse, ActionButton,
    MathResult, AstResponse
)
from app.services.sympy_engine import SympyEngine
from app.services.omni_ai import OmniAIService
from app.services.math_memory import math_memory

router = APIRouter(prefix="/api/math", tags=["Mathematical Engine"])

class ReportSolutionRequest(BaseModel):
    operation: str = Field(default="solve", description="Operation that was performed")
    latex: str = Field(..., description="The LaTeX formula that was solved")
    reason: Optional[str] = Field(default="User flagged solution as inaccurate", description="Reason for reconsideration")
    variable: Optional[str] = Field(default="x", description="Target variable")

@router.post("/evaluate", response_model=MathResult, summary="Evaluate expression symbolically or numerically")
async def evaluate_expression(req: EvaluateRequest):
    """Evaluates a mathematical LaTeX expression with memory cache."""
    cached = math_memory.get_cached_result("evaluate", req.latex, str(req.numeric))
    if cached:
        return MathResult(**cached)
    res = SympyEngine.evaluate(req.latex, variables=req.variables, numeric=req.numeric)
    if res.success:
        math_memory.save_cached_result("evaluate", req.latex, res.model_dump(), str(req.numeric))
    return res

@router.post("/simplify", response_model=MathResult, summary="Simplify a mathematical expression")
async def simplify_expression(req: SimplifyRequest):
    """Simplifies an algebraic or trigonometric LaTeX expression with memory cache."""
    cached = math_memory.get_cached_result("simplify", req.latex)
    if cached:
        return MathResult(**cached)
    res = SympyEngine.simplify_expr(req.latex)
    if res.success:
        math_memory.save_cached_result("simplify", req.latex, res.model_dump())
    return res

@router.post("/factor", response_model=MathResult, summary="Factorize a mathematical expression")
async def factor_expression(req: FactorRequest):
    """Factorizes polynomials or rational expressions with memory cache."""
    cached = math_memory.get_cached_result("factor", req.latex)
    if cached:
        return MathResult(**cached)
    res = SympyEngine.factor_expr(req.latex)
    if res.success:
        math_memory.save_cached_result("factor", req.latex, res.model_dump())
    return res

@router.post("/domain", response_model=MathResult, summary="Analyze domain and restrictions (ОДЗ)")
async def domain_expression(req: DomainRequest):
    """Finds domain restrictions, excluded points, and roots of denominator with memory cache."""
    cached = math_memory.get_cached_result("domain", req.latex, req.variable)
    if cached:
        return MathResult(**cached)
    res = SympyEngine.find_domain(req.latex, variable=req.variable)
    if res.success:
        math_memory.save_cached_result("domain", req.latex, res.model_dump(), req.variable)
    return res

@router.post("/derivative", response_model=MathResult, summary="Compute symbolic derivative")
async def compute_derivative(req: DerivativeRequest):
    """Differentiates an expression with respect to the given variable with memory cache."""
    extra = f"{req.wrt}:{req.order}"
    cached = math_memory.get_cached_result("derivative", req.latex, extra)
    if cached:
        return MathResult(**cached)
    res = SympyEngine.derivative(req.latex, wrt=req.wrt, order=req.order)
    if res.success:
        math_memory.save_cached_result("derivative", req.latex, res.model_dump(), extra)
    return res

@router.post("/integrate", response_model=MathResult, summary="Compute indefinite or definite integral")
async def compute_integral(req: IntegrateRequest):
    """Integrates an expression with respect to the given variable with memory cache."""
    extra = f"{req.wrt}:{req.definite}:{req.lower_limit}:{req.upper_limit}"
    cached = math_memory.get_cached_result("integrate", req.latex, extra)
    if cached:
        return MathResult(**cached)
    res = SympyEngine.integrate_expr(
        req.latex,
        wrt=req.wrt,
        definite=req.definite,
        lower=req.lower_limit,
        upper=req.upper_limit
    )
    if res.success:
        math_memory.save_cached_result("integrate", req.latex, res.model_dump(), extra)
    return res

@router.post("/solve", response_model=MathResult, summary="Solve equation or inequality")
async def solve_equation(req: SolveRequest):
    """Solves an equation or inequality for the given variable with persistent solution memory."""
    cached = math_memory.get_cached_result("solve", req.latex, req.variable)
    if cached:
        return MathResult(**cached)
    res = SympyEngine.solve_equation(req.latex, variable=req.variable)
    if res.success:
        math_memory.save_cached_result("solve", req.latex, res.model_dump(), req.variable)
    return res

@router.post("/report", summary="Report inaccurate solution for reconsideration")
async def report_solution(req: ReportSolutionRequest):
    """
    Invalidates cached solution and marks the formula for reconsideration.
    Forces subsequent solves of this expression to re-execute cleanly.
    """
    math_memory.flag_solution_for_review(
        op=req.operation,
        latex_str=req.latex,
        reason=req.reason or "Пользователь отправил решение на пересмотр",
        extra=req.variable or "x"
    )
    return {
        "success": True,
        "message": "Решение отправлено на пересмотр, кэш сброшен.",
        "latex": req.latex
    }

@router.post("/suggested-actions", response_model=SuggestedActionsResponse, summary="Get dynamic actions tailored to formula")
async def get_suggested_actions(req: SuggestedActionsRequest):
    """
    Returns 4-5 dynamically selected action buttons tailored to the current expression
    using the fastest AI model (auto/best-fast) with instant local heuristic fallback.
    """
    res = OmniAIService.suggest_actions(req.latex)
    raw_actions = res.get("actions", [])
    actions = [ActionButton(**a) for a in raw_actions]
    return SuggestedActionsResponse(
        expression_type=res.get("type", "Выражение"),
        actions=actions
    )

@router.post("/ast", response_model=AstResponse, summary="Parse LaTeX to AST expression tree (for AI/tools)")
async def parse_to_ast(latex: str):
    """Parses LaTeX into a recursive Abstract Syntax Tree (AST)."""
    return SympyEngine.to_ast(latex)

class ExplainStepRequest(BaseModel):
    latex: str
    title: Optional[str] = ""
    comment: Optional[str] = ""

@router.post("/explain-step", summary="Get detailed human-readable explanation of a mathematical step")
async def explain_step(req: ExplainStepRequest):
    """Returns a rich, pedagogically sound human-readable explanation with KaTeX-formatted formulas."""
    return OmniAIService.explain_step(req.latex, req.title or "", req.comment or "")
