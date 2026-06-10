const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const {
  mkdtempSync,
  existsSync
} = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function assertNoForbiddenTrueFields(value) {
  const forbidden = new Set([
    "trusted",
    "protocolAuthority",
    "governanceApproval",
    "amendmentApproval",
    "compatibilityProof",
    "distributionProof",
    "installationProof",
    "productReady",
    "productReadiness"
  ]);
  const stack = [value];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || typeof current !== "object") {
      continue;
    }
    for (const [key, nested] of Object.entries(current)) {
      assert.notEqual(forbidden.has(key) && nested === true, true, `${key} was set to true`);
      if (nested && typeof nested === "object") {
        stack.push(nested);
      }
    }
  }
}

test("artifact packaging and installation works cold", () => {
  // 1. Create a clean temporary directory.
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "clista-installation-test-"));

  // 2. Initialize a dummy project in the temp directory.
  const initResult = spawnSync("npm", ["init", "-y"], {
    cwd: tempDir,
    encoding: "utf8"
  });
  assert.equal(initResult.status, 0, `npm init failed: ${initResult.stderr}`);

  // 3. Install the local package into the temp directory.
  // Since the package has no external dependencies, this runs fast and offline.
  const installResult = spawnSync("npm", ["install", root], {
    cwd: tempDir,
    encoding: "utf8"
  });
  assert.equal(installResult.status, 0, `npm install failed: ${installResult.stderr}`);

  // 4. Verify npx clista --help runs and prints help
  const helpResult = spawnSync("npx", ["clista", "--help"], {
    cwd: tempDir,
    encoding: "utf8"
  });
  assert.equal(helpResult.status, 0, `clista --help failed: ${helpResult.stderr}`);
  assert.match(helpResult.stdout, /Usage:/);

  // 5. Initialize the store in the temp directory
  const storeInitResult = spawnSync("npx", ["clista", "init"], {
    cwd: tempDir,
    encoding: "utf8"
  });
  assert.equal(storeInitResult.status, 0, `clista init failed: ${storeInitResult.stderr}`);
  
  // Verify .clista directory and events.ndjson were created
  const clistaDir = path.join(tempDir, ".clista");
  const eventsFile = path.join(clistaDir, "events.ndjson");
  const configFile = path.join(clistaDir, "config.json");
  assert.ok(existsSync(clistaDir), ".clista directory should exist");
  assert.ok(existsSync(eventsFile), "events.ndjson should exist");
  assert.ok(existsSync(configFile), "config.json should exist");

  // 6. Run clista validate in the initialized store
  const validateResult = spawnSync("npx", ["clista", "validate"], {
    cwd: tempDir,
    encoding: "utf8"
  });
  assert.equal(validateResult.status, 0, `clista validate failed: ${validateResult.stderr}`);
  const validation = JSON.parse(validateResult.stdout);
  assert.equal(validation.valid, true);
  assert.deepEqual(validation.errors, []);
  assertNoForbiddenTrueFields(validation);

  // 7. Run clista decision summary and check it behaves cleanly without crashing
  const summaryResult = spawnSync("npx", ["clista", "decision", "summary"], {
    cwd: tempDir,
    encoding: "utf8"
  });
  assert.equal(summaryResult.status, 0, `clista decision summary failed: ${summaryResult.stderr}`);
  const summary = JSON.parse(summaryResult.stdout);
  assert.equal(summary.schema, "clista.decisionSummary.v0");
  assert.ok(summary.error);
  assertNoForbiddenTrueFields(summary);
});
