"""Build an offline OI recovery candidate; never install it or publish data."""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
import re
import subprocess
from copy import deepcopy
from datetime import UTC, datetime, timedelta
from pathlib import Path

from producer.derivatives_sidecar import PROVIDER, SCHEMA_VERSION, _daily_point

SIDECAR = "data/pivot_derivatives_history.live.json"
PUBLIC_PAIR = ("data/pivot_assets.live.json", "data/pivot_backtest.live.json")
DATA_PATHS = frozenset((*PUBLIC_PAIR, SIDECAR))
ASSETS = ("BTC", "ETH")
OI_KEYS = {"sample_count", "first", "last", "min", "max", "avg",
           "last_usd", "avg_usd", "growth_pct"}
FUNDING_KEYS = {"sample_count", "sum", "avg", "abs_avg", "max_abs", "last"}


class RecoveryError(ValueError):
    """The candidate cannot be safely constructed from the supplied history."""


def _require(condition: bool, reason: str) -> None:
    if not condition:
        raise RecoveryError(reason)


def _timestamp(value: str) -> datetime:
    _require(isinstance(value, str) and value.endswith("Z"), "UTC timestamp required")
    try:
        result = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise RecoveryError("invalid timestamp") from exc
    _require(result.utcoffset() == timedelta(0), "UTC timestamp required")
    return result


def _object(pairs):
    result = {}
    for key, value in pairs:
        _require(key not in result, f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _load(raw: bytes) -> dict:
    try:
        value = json.loads(raw, object_pairs_hook=_object)
    except (ValueError, UnicodeError) as exc:
        raise RecoveryError("invalid JSON object") from exc
    _require(isinstance(value, dict), "JSON object required")
    return value


def _close(actual: float, expected: float) -> bool:
    return math.isclose(actual, expected, rel_tol=1e-8, abs_tol=1e-9)


def _aggregate(value: dict, keys: set[str], maximum: int) -> int:
    _require(isinstance(value, dict) and set(value) == keys, "invalid aggregate shape")
    n = value["sample_count"]
    _require(type(n) is int and 0 <= n <= maximum, "invalid sample count")
    for key in keys - {"sample_count"}:
        number = value[key]
        _require(type(number) in (int, float) and math.isfinite(number), "non-finite aggregate")
        if n == 0:
            _require(number == 0, "empty aggregate must contain zeros")
    return n


def validate_snapshot(snapshot: dict) -> None:
    """Strict recovery-only checks, beyond the runtime loader's shape checks."""
    try:
        _require(set(snapshot) == {"schema_version", "generated_at", "provider", "assets"},
                 "invalid snapshot shape")
        _require(snapshot["schema_version"] == SCHEMA_VERSION, "wrong schema")
        _require(snapshot["provider"] == PROVIDER, "wrong provider")
        generated = _timestamp(snapshot["generated_at"])
        latest_end = generated.replace(hour=0, minute=0, second=0, microsecond=0)
        _require(set(snapshot["assets"]) == set(ASSETS), "wrong assets")
        for asset in ASSETS:
            block = snapshot["assets"][asset]
            _require(set(block) == {"symbol", "history"}, "invalid asset shape")
            _require(block["symbol"] == asset + "USDT", "wrong symbol")
            _require(isinstance(block["history"], list), "history must be a list")
            previous = None
            for row in block["history"]:
                _require(set(row) == {"bucket_start", "bucket_end", "open_interest",
                                     "funding", "completeness", "source"}, "invalid row shape")
                start, end = _timestamp(row["bucket_start"]), _timestamp(row["bucket_end"])
                _require(start == start.replace(hour=0, minute=0, second=0, microsecond=0),
                         "bucket must start at UTC midnight")
                _require(end == start + timedelta(days=1) and end <= latest_end,
                         "unclosed or invalid bucket")
                _require(previous is None or start > previous, "duplicate or unsorted bucket")
                previous = start
                _require(row["source"] == {"oi_period": "4h", "funding_granularity": "8h",
                                           "is_closed_bucket": True}, "invalid source metadata")
                oi, funding = row["open_interest"], row["funding"]
                oi_n = _aggregate(oi, OI_KEYS, 6)
                funding_n = _aggregate(funding, FUNDING_KEYS, 3)
                if oi_n:
                    _require(oi["min"] > 0 and oi["last_usd"] > 0 and oi["avg_usd"] > 0,
                             "non-positive OI")
                    _require(all(oi["min"] <= oi[k] <= oi["max"]
                                 for k in ("first", "last", "avg")), "inconsistent OI bounds")
                    # First/last and extrema must fit in n actual observations.
                    known = [oi["first"]] if oi_n == 1 else [oi["first"], oi["last"]]
                    if oi_n == 1:
                        _require(oi["first"] == oi["last"], "infeasible OI endpoints")
                    for bound in (oi["min"], oi["max"]):
                        if bound not in known:
                            known.append(bound)
                    remaining = oi_n - len(known)
                    _require(remaining >= 0, "infeasible OI sample count")
                    low = (sum(known) + remaining * oi["min"]) / oi_n
                    high = (sum(known) + remaining * oi["max"]) / oi_n
                    _require((oi["avg"] >= low or _close(oi["avg"], low))
                             and (oi["avg"] <= high or _close(oi["avg"], high)),
                             "infeasible OI average")
                    _require(_close(oi["growth_pct"], (oi["last"] - oi["first"]) / oi["first"]),
                             "inconsistent OI growth")
                if funding_n:
                    _require(_close(funding["avg"], funding["sum"] / funding_n),
                             "inconsistent funding average")
                    _require(funding["max_abs"] + 1e-9 >= funding["abs_avg"] >= 0
                             and funding["max_abs"] + 1e-9 >= abs(funding["last"])
                             and funding["abs_avg"] + 1e-9 >= abs(funding["avg"]),
                             "inconsistent funding bounds")
                expected = {"open_interest": oi_n / 6, "funding": funding_n / 3,
                            "overall": (oi_n / 6 + funding_n / 3) / 2}
                _require(set(row["completeness"]) == set(expected), "invalid completeness shape")
                for key, value in expected.items():
                    actual = row["completeness"][key]
                    _require(type(actual) in (int, float) and math.isfinite(actual)
                             and _close(actual, value), "inconsistent completeness")
    except (KeyError, TypeError, AttributeError, ZeroDivisionError) as exc:
        raise RecoveryError("malformed snapshot") from exc


def _git(repo: Path, *args: str) -> bytes:
    # Pinned reads must not inherit repository redirects, config injections or traces.
    env = {key: value for key, value in os.environ.items() if not key.startswith("GIT_")}
    env.update({"GIT_CONFIG_NOSYSTEM": "1", "GIT_CONFIG_GLOBAL": os.devnull})
    result = subprocess.run(
        ["git", "--no-pager", "--no-replace-objects", "-c", "log.showSignature=false",
         "-C", str(repo), *args], capture_output=True, timeout=60, env=env,
    )
    if result.returncode:
        raise RecoveryError("git history read failed")
    return result.stdout


def _repo_root(repo: Path) -> Path:
    return Path(_git(repo, "rev-parse", "--show-toplevel").decode().strip()).resolve()


def _json_bytes(value: dict) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=True, allow_nan=False) + "\n").encode()


