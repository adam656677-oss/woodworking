# Shop Tools — Design (Piece 13)

Date: 2026-10-29
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time

## 1. Calculators (Master Shop → Shop Tools; kids get board feet, fractions and even spacing)

All in inches with fractions (to 1/64", shown to 1/16" or 1/32" as chosen), each with a worked explanation:
- **Board feet** (T × W × L / 144, with a list and price per BF), **fraction calculator** (+ − × ÷ of tape
  amounts, decimal ↔ fraction, nearest 1/16/1/32/1/64), **even spacing** (n items of width w in a space —
  gap and positions, e.g. balusters), **compound miter** (sides n, spring/slope angle → miter and bevel saw
  settings, crown moulding), **drawer sizing** (opening → box sizes for each slide type; same rules as Piece 6),
  **golden ratio / proportions** (1:1.618, rule of thirds, Fibonacci heights for a drawer bank), **shellac**
  (pound cut from flakes per alcohol; dilution), **epoxy** (volume for a pour from L × W × depth, with a
  10% allowance; resin:hardener split by ratio).

## 2. Shop journal

- Entries per project (or general): date, notes, photos (stored in the app data folder, thumbnails), time
  spent (start/stop timer or typed), costs (items and amounts). Project page shows total time and cost;
  Shop Mode's step timer feeds time here. Export a journal entry with the plan packet.

## 3. Inventory

- Lumber and sheets (takes over Piece 4's stock list: sizes, material, defects, location), tools (name,
  kind, notes, kids' tier from the Kids' Workshop permissions), hardware (from the hardware library, qty),
  finishes (product, amount left). Low-stock alerts (per item threshold) shown on the home screen and in the
  shopping list ("You have 6 hinges; this project needs 8 — buy 2").
- The optimizer uses lumber/sheet inventory (offcuts first); the shopping list subtracts hardware and
  finishes on hand.

## 4. Testing

Unit: every calculator against hand values (compound miter for 4/6/8 sides and 38°/52° crown, shellac 2-lb cut,
board feet, spacing positions); journal totals; inventory subtraction in the shopping list; low-stock
thresholds. UI and E2E: open each calculator; add a journal entry with a photo; inventory reduces a shopping
list.
