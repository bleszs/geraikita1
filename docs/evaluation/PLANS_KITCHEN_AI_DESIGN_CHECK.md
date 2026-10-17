# Plans and kitchen AI: design comparison

Date: 2026-10-18. Judgment: **ordinary extension; retain the existing visual canon**. The completed settings and kitchen additions express the established Neighborhood Kedai system through existing panels, fields, notices, typography and explicit controls. No new visual identity, token, stylesheet, font or shipping image is needed. This document records the comparison; it does not refresh DESIGN.md or its sidecar.

## Authority and scope

The normative reference is root `DESIGN.md`; `.impeccable/design.json` supplies the incumbent component specimens and extension metadata. The task-local contract is `.impeccable/briefs/plans-kitchen-ai.md`. The fresh finish review at `docs/evaluation/PLANS_KITCHEN_AI_UI_REVIEW.md` has disposition `ship` and no material fixes.

Compared source: `public/plan-view.js`, `public/kitchen-intake.js`, and their integration in `public/app.js`, `public/live-views.js`, `public/kitchen-view.js`, `public/staff-workspace.js` and `public/guide-content.js`. Existing rules in `public/styles.css` were read to verify reuse. The public-file diff contains no stylesheet change; neither new module defines inline style, a color, a font, a token or an image asset.

`PRODUCT.md` exists and was read. Its durable constraints support this extension: plain Indonesian operational language, business-owned records, human confirmation after AI assistance and no synthetic records in live accounts. It contains accumulated version history, including older catalog limits; this check does not treat those historical statements as authorization for a new plan paywall or change product documentation.

## Comparison evidence

| Canon or surface requirement | Observed extension | Judgment |
| --- | --- | --- |
| Warm Ground Rule | Owner kitchen, settings and cashier captures retain cream surfaces and brown writing in light mode; dark captures retain brown surfaces and peach accents. | Match. Semantic theme assignments remain inherited. |
| Typography and hierarchy | Existing Nunito family, page-title treatment, section headings, compact explanations and bold action labels carry both additions. The helper is a subsection of the operational form. | Match. No decorative display style or new type scale. |
| Flat Workbench Rule and panel shapes | Settings uses the existing paper section panel, transaction separators and native fields. Kitchen assistance uses the existing voice-entry separator and notice pattern inside the intake panel. | Match. No new resting elevation or surface material. Any incumbent button shadow is inherited, not introduced here. |
| Named Status Rule | Voice unavailability, parser fallback, extraction errors, preserved previous-message results and saved needs all have written explanations. Color supplements the explanation. | Match. No color-only state. |
| Existing controls and accessible semantics | Labeled native textareas, selects, numeric fields and explicit buttons inherit focus and disabled styling. Status and error regions use `role="status"` and `role="alert"`. The needs checkbox requires explicit consent. | Match in source. Captures do not independently prove every keyboard or assistive-technology interaction. |
| Responsive operational layout | Owner queue remains above intake; phone fields and actions stack. Cashier keeps the order shortcut and queue before the intake on phones, with queue and intake side by side on desktop. Settings remains a vertical account page. | Ordinary adaptation of existing responsive rules. No new breakpoint or composition system. |
| Honest free plan | `planView` renders the server plan name, period and used/limit/remaining values. It says menus are not limited by the package, manual work remains available, and parser/failure results do not consume quota. | Match to the brief. The fixture capture shows 0/100 text and 0/30 speech; those values are rendered data, not a new visual token or a pricing promise. |
| Proposed paid services and saved needs | Tumbuh and Jaringan are explicitly plans with unavailable paid packages and undecided prices/capacities. Saved need/note is separate from the new request; saving says no charge or activation. | Match. No ten-menu paywall, subscription activation, invented payment flow or pricing-card redesign. |
| AI assistance before human submission | The shared helper precedes the existing editable menu/portion/note fields. `app.js` fills those values only after extraction succeeds. A separate `kitchen-new` submit sends the final order. | Match. Assistance does not visually imply an order was queued or stock reserved. |
| Failure and catalog review | A rejected replacement leaves the previous editable values intact; the helper compares source text and names a previous-message result. Catalog revision changes produce a written reprocess instruction and the final submit checks that revision. Manual continuation is explicit. | Match. The owner capture demonstrates rejected replacement text beside preserved quantity and notes. |
| Owner and cashier integration | Owner settings adds the plan panel after the existing page title. Owner and cashier reuse the same helper; cashier retains permitted menu availability labels and its own account workspace. | Match. Packaging is not injected into the cashier account page. |
| Guide copy | Guide topics name actual free usage, future paid features, local parsing, review and final queue submission. | Match. Guidance describes the implemented separation of actions. |

All nine corrected evidence files in `.impeccable/review/v47/` were opened for this comparison:

- Owner kitchen: `desktop.png`, `mobile.png`, `dark.png`.
- Owner plan settings: `plan-desktop.png`, `plan-mobile.png`, `plan-dark.png`.
- Cashier intake: `cashier-desktop.png`, `cashier-mobile.png`, `cashier-dark.png`.

Desktop evidence is 1440 pixels wide and phone evidence is 390 pixels wide. The captures show the intended loaded routes and states without toast overlays. The long settings and kitchen pages inherit their existing vertical density; adding these controls does not create a new visual world. The finish review records the corrected dark capture procedure: transitions settled after 250 ms with animations disabled. Earlier unsettled dark captures are not the comparison evidence.

The three supplied computed-color records (`dark-colors.json`, `plan-dark-colors.json`, `cashier-dark-colors.json`) each report `background: rgb(46, 39, 35)`, `foreground: rgb(244, 233, 223)`, and `disabled: false`. These agree with the canon's dark surface and ink assignments and corroborate the settled active control appearance. They are sampled-control evidence, not a complete contrast or accessibility audit.

## Canon preservation

SHA256 verification before and after this documentation write matches the supplied frozen values:

| File | SHA256 |
| --- | --- |
| `DESIGN.md` | `769ec61803fcbc4bbaad840a21df02c1fceb8996f7894891dfd5637c04491c04` |
| `.impeccable/design.json` | `c31fbfcb60ab61b3b4152b3a87e8b22ca5e1abf008039ea8dc469584c742b51f` |

No rewrite, merge, sidecar regeneration or new component specimen is warranted for this extension. The canonical primitives already describe the forms and controls used here. The task-specific plan semantics and assistance flow remain in their surface brief, implementation and feature documentation rather than becoming global visual rules.

## Historical context drift and limits

`.impeccable/direction.md` still describes a local prototype with synthetic data and no production backend. That is pre-existing historical context drift: current product context and source include business accounts, server-backed records and isolated test/demo data. The direction file's old first-viewport story also predates the established kitchen-first operational layout. Its warm kedai identity remains consistent; its old runtime and page-strategy claims are not current implementation authority. It was reported and left unchanged.

This check supports the finish review's ship judgment for the ordinary UI extension. It does not establish field AI accuracy, microphone recognition quality, production deployment readiness or exhaustive accessibility coverage. Only this design-check document was written during the documenter pass; canon, source, captures and historical context were preserved.
