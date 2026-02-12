# Copilot Instructions for hotprevue

## Project Overview
- **hotprevue** is a FastAPI application designed for organizing and remotely accessing large collections of images.
- The project is intended for efficient image management and remote access, likely serving as a backend for a web or desktop client.

## Architecture & Key Components
- The main application is built with **FastAPI** (Python web framework).
- Expect core logic in Python files (not present in this minimal repo snapshot).
- The project structure is currently minimal; look for future additions like `app/`, `main.py`, or similar for the FastAPI entrypoint.

## Developer Workflows
- **Run the server:**
  - Typical FastAPI: `uvicorn main:app --reload` (adjust module path as needed)
- **Testing:**
  - No test framework or scripts are present yet. Add tests in a `tests/` directory and use `pytest` by convention.
- **Dependencies:**
  - No `requirements.txt` or `pyproject.toml` yet. Add one to manage dependencies (e.g., `fastapi`, `uvicorn`).

## Conventions & Patterns
- Follow standard FastAPI project structure:
  - Place API routes in `routers/` or `routes/`.
  - Use `models/` for Pydantic schemas and database models.
  - Configuration in `config.py` or `.env` files.
- Use environment variables for secrets and configuration.
- Organize static/image files in a dedicated directory (e.g., `static/` or `images/`).

## Integration Points
- FastAPI integrates with ASGI servers (e.g., Uvicorn, Hypercorn).
- For image storage, expect integration with local filesystems or cloud storage (not yet implemented).

## Examples
- To start the app (once implemented):
  ```sh
  uvicorn main:app --reload
  ```
- To add a new API route, create a Python file in `routers/` and include it in the main app.

## Key Files/Directories
- `README.md`: Project summary and high-level purpose.
- `.gitignore`: Standard Python ignores.
- `.github/copilot-instructions.md`: (this file) AI agent guidance.

---
If the project structure changes or new conventions emerge, update this file to keep AI agents productive.
