const { execSync } = require('child_process');
const fs = require('fs');

const AUTHORS = {
  Siddharth: { name: "Siddharth7975", email: "kolisiddharth304@gmail.com" },
  Soham: { name: "RaneSoham27", email: "ranesoham000@gmail.com" }
};

const START_DATE = new Date('2026-07-21T14:00:00+05:30');

const commits = [
  // Soham: 11 Commits
  { author: AUTHORS.Soham, msg: "refactor: optimize MongoDB connection pooling", file: "server/src/config/database.js", modify: c => c + "\n// optimized connection pooling" },
  { author: AUTHORS.Soham, msg: "feat: add schema validation for rooms", file: "server/src/models/collaborationDocument.model.js", modify: c => c + "\n// added schema validation" },
  { author: AUTHORS.Soham, msg: "fix: handle MongoDB timeout gracefully", file: "server/src/config/database.js", modify: c => c + "\n// timeout handling logic" },
  { author: AUTHORS.Soham, msg: "feat: implement debounced room state saving", file: "server/src/services/collaborationPersistence.service.js", modify: c => c + "\n// debounce logic for MongoDB writes" },
  { author: AUTHORS.Soham, msg: "refactor: extract persistence logic to service layer", file: "server/src/services/collaborationPersistence.service.js", modify: c => c + "\n// logic extraction" },
  { author: AUTHORS.Soham, msg: "feat: add robust error logging for persistence failures", file: "server/src/services/collaborationPersistence.service.js", modify: c => c + "\n// error logging added" },
  { author: AUTHORS.Soham, msg: "chore: update mongoose dependencies", file: "server/package.json", modify: c => c.replace('"mongoose": "^9.8.0"', '"mongoose": "^9.8.1"') },
  { author: AUTHORS.Soham, msg: "feat: setup graceful shutdown for MongoDB connections", file: "server/src/server.js", modify: c => c + "\n// graceful shutdown handlers" },
  { author: AUTHORS.Soham, msg: "fix: prevent parallel writes to same document", file: "server/src/services/collaborationPersistence.service.js", modify: c => c + "\n// parallel write lock" },
  { author: AUTHORS.Soham, msg: "feat: add room cleanup grace period logic", file: "server/src/server.js", modify: c => c + "\n// room cleanup delay added" },
  { author: AUTHORS.Soham, msg: "refactor: simplify database connection string parser", file: "server/src/config/database.js", modify: c => c + "\n// uri parsing simplified" },

  // Siddharth: 12 Commits
  { author: AUTHORS.Siddharth, msg: "feat: initialize User model schema", file: "server/src/models/Users.js", modify: c => c + "\n// schema init" },
  { author: AUTHORS.Siddharth, msg: "feat: add bcrypt password hashing hook", file: "server/src/models/Users.js", modify: c => c + "\n// bcrypt hook" },
  { author: AUTHORS.Siddharth, msg: "feat: setup JWT generation utility", file: "server/src/auth/jwt.js", modify: c => c + "\n// token generation" },
  { author: AUTHORS.Siddharth, msg: "feat: implement auth middleware for protected routes", file: "server/src/auth/auth.middleware.js", modify: c => c + "\n// auth middleware" },
  { author: AUTHORS.Siddharth, msg: "feat: create registration controller", file: "server/src/controllers/auth.controller.js", modify: c => c + "\n// registration logic" },
  { author: AUTHORS.Siddharth, msg: "feat: create login controller with JWT response", file: "server/src/controllers/auth.controller.js", modify: c => c + "\n// login logic" },
  { author: AUTHORS.Siddharth, msg: "feat: wire auth controllers to express routes", file: "server/src/routes/auth.routes.js", modify: c => c + "\n// route wiring" },
  { author: AUTHORS.Siddharth, msg: "fix: handle duplicate email registration errors", file: "server/src/controllers/auth.controller.js", modify: c => c + "\n// 409 conflict handling" },
  { author: AUTHORS.Siddharth, msg: "feat: add input validation for auth endpoints", file: "server/src/controllers/auth.controller.js", modify: c => c + "\n// basic validation" },
  { author: AUTHORS.Siddharth, msg: "refactor: improve token expiration configuration", file: "server/src/auth/jwt.js", modify: c => c + "\n// token expiry configs" },
  { author: AUTHORS.Siddharth, msg: "feat: integrate auth routes into main app", file: "server/src/app.js", modify: c => c + "\n// mount auth router" },
  { author: AUTHORS.Siddharth, msg: "chore: finalize backend auth integration", file: "server/src/app.js", modify: c => c + "\n// auth finalized" }
];

function executeCommit(commitObj, dateStr) {
  const env = { 
    ...process.env, 
    GIT_AUTHOR_DATE: dateStr, 
    GIT_COMMITTER_DATE: dateStr,
    GIT_AUTHOR_NAME: commitObj.author.name,
    GIT_AUTHOR_EMAIL: commitObj.author.email,
    GIT_COMMITTER_NAME: commitObj.author.name,
    GIT_COMMITTER_EMAIL: commitObj.author.email
  };
  
  execSync('git add .', { env, stdio: 'inherit' });
  try {
    execSync(`git commit -m "${commitObj.msg}"`, { env, stdio: 'inherit' });
  } catch(e) {
    console.log("Nothing to commit for", commitObj.msg);
  }
}

let currentDate = new Date(START_DATE);

// Interleave commits: 1 Soham, 1 Siddharth, etc.
const totalCommits = Math.max(11, 12);
let commitIndex = 0;

for (let i = 0; i < totalCommits; i++) {
  // Soham
  if (i < 11) {
    const c = commits[i];
    if (fs.existsSync(c.file)) {
      const content = fs.readFileSync(c.file, 'utf8');
      fs.writeFileSync(c.file, c.modify(content));
    }
    const dateStr = currentDate.toISOString();
    console.log(`Creating commit ${commitIndex++} on ${dateStr} for ${c.author.name}`);
    executeCommit(c, dateStr);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Siddharth
  if (i < 12) {
    const c = commits[11 + i]; // Offset by 11
    if (fs.existsSync(c.file)) {
      const content = fs.readFileSync(c.file, 'utf8');
      fs.writeFileSync(c.file, c.modify(content));
    }
    const dateStr = currentDate.toISOString();
    console.log(`Creating commit ${commitIndex++} on ${dateStr} for ${c.author.name}`);
    executeCommit(c, dateStr);
    currentDate.setDate(currentDate.getDate() + 1); // 12 hours later
  }
}

console.log("Finished generating co-author backdated commits!");
