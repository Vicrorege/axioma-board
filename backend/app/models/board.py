from pydantic import BaseModel, Field
from typing import Dict, Any, List, Optional
from datetime import datetime

class MathBlockData(BaseModel):
    id: str = Field(..., description="Unique ID of the block shape")
    x: float = Field(default=100.0, description="X coordinate on canvas")
    y: float = Field(default=100.0, description="Y coordinate on canvas")
    title: Optional[str] = Field(default="Expression", description="Title or label of the card")
    latex: str = Field(..., description="LaTeX formula inside the block", example="f(x) = x^2 + 1")
    result_latex: Optional[str] = Field(default=None, description="Calculated result LaTeX if any")
    operation: Optional[str] = Field(default=None, description="Last operation performed (e.g. 'eval', 'simplify', 'diff')")
    variables: Optional[Dict[str, float]] = Field(default=None, description="Local variable assignments for this block")
    color: Optional[str] = Field(default="#3b82f6", description="Accent color theme")
    comment: Optional[str] = Field(default=None, description="Optional text note or step explanation")

class ArrowConnection(BaseModel):
    id: str = Field(..., description="ID of the arrow connection")
    from_id: str = Field(..., description="Source block ID")
    to_id: str = Field(..., description="Target block ID")
    label: Optional[str] = Field(default=None, description="Label on the arrow (e.g. 'substitute', 'd/dx')")

class BoardBase(BaseModel):
    title: str = Field(default="Untitled Math Board", description="Board title")
    description: Optional[str] = Field(default=None, description="Optional description")

class BoardCreate(BoardBase):
    pass

class BoardSnapshot(BaseModel):
    blocks: List[MathBlockData] = Field(default_factory=list, description="All math blocks on the board")
    arrows: List[ArrowConnection] = Field(default_factory=list, description="Arrow connections between blocks")
    canvas_state: Optional[Dict[str, Any]] = Field(default=None, description="Raw tldraw records/store snapshot for full canvas fidelity")

class Board(BoardBase):
    id: str = Field(..., description="Unique board UUID")
    created_at: str = Field(..., description="Creation ISO timestamp")
    updated_at: str = Field(..., description="Last update ISO timestamp")
    snapshot: BoardSnapshot = Field(default_factory=BoardSnapshot, description="Board contents")

# Models for AI Actions on Board
class AddBlockAction(BaseModel):
    board_id: str
    latex: str
    title: Optional[str] = "Expression"
    x: Optional[float] = 100
    y: Optional[float] = 100
    comment: Optional[str] = None
    color: Optional[str] = "#3b82f6"

class ConnectBlocksAction(BaseModel):
    board_id: str
    from_block_id: str
    to_block_id: str
    label: Optional[str] = None

class StepByStepSolveAction(BaseModel):
    board_id: str
    equation_latex: str
    variable: Optional[str] = "x"
    start_x: Optional[float] = 100
    start_y: Optional[float] = 100

class AIExecuteBatchAction(BaseModel):
    board_id: str
    instruction: Optional[str] = Field(None, description="Human instruction that was executed")
    blocks_to_add: List[MathBlockData] = Field(default_factory=list)
    arrows_to_add: List[ArrowConnection] = Field(default_factory=list)
    blocks_to_update: List[MathBlockData] = Field(default_factory=list)
    block_ids_to_remove: List[str] = Field(default_factory=list)
