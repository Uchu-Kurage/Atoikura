# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Atoikura**（今月あといくら使える？ / "How much can I still spend this month?") is a gamified household-budgeting (家計簿) web app with a Japanese sci-fi survival theme. The month's budget is an **Energy Core** (HP bar); expenses are **threats** that deplete it; surviving the month efficiently earns **materials** (🔩) that upgrade your **base** and unlock lore **data chips** and **badges**.

It is a **single-file, framework-less static web app** — all HTML, CSS, and JavaScript live inline in `index.html`. There is no build step, no package manager, no test suite, and no backend. All state lives in the browser's `localStorage`.

## Build / run / deploy

- **Run locally:** open `index.html` directly in a browser, or serve the directory statically (e.g. `python3 -m http.server`). No install or build.
- **Deploy:** Vercel serves this repo as static files (note `vercel.svg`, and `.vercel` in `.gitignore`). There is no `vercel.json` or CI config — pushing to the deployed branch triggers a redeploy.
- **No lint / test / typecheck commands exist.** Verify changes by loading the app in a browser and exercising the affected screen. To reset state during testing, clear the `kakebo_quest_v1` localStorage key (see below).
- The `*.svg` files (`next.svg`, `file.svg`, `globe.svg`, `window.svg`) are leftover Next.js template assets and are unused by the app.

## Critical convention: keep the two HTML files in sync

`index.html` and `app.html` are **byte-for-byte identical** (both the full 2420-line app). Any change to one **must** be mirrored to the other, or the app will diverge depending on which entry point is served. When editing, apply the same edit to both files (or copy `index.html` → `app.html` after changes).

## Architecture

Everything is in the single `<script>` block at the bottom of `index.html` (starts ~line 789). The structure:

- **Screens (SPA):** Each view is a `<div class="scr" id="scr-<name>">`. Only one has the `on` class at a time. Navigation is `go(name)`, which hides all `.scr`, shows `#scr-<name>`, updates the bottom nav, and dispatches to the screen's render function (`renderHome`, `renderBase`, `renderHist`, `initExp`, `playMono`). Screens: `splash`, `mono` (opening monologue), `register`, `edit-budget`, `reference`, `share`, `mend` (month-end result), `cp` (weekly checkpoint), `home`, `expense`, `base`, `history`.
- **State:** One JSON object persisted under `localStorage` key `SK = 'kakebo_quest_v1'`. Read/write via `load()` / `save(state)`. Shape:
  ```
  { character:   { name, avatar, monthlyBudget, categories[], lifetimeSaved, fixedCosts[], carryover },
    currentMonth:{ year, month, baseHp, currentHp, expenses[], tempExpenses[], checkpoints[], status },
    inventory:   { materials, unlockedChips[] },
    baseLevel,
    history:     [ …past currentMonth snapshots… ] }
  ```
- **Game-loop gating happens inside `go('home')`:** before showing home it calls `checkMonthEnd(state)` (rolls the month over if the calendar month advanced, computing bonuses and pushing the old month to `history`) and `getPendingCp(state)` (detects an un-acknowledged past week). Either can redirect to the `mend` or `cp` result screen instead of home. This means month-rollover and checkpoint logic is **only** triggered by navigating home — not on a timer.

### Domain ↔ code vocabulary (needed to read the UI code)

| Game term | Code / meaning |
|---|---|
| Energy Core / HP | `baseHp` (month budget), `currentHp` (remaining) |
| Threat / damage | an expense in `expenses[]` reducing `currentHp` |
| Materials 🔩 | `inventory.materials`, earned at month end |
| Base level | `baseLevel`, upgraded by spending materials per `BASE_LEVELS` |
| Data chips | lore unlocked by base level, defined in `DATA_CHIPS` (`inventory.unlockedChips`) |
| Badges | achievements in `LIFETIME_BADGES`, each a `condition: state => bool` |
| Character state | `healthy`/`tired`/`critical`/`victory`/`defeated`, computed by `cst()` from HP % vs. weekly pace |

### Key constants and helpers

- **Constants** (top of script): `CATS` (9 spending categories with id/name/icon/color), `CSTATE`, `AVEM` (avatars), `MONO_LINES` (intro narration), `DATA_CHIPS`, `BASE_LEVELS`, `LIFETIME_BADGES`.
- **Month-end settlement (`checkMonthEnd`)** computes materials from: 10% of leftover HP, a +1000 clear bonus if not in the red, per-week budget-clearance bonuses (+200/week, ISO/Monday-start weeks), and per-category limit-clearance bonuses (+200/category). Optional `carryover` rolls unspent budget into next month's `baseHp`.
- **Weeks are ISO / Monday-start:** `getWeekStr(dateStr)` returns `YYYY-Www`; week partitioning in settlement also treats Monday as day 0 (`(getDay()+6)%7`).
- **Terse global helpers:** `el(id)` = `getElementById`, `Y(n)` = yen formatting, `go(name)` = navigate, `uid()`, `getCat()`, `showErr`/`hideErr(id,msg)`, `fmtDate`. Expect single-letter/abbreviated names throughout.
- **Two expense kinds:** `expenses[]` are real threats that damage HP and count toward the game; `tempExpenses[]` are non-game reference records (see the `reference` screen), and `fixedCosts[]` are fixed costs — neither affects HP.

### State-migration pattern

Because data survives across app versions in `localStorage`, render functions **defensively backfill new fields** rather than migrating up front — e.g. `if(!state.inventory){ state.inventory={materials:0,unlockedChips:[]}; state.baseLevel=1; save(state); }` and `if(!Array.isArray(state.currentMonth.tempExpenses)){…}`. When you add a new persisted field, add the same guard at the read sites so existing saved states don't break.

## Conventions

- **UI language is Japanese**; code identifiers and the `// ─── SECTION ───` comment banners are English. Match this when adding code.
- Base/room artwork is chosen dynamically by level: `images/room_lv${baseLevel}.png` (also `base_lv*.png`, `character_states.png`). Keep new level assets to the same naming scheme.
- Styling is a single inline `<style>` block using CSS custom properties defined in `:root` (`--bg`, `--green`, `--font-g` = pixel font, etc.); reuse these variables and the existing `.card` / `.btn-*` / `.scr` classes rather than introducing new styling systems.
