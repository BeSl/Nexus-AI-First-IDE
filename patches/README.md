# Nexus Agent IDE — Patches

Patches are applied to `vscode-src/` in lexicographic order.

## Naming Convention

```
NNNN-scope-description.patch
```

| Range | Scope | Description |
|-------|-------|-------------|
| 0001–0099 | `branding` | Replace MS branding, telemetry removal |
| 0100–0199 | `nexus-core` | Agent orchestration hooks into vscode core |
| 0200–0299 | `nexus-ui` | Webview panels, ArchitectureGraph |
| 0300–0399 | `agent-ts` | AgentTS DSL integration |

## Creating a Patch

```bash
# Make changes in vscode-src/
cd vscode-src
git diff > ../patches/NNNN-scope-description.patch
```

## Status

| Patch | Status |
|-------|--------|
| (none yet — first step: clone vscode-src with `npm run vscode:clone`) | — |
