# Maintainability Plan

This document captures the architectural improvements proposed on 2026-04-05 so we can track them over time.

## Goals

- Reduce coupling in server token generation code.
- Make core logic easier to test in isolation.
- Reduce drift between server, script, and plugin adapters.
- Clarify configuration, versioning, and public contracts.

## Plan

1. Split `SessionManager` into composable services. **Status: In progress.**
   Extract logging, caching, and HTTP fetch concerns into dedicated modules.
   Continue separating challenge retrieval, token minting, and session orchestration.
2. Create explicit request/response DTOs + schema validation for `/get_pot`.
3. Establish a single source of truth for versions shared by server + plugin.
4. Move HTTP wiring out of `main.ts` into `cli.ts`, `server.ts`, and route modules.
5. Centralize configuration and defaults into a `config.ts` module.
6. Define a core `pot_service` API used by both server and script adapters.
7. Introduce dependency injection for fetch/proxy/logging in core logic.
8. Reduce reliance on global DOM setup and make it a dedicated module.
9. Formalize cache storage behind an interface for alternative backends.
10. Add unit/contract tests for core minting + cache behavior.

## Implemented So Far

- Initial extraction for step 1:
  `server/src/logger.ts` contains the logger implementation.
  `server/src/session_manager.ts` now uses `CacheStore` and `NetworkClient` helpers.
  `server/src/challenge_service.ts` and `server/src/token_minter_service.ts` now own challenge retrieval and token minting.
  `server/src/proxy_spec.ts`, `server/src/cache_spec.ts`, `server/src/network_client.ts`, and `server/src/cache_store.ts` own their respective responsibilities.

- Step 4 (HTTP wiring split):
  `server/src/cli.ts` owns CLI parsing.
  `server/src/server.ts` owns server creation + startup.
  Routes live in `server/src/routes/*`.

## Next Steps (Suggested)

1. Continue step 1 by moving challenge retrieval + token minting into separate services.
2. Add DTO + schema validation for `/get_pot`.
3. Add a shared `version.json` and wire both server + plugin to it.
