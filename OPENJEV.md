# OpenJEV Support

This fork adds optional [OpenJEV](https://openjev.sh) support alongside the existing
TypeSafe/OpenRouter transport. OpenJEV is a free community gateway to the same Jev model.
TypeSafe stays the default; anyone with an OpenRouter/TypeSafe key sees zero behaviour change.

## What was added

| File | Change |
| --- | --- |
| `src/jev.ts` | `JevProvider` type, `provider` option on `JevOptions`, `createOpenjevAsk()` direct HTTP transport to `https://api.openjev.sh/v1/systemone` with model `openjev`. `createJev()` branches on `provider`. |
| `index.ts` | `provider` in `ResolvedOptions` and `readOptions()`. Provider/key resolution in `setup()`: explicit `provider` option or `JEV_PROVIDER` env wins; otherwise OpenRouter if `OPENROUTER_API_KEY` is set (default); otherwise OpenJEV if `OPENJEV_API_KEY` is set. |
| `adapters/claude-code/hooks/system-one.ts` | `newAsk()` resolves provider and key the same way, passes `provider` to `createJev()`. |
| `adapters/pi-senpi/index.ts` | `PiOptions.provider`, `readPiOptions()` reads it, `setup()` resolves provider/key and passes `provider` to `createJev()`. |
| `adapters/hermes/system_one/decision.py` | `ask_openjev()` function (urllib, same contract as `ask_openrouter`). `resolve_provider()` helper returning `(provider, api_key, model)`. |
| `adapters/hermes/system_one/__init__.py` | `_handle_turn()` and `_handle_verify()` use `resolve_provider()` and branch to `ask_openjev` or `ask_openrouter`. |
| `README.md` | OpenJEV note after the intro; `provider` option documented in Configuration. |
| `adapters/hermes/README.md` | Provider selection documented in Settings. |

No TypeSafe/OpenRouter code was renamed, removed, or re-defaulted.

## Provider selection rule

1. Explicit choice wins: `provider` option or `JEV_PROVIDER=openjev` / `JEV_PROVIDER=openrouter`.
2. Otherwise, if `OPENROUTER_API_KEY` is set → OpenRouter (default unchanged).
3. Otherwise, if only `OPENJEV_API_KEY` is set → OpenJEV.

## Configuration

Set `OPENJEV_API_KEY` (from https://openjev.sh/dashboard) and optionally `JEV_PROVIDER=openjev`:

```bash
export OPENJEV_API_KEY=oj-...
# Optional: force OpenJEV even if OPENROUTER_API_KEY is also set
export JEV_PROVIDER=openjev
```

Or in the OpenCode plugin options:

```jsonc
{
  "plugins": [
    { "package": "jev-for-all", "options": { "provider": "openjev" } }
  ]
}
```

For the Hermes adapter, set the env vars in the Hermes process environment.

## How it was verified

One live POST to `https://api.openjev.sh/v1/systemone` with model `openjev`, state `ping`,
one noul question — returned HTTP 200 with valid answers. No repo code was executed.

## Upstream

Original project: https://github.com/emirbartu/jev-for-all by @emirbartu