def build_recovery_candidate(repo: Path, source_ref: str) -> tuple[dict, dict]:
    """Fill zero-sample OI only, from attributable complete recent observations."""
    _require(re.fullmatch(r"[0-9a-f]{40}", source_ref) is not None, "full commit SHA required")
    repo = _repo_root(Path(repo))
    _require(_git(repo, "rev-parse", f"{source_ref}^{{commit}}").decode().strip() == source_ref,
             "source must be a commit")
    baseline_bytes = _git(repo, "show", f"{source_ref}:{SIDECAR}")
    baseline = _load(baseline_bytes)
    validate_snapshot(baseline)
    candidate = deepcopy(baseline)
    commits = _git(repo, "log", "--first-parent", "--format=%H", source_ref,
                   "--", SIDECAR).decode().splitlines()
    audit = {
        "source_ref": source_ref,
        "baseline_sha256": hashlib.sha256(baseline_bytes).hexdigest(),
        "generated_at": baseline["generated_at"],
        "accepted_commits": [], "rejected_commits": [], "restored": [],
        "out_of_window_observations": 0,
        "policy": "complete_oi_only_into_zero_sample_existing_rows; no_live_write",
    }
    observations = {}
    for sha in commits:
        try:
            fields = _git(
                repo, "show", "-s", "--format=%P%x00%cI%x00%s", sha,
            ).decode().removesuffix("\n").split("\0")
            _require(len(fields) == 3, "invalid commit metadata")
            parents, date, subject = fields
            _require(len(parents.split()) == 1, "not a single-parent snapshot commit")
            prefix = "chore(pivots): daily snapshot "
            _require(subject.startswith(prefix), "not a daily snapshot commit")
            changed = set(_git(repo, "diff-tree", "--no-commit-id", "--name-only", "-r", sha)
                          .decode().splitlines())
            _require(SIDECAR in changed and changed <= DATA_PATHS, "not data-only")
            snapshot = _load(_git(repo, "show", f"{sha}:{SIDECAR}"))
            validate_snapshot(snapshot)
            generated = _timestamp(snapshot["generated_at"])
            _require(generated <= _timestamp(baseline["generated_at"]), "source newer than baseline")
            for path in PUBLIC_PAIR:
                pair = _load(_git(repo, "show", f"{sha}:{path}"))
                _require(pair.get("generated_at") == snapshot["generated_at"], "public pair mismatch")
            _require(abs((generated - _timestamp(subject[len(prefix):])).total_seconds()) <= 600,
                     "snapshot subject time mismatch")
            committed = datetime.fromisoformat(date).astimezone(UTC)
            _require(abs((generated - committed).total_seconds()) <= 600, "commit time mismatch")
        except RecoveryError as exc:
            audit["rejected_commits"].append({"commit": sha, "reason": str(exc)})
            continue
        audit["accepted_commits"].append(sha)
        for asset in ASSETS:
            for row in snapshot["assets"][asset]["history"]:
                if row["open_interest"]["sample_count"] != 6:
                    continue
                if generated - _timestamp(row["bucket_start"]) > timedelta(days=30):
                    audit["out_of_window_observations"] += 1
                    continue
                key = (asset, row["bucket_start"])
                observations.setdefault(key, []).append((sha, row["open_interest"]))

    _require(bool(audit["accepted_commits"]), "no eligible daily snapshot commits")
    for asset in ASSETS:
        for row in candidate["assets"][asset]["history"]:
            if row["open_interest"]["sample_count"] != 0:
                continue
            sources = observations.get((asset, row["bucket_start"]), [])
            if not sources:
                continue
            oi = sources[0][1]
            _require(all(value == oi for _, value in sources),
                     f"conflicting complete OI observations: {asset} {row['bucket_start']}")
            row["open_interest"] = deepcopy(oi)
            row["completeness"] = _daily_point(
                row["bucket_start"], row["open_interest"], row["funding"],
            )["completeness"]
            audit["restored"].append({
                "asset": asset, "bucket_start": row["bucket_start"],
                "source_commits": [sha for sha, _ in sources],
                "oi_sha256": hashlib.sha256(_json_bytes(oi)).hexdigest(),
            })
    validate_snapshot(candidate)
    audit["candidate_sha256"] = hashlib.sha256(_json_bytes(candidate)).hexdigest()
    audit["coverage"] = {
        asset: {
            "before_oi_days": sum(row["open_interest"]["sample_count"] > 0
                                  for row in baseline["assets"][asset]["history"]),
            "after_oi_days": sum(row["open_interest"]["sample_count"] > 0
                                 for row in candidate["assets"][asset]["history"]),
            "rows": len(candidate["assets"][asset]["history"]),
        }
        for asset in ASSETS
    }
    return candidate, audit


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", type=Path, required=True)
    parser.add_argument("--source-ref", required=True, help="Full immutable commit SHA")
    parser.add_argument("--output-dir", type=Path, required=True, help="New directory outside source repo")
    args = parser.parse_args(argv)
    try:
        output = args.output_dir.resolve()
        repo = _repo_root(args.repo)
        _require(not output.is_relative_to(repo), "output must be outside source repo")
        _require(not output.exists(), "output directory already exists")
        _require(output.parent.is_dir(), "output parent must already exist")
        candidate, audit = build_recovery_candidate(repo, args.source_ref)
        output.mkdir(mode=0o700)
        (output / "pivot_derivatives_history.candidate.json").write_bytes(_json_bytes(candidate))
        (output / "recovery-audit.json").write_bytes(_json_bytes(audit))
        print(json.dumps({"output_dir": str(output), "coverage": audit["coverage"]}))
        return 0
    except (RecoveryError, OSError, subprocess.SubprocessError) as exc:
        print(f"recovery failed: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
