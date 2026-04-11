# LiveMakers Site — Deploy Handoff (Week 4 Tasks 17-20)

This document describes the manual steps required to ship `livemakers.com` Issue #1 to production. Code implementation is complete (Tasks 1-12); this file covers Task 13's human-in-the-loop steps.

## Code Status — Ready to Deploy

- **livemakers-site repo**: all 12 implementation tasks complete. 16/16 vitest tests pass.
- **sition-intelligence-terminal repo**: `publish-to-site` CLI subcommand added (Task 12). 32/32 pytest tests pass.
- **No real briefs in `content/brief/` yet** — only the `test-brief` fixture, which is filtered out of `getAllBriefs()` at runtime. Production will show "No briefs published yet." until Issue #1 is published.

## Prerequisites (田平氏 must complete before launch)

### 1. Resend Audience setup
- Log in to Resend dashboard (https://resend.com/audiences)
- Create a new Audience (e.g. "LiveMakers Weekly Brief")
- Copy the Audience ID (starts with `a_` or similar)
- Copy or generate an API key
- **Save both values** — they go into Vercel environment variables below
- **Configure double opt-in template** in Resend dashboard → Email templates → set "Subscription confirmation" email

### 2. WeasyPrint environment (for PDF generation)
Running `publish-to-site` requires WeasyPrint. On macOS system Python this fails due to SIP. Use one of:

**Option A — homebrew python + env var (recommended)**
```bash
brew install python@3.11 pango cairo
/opt/homebrew/bin/python3.11 -m pip install --user weasyprint markdown jinja2 httpx pytest
export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib
```

**Option B — pyenv**
```bash
pyenv install 3.11
pyenv local 3.11
pip install weasyprint markdown jinja2 httpx
export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib
```

Verify:
```bash
cd DEV/sition-intelligence-terminal
python3 -c "import weasyprint; print(weasyprint.__version__)"
```

### 3. Write Issue #1 draft
Create the draft JSON with real content:

```bash
cd DEV/sition-intelligence-terminal
cp drafts/weekly_template.json drafts/weekly_2026-W15.json
```

Edit `drafts/weekly_2026-W15.json` and fill in:

**Required top-level fields**:
```json
{
  "slug": "2026-W15-brief",
  "issue_number": 1,
  "week_label": "W15 / Apr 10 2026",
  "publish_date": "2026-04-10",
  "published_at": "2026-04-10T12:00:00+09:00",
  "epoch": 624,
  "sipo_rank": 13,
  "tags": ["governance", "defi", "midnight"],
  "title_en": "Cardano Treasury Crosses 1.6B ADA Inflection — Q2 Allocation Outlook",
  "title_ja": "Cardano Treasury が 16億 ADA を突破 — Q2 割当見通し",
  "executive_summary": "(日本語 200字程度の要旨)",
  "executive_summary_en": "(English ~200-char summary)"
}
```

**Required sections** (these drive the Weekly Brief Markdown template):
- `market`: ADA price/change/mcap
- `peer_comparison`: list of L1 peers
- `ecosystem`: total_tvl + sectors + top_movers
- `governance`: active_count + treasury_ada + active_proposals + sipo_votes
- `midnight`: block_height/epoch/peers/enterprise_pilots/dust_status/ambassador_notes
- `risk`: 4 dimensions each with level + note + note_en, plus overall
- `next_week_preview` + `next_week_preview_en`

**Optional — Hero snapshot data** (for the livemakers.com frontpage):
```json
"ticker_snapshot": {
  "ada_price_usd": 0.2454,
  "ada_change_24h": -2.1,
  "ada_mcap_usd": 9050000000,
  "cardano_tvl_usd": 133900000,
  "tvl_change_24h": 1.4,
  "stake_active_percent": 58.99,
  "naka_rank": 167
},
"four_panel_summary": {
  "governance": "4 active proposals; SIPO voted on all.",
  "defi": "Cardano TVL at $133.9M, Dexes dominant.",
  "midnight": "Block height 318575, 3 enterprise pilots.",
  "risk": "Overall MEDIUM — regulatory uncertainty."
}
```

If you omit `ticker_snapshot` / `four_panel_summary`, the SitePublisher uses zero/empty fallbacks — the Hero still renders but with dashes.

### 4. Run `publish-to-site`
```bash
cd DEV/sition-intelligence-terminal
export DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib
python3 cli.py publish-to-site --input drafts/weekly_2026-W15.json
```

Expected output:
```
✅ Published to ../livemakers-site/content/brief/2026-W15-brief
```

Files created in `DEV/livemakers-site/`:
- `content/brief/2026-W15-brief/meta.json`
- `content/brief/2026-W15-brief/ja.md`
- `content/brief/2026-W15-brief/en.md`
- `public/brief/2026-W15-brief/brief.pdf`

### 5. Preview locally
```bash
cd DEV/livemakers-site
npm run dev
```

Open `http://localhost:3000/` and verify:
- Hero renders the new Issue #1 title and summary
- Network Pulse shows values from `ticker_snapshot`
- 4-Panel shows `four_panel_summary` lines
- `/brief` lists Issue #1
- `/brief/2026-W15-brief` renders the full MDX body; language toggle works; PDF downloads
- `/ja` shows Japanese everywhere
- `/subscribe` form renders (do not submit until Vercel env vars are set)

Stop the dev server.

### 6. Commit Issue #1 content
```bash
cd DEV/livemakers-site
git add content/brief/2026-W15-brief/ public/brief/2026-W15-brief/
git commit -m "content: publish Issue #1 (2026-W15)"
```

### 7. Create GitHub repo (human)
- Go to GitHub, create new repo `sition-group/livemakers-site` (private or public — your call)
- Back in terminal:
```bash
cd DEV/livemakers-site
git remote add origin git@github.com:sition-group/livemakers-site.git
git push -u origin main
```

### 8. Vercel project
- Import `sition-group/livemakers-site` in Vercel dashboard
- Set environment variables:
  - `RESEND_API_KEY` = (from step 1)
  - `RESEND_AUDIENCE_ID` = (from step 1)
  - Optional: `COINGECKO_API_KEY`, `GITHUB_TOKEN`
- First deploy succeeds → verify at the Vercel preview URL (`https://livemakers-site-xxxxx.vercel.app`)
- In Vercel project settings → Domains, add `livemakers.com` and `www.livemakers.com`
- Follow Vercel's DNS instructions to update records at your registrar
- Wait for DNS propagation (<5 min) — verify `https://livemakers.com/` returns Issue #1

### 9. Smoke test subscribe form on production
- Visit `https://livemakers.com/subscribe`
- Enter your own real email
- Submit → expect "Check your email to confirm"
- Confirm via Resend's opt-in email
- Verify the contact appears in Resend Audiences dashboard

### 10. Launch announcement
Post from **@SITIONjp** (per Week 3 brainstorm decision — no new @LiveMakersJP account).

Draft post (JP):
```
LiveMakers — Intelligence Terminal 始動。

Cardano & Midnight 機関投資家向けリサーチ週次ブリーフ第1号を公開しました。

Issue #1 / W15 — (タイトル)

https://livemakers.com/brief/2026-W15-brief

毎週金曜 12:00 JST 配信。購読無料。
```

Draft post (EN — optional second tweet):
```
Launching LiveMakers — an Intelligence Terminal for Cardano & Midnight.

Institutional-grade weekly brief, issue #1 is live:

https://livemakers.com/brief/2026-W15-brief

Free to subscribe. Every Friday 12:00 JST.
```

**No hashtags** (per feedback_no_hashtags_x.md memory rule).

### 11. Record launch in published_log.jsonl
```bash
cd /Users/sition/Documents/SITION
echo '{"type":"weekly_brief","issue":1,"url":"https://livemakers.com/brief/2026-W15-brief","published_at":"2026-04-10T12:00:00+09:00"}' >> 07_DATA/content/intelligence/published_log.jsonl
```

### 12. Mark v0.1 complete
Update `DEV/sition-intelligence-terminal/STATUS.md`:
- Change `Progress: 16 / 20` to `Progress: 20 / 20 (100%)`
- Mark Tasks 17-20 as complete
- Add a Week 4 completion section

```bash
cd DEV/sition-intelligence-terminal
git add STATUS.md
git commit -m "docs: mark Week 4 complete, v0.1 shipped"
```

---

## Troubleshooting

### `/api/ticker` returns 503 in production
- CoinGecko free tier has tight rate limits. The Route Handler caches for 5 minutes and falls back to stale data on error. If all three upstream APIs fail on a cold cache, the endpoint returns 503 and the TickerBar shows "TICKER · OFFLINE" — this is the expected degraded state.
- If this persists: set `COINGECKO_API_KEY` env var in Vercel for the paid tier.

### `/api/subscribe` returns 503 "not_configured"
- `RESEND_API_KEY` or `RESEND_AUDIENCE_ID` env var is missing in Vercel.

### Build fails on `Cannot find module 'resend'`
- `npm install` was never run. In Vercel, this shouldn't happen because Vercel runs install automatically. Locally, run `npm install` in `DEV/livemakers-site/`.

### PDF rendering fails with `libgobject` dlopen error
- You're running on macOS system Python. Use homebrew/pyenv Python + `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib` (see prerequisite 2 above).

### Japanese redirect loops
- If `middleware.ts` keeps redirecting between `/` and `/ja`, the cookie isn't being set. Check browser devtools → Application → Cookies — `NEXT_LOCALE` should appear after the first redirect. Clear cookies and retry.

---

## Rollback

If a launched Brief needs to be retracted:
```bash
cd DEV/livemakers-site
git rm -r content/brief/2026-W15-brief/ public/brief/2026-W15-brief/
git commit -m "content: retract Issue #1"
git push
```
Vercel auto-redeploys. The OVERVIEW page falls back to "No briefs published yet." if no other briefs exist.
