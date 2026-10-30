# ZT Search

ZT Search provides a French-language interface for searching the configured content catalogue and viewing available source links.

## Run & Operate

- Use the `artifacts/zt-preview: web` workflow for the React/Vite interface.
- Use the `artifacts/zt-preview: search-api` workflow for the FastAPI search backend.
- The `artifacts/api-server: API Server` workflow is a separate workspace service and is not used by the ZT Search interface.
- Run `pnpm install --frozen-lockfile` to install the workspace dependencies.
- Run `pnpm run typecheck` to check the TypeScript workspace.
- Python dependencies and the supported Python version are defined in `pyproject.toml` and `uv.lock`.

## Required Secrets

- `ZT_ORIGIN_USERNAME` and `ZT_ORIGIN_PASSWORD` configure the direct source-site account.
- `ADMIN_KEY` protects source settings and the full, private diagnostics endpoint.
- `TMDB_API_KEY` enables TMDB-backed metadata.
- Keep credentials in Replit Secrets. Do not paste credentials into source files or send authenticated session cookies through relays.

## Project Map

- `artifacts/zt-preview/src/` — React/Vite interface, search views, source settings, and network diagnostics.
- `artifacts/zt-preview/backend/` — FastAPI search service, source fetching, relay management, and local state.
- `lib/api-spec/openapi.yaml` — API contract source; regenerate clients with `pnpm --filter @workspace/api-spec run codegen`.
- `artifacts/zt-preview/.replit-artifact/artifact.toml` — web and search API service routing.

## Operations

- The **Réseau** panel next to **Sources** is available without a key and shows redacted server, tunnel, relay-count, and request-status diagnostics.
- The full diagnostics endpoint remains administrator-only; it checks the outbound IP through api.ipify.org when requested.
- Relay credentials, URL paths, query parameters, and the last proxy URL must not be exposed in public status responses or the diagnostics UI.
- Search configuration and proxy-pool state are stored by the backend in its local SQLite state file.
