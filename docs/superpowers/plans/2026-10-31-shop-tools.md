# Piece 13 — Shop Tools (plan, as built)

Spec: docs/superpowers/specs/2026-10-29-shop-tools-design.md

- `src/tools/calc.ts`: board feet; tape math (+ − × ÷ of tape amounts incl. feet and mixed numbers) and nearest 1/16, 1/32, 1/64; even spacing (gaps at the ends or pieces at the ends) with positions; compound miter for n sides and a lean angle (miter = atan(sin a·tan(180/n)), bevel = asin(cos a·sin(180/n))), crown laid flat for a spring angle and wall corner; graduated (golden ratio or any ratio) and Fibonacci drawer heights, rule of thirds; shellac flakes for a cut and thinning; epoxy pour volume + 10% split by ratio.
- Drawer sizing uses the Drawer maker's own `boxSize` for each slide type.
- `src/tools/store.ts`: shop journal (entries per project: date, notes, minutes or timer, costs, photos as small JPEG thumbnails) and inventory (tools, hardware with low-stock marks, finishes) saved to the app data folder through `aa:loadData`/`aa:saveData` (only the names journal and inventory). Journal totals include Shop Mode's step timers. Lumber and sheets stay in the optimizer's stock list, shown in the Inventory tab.
- Shopping list subtracts hardware on hand ("you have 6; this project needs 8 — buy 2") and lists the finishing schedule's finishes, noting ones on hand. Low stock shows on the home screen and in the Inventory tab.
- UI: Shop Tools screen (home tile, toolbar "Shop tools"): Calculators, Shop journal, Inventory. Kids: "Math Helpers" tile with board feet, tape sums and even spacing. Plan packet: Shop journal page.
- Tests: tests/tools/calc.test.ts, store.test.ts; tests/e2e/tools.spec.ts.
