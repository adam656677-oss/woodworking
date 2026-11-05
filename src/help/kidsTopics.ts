// The Kids' Workshop help topics. Short sentences, plain words, big text (the window makes the text large).
//
// Same rules as topics.ts (**Name** around buttons, repeat them in `labels`, only say what the app really does), and
// the kids' rules too: no streaks, points, coins or guilt. Help only tells a child what to press next.
import type { HelpTopic } from './types'

export const KIDS_TOPICS: HelpTopic[] = [
  {
    id: 'getting-started', group: 'Start here', title: 'What can I do here?',
    summary: 'A quick look at the big pictures on the Kids\' Workshop home page.',
    keywords: ['start', 'home', 'tour', 'welcome', 'begin'],
    steps: [
      'The home page has big pictures. Press one to go there.',
      '**My Path** has lessons and quizzes. **Projects** has things to build. **Learn** has tools, wood and safety.',
      '**Games** are for fun and practice. **Math Helpers** does tape measure sums for you.',
      '**Simple Designer** and **Draw It!** are where you make your own designs.',
      'Press **← Back** at the top to go back. Press Help any time.'
    ],
    tip: 'When a step says "Adult does this", a grown-up does that step.',
    labels: ['My Path', 'Projects', 'Learn', 'Games', 'Math Helpers', 'Simple Designer', 'Draw It!', '← Back']
  },
  {
    id: 'lessons', group: 'Learning', title: 'How do I do a lesson?',
    summary: 'Lessons are short pages you read one card at a time.',
    keywords: ['lesson', 'learn', 'read', 'path', 'cards', 'read aloud', 'safety'],
    steps: [
      'Press **My Path** on the home page. Pick a lesson.',
      'Read the card. Press **Next →** for the next one, or **← Back** for the one before.',
      'Want it read to you? Press the speaker button, **Read aloud**. Press it again to stop.',
      'On the last card, press **Done ✓**.',
      'A green tick shows next to lessons you have opened.'
    ],
    tip: '**Learn** on the home page is always open. It has safety, wood and tools.',
    labels: ['My Path', 'Next →', '← Back', 'Read aloud', 'Done ✓', 'Learn']
  },
  {
    id: 'quizzes', group: 'Learning', title: 'How do I take a quiz?',
    summary: 'Each level has a quiz. Passing it earns a badge and opens the next level.',
    keywords: ['quiz', 'test', 'questions', 'level', 'pass', 'badge'],
    steps: [
      'Go to **My Path**. At the bottom of a level, press the quiz button.',
      'You see one question at a time. Pick an answer.',
      'It tells you why the answer is right. Press **Next question**.',
      'At the end you see how many you got right.',
      'Not there yet? Press **Try again**. The questions come in a new order, and you can read the lessons again first.'
    ],
    labels: ['My Path', 'Next question', 'Try again']
  },
  {
    id: 'projects', group: 'Building', title: 'How do I pick a project to build?',
    summary: 'Projects are real things to make with a grown-up, with steps and a cut sheet.',
    keywords: ['project', 'build', 'birdhouse', 'steps', 'tools', 'cut sheet', 'built', 'locked', 'stars'],
    steps: [
      'Press **Projects**. Each picture shows how hard it is (stars) and about how long it takes.',
      'A project opens when you pass the quiz for its level. A lock shows which level it is waiting for.',
      'Press a project to see its cut sheet, its tools and its steps.',
      'Some steps say "Adult does this". Those are for your grown-up.',
      'When it is built, ask your grown-up to press **Mark as built**.'
    ],
    labels: ['Projects', 'Mark as built']
  },
  {
    id: 'print-sheet', group: 'Building', title: 'How do I print a project sheet?',
    summary: 'A project sheet is a page to take to the workbench, with the steps and a cut sheet.',
    keywords: ['print', 'sheet', 'paper', 'printer', 'cut sheet', 'steps', 'take to shop'],
    steps: [
      'Press **Projects** and pick a project.',
      'Press **Print project sheet**.',
      'Look at the page. It has a picture, the tools, the steps and the cut sheet.',
      'Press **🖨 Print** and pick a printer.',
      'Press **← Back** to go back to the project.'
    ],
    tip: 'There is a box on the page to glue a photo of what you built.',
    labels: ['Projects', 'Print project sheet', '🖨 Print', '← Back']
  },
  {
    id: 'designer', group: 'Designing', title: 'How do I design something in the Simple Designer?',
    summary: 'Add boards, give them sizes, move them together and print your plan.',
    keywords: ['designer', 'simple designer', 'board', 'design', 'size', 'join', 'print my plan', 'cut list', 'save', 'butt joint'],
    steps: [
      'Press **Add board**. A board shows up. Click it to pick it.',
      'On the right, choose the **Wood**. Type how long and wide you want it, and press Enter.',
      'Drag the arrows to move the board. It snaps to other boards.',
      'To join two boards, click one, hold Ctrl and click the other. Then press **Butt**.',
      '**Duplicate** makes a copy. **Rotate 90°** turns it. **Delete** takes it away. Made a mistake? Press **Undo**.',
      'Press **Cut List** to see all your pieces, and **Print my plan** to print the plan.',
      'Press **Save** to keep your design. Press **⌂ Kids\' Workshop** to go back.'
    ],
    labels: ['Add board', 'Wood', 'Butt', 'Duplicate', 'Rotate 90°', 'Delete', 'Undo', 'Cut List', 'Print my plan', 'Save', "⌂ Kids' Workshop"],
    shortcuts: ['undo', 'delete']
  },
  {
    id: 'draw-it', group: 'Designing', title: 'How do I use Draw It!?',
    summary: 'Draw a shape, then turn it into a real part of your design.',
    keywords: ['draw', 'drawing', 'shape', 'heart', 'star', 'letters', 'circle', 'part', 'print'],
    steps: [
      'Press **Draw It!** on the home page.',
      'Draw with your finger or the mouse. Or press a shape at the top: **Circle**, **Heart**, **Star** or **Letters**.',
      'Type how wide you want it in the **How wide?** box.',
      'Press **Make it a part!** to turn your drawing into a board in the Simple Designer.',
      'Press **Print it** to print it full size. Press **Remove** to take away a shape you picked.'
    ],
    tip: 'Printing full size? In the print box, choose Actual size.',
    labels: ['Draw It!', 'Circle', 'Heart', 'Star', 'Letters', 'How wide?', 'Make it a part!', 'Print it', 'Remove']
  },
  {
    id: 'games', group: 'Fun', title: 'How do I play the games?',
    summary: 'The games help you practice tape measures, safety, wood and joints.',
    keywords: ['game', 'play', 'fun', 'tape', 'hazard', 'wood', 'joint', 'lathe', 'practice'],
    steps: [
      'Press **Games** on the home page.',
      'Pick one: **Read the Tape**, **Spot the Hazard**, **Match the Wood**, **Joint Puzzle** or **Lathe Turning**.',
      'Follow the words on the screen.',
      'Play as many times as you like.'
    ],
    tip: 'No Games picture on the home page? Your grown-up can turn games on.',
    labels: ['Games', 'Read the Tape', 'Spot the Hazard', 'Match the Wood', 'Joint Puzzle', 'Lathe Turning']
  },
  {
    id: 'math', group: 'Fun', title: 'What are the Math Helpers?',
    summary: 'Three helpers that do the tape measure maths and show their working.',
    keywords: ['math', 'maths', 'calculator', 'fractions', 'board feet', 'spacing', 'measure'],
    steps: [
      'Press **Math Helpers** on the home page.',
      'Pick one at the top: **How much wood?**, **Add and take away**, or **Space them evenly**.',
      'Type in your numbers. The helper shows the answer and how it got there.'
    ],
    labels: ['Math Helpers', 'How much wood?', 'Add and take away', 'Space them evenly']
  },
  {
    id: 'badges', group: 'Building', title: 'How do I earn a badge?',
    summary: 'Badges are for passing a level quiz and for building a real project.',
    keywords: ['badge', 'certificate', 'print certificate', 'earn', 'quiz', 'built'],
    steps: [
      'Pass a level quiz, or build a project with your grown-up.',
      'Press **My Badges** to see them.',
      'Press **Print certificate** to print one.'
    ],
    labels: ['My Badges', 'Print certificate']
  },
  {
    id: 'my-plans', group: 'Building', title: 'Where are my plans?',
    summary: 'My Plans are plans a grown-up has checked and said are right for kids.',
    keywords: ['plans', 'my plans', 'kid-friendly', 'checked', 'grown-up'],
    steps: [
      'Press **My Plans** on the home page.',
      'Press a plan to open it.',
      'No plans yet? Ask your grown-up to check one and mark it as kid-friendly.'
    ],
    labels: ['My Plans']
  },
  {
    id: 'handy-keys', group: 'Designing', title: 'Which keys are handy?',
    summary: 'Some keys do the same thing as buttons, a little faster.',
    keywords: ['keys', 'keyboard', 'shortcut', 'ctrl', 'undo', 'delete'],
    steps: [
      'You are in the Simple Designer. Press a key shown below instead of a button.',
      'Hold Ctrl and press the letter at the same time.'
    ],
    labels: [],
    shortcuts: ['save', 'undo', 'redo', 'duplicate', 'delete', 'help']
  },
  {
    id: 'grown-ups', group: 'For grown-ups', title: 'For grown-ups: setting up the Kids\' Workshop',
    summary: 'The gear button is behind a 4-number PIN. It sets the tools, games and finished projects.',
    keywords: ['parent', 'pin', 'tool level', 'games', 'confirm', 'built', 'child name', 'reset quiz', 'family'],
    steps: [
      'Press the gear, **Parent**, on the home page.',
      'The first time, type the child\'s first name and a 4-number PIN, then press **Save PIN**.',
      'Pick the **Tool level**: it decides which steps an adult does. Big power tools are always for adults.',
      'Turn **Games on** off if you want no games.',
      'Under finished projects, press **Mark as built** once you have built one together. That earns the badge.'
    ],
    labels: ['Parent', 'Save PIN', 'Tool level', 'Games on', 'Mark as built']
  }
]
