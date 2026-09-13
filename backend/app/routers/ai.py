import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.models.board import MathBlockData, ArrowConnection, Board
from app.services.board_store import board_store
from app.services.sympy_engine import SympyEngine

router = APIRouter(prefix="/api/ai", tags=["AI & LLM Integration Agent API"])

class AIAddFormulaRequest(BaseModel):
    board_id: str
    latex: str = Field(..., description="LaTeX formula to place", example=r"E = mc^2")
    title: Optional[str] = Field(default="AI Expression", description="Block card title")
    comment: Optional[str] = Field(default=None, description="Explanation or reasoning text")
    x: Optional[float] = Field(default=None, description="X canvas position (auto-placed if null)")
    y: Optional[float] = Field(default=None, description="Y canvas position (auto-placed if null)")
    color: Optional[str] = Field(default="#8b5cf6", description="Accent color (default purple for AI)")

class AIConnectRequest(BaseModel):
    board_id: str
    from_block_id: str
    to_block_id: str
    label: Optional[str] = Field(default=None, description="Label describing the step or deduction")

class AISolveStepsRequest(BaseModel):
    board_id: str
    latex: str = Field(..., description="Equation or expression to solve step by step", example=r"x^2 - 4x + 4 = 0")
    variable: Optional[str] = Field(default="x", description="Target variable to solve for")
    origin_x: Optional[float] = Field(default=150.0, description="Start X position")
    origin_y: Optional[float] = Field(default=150.0, description="Start Y position")

class AIBatchMutateRequest(BaseModel):
    board_id: str
    reasoning: Optional[str] = Field(None, description="Summary of AI action/intent")
    blocks_to_add: List[MathBlockData] = Field(default_factory=list)
    arrows_to_add: List[ArrowConnection] = Field(default_factory=list)
    blocks_to_update: List[MathBlockData] = Field(default_factory=list)
    block_ids_to_remove: List[str] = Field(default_factory=list)

