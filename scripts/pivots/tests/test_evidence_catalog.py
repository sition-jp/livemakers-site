"""Keep lib/pivots/evidence-messages.json in sync with the producer's evidence text.

If a scorer adds/changes a message, this test fails until the JSON catalog (and the
ja/en i18n entries, checked on the TS side) are updated.
"""
import json
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
CATALOG = REPO_ROOT / "lib" / "pivots" / "evidence-messages.json"
SCORERS = [
    REPO_ROOT / "scripts" / "pivots" / "producer" / "score_price_pivot.py",
    REPO_ROOT / "scripts" / "pivots" / "producer" / "score_volatility_pivot.py",
    REPO_ROOT / "scripts" / "pivots" / "producer" / "score_derivatives_evidence.py",
]
_MESSAGE_RE = re.compile(r'"message":\s*f?"([^"]+)"')
_RSI_FSTRING_RE = re.compile(r"\(\{ctx\['rsi_14'\]:\.1f\}\)")


# Messages older runner deployments still emit (live data keeps them until the
# runner is redeployed); the catalogue must keep them alongside the current ones.
LEGACY_MESSAGES = {
    "Price is far from MA20 (top 20% of recent range)",
    "Price is far from MA50 (top 20% of recent range)",
}


def _producer_messages() -> set[str]:
    found: set[str] = set()
    for path in SCORERS:
        for match in _MESSAGE_RE.finditer(path.read_text(encoding="utf-8")):
            found.add(_RSI_FSTRING_RE.sub("({rsi})", match.group(1)))
    return found


def test_catalog_matches_producer_messages() -> None:
    catalog = set(json.loads(CATALOG.read_text(encoding="utf-8"))["messages"])
    produced = _producer_messages()
    assert produced, "no evidence messages found in scorers (regex drift?)"
    expected = produced | LEGACY_MESSAGES
    assert catalog == expected, (
        f"missing in catalog: {sorted(expected - catalog)}; stale in catalog: {sorted(catalog - expected)}"
    )
