# AxiomaBoard API Reference

AxiomaBoard provides a REST API with interactive Swagger documentation at `/docs`.

Base URL: `http://localhost:8200`

---

## 1. Mathematical Engine (`/api/math`)

### `POST /api/math/solve`
Solves equations and inequalities.
- **Request Body:**
  ```json
  {
    "latex": "\\frac{x^3 - x^2 + 6x - 6}{x^2 - 16} < 0",
    "variable": "x"
  }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "operation": "solve inequality for x",
    "result_latex": "x \\in \\left(-\\infty, -4\\right) \\cup \\left(1, 4\\right)",
    "steps": [
      "Множество решений на \\mathbb{R}: x \\in \\left(-\\infty, -4\\right) \\cup \\left(1, 4\\right)"
    ]
  }
  ```

### `POST /api/math/simplify`
Simplifies an algebraic or trigonometric expression.
- **Request Body:**
  ```json
  { "latex": "\\frac{x^2 - 1}{x - 1}" }
  ```
- **Response:**
  ```json
  {
    "success": true,
    "result_latex": "x + 1"
  }
  ```

### `POST /api/math/derivative`
Computes the symbolic derivative of an expression.
- **Request Body:**
  ```json
  { "latex": "x^3 \\cdot \\sin(x)", "wrt": "x", "order": 1 }
  ```

### `POST /api/math/integrate`
Computes indefinite or definite integral.
- **Request Body:**
  ```json
  {
    "latex": "2x + \\cos(x)",
    "wrt": "x",
    "definite": false
  }
  ```

### `POST /api/math/factor`
Factorizes a polynomial or rational expression.
- **Request Body:**
  ```json
  { "latex": "x^3 - x^2 + 6x - 6" }
  ```

### `POST /api/math/domain`
Finds domain restrictions and excluded points (ОДЗ).
- **Request Body:**
  ```json
  { "latex": "\\frac{1}{x^2 - 16}", "variable": "x" }
  ```

### `POST /api/math/suggested-actions`
Returns dynamically selected action buttons tailored to the given formula.
- **Request Body:**
  ```json
  { "latex": "x^2 - 5x + 6 = 0" }
  ```

### `POST /api/math/ast`
Converts LaTeX to a structured Abstract Syntax Tree (AST) for programmatic processing.

---

## 2. Whiteboard CRUD (`/api/boards`)

- `GET /api/boards`: List all boards belonging to the current user/guest.
- `POST /api/boards`: Create a new board.
- `GET /api/boards/{board_id}`: Retrieve full board state and snapshot.
- `PUT /api/boards/{board_id}`: Update title or canvas snapshot.
- `DELETE /api/boards/{board_id}`: Delete a board.
- `POST /api/boards/assets`: Upload an image file for the canvas.
- `GET /api/boards/assets/{filename}`: Retrieve an uploaded image asset.

---

## 3. AI Agent Integration (`/api/ai`)

- `GET /api/ai/board-context/{board_id}`: Clean Markdown & JSON context representing all board shapes and relations.
- `POST /api/ai/add-formula`: Programmatically place a formula card onto the canvas.
- `POST /api/ai/connect`: Connect two formula cards with a directed arrow.
- `POST /api/ai/solve-steps`: Automatically lay out a step-by-step resolution chain on the canvas.
- `POST /api/ai/batch-mutate`: Atomic multi-card updates and deletions.