@router.get("/board-context/{board_id}", summary="Get clean AI prompt context for a board")
async def get_board_context(board_id: str):
    """
    Returns a markdown and JSON summary of the board optimized for LLM consumption.
    Includes all current mathematical blocks, expressions, results, and arrow dependencies.
    """
    board = board_store.get_board(board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    blocks = board.snapshot.blocks
    arrows = board.snapshot.arrows

    md_lines = [f"# Board: {board.title} (ID: {board.id})"]
    if board.description:
        md_lines.append(f"Description: {board.description}")
    
    md_lines.append("\n## Current Mathematical Blocks:")
    for b in blocks:
        res = f" => Result: {b.result_latex}" if b.result_latex else ""
        comment = f" ({b.comment})" if b.comment else ""
        md_lines.append(f"- Block `{b.id}` [{b.title}]: ${b.latex}${res}{comment} (at x={b.x}, y={b.y})")

    if arrows:
        md_lines.append("\n## Connections / Workflow:")
        for a in arrows:
            lbl = f" --[{a.label}]--> " if a.label else " ----> "
            md_lines.append(f"- `{a.from_id}`{lbl}`{a.to_id}`")

    return {
        "board_id": board.id,
        "title": board.title,
        "context_markdown": "\n".join(md_lines),
        "blocks_count": len(blocks),
        "blocks": [b.model_dump() for b in blocks],
        "arrows": [a.model_dump() for a in arrows]
    }

@router.post("/add-formula", response_model=Board, summary="AI adds a formula block to the board")
async def ai_add_formula(req: AIAddFormulaRequest):
    """
    Allows an AI agent to inject a new formula block into the user's canvas.
    Auto-computes position if coordinates are not specified.
    """
    board = board_store.get_board(req.board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    # Auto-position if not supplied
    if req.x is None or req.y is None:
        last_block = board.snapshot.blocks[-1] if board.snapshot.blocks else None
        pos_x = (last_block.x + 360) if last_block else 150.0
        pos_y = last_block.y if last_block else 150.0
    else:
        pos_x, pos_y = req.x, req.y

    new_block = MathBlockData(
        id=f"ai-block-{uuid.uuid4().hex[:8]}",
        x=pos_x,
        y=pos_y,
        title=req.title or "AI Formula",
        latex=req.latex,
        comment=req.comment,
        color=req.color or "#8b5cf6"
    )

    board.snapshot.blocks.append(new_block)
    return board_store.update_board(board.id, snapshot=board.snapshot)

@router.post("/connect", response_model=Board, summary="AI connects two formula blocks with an arrow")
async def ai_connect(req: AIConnectRequest):
    """
    Connects two mathematical blocks with a labelled arrow indicating a logical step or dependency.
    """
    board = board_store.get_board(req.board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    arrow = ArrowConnection(
        id=f"arrow-{uuid.uuid4().hex[:8]}",
        from_id=req.from_block_id,
        to_id=req.to_block_id,
        label=req.label
    )
    board.snapshot.arrows.append(arrow)
    return board_store.update_board(board.id, snapshot=board.snapshot)

@router.post("/solve-steps", response_model=Board, summary="AI / Engine generates step-by-step resolution chain")
async def ai_solve_steps(req: AISolveStepsRequest):
    """
    Takes an equation, performs step-by-step algebraic solving via SymPy engine,
    and lays out a visual pipeline of blocks connected by arrows on the board.
    """
    board = board_store.get_board(req.board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    solve_res = SympyEngine.solve_equation(req.latex, variable=req.variable or "x")
    simp_res = SympyEngine.simplify_expr(req.latex)

    x_step = req.origin_x or 150.0
    y_step = req.origin_y or 150.0

    b1_id = f"step-orig-{uuid.uuid4().hex[:6]}"
    b2_id = f"step-simp-{uuid.uuid4().hex[:6]}"
    b3_id = f"step-sol-{uuid.uuid4().hex[:6]}"

    # 1. Original
    block1 = MathBlockData(
        id=b1_id,
        x=x_step,
        y=y_step,
        title="1. Original Equation",
        latex=req.latex,
        color="#3b82f6"
    )

    # 2. Simplified form
    block2 = MathBlockData(
        id=b2_id,
        x=x_step + 340,
        y=y_step,
        title="2. Simplified Form",
        latex=simp_res.result_latex if simp_res.success else req.latex,
        color="#06b6d4"
    )

    # 3. Solution
    block3 = MathBlockData(
        id=b3_id,
        x=x_step + 680,
        y=y_step,
        title=f"3. Solution for {req.variable}",
        latex=solve_res.result_latex if solve_res.success else r"\text{No analytical solution}",
        color="#10b981",
        comment=f"Solved in SymPy"
    )

    arr1 = ArrowConnection(id=f"arr-{uuid.uuid4().hex[:6]}", from_id=b1_id, to_id=b2_id, label="simplify")
    arr2 = ArrowConnection(id=f"arr-{uuid.uuid4().hex[:6]}", from_id=b2_id, to_id=b3_id, label=f"solve for {req.variable}")

    board.snapshot.blocks.extend([block1, block2, block3])
    board.snapshot.arrows.extend([arr1, arr2])

    return board_store.update_board(board.id, snapshot=board.snapshot)

@router.post("/batch-mutate", response_model=Board, summary="Atomic batch mutation of board state")
async def ai_batch_mutate(req: AIBatchMutateRequest):
    """
    Atomic bulk mutation designed for an LLM agent to execute complex canvas rewrites.
    """
    board = board_store.get_board(req.board_id)
    if not board:
        raise HTTPException(status_code=404, detail="Board not found")

    existing_blocks = {b.id: b for b in board.snapshot.blocks}

    # Removals
    for rm_id in req.block_ids_to_remove:
        existing_blocks.pop(rm_id, None)

    # Updates
    for up_block in req.blocks_to_update:
        existing_blocks[up_block.id] = up_block

    # Additions
    for add_block in req.blocks_to_add:
        existing_blocks[add_block.id] = add_block

    board.snapshot.blocks = list(existing_blocks.values())
    board.snapshot.arrows.extend(req.arrows_to_add)

    return board_store.update_board(board.id, snapshot=board.snapshot)
