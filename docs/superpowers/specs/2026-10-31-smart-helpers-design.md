# Smart Helpers — Design (Piece 15)

Date: 2026-10-31
Status: this is "option 2", which I told Adam I'd build if he hadn't picked one by the time I got here. The
features are built and stay switched off until an Anthropic API key is entered. Everything that can work offline
works without one.

## 1. The online service, and privacy

- **Service.** Anthropic's Messages API (Claude), with the user's own API key. The key goes in Smart Helpers
  settings (on the Home screen), is stored encrypted using Windows' own protection (Electron `safeStorage`), and
  never leaves the computer except to call the API.
- **No key, no traffic.** Without a key, nothing is sent anywhere.
- **What is sent.** With a key, a request is sent only when the user presses a helper's button, and it contains
  only that photo or text. Each helper says so next to its button.
- **Cost.** Pay-as-you-go on the user's Anthropic account, roughly a few cents a request. There is no
  subscription and no charge when the helpers aren't used.
- **Model and timeout.** The model can be set in settings and defaults to `claude-sonnet-5-5`. Requests (including
  reading the whole answer) time out after 90 s with a plain message. Answers over 1 MB are refused, and an answer
  cut off by the length limit says so. Requests go through Electron's own network stack, so Windows proxy settings
  apply.
- **Untrusted answers.** Every answer is checked before use: parts and orientations against fixed lists, template
  settings against the template's own ranges, woods against the woods the new design has (others are dropped), and
  wood guesses against the Library.
- **Test switches.** `AA_AI_URL` (a local stand-in server, `http://127.0.0.1:port` only) and `AA_TEST_PLAIN_KEY`
  are honoured only when the app isn't packaged, so they can't be used against an installed copy.
- **Kids.** The kids' side has no online helpers. The tracing tool and the voice "next" can be used anywhere.

## 2. The helpers

1. **Photo → plan** (Master Shop, Smart Helpers menu).
   - **What the user gives:** a photo of a piece of furniture and one known measurement (for example "overall
     height 30").
   - **What comes back:** the parts as boxes (name, size, position and which way each one lies), a suggested wood
     for each, and build steps.
   - **How it's used:**
     - The answer is checked: no negative or absurd sizes, a known orientation, and at most 60 parts.
     - Everything is scaled so the known measurement is exact.
     - Each part is snapped to the nearest stock thickness in the wood library.
     - It opens as a new, unsaved design, with a "Check these" note.
     - The steps are shown in a panel that can save them as a new My Plans plan.
   - **Without a key:** "Trace it instead" puts the chosen photo in as a tracing picture (the existing Pictures
     feature, on the plane that shows the known measurement), with the steps to scale it from that measurement.
   - **After scaling,** the plan is checked again: a part that comes out too big or too small to build is refused
     with a plain message. Snapping to stock thickness can leave parts overlapping or with small gaps; the steps
     panel says how many places overlap and points to Checks.
2. **What wood is this?** (Master Shop, Smart Helpers menu, and the Library). A photo of a board comes back as up
   to three species from the Library, each with how sure the answer is and what to look for, and each with a link
   to its Library page. Answers that aren't in the Library are dropped. There is no offline version; the button
   explains why.
3. **Describe a project** (Master Shop, Smart Helpers menu, and the start panel).
   - **Online:** the description is turned into either one of the app's templates with its settings, or a list
     of parts like Photo → plan. Template answers are clamped to the template's ranges.
   - **Offline (always available):** a word matcher picks the closest template and reads sizes from the text
     ("30 wide", "4 feet 6 inches tall", "2-1/2 ft deep", "three shelves", "30 x 48 x 12" as width × height ×
     depth). Whole words only. A cutting board's width sets its number of strips.
4. **Hands-free "next step"** (Shop Mode). Offline and free: it uses the microphone level. A **double clap** (or
   two quick knocks on the bench: two short bangs 150–600 ms apart, with no third right after) moves to the next
   step. One bang (a hammer blow, a dropped board), fast hammering, talking and a machine starting don't. There's a
   1.5 s pause between triggers and a sensitivity slider. A small meter shows it's listening. It only runs while switched on, and nothing is recorded or sent.

## 3. Testing

- **Unit tests:**
  - Checking and scaling the answers: bad parts are refused; the plan is scaled to the known measurement and
    snapped to stock; it builds with no overlapping parts in a simple case.
  - Checking wood-ID answers.
  - The template matcher on typical sentences.
  - Clap detection: a double clap fires once; one bang, bangs too far apart and fast hammering don't; it doesn't
    fire twice inside the pause, and ignores a steady loud noise like a dust collector.
  - The settings store: the key is never sent to the page, which only learns whether a key is set.
- **E2E:**
  - A local stand-in server plays the API, using the `AA_AI_URL` setting for tests only.
  - Enter a key, then Describe a project builds a design, Photo → plan opens a design, and wood ID shows a
    species.
  - Without a key, the offline describe works and the photo helper offers tracing instead.
