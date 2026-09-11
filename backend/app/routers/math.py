from fastapi import APIRouter, HTTPException
from app.models.math import (
    EvaluateRequest, SimplifyRequest, DerivativeRequest,
    IntegrateRequest, SolveRequest, FactorRequest, DomainRequest,
    SuggestedActionsRequest, SuggestedActionsResponse, ActionButton,
    MathResult, AstResponse
)
from app.services.sympy_engine import SympyEngine
from app.services.omni_ai import OmniAIService

router = APIRouter(prefix="/api/math", tags=["Mathematical Engine"])

@router.post("/evaluate", response_model=MathResult, summary="Evaluate expression symbolically or numerically")
async def evaluate_expression(req: EvaluateRequest):
    """Evaluates a mathematical LaTeX expression."""
    return SympyEngine.evaluate(req.latex, variables=req.variables, numeric=req.numeric)

@router.post("/simplify", response_model=MathResult, summary="Simplify a mathematical expression")
async def simplify_expression(req: SimplifyRequest):
    """Simplifies an algebraic or trigonometric LaTeX expression."""
    return SympyEngine.simplify_expr(req.latex)

@router.post("/factor", response_model=MathResult, summary="Factorize a mathematical expression")
async def factor_expression(req: FactorRequest):
    """Factorizes polynomials or rational expressions."""
    return SympyEngine.factor_expr(req.latex)

@router.post("/domain", response_model=MathResult, summary="Analyze domain and restrictions (ОДЗ)")
async def domain_expression(req: DomainRequest):
    """Finds domain restrictions, excluded points, and roots of denominator."""
    return SympyEngine.find_domain(req.latex, variable=req.variable)

@router.post("/derivative", response_model=MathResult, summary="Compute symbolic derivative")
async def compute_derivative(req: DerivativeRequest):
    """Differentiates an expression with respect to the given variable."""
    return SympyEngine.derivative(req.latex, wrt=req.wrt, order=req.order)

@router.post("/integrate", response_model=MathResult, summary="Compute indefinite or definite integral")
async def compute_integral(req: IntegrateRequest):
    """Integrates an expression with respect to the given variable."""
    return SympyEngine.integrate_expr(
        req.latex,
        wrt=req.wrt,
        definite=req.definite,
        lower=req.lower_limit,
        upper=req.upper_limit
    )

@router.post("/solve", response_model=MathResult, summary="Solve equation or inequality")
async def solve_equation(req: SolveRequest):
    """Solves an equation or inequality for the given variable."""
    return SympyEngine.solve_equation(req.latex, variable=req.variable)

@router.post("/suggested-actions", response_model=SuggestedActionsResponse, summary="Get dynamic actions tailored to formula")
async def get_suggested_actions(req: SuggestedActionsRequest):
    """
    Returns 4-5 dynamically selected action buttons tailored to the current expression
    using AI (OmniRoute) with instant local heuristic fallback.
    """
    actions_raw = OmniAIService.suggest_actions(req.latex)
    actions = [ActionButton(**a) for a in actions_raw]
    return SuggestedActionsResponse(
        expression_type="detected",
        actions=actions
    )

@router.post("/ast", response_model=AstResponse, summary="Parse LaTeX to AST expression tree (for AI/tools)")
async def parse_to_ast(latex: str):
    """Parses LaTeX into a recursive Abstract Syntax Tree (AST)."""
    return SympyEngine.to_ast(latex)
