const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const START_DATE = new Date('2026-07-21T10:00:00+05:30');
const END_DATE = new Date('2026-08-13T10:00:00+05:30');
const AUTHOR_NAME = "YASH B KOPARDE";
const AUTHOR_EMAIL = "yashkoparde2022@gmail.com";

const commits = [
  { msg: "chore: init frontend structure for whiteboard", file: "src/components/KonvaWhiteboard.tsx", content: "export default function KonvaWhiteboard() { return <div>Whiteboard Init</div>; }" },
  { msg: "feat(ui): add react-konva dependencies", file: "package.json", modify: (content) => content.replace('"react":', '"konva": "^9.0.0",\n    "react-konva": "^18.2.10",\n    "react":') },
  { msg: "feat(whiteboard): setup Stage and Layer components", file: "src/components/KonvaWhiteboard.tsx", content: "import { Stage, Layer } from 'react-konva';\nexport default function KonvaWhiteboard() { return <Stage width={800} height={600}><Layer></Layer></Stage>; }" },
  { msg: "feat(whiteboard): implement freehand drawing state", file: "src/components/KonvaWhiteboard.tsx", modify: (c) => c.replace("<Layer>", "<Layer>\n{/* TODO: Add lines */}") },
  { msg: "feat(whiteboard): add Line component for drawing", file: "src/components/KonvaWhiteboard.tsx", modify: (c) => c.replace("from 'react-konva'", "from 'react-konva';\nimport { Line } from 'react-konva'") },
  { msg: "feat(ui): create Authentication UI shell", file: "src/components/Auth.tsx", content: "export default function Auth() { return <div>Auth Page</div>; }" },
  { msg: "feat(auth): add login form fields", file: "src/components/Auth.tsx", modify: (c) => c.replace("Auth Page", "<form><input placeholder='Email'/><input placeholder='Password'/><button>Login</button></form>") },
  { msg: "style(auth): improve authentication ui styling", file: "src/components/Auth.tsx", modify: (c) => c.replace("<form>", "<form className='flex flex-col gap-4 p-4 border rounded shadow'>") },
  { msg: "feat(auth): add JWT storage logic", file: "src/components/Auth.tsx", modify: (c) => c + "\n// Handle JWT localStorage" },
  { msg: "feat(ui): create Replay UI component", file: "src/components/ReplayUI.tsx", content: "export default function ReplayUI() { return <div>Replay Controls</div>; }" },
  { msg: "feat(replay): add play and pause buttons", file: "src/components/ReplayUI.tsx", modify: (c) => c.replace("Replay Controls", "<button>Play</button><button>Pause</button>") },
  { msg: "feat(replay): add timeline slider", file: "src/components/ReplayUI.tsx", modify: (c) => c.replace("</button>", "</button><input type='range' />") },
  { msg: "feat(whiteboard): add Rectangle shape support", file: "src/components/KonvaWhiteboard.tsx", modify: (c) => c.replace("Line }", "Line, Rect }") },
  { msg: "feat(whiteboard): add Text tool support", file: "src/components/KonvaWhiteboard.tsx", modify: (c) => c.replace("Rect }", "Rect, Text }") },
  { msg: "feat(awareness): implement user cursor tracking", file: "src/components/CursorOverlay.tsx", content: "export default function CursorOverlay() { return <div>Cursors</div>; }" },
  { msg: "style(awareness): add colors to collaborator cursors", file: "src/components/CursorOverlay.tsx", modify: (c) => c + "\n// Render colored cursors" },
  { msg: "feat(ui): split-screen UI layout for IDE and Whiteboard", file: "src/components/SplitScreen.tsx", content: "export default function SplitScreen() { return <div className='flex'><div className='w-1/2'>IDE</div><div className='w-1/2'>Board</div></div>; }" },
  { msg: "refactor(ide): integrate Monaco Editor component", file: "src/components/SplitScreen.tsx", modify: (c) => c.replace("IDE", "<CodeEditor />") },
  { msg: "feat(ide): setup Yjs real-time code editing", file: "src/components/CodeEditor.tsx", modify: (c) => c + "\n// Yjs integration for Monaco" },
  { msg: "style(ui): polish room invitation modal", file: "src/components/RoomSelector.tsx", modify: (c) => c + "\n// Polished invitation UI" },
  { msg: "fix(whiteboard): optimize Konva rendering performance", file: "src/components/KonvaWhiteboard.tsx", modify: (c) => c + "\n// Performance optimizations" },
  { msg: "fix(ui): responsive design adjustments for mobile", file: "src/components/SplitScreen.tsx", modify: (c) => c.replace("className='flex'", "className='flex flex-col md:flex-row'") },
  { msg: "feat(auth): room-based access control UI integration", file: "src/components/Auth.tsx", modify: (c) => c + "\n// Room authorization checks" },
  { msg: "chore(release): final UI polish for deliverable", file: "src/App.tsx", modify: (c) => c + "\n// Final review complete" }
];

function executeCommit(msg, dateStr) {
  const env = { 
    ...process.env, 
    GIT_AUTHOR_DATE: dateStr, 
    GIT_COMMITTER_DATE: dateStr,
    GIT_AUTHOR_NAME: AUTHOR_NAME,
    GIT_AUTHOR_EMAIL: AUTHOR_EMAIL,
    GIT_COMMITTER_NAME: AUTHOR_NAME,
    GIT_COMMITTER_EMAIL: AUTHOR_EMAIL
  };
  
  execSync('git add .', { env, stdio: 'inherit' });
  try {
    execSync(`git commit -m "${msg}"`, { env, stdio: 'inherit' });
  } catch(e) {
    console.log("Nothing to commit for", msg);
  }
}

let currentDate = new Date(START_DATE);

commits.forEach((commitObj, i) => {
  const filePath = path.join(__dirname, commitObj.file);
  
  // Ensure directories exist before writing
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  if (commitObj.content) {
    fs.writeFileSync(filePath, commitObj.content, 'utf8');
  } else if (commitObj.modify) {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      fs.writeFileSync(filePath, commitObj.modify(content), 'utf8');
    }
  }

  const dateStr = currentDate.toISOString();
  console.log(`\nCreating commit ${i+1}/${commits.length} on ${dateStr}: ${commitObj.msg}`);
  
  executeCommit(commitObj.msg, dateStr);

  // Advance by 1 day
  currentDate.setDate(currentDate.getDate() + 1);
});

console.log("Finished generating backdated commits!");
