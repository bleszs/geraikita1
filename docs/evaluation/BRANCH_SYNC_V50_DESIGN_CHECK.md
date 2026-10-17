# Branch sync v0.50 design-system check

Date: 2026-10-18. Fresh documenter pass; ordinary extension in Operate mode. Authority: `.impeccable/briefs/branch-sync-v50.md`. No comp or replacement visual world was requested.

## Decision

Preserve `DESIGN.md` and `.impeccable/design.json` unchanged. The owner staff directory, cashier review and restricted kitchen workspace extend the existing cream/terracotta/Nunito system. They reuse semantic light/dark variables, labeled forms, explicit actions, status text and separated queue rows. No new durable palette or typography vocabulary warrants a canon update.

## Evidence checked

Source inspection covered `public/styles.css`, `public/staff.css`, `public/staff-workspace.js`, `public/staff-management.js` and the staff route/settings composition in `public/live-views.js`. Context checked: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json` and the v0.50 brief. `reference/document.md` and the documenter role instructions governed this pass. The final staff-management result/list line was re-read after the parent removed the unused raw-code directory rendering. A final source-only reconciliation checked the reviewer-requested flat staff sections, phone stacking and direct-child list selectors.

- Palette: light canvas/surface remain `#fcfaf6`/`#fffdf9`, with terracotta `#a3452b` and brown ink `#382c24`. Dark surfaces remain `#241f1c`/`#2e2723`, with peach terracotta `#e5a07f` and warm ink `#f4e9df`. New staff styles consume existing semantic variables.
- Type: local Nunito Sans remains aliased to `Nunito`, with Segoe UI/sans-serif fallbacks; base text is 15px/1.55. Existing heading sizes are 32px, 20px and 16px, weight 800; labels/status text use the existing smaller sizes. Staff totals and code displays use tabular numerals.
- Layout: staff work remains inside a 1440px maximum-width container. Cashier columns use `minmax(0,1.25fr)` and `minmax(320px,1fr)`, stacking at 1000px. Header/actions wrap at 760px. Staff editor, code-result and order-review sections are transparent, with a single-pixel semantic top separator, 24px top margin and top padding, zero radius and no side/bottom inset or enclosing border. At 680px the owner directory heading and staff rows stack. Staff list-row layout rules target direct children, preserving nested capability lists.
- Components: owner `Daftar staf` names its purpose and exposes `Tambah staf`; settings retain legacy management. Staff header names business, role and account; queue statuses are written out. `Pesanan baru` precedes the cashier queue/intake layout. Review explains reservation versus direct stock/sale recording before the two explicit actions. Native labels, required fields, disclosures and shared focus styles remain in source.
- Code display: the final owner directory list renders an active-code status rather than a raw code; the acknowledgement result uses an explicit hide action. This source sample does not independently verify storage, request reconciliation or navigation cleanup.

## Five-line system summary

1. Palette: cream paper, brown ink and terracotta actions; warm brown/peach counterparts in dark mode — Warm Ground Rule.
2. Type ramp: local Nunito Sans; 32/20/16px headings, 15px body and compact labels/statuses; bold tabular totals — Legible Arithmetic Rule.
3. Layout: bounded work area, flexible task columns and phone stacking; labeled controls remain adjacent to their work.
4. Shapes/depth: incumbent 14px outer panels; flat staff sections use fine top separators without nested panel framing — Flat Workbench Rule.
5. States: warning/success colors accompany explicit words, with visible keyboard focus and reduced-motion support — Named Status Rule.

## Drift not canonized or repaired

Existing global button rules already add small resting shadows, a 1px hover lift and transitions; secondary buttons use paper fill, and text actions are outlined controls. Those differ from the canon's transparent/text-action specimens and prose saying buttons change color directly with no decorative lift. This pass records that inherited drift without redefining the system. `DESIGN.md` still describes its extraction as a local prototype; sidecar specimen labels include `Data contoh` and `Simulasi kelompok`, while `PRODUCT.md` contains historical pairing/version statements. These are historical documentation/specimen context, not instructions to seed active business data. They were left untouched under the explicit ordinary-extension boundary.

## Preservation and limits

Verified SHA-256 values:

- `DESIGN.md`: `769ec61803fcbc4bbaad840a21df02c1fceb8996f7894891dfd5637c04491c04`
- `.impeccable/design.json`: `c31fbfcb60ab61b3b4152b3a87e8b22ca5e1abf008039ea8dc469584c742b51f`

The parent reports one detector run with zero anti-patterns and 116 advisory notes across inherited/new styles; it was not rerun here. Advisory totals are not a visual or accessibility certification. This documenter pass inspected source and did not launch the app, inspect computed styles, audit all interactions or certify backend behavior. Browser capture review belongs to the separate finish review; desktop Chromium and emulated phone evidence cannot establish physical-device behavior. No commercial, model-accuracy or deployment conclusions follow from this check.

Only `docs/evaluation/BRANCH_SYNC_V50_DESIGN_CHECK.md` was written by this pass.
