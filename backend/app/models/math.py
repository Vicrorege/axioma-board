from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional

class MathOperationBase(BaseModel):
    latex: str = Field(..., description="LaTeX representation of the mathematical expression or equation", example=r"x^2 + 2x + 1")
    variables: Optional[Dict[str, float]] = Field(default=None, description="Optional dictionary of variable values to substitute, e.g. {'x': 2.5}")

class SimplifyRequest(BaseModel):
    latex: str = Field(..., description="LaTeX expression to simplify", example=r"\frac{x^2 - 1}{x - 1}")

class EvaluateRequest(BaseModel):
    latex: str = Field(..., description="LaTeX expression to evaluate numerically or symbolically", example=r"\sqrt{16} + 2^3")
    variables: Optional[Dict[str, float]] = Field(default=None, description="Variable values to substitute before evaluating", example={"x": 5})
    numeric: bool = Field(default=False, description="Whether to force numerical floating-point evaluation")

class DerivativeRequest(BaseModel):
    latex: str = Field(..., description="LaTeX expression to differentiate", example=r"x^3 \cdot \sin(x)")
    wrt: str = Field(default="x", description="Variable with respect to which differentiation is performed", example="x")
    order: int = Field(default=1, description="Order of derivative (e.g. 1 for first derivative, 2 for second)")

class IntegrateRequest(BaseModel):
    latex: str = Field(..., description="LaTeX expression to integrate", example=r"2x + \cos(x)")
    wrt: str = Field(default="x", description="Variable of integration")
    definite: bool = Field(default=False, description="Whether to compute definite integral")
    lower_limit: Optional[str] = Field(default=None, description="Lower limit (LaTeX or number)")
    upper_limit: Optional[str] = Field(default=None, description="Upper limit (LaTeX or number)")

class SolveRequest(BaseModel):
    latex: str = Field(description="LaTeX equation or inequality to solve")
    variable: str = Field(default="x", description="Variable to solve for")

class FactorRequest(BaseModel):
    latex: str = Field(description="LaTeX expression to factorize")

class DomainRequest(BaseModel):
    latex: str = Field(description="LaTeX expression to find domain/restrictions (ОДЗ)")
    variable: str = Field(default="x", description="Variable")

class ActionButton(BaseModel):
    id: str
    label: str
    icon: str
    operation: str
    tooltip: Optional[str] = None

class SuggestedActionsRequest(BaseModel):
    latex: str = Field(..., description="Current LaTeX expression")

class SuggestedActionsResponse(BaseModel):
    expression_type: str = "general"
    actions: List[ActionButton] = Field(default_factory=list)

class MathResult(BaseModel):
    success: bool = Field(description="Whether the operation succeeded")
    operation: str = Field(description="Operation performed")
    input_latex: str = Field(description="Original input LaTeX")
    result_latex: Optional[str] = Field(default=None, description="Result formatted as LaTeX")
    result_str: Optional[str] = Field(default=None, description="Plain text / Python string representation")
    numeric_value: Optional[float] = Field(default=None, description="Numerical float value if evaluatable")
    variables_found: List[str] = Field(default_factory=list, description="Variables detected in the expression")
    steps: Optional[List[str]] = Field(default=None, description="Step-by-step notes or explanations if applicable")
    error: Optional[str] = Field(default=None, description="Error message if operation failed")

class AstNode(BaseModel):
    type: str = Field(..., description="Node operator/type (e.g. Add, Mul, Pow, Symbol, Number)")
    latex: str = Field(..., description="LaTeX representation of this sub-expression")
    str_repr: str = Field(..., description="String representation")
    args: List['AstNode'] = Field(default_factory=list, description="Child argument nodes in the expression tree")

class AstResponse(BaseModel):
    success: bool
    latex: str
    tree: Optional[AstNode] = None
    symbols: List[str] = Field(default_factory=list)
    is_equation: bool = False
    error: Optional[str] = None
