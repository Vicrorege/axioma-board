# AxiomaBoard 🧮

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?logo=fastapi)](https://fastapi.tiangolo.com)
[![SymPy](https://img.shields.io/badge/CAS-SymPy-3B5526.svg)](https://www.sympy.org/)
[![React](https://img.shields.io/badge/Frontend-React_19-61DAFB.svg?logo=react)](https://react.dev)
[![tldraw](https://img.shields.io/badge/Canvas-tldraw-FF5C00.svg)](https://tldraw.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6.svg?logo=typescript)](https://www.typescriptlang.org/)

An infinite, collaborative mathematical whiteboard (like Miro), purpose-built for visual formula derivation, powered by a dual **SymPy + LLM Engine** and featuring a rich **Open API** for autonomous AI agents.

---

## ✨ Features

- **Infinite Mathematical Canvas**:
  - Pan, zoom, multi-select, freehand ink, notes, arrows, and shape drawing backed by `tldraw`.
  - **Persistent Image Assets**: Paste screenshots and drop image files directly onto the board with automatic persistent backend storage.
- **WYSIWYG Math Editor (MathLive)**:
  - Natural keyboard-driven formula editing (Photomath-style): fractions, powers, roots, calculus, and matrix notation.
  - Multi-level vertical fractions, superscripts, and integrals rendered in real-time with KaTeX.
- **Dual Symbolic Computation (SymPy + AI Engine)**:
  - **Algebraic Solving**: Rational inequalities with interval notation ($x \in (-\infty, -4) \cup (1, 4)$), polynomial roots, systems of equations.
  - **Calculus**: Symbolic derivatives ($d/dx$, higher order) and indefinite/definite integrals ($\int$).
  - **Domain Analysis (ОДЗ)**: Discontinuities and denominator restrictions.
  - **Factorization**: Polynomial and rational expression factoring.
  - **Step-by-Step Breakdown**: Detailed mathematical reasoning for equations and interval analysis.
- **Context-Aware Adaptive Actions**:
  - The formula card dynamically adapts its action buttons depending on the input expression (e.g. Inequalities -> Solve, Interval Method, Domain, Factor; Equations -> Roots, Derivative, Steps).
- **Derivation Tree Branching**:
  - Click **Ветвить (Branch)** to sprout a new connected formula block linked by an arrow, turning problem-solving into a visual proof graph.
- **Account & Multi-Board Management**:
  - Personal workspaces with SQLite persistence and instantaneous auto-saving.
- **Open API for AI Agents**:
  - First-class OpenAPI (Swagger) endpoints for autonomous agents to inspect canvas state, manipulate expressions, and generate multi-step solutions.

---

## 🛠️ Architecture & Tech Stack

```text
┌────────────────────────────────────────────────────────┐
│             AxiomaBoard Frontend (Vite + React)        │
│    tldraw Canvas  │  MathLive WYSIWYG  │  KaTeX Render │
└───────────┬────────────────────────────────┬───────────┘
            │ REST / WebSocket               │
┌───────────▼────────────────────────────────▼───────────┐
│             FastAPI Backend (Python 3.12)              │
│  ┌───────────────────────┐   ┌───────────────────────┐ │
│  │     SymPy Engine      │   │     OmniRoute AI      │ │
│  │ (Exact CAS, Solveset, │   │ (Step-by-step logic,  │ │
│  │  Derivatives, Domain) │   │  Adaptive suggestions)│ │
│  └───────────────────────┘   └───────────────────────┘ │
│                     SQLite Storage                     │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: v18+ (tested on Node 20+)
- **Python**: 3.10+ (with `uv` or standard virtual environment)

### 1. Clone the repository
```bash
git clone https://github.com/Vicrorege/axioma-board.git
cd axioma-board
```

### 2. Configure Environment

#### Backend
```bash
cp backend/.env.example backend/.env
```
*(Optional: add `OMNI_API_KEY` for AI-assisted steps and reasoning; standard SymPy CAS works out of the box without any key).*

#### Frontend
```bash
cp frontend/.env.example frontend/.env
```
*(Optional: set `VITE_DEV_TOKEN` if you wish to gate access with a preview token; leave empty for open access).*

### 3. Launch Services

#### One-click launch (Linux / macOS):
```bash
chmod +x start.sh stop.sh
./start.sh
```

#### Or manual launch:
**Backend:**
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8200 --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

- **Frontend App**: [http://localhost:5173](http://localhost:5173)
- **Interactive API Docs (Swagger UI)**: [http://localhost:8200/docs](http://localhost:8200/docs)
- **OpenAPI JSON**: [http://localhost:8200/openapi.json](http://localhost:8200/openapi.json)

---

## 🤖 AI Agent Integration

AxiomaBoard provides dedicated endpoints for autonomous AI models:

```python
import requests

API_URL = "http://localhost:8200"

# 1. Fetch current board context for LLM prompt
board_id = "your-board-id"
context = requests.get(f"{API_URL}/api/ai/board-context/{board_id}").json()
print("Board Markdown:\n", context["context_markdown"])

# 2. Add an expression to the board
requests.post(f"{API_URL}/api/ai/add-formula", json={
    "board_id": board_id,
    "latex": r"\frac{x^3 - x^2 + 6x - 6}{x^2 - 16} < 0",
    "title": "Rational Inequality",
    "comment": "Added by AI agent"
})

# 3. Automatically lay out step-by-step solution cards
requests.post(f"{API_URL}/api/ai/solve-steps", json={
    "board_id": board_id,
    "latex": r"\frac{x^3 - x^2 + 6x - 6}{x^2 - 16} < 0",
    "variable": "x"
})
```

See [API.md](API.md) for full endpoint specifications.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
