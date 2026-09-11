from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from app.routers import math, boards, ai, telemetry, auth
from app.services.board_store import board_store

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure at least one initial board exists
    boards_list = board_store.list_boards()
    if not boards_list:
        board_store.create_board(
            title="Demo Axioma Workspace",
            description="Welcome to AxiomaBoard! An infinite collaborative whiteboard for mathematical expressions."
        )
    yield

app = FastAPI(
    title="AxiomaBoard API - Open Mathematical Whiteboard",
    description="""
# AxiomaBoard Open API

High-performance API for interactive mathematical whiteboard, powered by SymPy and designed for humans and AI agents.

### Features:
- 🧮 **Symbolic & Numeric Engine**: Evaluate, simplify, differentiate, integrate, and solve equations.
- 🌳 **AST Analysis**: Extract tree representations of expressions for AI tool use and logic transformations.
- 📋 **Whiteboard Graph**: Read and mutate mathematical blocks, arrow relations, and positions on the infinite canvas.
- 🤖 **AI-First Endpoints**: Dedicated endpoints for autonomous agents to inspect boards, inject formulas, connect steps, and solve pipelines.
    """,
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan
)

# Enable CORS for frontend and external integrations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(math.router)
app.include_router(boards.router)
app.include_router(ai.router)
app.include_router(telemetry.router)
app.include_router(auth.router)

@app.get("/api/health", summary="Health check endpoint")
async def health_check():
    return {"status": "ok", "service": "axioma-board-backend", "engine": "sympy"}
