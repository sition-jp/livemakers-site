"""Atomic JSON write: tmp + fsync + os.replace.

The contract this enforces:
- The target file is either the previous good snapshot, or fully the new one.
  Readers (Phase 1 pivots-reader.ts) never observe a half-written file.
- On any failure during serialization or write, the tmp file is removed and
  the existing target is left untouched.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


def atomic_write_json(target: Path, payload: Any) -> None:
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(target.suffix + ".tmp")
    try:
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2, sort_keys=False)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp, target)  # POSIX atomic; cross-platform safe.
    except BaseException:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError:
                pass
        raise
