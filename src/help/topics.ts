// The Master Shop help topics. Edit the words here.
//
// Rules for writing a topic:
//  - Plain words and short steps. Say what to press, then what happens.
//  - Wrap the name of every button, menu, tab or box in **double stars**, spelled exactly as it is on screen.
//  - Repeat each starred name once in `labels`. tests/help/topics.test.ts checks every label is still in the app's
//    source, so help can't quietly go out of date when a button is renamed or removed.
//  - Only describe what the app really does (check the code when unsure).
import type { HelpTopic } from './types'

/** Every **starred** name in a topic's steps and tip. */
export function boldLabels(topic: HelpTopic): string[] {
  const out: string[] = []
  for (const text of [...topic.steps, topic.tip ?? '']) {
    const parts = text.split('**')
    for (let i = 1; i < parts.length; i += 2) out.push(parts[i])
  }
  return out
}

export const MASTER_TOPICS: HelpTopic[] = [
  // ---------------------------------------------------------------- Getting started
  {
    id: 'getting-started', group: 'Getting started', title: 'How does the Studio fit together?',
    summary: 'A short tour of the parts of the Studio and how they connect.',
    keywords: ['overview', 'tour', 'begin', 'first time', 'start', 'welcome', 'workflow'],
    steps: [
      'On Home, press **Master Shop** to open the designer. The bar across the top (**Dashboard**, **Design**, **Drawing Board**, **My Plans**, **Library**, **Joinery**, **Finishing**, **Shop Tools**) moves you between the parts of the Studio.',
      'Design your piece once, in **Design**. Boards, joints, the cut list and the build plan all come from that one design, so there is nothing to draw twice.',
      'When it looks right, press **Create Build Plan** to get drawings, a cut list, a shopping list and building steps.',
      'At the bench, press **Shop Mode** for big-text steps you can follow with dusty hands.',
      'The **Kids\' Workshop** on Home is a separate, simpler place for young makers, with its own Help.'
    ],
    tip: 'Press F1 on any screen to open the help for that screen.',
    labels: ['Master Shop', 'Dashboard', 'Design', 'Drawing Board', 'My Plans', 'Library', 'Joinery', 'Finishing', 'Shop Tools', 'Create Build Plan', 'Shop Mode', "Kids' Workshop"],
    shortcuts: ['help']
  },
  {
    id: 'commands', group: 'Getting started', title: 'How do I find a command quickly?',
    summary: 'The command finder lists the main actions so you can type instead of hunting through menus.',
    keywords: ['palette', 'search commands', 'ctrl k', 'quick', 'find'],
    steps: [
      'In the Design screen, press Ctrl+K (or press **Commands · Ctrl/Cmd+K** in the bottom corner).',
      'Type a few letters, like "front", "cut" or "save".',
      'Use the up and down arrows to pick one, then press Enter. Esc closes the box without doing anything.'
    ],
    tip: 'Greyed-out commands, like Undo when there is nothing to undo, cannot be run.',
    labels: ['Commands · Ctrl/Cmd+K'], shortcuts: ['palette', 'palette-keys']
  },
  {
    id: 'panels', group: 'Getting started', title: 'How do I make the panels fit my screen?',
    summary: 'The Parts panel on the left and the Inspector on the right can be made wider, narrower or tucked away.',
    keywords: ['resize', 'collapse', 'layout', 'width', 'small screen', 'inspector', 'sidebar'],
    steps: [
      'Drag the thin edge of a panel left or right to change its width.',
      'Double-click the edge to put it back to its usual width. You can also click the edge, then use the arrow keys.',
      'Press the − button at the top of a panel to tuck it away, and + to bring it back.',
      'The Inspector has four tabs: **Properties**, **Template**, **References** and **Checks**.'
    ],
    labels: ['Properties', 'Template', 'References', 'Checks'], shortcuts: ['resize-panel', 'inspector-tabs']
  },

  // ---------------------------------------------------------------- Designing
  {
    id: 'template', group: 'Designing', title: 'How do I start from a template?',
    summary: 'Templates give you a finished design with sizes you can change, like a box, bookshelf or workbench.',
    keywords: ['new', 'start', 'box', 'bookshelf', 'birdhouse', 'side table', 'workbench', 'cabinet', 'cutting board', 'step stool', 'wall shelf', 'live template', 'unlock'],
    steps: [
      'Open the **Master Shop**. An empty design shows **Start a project** with a button for each template: Box, Bookshelf, Birdhouse, Side table, Workbench, Base cabinet, Cutting board, Step stool and Wall shelf.',
      'Press one. You can also press **New** in the toolbar and choose a template there, or choose **Blank project** for an empty design.',
      'If you have unsaved work, the Studio asks first: **Save**, **Don\'t Save** or **Cancel**.',
      'Open the **Template** tab on the right and change the sizes. The parts follow the new sizes.',
      'To move boards around one by one instead, press **Unlock for free-form editing**, then **Unlock**. The template sizes stop updating, but you can **Undo** it.'
    ],
    tip: 'Not sure which template? Press **✨ Describe what you want to make…** and type it in your own words. It works without an internet connection.',
    labels: ['Master Shop', 'Start a project', 'New', 'Blank project', 'Save', "Don't Save", 'Cancel', 'Template', 'Unlock for free-form editing', 'Unlock', 'Undo', '✨ Describe what you want to make…']
  },
  {
    id: 'boards', group: 'Designing', title: 'How do I add a board and set its size?',
    summary: 'Add boards one at a time and type their sizes in inches.',
    keywords: ['add board', 'width', 'length', 'thickness', 'wood', 'inches', 'fraction', 'size', 'dimension', 'part', 'grain', 'new board'],
    steps: [
      'Press **Add board** in the toolbar. A new board appears beside your other parts.',
      'Click the board in the 3D view or in the parts list, then open the **Properties** tab.',
      'Pick the **Wood**. The thickness comes from the wood, so it cannot be typed.',
      'Type the **Width** and **Length** in inches and press Enter. Fractions work: 11-3/4, 3/4, 11.75, or 1\' 2".',
      'Use **Grain** to say which way the grain runs. The **Ends & edges** section sets mitered ends and bevelled edges.'
    ],
    tip: 'Sizes are kept to the nearest 1/64 inch. Press Esc in a size box to put back what was there before.',
    labels: ['Add board', 'Properties', 'Wood', 'Width', 'Length', 'Grain', 'Ends & edges'], shortcuts: ['box-enter', 'box-esc']
  },
  {
    id: 'move', group: 'Designing', title: 'How do I move, copy, turn and line up parts?',
    summary: 'Drag parts into place and use the toolbar to copy, turn, mirror and align them.',
    keywords: ['position', 'drag', 'gizmo', 'snap', 'rotate', 'copy', 'duplicate', 'mirror', 'align', 'delete', 'x y z', 'arrows', 'undo'],
    steps: [
      'Click a part. Drag its arrows in the 3D view to move it. It snaps to the faces, edges and corners of other parts, or to a 1/16 inch grid, and says what it snapped to.',
      'For exact spots, type into the **X**, **Y** and **Z** boxes in **Properties**. They give the low corner of the part.',
      'Press **Duplicate** to copy the selected parts. **Delete** removes them.',
      'Use **Rotate 90°** to turn the selection a quarter turn. For other angles, use the **Rotation** boxes in **Properties**.',
      'Pick several parts and use **Align** to line them up on one side or centre, or **Mirror** to make a flipped copy.',
      'If something goes wrong, press **Undo**. **Redo** brings it back.'
    ],
    labels: ['X', 'Y', 'Z', 'Properties', 'Duplicate', 'Delete', 'Rotate 90°', 'Rotation', 'Align', 'Mirror', 'Undo', 'Redo'],
    shortcuts: ['duplicate', 'delete', 'undo', 'redo']
  },
  {
    id: 'groups', group: 'Designing', title: 'How do I pick several parts, group them or hide some?',
    summary: 'Work on a few parts at a time, or treat several parts as one assembly.',
    keywords: ['select', 'multiple', 'group', 'assembly', 'ungroup', 'isolate', 'hide', 'show', 'linked copy', 'parts list'],
    steps: [
      'Ctrl-click or Shift-click parts in the 3D view to add them to the selection. In the parts list, Shift-click picks a whole range.',
      'Press **Group** to make the selected parts one assembly. Give it a name. **Ungroup** splits it again.',
      'Press **Isolate** to show only the selected parts. **Show all** brings everything back.',
      'The eye next to a part in the list hides or shows just that part. Hidden parts are still in the design and the cut list.',
      'Double-click a part\'s name in the list to rename it.'
    ],
    labels: ['Group', 'Ungroup', 'Isolate', 'Show all'], shortcuts: ['multi-select', 'list-range', 'list-add', 'rename-part']
  },
  {
    id: 'views', group: 'Designing', title: 'How do I look around, measure and see inside?',
    summary: 'Change the view, measure between two points, pull the design apart or cut through it.',
    keywords: ['3d', 'front', 'side', 'top', 'zoom', 'orbit', 'rotate view', 'measure', 'explode', 'section', 'realistic', 'picture', 'png', 'camera', 'look'],
    steps: [
      'Press **3D**, **Front**, **Side** or **Top** for a different view. **Fit** zooms to show the whole design.',
      'In the 3D view, drag to turn, right-drag to slide and use the wheel to zoom.',
      'Press **Measure**, then click two points on the model. The distance shows. Press **Keep** to keep that dimension.',
      'The little bar over the 3D view has **Explode** (pulls parts apart), **Section** (cuts through the design) and **Open doors & drawers**.',
      'Change **Look** to **Realistic wood** to see grain and finish, or back to **Drawing (CAD)**.',
      'Press **📷 Picture…** to save the 3D view as a PNG picture.'
    ],
    labels: ['3D', 'Front', 'Side', 'Top', 'Fit', 'Measure', 'Keep', 'Explode', 'Section', 'Open doors & drawers', 'Look', 'Realistic wood', 'Drawing (CAD)', '📷 Picture…'],
    shortcuts: ['orbit', 'cancel-tool']
  },
  {
    id: 'joints', group: 'Designing', title: 'How do I join two parts?',
    summary: 'Pick two parts that touch and choose how they are joined, from simple butt joints to dovetails.',
    keywords: ['joint', 'butt', 'dado', 'rabbet', 'pocket screws', 'miter', 'mortise', 'tenon', 'dovetail', 'box joint', 'dowel', 'biscuit', 'join', 'glue', 'screws'],
    steps: [
      'Click one part, then Ctrl-click the part it touches. If they do not touch, move them together first; snapping helps.',
      'The **Properties** tab shows the choices that fit this pair under **Choose a joint**, like Butt, Dado, Rabbet, Pocket screws or Miter.',
      'For woodworking joints, use the **Cut joints** list, which offers the ones that suit how the two parts meet (mortise and tenon, dovetail, dowel and more).',
      'Set the joint\'s sizes, fasteners and counts below it. The cuts show on both parts, and the cut list notes them.',
      'Press **Remove joint** to take it away.'
    ],
    tip: 'A warning appears under the parts list if a joint cannot be cut the way it is set up. Open **Joint designer** to invent your own joint on a grid.',
    labels: ['Properties', 'Choose a joint', 'Cut joints', 'Remove joint', 'Joint designer']
  },
  {
    id: 'formulas', group: 'Designing', title: 'How do I use named sizes and formulas?',
    summary: 'Name a size once, use it in many boxes, and change the whole design from one place.',
    keywords: ['formula', 'parametric', 'variable', 'rule', 'equals', 'named size', 'sizes tab', 'expression', 'space evenly', 'center', 'count'],
    steps: [
      'In the Parts panel on the left, open the **Sizes** tab.',
      'Type a short **Name** and a value (like 30) in the new size boxes, then press **Add size**.',
      'In any size box, such as a board\'s **Width**, type an equals sign and the name: =H. You can do sums too: =H - 2*T.',
      'A box with a formula shows a small ƒ. Change the named size and every box that uses it follows.',
      'To keep parts in place, open **Rules** in a part\'s **Properties** and press **Add a rule** (for example, centre a shelf between two sides).'
    ],
    tip: 'Typing a plain size over a formula asks first, so you do not lose it by accident.',
    labels: ['Sizes', 'Name', 'Add size', 'Width', 'Rules', 'Properties', 'Add a rule']
  },
  {
    id: 'cabinets', group: 'Designing', title: 'How do I add doors, drawers and shelf pins?',
    summary: 'The Cabinet menu makes doors, drawers, face frames and shelf pin holes that fit an opening.',
    keywords: ['door', 'drawer', 'face frame', 'shelf pins', 'hinge', 'slides', 'cabinet', 'hardware', 'opening', 'shaker', 'slab'],
    steps: [
      'Pick the parts that make the opening, such as the two sides, a top and a bottom.',
      'Open the **Cabinet** menu and choose **Door…**, **Drawer…**, **Face frame…** or **Shelf pins…**.',
      'Press **Use the space between the selected parts** to fill in the opening, or type its sizes yourself.',
      'Choose the style, wood and hardware, then press **Make it**. The new parts join the design.',
      'The hardware they need shows in a **Hardware** list at the bottom of the **Cut List**.'
    ],
    tip: 'Shelf pins needs one or two parts picked. Use **Open doors & drawers** and the clearance check to see that they open without hitting anything.',
    labels: ['Cabinet', 'Door…', 'Drawer…', 'Face frame…', 'Shelf pins…', 'Use the space between the selected parts', 'Make it', 'Hardware', 'Cut List', 'Open doors & drawers']
  },
  {
    id: 'checks', group: 'Designing', title: 'How do I check my design for problems?',
    summary: 'The Studio warns about problems as you work, and the Checks menu looks closer.',
    keywords: ['warning', 'interference', 'collision', 'weight', 'balance', 'clearance', 'notes', 'dimension', 'problem', 'error', 'sag', 'cross grain'],
    steps: [
      'Warnings appear in the **Project checks** list under the parts list. Click one to highlight the parts it is about.',
      'Open the **Checks** menu in the toolbar for more: **Interference**, **Weight & balance**, **Door & drawer clearance**, **Dimensions & notes**.',
      'In **Interference**, press **Check for interference** to find parts that run into each other.',
      'In **Dimensions & notes**, use **Measure** then **Keep** to keep a dimension, or add a note and click the model where it goes.'
    ],
    tip: 'These checks help you spot mistakes. They do not say a piece is structurally safe.',
    labels: ['Project checks', 'Checks', 'Interference', 'Weight & balance', 'Door & drawer clearance', 'Dimensions & notes', 'Check for interference', 'Measure', 'Keep']
  },
  {
    id: 'woods', group: 'Designing', title: 'How do I add my own wood or change prices?',
    summary: 'The wood library holds the boards you have in your shop, with their sizes and prices.',
    keywords: ['wood library', 'lumber', 'species', 'price', 'board foot', 'stock', 'sheet', 'plywood', 'hardwood', 'my stock'],
    steps: [
      'Press **Woods** in the toolbar.',
      'Under **My stock**, fill in the name, species, kind, size and price of a board you own.',
      'Press **Add to my stock**. It shows in the **Wood** list of this project and of every new project. Use **Edit** or **Delete** to change it later.',
      'The prices feed the cut list totals and the shopping list.'
    ],
    labels: ['Woods', 'My stock', 'Add to my stock', 'Wood', 'Edit', 'Delete']
  },
  {
    id: 'pictures', group: 'Designing', title: 'How do I design over a photo or scan?',
    summary: 'Put a picture into the 3D view, scale it with one measurement, and build parts over it.',
    keywords: ['picture', 'photo', 'trace', 'reference image', 'scan', 'scale', 'overlay'],
    steps: [
      'Press **🖼 Pictures** in the toolbar. The **References** tab opens.',
      'Choose which flat plane the picture goes on, then press **Add picture…** and pick a PNG, JPG or WebP file.',
      'Press **Scale from two points**, click two spots on the picture, type the real distance between them, then press **Scale**.',
      'Use the opacity slider, the eye and the lock beside the picture, then add boards over it.'
    ],
    tip: 'You can also trace a picture on the Drawing Board to make a shaped part.',
    labels: ['🖼 Pictures', 'References', 'Add picture…', 'Scale from two points', 'Scale']
  },

  // ---------------------------------------------------------------- Output
  {
    id: 'cut-list', group: 'Cut list and building', title: 'How do I get a cut list and a shopping list?',
    summary: 'The cut list lists every part. Its tabs plan the cuts, work out what to buy and make labels.',
    keywords: ['cut list', 'shopping', 'buy', 'board feet', 'layout', 'labels', 'csv', 'print', 'stock', 'hardware', 'cost', 'sales tax', 'waste', 'kerf', 'offcuts', 'spreadsheet'],
    steps: [
      'Press **Cut List** in the toolbar.',
      'The **Cut list** tab shows each part with its finished size, wood, grain and notes, plus board feet and the estimated cost.',
      'The **Layout** tab plans which boards to cut each part from. Set the **Saw kerf** and trims, and add your own stock under **Add to my stock**.',
      'The **Buy** tab is the shopping list. Set **Sales tax** and **Hardwood waste** to match your lumberyard.',
      'The **Labels** tab prints sticker labels with a QR code for each part.',
      'Press **Print** to print the tab you are on, or **Save as CSV** to open the cut list in a spreadsheet.'
    ],
    tip: 'Lengths are from long point to long point, so mitered parts are listed at their longest.',
    labels: ['Cut List', 'Cut list', 'Layout', 'Saw kerf', 'Add to my stock', 'Buy', 'Sales tax', 'Hardwood waste', 'Labels', 'Print', 'Save as CSV']
  },
  {
    id: 'build-plan', group: 'Cut list and building', title: 'How do I create a build plan and save it as a PDF?',
    summary: 'The build plan turns your design into drawings, a cut list, a shopping list and assembly steps.',
    keywords: ['build plan', 'plan', 'pdf', 'print', 'drawings', 'create', 'update', 'assembly', 'steps', 'export', 'stale', 'packet'],
    steps: [
      'Finish your design. If a size box shows a formula error, fix it first: a plan cannot be made until it is fixed.',
      'Press **Create Build Plan** in the bar at the top of the Design screen. The plan opens as a preview you can scroll through.',
      'Read it over: the drawing sheets, the cut list, the shopping list and the assembly guidance.',
      'Press **Save as PDF** to keep it, or **Print** to open it in your PDF viewer. Print at Actual size so measurements stay true.',
      'Press **Back to Design** to keep working.',
      'If you change the design afterwards, the button reads **Update Build Plan**. In the preview, press **Update Plan** before saving or printing again.'
    ],
    tip: 'The plan is made from the very same design, so it cannot disagree with it. The preview is for reading; to change something, go back to the design.',
    labels: ['Create Build Plan', 'Save as PDF', 'Print', 'Back to Design', 'Update Build Plan', 'Update Plan']
  },
  {
    id: 'shaped', group: 'Cut list and building', title: 'How do I draw a curved or shaped part?',
    summary: 'Draw an outline on the Drawing Board and cut a board to that shape.',
    keywords: ['draw', 'drawing board', 'shape', 'curve', 'sketch', 'outline', 'dimension', 'circle', 'arc', 'spline', 'cnc', 'laser', 'dxf', 'svg', 'cad', 'constraint'],
    steps: [
      'Pick a board and press **Edit shape**, or open the **✏️ Draw a shape** menu and choose **New drawing**.',
      'Pick a tool on the left (**Line**, **Rectangle**, **Circle**, **Curve** and more) and click on the sheet. While drawing, type a size such as 11-3/4 and press Enter.',
      'Use **Dimension** to fix a size. The panel on the right shows the rules that keep the shape tied together.',
      'Close the outline. If it cannot become a board, a red note above the sheet says why.',
      'Press **Cut a board to this shape**, choose the wood under **Cut it from**, and press **Cut it**. (For a board you are editing the button says **Shape** and its name.)',
      'Press **← Back to the design**. The part keeps its drawing; **Make it a rectangle again** in **Properties** undoes the shape.'
    ],
    tip: 'Need it for a CNC or laser? Press **Export DXF** or **Export SVG** on the Drawing Board.',
    labels: ['Edit shape', '✏️ Draw a shape', 'New drawing', 'Line', 'Rectangle', 'Circle', 'Curve', 'Dimension', 'Cut a board to this shape', 'Cut it from', 'Cut it', 'Shape', '← Back to the design', 'Make it a rectangle again', 'Properties', 'Export DXF', 'Export SVG'],
    shortcuts: ['draw-tool-l', 'draw-tool-r', 'draw-type', 'draw-esc', 'draw-undo']
  },
  {
    id: 'full-size', group: 'Cut list and building', title: 'How do I print a shaped part at full size?',
    summary: 'Print a template at exactly 1:1, taped together from several pages if the part is big.',
    keywords: ['full size', 'template', 'actual size', '100%', 'tile', 'pattern', 'print', 'tape', '1:1', 'scale', 'paper'],
    steps: [
      'To print one drawing: on the Drawing Board press **Print full size**. It shows how many pages it needs, across and down.',
      'To print templates for several parts: press **Drawings** in the toolbar and open the **Templates** tab. Shaped parts are picked for you.',
      'Press **Print** (the Drawings window opens your PDF viewer) or **Save as PDF**.',
      'In the print box choose **Actual size** or 100%, never "Fit". Measure the check square on a page: it must be exactly 1 inch.',
      'Lay the pages out like the map, overlap each one up to its dashed line, line up the + marks, and tape.'
    ],
    labels: ['Print full size', 'Drawings', 'Templates', 'Print', 'Save as PDF', 'Actual size']
  },
  {
    id: 'shop-mode', group: 'Cut list and building', title: 'How do I follow the build in Shop Mode?',
    summary: 'Shop Mode shows one big step at a time, with a timer, and can be run by clapping.',
    keywords: ['shop mode', 'bench', 'steps', 'timer', 'hands-free', 'clap', 'big text', 'read aloud', 'done', 'tick', 'progress', 'microphone'],
    steps: [
      'Open a design with at least one part and press **Shop Mode** in the toolbar. (From **My Plans**, open a plan that has steps and press it there.)',
      'Read the step. The parts it uses and the tools it needs are listed under it, and a picture shows beside it when there is one.',
      'Press **Next ▶** and **◀ Back** to move. Tick **Done** when a step is finished.',
      'Press **Start timer** when you begin a step and **Stop timer** when you stop; the minutes are kept with the project.',
      '**Bigger text** and **Smaller text** change the size. **🔊 Read** reads the step out loud when your computer has a voice.',
      'Press **Hands-free**, then clap twice (or knock twice on the bench) to go to the next step. It only listens to loudness; nothing is recorded or sent.',
      'Press **Exit (Esc)** to leave. Ticks and times are kept with the project.'
    ],
    labels: ['Shop Mode', 'My Plans', 'Next ▶', '◀ Back', 'Done', 'Start timer', 'Stop timer', 'Bigger text', 'Smaller text', '🔊 Read', 'Hands-free', 'Exit (Esc)'],
    shortcuts: ['shop-next', 'shop-back', 'shop-done', 'shop-exit']
  },
  {
    id: 'export', group: 'Cut list and building', title: 'How do I export or import 3D files?',
    summary: 'Send the design to other programs (printing, CNC, other CAD), or bring in a model to design around.',
    keywords: ['export', 'import', 'stl', 'obj', '3mf', 'glb', 'step', 'dxf', 'csv', 'reference model', '3d print', 'cad', 'millimetres', 'mm', 'png'],
    steps: [
      'To send the design out: open the **3D files** menu and choose **Export…**.',
      'Pick a **Format**: STL, OBJ, 3MF, glTF, STEP, or DXF flat patterns. Choose all parts or just the selected ones, and the **Units**.',
      'Press **Export…** and choose where to save.',
      'To bring a model in: open **3D files** and choose **Import reference model…**, pick the file, check **Model units**, then press **Add to the design**.',
      'A reference model shows in grey and counts in the interference and clearance checks. It is not a part, so it is not in the cut list.'
    ],
    tip: 'Other ways out: **Save as CSV** in the cut list, **Export DXF** and **Export SVG** on the Drawing Board, and **📷 Picture…** for a PNG.',
    labels: ['3D files', 'Export…', 'Format', 'Units', 'Import reference model…', 'Model units', 'Add to the design', 'Save as CSV', 'Export DXF', 'Export SVG', '📷 Picture…']
  },

  // ---------------------------------------------------------------- More of the Studio
  {
    id: 'finishing', group: 'More of the Studio', title: 'How do I plan a finish?',
    summary: 'Finishing School teaches finishes, helps you choose one and builds a coat-by-coat schedule.',
    keywords: ['finish', 'finishing school', 'stain', 'varnish', 'shellac', 'oil', 'polyurethane', 'schedule', 'coats', 'dry time', 'mohawk', 'compatible', 'topcoat'],
    steps: [
      'Open **Finishing School** from Home, **Finishing** in the top bar, or **Finish** in the toolbar (which opens your schedule).',
      'Read the **Lessons**. Try **Choose a finish**: say what matters for this piece and how you can apply it, and compare up to three. **Mohawk products** lists the Mohawk finishing products.',
      'Wondering if one finish can go over another? Open **Can I put…?** and pick the two.',
      'In **My finishing schedule**, start from a template, then edit each step: the finish, method, sheen, coats and drying time. **Add a step** adds more.',
      'The schedule shows up in Shop Mode and in the plan packet. **Start over** clears it.'
    ],
    labels: ['Finishing School', 'Finishing', 'Finish', 'Lessons', 'Choose a finish', 'Mohawk products', 'Can I put…?', 'My finishing schedule', 'Add a step', 'Start over']
  },
  {
    id: 'plans', group: 'More of the Studio', title: 'How do I bring in a plan I already have?',
    summary: 'My Plans keeps plans from PDFs, photos or web pages, checks them with you, and can run them in Shop Mode.',
    keywords: ['plans', 'import', 'pdf', 'photo', 'scan', 'web', 'website', 'build guide', 'kid-friendly', 'ocr', 'check', 'accept', 'draft'],
    steps: [
      'Press **My Plans** in the top bar. **New plan** starts an empty one.',
      'To bring one in, press **Bring in a plan ▾** and choose **PDF…**, **Photos or scans…**, or type a **Web address** and press **Bring in page**.',
      'The plan arrives as a draft. On the **Check the brought-in plan** screen, press **Show** to see where something came from, **Accept** if it is right and **Delete** if it is not. **Accept all** accepts everything.',
      'Press **Done — open the plan**. Fix anything in the **Overview**, **Steps** and **Cut list** tabs.',
      'Press **Attach the open Master Shop design** to link a design to the plan, or **Print build guide** to print it.',
      'Tick **Kid-friendly** to show a plan in the Kids\' Workshop. This is only allowed after every drafted item is checked.'
    ],
    labels: ['My Plans', 'New plan', 'Bring in a plan ▾', 'PDF…', 'Photos or scans…', 'Web address', 'Bring in page', 'Check the brought-in plan', 'Show', 'Accept', 'Delete', 'Accept all', 'Done — open the plan', 'Overview', 'Steps', 'Cut list', 'Attach the open Master Shop design', 'Print build guide', 'Kid-friendly']
  },
  {
    id: 'library-tools', group: 'More of the Studio', title: 'What are the Library, Joint designer and Shop Tools?',
    summary: 'Reference pages, a joint inventor, calculators, a shop journal and an inventory.',
    keywords: ['library', 'species', 'wood movement', 'shelf sag', 'glue', 'safety', 'glossary', 'drill speeds', 'calculator', 'journal', 'inventory', 'low stock', 'board feet', 'joint designer', 'custom joint'],
    steps: [
      'Open **Library** from the top bar for wood and technique facts: **Species**, **Wood movement**, **Shelf sag**, **Glues**, **Techniques & safety**, **Grades & sizes**, **Drill speeds** and a **Glossary**.',
      'Open **Joinery** (the Joint designer) to design your own joint on a grid, then use it from **Cut joints** on any pair of parts.',
      'Open **Shop Tools** for **Calculators** (board feet, miters, shellac mixing and more), the **Shop journal** (notes, time and costs) and the **Inventory**.',
      'Things that are running low in the inventory show up on Home with a link to the inventory.'
    ],
    labels: ['Library', 'Species', 'Wood movement', 'Shelf sag', 'Glues', 'Techniques & safety', 'Grades & sizes', 'Drill speeds', 'Glossary', 'Joinery', 'Cut joints', 'Shop Tools', 'Calculators', 'Shop journal', 'Inventory']
  },

  // ---------------------------------------------------------------- Saving and sharing
  {
    id: 'files', group: 'Saving and sharing', title: 'Where are my files saved?',
    summary: 'Where projects, plans, exports and the Studio\'s own information live on the computer.',
    keywords: ['save', 'save as', 'open', 'folder', 'documents', 'aaw', 'location', 'where', 'bak', 'file', 'onedrive', 'plans folder', 'appdata'],
    steps: [
      'Press **Save** (or Ctrl+S). The first time, **Save As** asks for a name. Projects are .aaw files, in Documents\\A&A Woodworking unless you choose another folder.',
      'Each time you save, the version before is kept beside it with .bak on the end.',
      'Use **Open** to open a project file again.',
      'Plans in **My Plans** are kept in Documents\\A&A Woodworking\\Plans, one folder for each plan.',
      'Exports (3D files, CSV) start in Documents\\A&A Woodworking too.',
      'The Studio\'s own information (shop journal, inventory, your woods, and the Kids\' Workshop progress and photos) is kept in the Studio\'s data folder for your Windows user, not in Documents.'
    ],
    tip: 'Copy the Documents\\A&A Woodworking folder to a USB stick now and then, or use **Back up everything…** on Home, which also takes the Studio\'s own information.',
    labels: ['Save', 'Save As', 'Open', 'My Plans', 'Back up everything…'], shortcuts: ['save']
  },
  {
    id: 'autosave', group: 'Saving and sharing', title: 'How do autosave and recovery work?',
    summary: 'The Studio keeps a spare copy every 30 seconds, so a crash or power cut loses very little.',
    keywords: ['autosave', 'recover', 'recovery', 'crash', 'lost', 'power', 'backup', 'unsaved', 'restore', 'untitled'],
    steps: [
      'Every 30 seconds, if you have unsaved changes, the Studio quietly writes a spare copy. For a saved project it sits beside the file with .autosave on the end. For a project that was never saved it is Untitled.aaw.autosave in Documents\\A&A Woodworking.',
      'The spare copy never replaces your real file. Saving clears it away.',
      'After a crash, open the project again. If the spare copy is newer, a bar asks: "There are unsaved changes from last time (autosave). Recover them?"',
      'Press **Recover** to get the newer work back (it stays unsaved until you press **Save**), or **Open saved version** to go back to the last save.',
      'For work that was never saved, the bar appears when you open the **Master Shop** from Home. **Dismiss** there throws that spare copy away for good.',
      'If a project file will not open, the message gives the path of its .bak copy from the save before.'
    ],
    tip: 'Closing the Studio with unsaved changes asks whether to save first. Autosave is a safety net, not a replacement for **Save**.',
    labels: ['Recover', 'Save', 'Open saved version', 'Master Shop', 'Dismiss'], shortcuts: ['save']
  },
  {
    id: 'backup', group: 'Saving and sharing', title: 'How do I back up everything, or restore a backup?',
    summary: 'One file holds your projects, plans, journal, inventory and the kids\' progress.',
    keywords: ['backup', 'restore', 'back up', 'usb', 'new computer', 'copy', 'aabackup', 'cloud', 'move'],
    steps: [
      'On Home, press **Back up everything…** at the bottom and choose where to save the .aabackup file.',
      'Keep a copy somewhere else too, like a USB stick or a cloud folder.',
      'To restore, first save (or close) any project open in the Master Shop. Then press **Restore from a backup…**.',
      'If a parent PIN is set, type it. Press **Choose the backup file…** and pick the file.',
      'Everything it replaces is kept aside first, and the Studio shows where. Files made after the backup stay as they are. The Studio then reloads.'
    ],
    labels: ['Back up everything…', 'Restore from a backup…', 'Choose the backup file…']
  },
  {
    id: 'sharing', group: 'Saving and sharing', title: 'How do I share a project with family?',
    summary: 'A package is one file with the design and its shop journal. Whoever opens it gets their own copy.',
    keywords: ['share', 'package', 'send', 'email', 'family', 'copy', 'journal', 'open shared'],
    steps: [
      'Open the project and choose **Share this project…** from the **Share** menu.',
      'Type your name in **From** and a **Note** for them. Untick **Include the shop journal and photos** if you do not want those to go too.',
      'Press **Save the package…** and send that one file however you like.',
      'To open a package you were sent, choose **Open a shared project…** from **Share**. It opens as a new, unsaved copy and its journal entries are added to yours.'
    ],
    labels: ['Share this project…', 'Share', 'From', 'Note', 'Include the shop journal and photos', 'Save the package…', 'Open a shared project…']
  },
  {
    id: 'smart', group: 'Saving and sharing', title: 'How do I set up the Smart Helpers?',
    summary: 'Helpers that describe a project, turn a photo into a plan or guess a wood. Some work offline; some need a key.',
    keywords: ['smart helpers', 'ai', 'api key', 'claude', 'anthropic', 'describe', 'photo to plan', 'what wood', 'offline', 'settings', 'online'],
    steps: [
      'On Home press **Smart Helpers settings**, or open **✨ Helpers** in the toolbar and choose **Settings…**.',
      '**Describe a project…** works offline: type "A bookshelf 30 inches wide and 4 feet tall" and it shows the closest template, with a button to start from it.',
      'The online helpers (**Photo → plan…** and **What wood is this?…**, and drafting designs no template covers) need your own key from console.anthropic.com. You pay Anthropic directly, a few cents a request.',
      'Type the key in **API key** and press **Save**. It is kept on this computer, encrypted with Windows\' own protection.',
      'A picture or text is only sent when you press a helper\'s button. **Remove the key** turns the online helpers off.'
    ],
    tip: 'The Kids\' Workshop has no online helpers. Hands-free clapping in Shop Mode and tracing a photo work without a key.',
    labels: ['Smart Helpers settings', '✨ Helpers', 'Settings…', 'Describe a project…', 'Photo → plan…', 'What wood is this?…', 'API key', 'Save', 'Remove the key']
  }
]
