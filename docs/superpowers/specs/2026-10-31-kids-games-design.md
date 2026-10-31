# Kids' Games — Design (Piece 9)

Date: 2026-10-31
Status: decided by Claude under Adam's "run straight through" instruction; Adam can redirect at any time

## 1. What

A **Games** tile in the Kids' Workshop opens five short games. They teach shop skills, and they follow the
roadmap's reward rule: a round ends with "8 of 10 right" and a friendly note, but there are no streaks, points
banks, currencies or badges. Badges still come only from real projects and quizzes. Every game has big
buttons, a 🔊 read-aloud of its instructions, and works with the mouse or a touch screen. All the art is
drawn in code for this app; no pictures are copied from anywhere.

1. **Read the Tape.** A tape measure is drawn with an arrow pointing at a mark. Pick the right reading from
   four choices. There are five levels: whole inches, halves, quarters, eighths and sixteenths. A second mode,
   "Find it", asks for a measurement (say 3-5/8") and the child taps the tape. The answer counts if it is
   within half a tick. Each answer explains how to count the marks ("3 inches and 5 little eighths").
2. **Spot the Hazard.** A drawn shop scene has 8 hidden dangers: a cord across the floor, safety glasses left
   on the bench, a blade guard taken off, a spill, oily rags in a pile, an open finish can near a heater,
   clutter on the saw table, and long hair or loose sleeves near the drill press. Tap a hazard to circle it
   and read why it's dangerous and what to do instead. A tap on a safe spot does nothing bad. There is a
   "Show me" hint button.
3. **Match the Wood.** A board picture, drawn with the same grain generator as the realistic view, comes with
   a clue (colour, smell, weight or use), and the child picks the species from three. The kids' species are
   pine, red oak, hard maple, black walnut, cherry, western red cedar, basswood and poplar. Facts come from
   the Deep Library, rewritten for kids.
4. **Joint Puzzle.** One part is shown cut for a joint (side view, on a grid). Pick which of three partner
   pieces fits it exactly, then name the joint. Puzzles cover the kids' joints (butt, lap, dado, rabbet,
   box, tongue and groove) plus mortise and tenon. Pieces that fit fill the space with no gap and no overlap.
   This is checked by code, not just marked in the data.
5. **Lathe Turning.** A blank spins on a drawn lathe, and a dashed shape shows the target. Hold the gouge
   (mouse or touch) against the blank to take wood off where it is. It cuts a little at a time and can't
   take off more than the reach of the tool. When done, the score is how close the turning is to the target
   (percent), with "too deep here" marks. The safety tip reminds the child that a grown-up runs the real
   lathe, and to keep the tool on the rest. Three target shapes to choose from: a pen, a small bowl
   profile and a candlestick.

## 2. Where

- Kids' Home gets a "Games" tile. Each game has a Back button to the games list.
- The Parent area gets an on/off switch for Games, on by default.

## 3. Testing

- **Unit tests:**
  - Tape rounds have exactly one right choice, all on the level's ticks, and different from each other.
  - "Find it" accepts an answer within half a tick.
  - Every hazard region is inside the scene, and hazards don't overlap.
  - Wood clues name the right species.
  - Every joint puzzle has exactly one partner that fits (by cell check).
  - Lathe cutting never goes below the tool's reach and the score is 100 for a perfect turning.
- **E2E:** open Games, answer a tape round, find a hazard, solve a joint puzzle, and turn the lathe until
  there's a score.
