import json
import os
from pathlib import Path

import pytest

from producer.atomic_write import atomic_write_json


def test_atomic_write_creates_target_with_payload(tmp_path: Path) -> None:
    target = tmp_path / "snap.json"
    atomic_write_json(target, {"hello": "world"})
    assert target.exists()
    assert json.loads(target.read_text()) == {"hello": "world"}
    assert not (tmp_path / "snap.json.tmp").exists()


def test_atomic_write_replaces_existing_atomically(tmp_path: Path) -> None:
    target = tmp_path / "snap.json"
    target.write_text(json.dumps({"old": True}))
    atomic_write_json(target, {"new": True})
    assert json.loads(target.read_text()) == {"new": True}


def test_atomic_write_leaves_existing_intact_when_serialization_fails(
    tmp_path: Path,
) -> None:
    target = tmp_path / "snap.json"
    target.write_text(json.dumps({"old": True}))

    class _Unserializable:
        pass

    with pytest.raises(TypeError):
        atomic_write_json(target, {"bad": _Unserializable()})

    assert json.loads(target.read_text()) == {"old": True}
    # Tmp must be cleaned up so the next run starts fresh.
    assert not (tmp_path / "snap.json.tmp").exists()
