import os
import hashlib
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import FileResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel

from app.models.board import Board, BoardCreate, BoardSnapshot, MathBlockData, ArrowConnection
from app.services.board_store import board_store
from app.routers.auth import get_current_user_optional, UserResponse

router = APIRouter(prefix="/api/boards", tags=["Whiteboard CRUD"])

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "../../data/assets")
os.makedirs(ASSETS_DIR, exist_ok=True)

class BoardUpdatePayload(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    snapshot: Optional[BoardSnapshot] = None

@router.get("", response_model=List[Dict[str, Any]], summary="List all boards for current user")
async def list_boards(user: Optional[UserResponse] = Depends(get_current_user_optional)):
    """Returns all saved boards belonging to the logged in user, or guest boards."""
    user_id = user.id if user else None
    boards = board_store.list_boards(user_id=user_id)
    if not boards and user:
        # Create first initial board for this user
        new_b = board_store.create_board(
            title="My First Workspace",
            description="Welcome to your personal math workspace!",
            user_id=user.id
        )
        return board_store.list_boards(user_id=user.id)
    return boards

@router.post("", response_model=Board, summary="Create a new board")
async def create_board(
    payload: BoardCreate,
    user: Optional[UserResponse] = Depends(get_current_user_optional)
):
    """Creates a new math whiteboard session linked to current account."""
    user_id = user.id if user else None
    return board_store.create_board(
        title=payload.title,
        description=payload.description,
        user_id=user_id
    )

@router.post("/assets", summary="Upload an image asset for whiteboard")
async def upload_asset(file: UploadFile = File(...)):
    """Uploads an image pasted or dropped onto the board."""
    content = await file.read()
    ext = os.path.splitext(file.filename or "")[1] or ".png"
    hash_name = hashlib.sha256(content).hexdigest()
    filename = f"{hash_name}{ext}"
    filepath = os.path.join(ASSETS_DIR, filename)
    if not os.path.exists(filepath):
        with open(filepath, "wb") as f:
            f.write(content)
    return {"src": f"/api/boards/assets/{filename}", "id": f"asset:{hash_name}"}

@router.get("/assets/{filename}", summary="Get whiteboard asset file")
async def get_asset(filename: str):
    """Serves uploaded whiteboard image asset with caching."""
    safe_name = os.path.basename(filename)
    filepath = os.path.join(ASSETS_DIR, safe_name)
    if not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="Asset not found")
    return FileResponse(filepath, headers={"Cache-Control": "public, max-age=31536000, immutable"})

@router.get("/{board_id}", response_model=Board, summary="Get board by ID")
async def get_board(board_id: str):
    """Retrieves full board state including math blocks, arrows, and canvas store."""
    b = board_store.get_board(board_id)
    if not b:
        raise HTTPException(status_code=404, detail="Board not found")
    return b

@router.put("/{board_id}", response_model=Board, summary="Update board state or snapshot")
async def update_board(board_id: str, payload: BoardUpdatePayload):
    """Updates board title, description, or canvas snapshot."""
    updated = board_store.update_board(
        board_id,
        title=payload.title,
        description=payload.description,
        snapshot=payload.snapshot
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Board not found")
    return updated

@router.delete("/{board_id}", summary="Delete a board")
async def delete_board(
    board_id: str,
    user: Optional[UserResponse] = Depends(get_current_user_optional)
):
    """Deletes board by ID."""
    user_id = user.id if user else None
    deleted = board_store.delete_board(board_id, user_id=user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Board not found or unauthorized")
    return {"success": True, "board_id": board_id}

@router.post("/{board_id}/blocks", response_model=Board, summary="Add or update a single math block")
async def add_or_update_block(board_id: str, block: MathBlockData):
    """Adds a new math block or updates an existing one on the specified board."""
    res = board_store.add_block_to_board(board_id, block)
    if not res:
        raise HTTPException(status_code=404, detail="Board not found")
    return res

@router.post("/{board_id}/arrows", response_model=Board, summary="Connect two blocks with an arrow")
async def add_arrow(board_id: str, arrow: ArrowConnection):
    """Adds an arrow relationship between two math blocks."""
    res = board_store.add_arrow_to_board(board_id, arrow)
    if not res:
        raise HTTPException(status_code=404, detail="Board not found")
    return res
