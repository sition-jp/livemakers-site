status: DONE

files changed:
- /Users/sition/Documents/SITION/DEV/livemakers-site/lib/livemakers-terminal-preview/reader-terminal-source.ts
- /Users/sition/Documents/SITION/DEV/livemakers-site/tests/lib/livemakers-terminal-preview-reader-terminal-source.test.ts

commit SHA(s):
- 5f32442

commands run:
- sed -n '1,220p' /Users/sition/Documents/SITION/DEV/livemakers-site/.superpowers/sdd/task-1-brief.md
- sed -n '1,220p' /Users/sition/.codex/plugins/cache/claude-plugins-official/superpowers/6.1.0/skills/test-driven-development/SKILL.md
- sed -n '1,220p' /Users/sition/.codex/plugins/cache/claude-plugins-official/superpowers/6.1.0/skills/using-superpowers/SKILL.md
- rg search over /Users/sition/.codex/memories/MEMORY.md for livemakers-site task context
- rg searches across /Users/sition/Documents/SITION/DEV/livemakers-site/lib and /Users/sition/Documents/SITION/DEV/livemakers-site/tests for terminal-preview references
- sed -n '1,220p' /Users/sition/Documents/SITION/DEV/livemakers-site/tests/lib/livemakers-terminal-preview-adapter-fixture.test.ts
- sed -n '1,220p' /Users/sition/Documents/SITION/DEV/livemakers-site/tests/lib/livemakers-terminal-preview-public-topology.test.ts
- sed -n '700,760p' /Users/sition/Documents/SITION/DEV/livemakers-site/lib/livemakers-terminal-preview/adapter-fixture-data.ts
- sed -n '1,260p' /Users/sition/Documents/SITION/DEV/livemakers-site/lib/livemakers-terminal-preview/types.ts
- npx vitest run tests/lib/livemakers-terminal-preview-reader-terminal-source.test.ts --cache=false
- git -C /Users/sition/Documents/SITION/DEV/livemakers-site status --short
- git -C /Users/sition/Documents/SITION/DEV/livemakers-site diff --check -- tests/lib/livemakers-terminal-preview-reader-terminal-source.test.ts lib/livemakers-terminal-preview/reader-terminal-source.ts

RED failure evidence:
- Vitest failed with: "Error: Cannot find module '@/lib/livemakers-terminal-preview/reader-terminal-source' imported from '/Users/sition/Documents/SITION/DEV/livemakers-site/tests/lib/livemakers-terminal-preview-reader-terminal-source.test.ts'."

GREEN pass evidence:
- Vitest passed: 1 file, 2 tests, 0 failures.

self-review notes:
- The new module is fixture-only and only re-exports the reviewed adapter fixture snapshot shape.
- No runtime/publish/live surfaces were introduced.
- app/[locale]/page.tsx and homepage tests were not modified.
