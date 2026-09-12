# OI history preservation and recovery

Status: implementation and offline recovery candidate; not installed in runner.

## Problem and scope

The sidecar merges a short OI response window with a longer funding response
window. Whole-row upsert replaced historical OI with empty or partial aggregates
when the OI response no longer covered the day. Snapshot generation still
succeeded, so an OK daily log did not prove historical OI preservation.

The fix selects the more complete aggregate independently for OI and funding.
Fresh values win equal sample counts. Completeness follows the selected values;
partial summaries are never summed, since their raw timestamps are unavailable.
Retention, schema, current scores, backtest, UI, and publication remain unchanged.

Recovery is narrower than future daily merging: it only fills an existing day's
zero-sample OI using a complete six-sample OI object. It never replaces positive
OI, changes funding, adds dates, rewrites source metadata, or advances
`generated_at`. Recovery provenance stays in a separate audit file.

## Offline candidate command

From `scripts/pivots` in the reviewed implementation worktree:

```bash
python -m ops.recover_oi_history \
  --repo /Users/sition/.sition_runners/lvm-pivots-runner \
  --source-ref 8fe388ec06188049402e19decfa994e69051ce15 \
  --output-dir '/Users/sition/Documents/SITION/SITION LiveMakers/output/turning-point/2026-09-12-oi-recovery-reviewed'
```

The output directory must be new, outside the source checkout, and have an
existing parent. The command reads only pinned Git objects and writes:

- `pivot_derivatives_history.candidate.json`
- `recovery-audit.json`: baseline/candidate SHA-256, accepted/rejected source
  commits, restored asset/day, full source commit list, OI digest, and coverage.

It has no live apply or publication option. Re-run with the same pinned source
into a different fresh directory to check deterministic output. Do not run the
daily producer merely to inspect or recover history.

## Eligibility and limits

1. Full source commit SHA only, no moving refs or `--all`. Traverse its
   first-parent lineage and single-parent daily snapshot commits. Git replacement
   objects are disabled for all reads; subdirectory inputs resolve to the actual
   checkout root for history traversal and output-path exclusion.
2. Sidecar must change, with changed paths confined to the three snapshot files.
   Assets, backtest and sidecar must agree exactly on `generated_at`.
3. Snapshot subject and commit times must be within 600 seconds of generation.
   Rejections are recorded, not silently treated as recovered data.
4. Strict shape/provider/symbol/source checks; sorted unique closed UTC days;
   finite values, valid counts/bounds/growth/averages/completeness. OI averages
   must be feasible for the reported sample count, first/last and extrema.
5. Recovery donors require six OI samples and a bucket within 30 days of source
   generation, avoiding stale inherited or known old fixture observations.
6. All eligible complete OI objects for a recovered day must match exactly.
   Any conflict stops candidate generation. No latest-wins or interpolation.

These checks establish consistency and local Git provenance, not independent
exchange attestation or proof of six unique raw timestamps. The original raw
responses are not retained. Known OI fixtures span April 4-May 4, outside the
May 20-August 11 recovery interval.

### PR #153 review hardening (#3, #4, #5)

- Recovered completeness uses the producer's daily-point calculation from raw
  sample counts. Funding payloads stay unchanged, including partial days; funding
  count 1 produces overall completeness `0.6666666667` after complete OI recovery.
- NUL-separated commit metadata preserves empty parent/subject fields. Root
  commits and empty subjects are rejected with an audit reason, without aborting
  the scan of other eligible sources.
- Git reads discard inherited `GIT_*` variables, ignore system/global config,
  disable pagers and override repository `log.showSignature`. This prevents
  environment redirects, trace files and signature-verifier invocation during
  offline reads. No installed environment or Git config is changed.
- Zero eligible snapshot commits is an error before any output directory is
  created. Zero restored days with eligible sources is still a valid no-op
  candidate; source eligibility and recovered coverage are different measures.

Runtime malformed-row handling, excessive sample counts, and the loader's
invalid-file reset behavior (review #1/#2/#9) remain a separate pre-maintenance
hardening gate. Do not coerce damaged retained counts to zero and overwrite the
history. Review preservation and explicit degradation before installing recovery
data in the runner. This PR does not change those runtime paths.

The earliest donor `97c875fa3ab5cd8996c56f3c01bc19c9fff906c8` introduced
the sidecar. Its three generation timestamps agree at `2026-06-18T23:00:16Z`
and its commit is 11 seconds later. May 20 has only this one source snapshot.
It passes the same eligibility rules and was independently reviewed; its
single-source provenance must remain visible during the maintenance review.

## Pinned rehearsal result

Baseline runner: `8fe388ec06188049402e19decfa994e69051ce15`.

| Measure | BTC | ETH |
|---|---:|---:|
| Existing date rows | 235 | 235 |
| OI-bearing days before | 29 | 29 |
| Restored zero-sample days | 84 | 84 |
| OI-bearing days in candidate | 113 | 113 |
| Remaining zero-sample days | 122 | 122 |

Candidate coverage is May 20-September 9. Of 76 first-parent data-only commits,
75 passed the 600-second provenance gate; `63127c088f15bf930c497ff17655d677561c0f98`
was excluded (931-second generation-to-commit lag), without reducing coverage.
There were no conflicting complete OI objects or out-of-window OI donors.

- Baseline SHA-256: `25641d85fdf7c4011c60c1c43fd62ab8ebaa2413b0c8fbcc973bf83af946526e`
- Candidate SHA-256: `0dca521672fb5da1d597fdd35db601cd0e479b4c2784d235933f7fe2aa80819f`
- Verified unchanged: funding, dates, source metadata, existing nonzero OI,
  generation time, and live baseline file.
- Replaying the current truncated history through the corrected merger retained
  the complete candidate exactly. This is an offline rehearsal, not a natural run.

## Maintenance and publication gates

Primary operational AI remains Claude. Code review, runner maintenance, and
public activation are distinct steps; this document authorizes none of them.

Before any runner write, obtain the repair/cutover approval for exact commits and
candidate digest. Check hostname/user/repo, drain producer/publisher processes,
suspend new scheduled starts, and acquire the existing `ops.run_daily` lock.
Direct producer/manual file operations do not implicitly take that lock. Keep
the same lock inode: never delete/recreate it as an unlock technique.

Back up the runner SHA, installed plist and all three snapshots outside the
seven-snapshot retention directory. Confirm the live sidecar still matches the
audit baseline digest; if a natural run changed it, regenerate and review the
candidate from the new pinned commit instead of applying this stale candidate.
Install only reviewed code commits, including test isolation from #112 before
running producer tests there. Never merge/rebase the parking branch into main.
Validate a temporary recovery file, atomically replace only the sidecar, and
read back its digest and preserved fields while holding the lock.

Release the lock before an approved non-publishing `ops.run_daily` verification.
Require JSONL OK, no sidecar degradation, public-pair validation, and preservation
of restored OI after fetching. Process exit 0 alone is insufficient. Re-enable
the generation-only schedule as appropriate; do not accidentally enable publish.

Before the later zero-touch activation, install the reviewed publisher code and
resolve two preflight issues separately: the installer default 120-second verify
timeout is shorter than publication/deployment polling budgets, and its bootout
failure branch prints raw `launchctl print` output (possible inherited secrets).
Use a reviewed redacted diagnostic and an explicitly chosen verification budget.
Check credentials privately, then follow the separately approved activation
procedure. The installer itself kickstarts the first run; do not start a second.

Rollback scopes differ: restoring the plist does not revert code, repaired
history, or an already merged public deployment. A post-merge publication error
requires reconciliation before a separately approved public revert.
