import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = path => JSON.parse(readFileSync(join(root, path), "utf8"));
const manifest = read("plugin.json"), mcp = read("mcp.json");
const sync = (path = root, ...args) => spawnSync(process.execPath, [join(path, "scripts/sync.mjs"), ...args], { cwd: tmpdir(), encoding: "utf8" });
const runTest = (path, pattern) => {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT; // The copied test needs its own runner, not the parent's child-process context.
  return spawnSync(process.execPath, ["--test", `--test-name-pattern=${pattern}`, join(path, "tests/package.test.mjs")], { encoding: "utf8", env });
};

test("portable metadata and one credential-free MCP endpoint are shared by clients", () => {
  assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.equal(mcp.$schema, "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json");
  assert.deepEqual(Object.keys(manifest).sort(), ["$schema", "author", "description", "extensions", "homepage", "keywords", "license", "name", "repository", "version"]);
  assert.deepEqual(Object.keys(mcp).sort(), ["$schema", "mcpServers"]);
  assert.equal(manifest.name, "iris");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.author.name, "Flowlith");
  assert.equal(manifest.license, "MIT");
  assert.equal(manifest.repository, "https://github.com/jubsnfzm/iris-plugin");
  assert.deepEqual(mcp.mcpServers, { iris: {
    type: "streamable-http", url: "https://mcp.flowlith.com/mcp",
    extensions: { "com.openai": { auth: { type: "oauth", client: { mode: "cimd" } } } },
  } });
  const pkg = read("package.json");
  assert.equal(pkg.private, true);
  for (const key of ["version", "license", "repository"]) assert.equal(pkg[key], manifest[key], key);
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});

test("the public client includes the complete MIT license", () => {
  const license = readFileSync(join(root, "LICENSE"));
  // Pin the full MIT grant and disclaimer, not just the license heading.
  assert.equal(createHash("sha256").update(license).digest("hex"), "bb67bb6c7f555c34198b9332cd81d78d1442df7f95dab50fb3adc681deb252a1", "LICENSE must contain the complete MIT license");
});

test("Claude compatibility files exactly match the canonical metadata and endpoint", () => {
  const checked = sync(root, "--check");
  assert.equal(checked.status, 0, checked.stderr);
  const { $schema, extensions, ...metadata } = manifest, ui = extensions["com.openai"].interface;
  assert.deepEqual(read(".claude-plugin/plugin.json"), { ...metadata, icon: ui.logo, privacyPolicyUrl: ui.privacyPolicyURL, termsOfServiceUrl: ui.termsOfServiceURL });
  assert.deepEqual(read(".mcp.json"), { mcpServers: { iris: { type: "http", url: mcp.mcpServers.iris.url } } });
  assert.equal(ui.composerIcon, ui.logo);
  assert.deepEqual([...readFileSync(join(root, ui.logo)).subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
});

test("ChatGPT metadata declares remote execution, OAuth discovery and the packaged setup skill", () => {
  const openai = manifest.extensions["com.openai"];
  assert.equal(openai.requires_local_executor, false);
  assert.equal(openai.interface.displayName, "Flowlith");
  assert.equal(openai.interface.shortDescription, "AI replies for customer DMs");
  assert.equal(openai.onboardingSkill, "./skills/iris-setup/SKILL.md");
  assert.match(readFileSync(join(root, openai.onboardingSkill), "utf8"), /^---\nname: iris-setup\n/);
  assert.deepEqual(mcp.mcpServers.iris.extensions["com.openai"].auth, { type: "oauth", client: { mode: "cimd" } });
  assert.equal(read(".mcp.json").mcpServers.iris.extensions, undefined);
});

test("ChatGPT listing metadata meets OpenAI's submission limits", () => {
  const { interface: ui, review, publication } = manifest.extensions["com.openai"];
  const categories = ["Business & Operations", "Communication", "Creativity", "Data & Analytics", "Developer Tools", "Education & Research", "Entertainment", "Finance", "Healthcare", "Other", "Productivity", "Scientific Research", "Security", "Travel"];
  assert(categories.includes(ui.category), "Use a supported category title");
  for (const key of ["displayName", "shortDescription", "developerName"]) {
    assert(typeof ui[key] === "string" && ui[key].trim(), key);
    assert.doesNotMatch(ui[key], /[\p{Cc}\p{Cf}\u2028\u2029]/u, key);
  }
  assert(ui.displayName.length <= 30 && ui.shortDescription.length <= 30, "display name and subtitle are 30 characters or fewer");
  assert(ui.longDescription.length > 0 && ui.longDescription.length <= 4000);
  assert(ui.developerName.length <= 80);
  for (const key of ["websiteURL", "supportURL", "privacyPolicyURL", "termsOfServiceURL"]) {
    const url = new URL(ui[key]);
    assert.equal(url.protocol, "https:", key);
    assert(!url.username && !url.password && ui[key].length <= 1024, key);
  }
  assert(ui.defaultPrompt.length <= 3 && new Set(ui.defaultPrompt).size === ui.defaultPrompt.length);
  const normalized = ui.defaultPrompt.map(prompt => prompt.normalize("NFKC").trim().replace(/\s+/gu, " "));
  assert.equal(new Set(normalized).size, normalized.length, "Starter prompts must be unique after normalization");
  for (const prompt of ui.defaultPrompt) {
    assert(prompt.trim() && prompt.length <= 128 && !prompt.includes("@"), prompt);
    assert.doesNotMatch(prompt, /[\p{Cc}\p{Cf}\u2028\u2029]/u);
  }
  for (const key of ["logo", "composerIcon"]) {
    assert.match(ui[key], /^\.\/assets\/[\w.-]+\.png$/);
    const icon = readFileSync(join(root, ui[key]));
    assert(icon.length <= 5 * 1024 * 1024);
    assert.equal(icon.readUInt32BE(16), icon.readUInt32BE(20), "Square icon required");
    assert(icon.readUInt32BE(16) >= (key === "logo" ? 256 : 48) && icon.readUInt32BE(16) <= 4096);
  }
  assert.equal(review.commerce, false);
  assert.equal(review.test_cases.positive.length, 5);
  assert.equal(review.test_cases.negative.length, 3);
  for (const t of review.test_cases.positive) for (const key of ["description", "prompt", "tools_triggered", "expected_behavior"]) assert(t[key]?.trim(), key);
  for (const t of review.test_cases.negative) for (const key of ["description", "prompt"]) assert(t[key]?.trim(), key);
  assert.deepEqual(publication.countries, ["US", "GB", "AE", "SG", "CA", "AU"]);
  assert(publication.release_notes.trim());
  // Reviewer sign-in details go only in OpenAI's secure Review details form, never in the ZIP.
  for (const key of Object.keys(review)) assert(["commerce", "commerce_description", "test_cases", "demo_recording_url"].includes(key), key);
  if (review.demo_recording_url !== undefined) {
    const demo = new URL(review.demo_recording_url);
    assert.equal(demo.protocol, "https:");
    assert(!demo.username && !demo.password);
  }
  assert.doesNotMatch(JSON.stringify(manifest), /test_credentials|reviewer_instructions|[\w.+-]+@[\w-]+\.[\w.-]+/i);
});

test("the isolated package contains only approved public files and no symlinks", () => {
  const paths = [];
  function walk(directory, prefix = "") {
    for (const name of readdirSync(directory)) {
      if (prefix === "" && name === ".git") continue; // A normal public Git clone has local metadata; never export it.
      const path = join(directory, name), relative = prefix + name, info = lstatSync(path);
      assert.equal(info.isSymbolicLink(), false, relative);
      if (info.isDirectory()) walk(path, relative + "/");
      else paths.push(relative);
    }
  }
  walk(root);
  assert.deepEqual(paths.sort(), [
    ".claude-plugin/plugin.json", ".mcp.json", "LICENSE", "README.md", "assets/iris-512.png", "commands/setup.md",
    "mcp.json", "package.json", "plugin.json", "scripts/sync.mjs", "skills/iris-setup/SKILL.md", "tests/package.test.mjs",
  ]);
});

test("the existing setup alias uses the single shared skill with approval and privacy rules", () => {
  const skill = readFileSync(join(root, "skills/iris-setup/SKILL.md"), "utf8");
  assert.match(skill, /^---\nname: iris-setup\n/);
  for (const text of ["list_businesses", "one at a time", "save_onboarding_answers", "clearly agrees", "preview_id", "Never ask for card numbers", "Ask before changing"]) assert(skill.includes(text), text);
  assert.match(readFileSync(join(root, "commands/setup.md"), "utf8"), /Follow the iris-setup skill/);
  const docs = readFileSync(join(root, "README.md"), "utf8");
  for (const client of ["Claude", "ChatGPT", "Grok Bot", "Cursor"]) assert(docs.includes(client), client);
  assert.match(docs, /Server-side commerce checks remain required/);
  assert.match(docs, /MIT License/);
  assert.match(docs, /Grok Bot only/);
  assert.match(docs, /platform's secure review fields/);
  assert.match(docs, /does not.*grant rights to its\nprivate server/);
});

test("teaching instructions preserve draft isolation, original files and secure key entry", () => {
  const skill = readFileSync(join(root, "skills/iris-setup/SKILL.md"), "utf8");
  for (const text of ["get_teaching", "save_asset", "get_asset", "remove_asset", "preview_skill", "apply_teaching", "access_key_names", "data_base64", "skill_id"]) assert(skill.includes(text), text);
  for (const text of ["untrusted reference data", "Never request or pass the value in chat or tool arguments", "changes a DRAFT only", "show ALL pending changes", "that exact revision", "A stale revision requires a new review and approval", "do not invent original bytes"]) assert(skill.includes(text), text);
});

test("the copied package works without this repository and regenerates stale adapters", () => {
  const temporary = mkdtempSync(join(tmpdir(), "iris-package-")), copy = join(temporary, "package with spaces");
  try {
    cpSync(root, copy, { recursive: true, filter: path => path !== join(root, ".git") });
    assert.equal(sync(copy, "--check").status, 0);
    const changed = { ...manifest, version: "9.8.7" }, updatedMcp = structuredClone(mcp);
    updatedMcp.mcpServers.iris.url = "https://iris.example.test/mcp";
    writeFileSync(join(copy, "plugin.json"), JSON.stringify(changed));
    writeFileSync(join(copy, "mcp.json"), JSON.stringify(updatedMcp));
    assert.notEqual(sync(copy, "--check").status, 0, "stale adapters must fail the check");
    const rebuilt = sync(copy);
    assert.equal(rebuilt.status, 0, rebuilt.stderr);
    assert.equal(JSON.parse(readFileSync(join(copy, ".claude-plugin/plugin.json"))).version, "9.8.7");
    assert.equal(JSON.parse(readFileSync(join(copy, ".mcp.json"))).mcpServers.iris.url, "https://iris.example.test/mcp");
    assert.equal(sync(copy, "--check").status, 0);
    updatedMcp.mcpServers.iris.type = "stdio";
    writeFileSync(join(copy, "mcp.json"), JSON.stringify(updatedMcp));
    assert.notEqual(sync(copy).status, 0, "a transport change must not silently create an HTTP adapter");
    assert.notEqual(sync(copy, "--unsupported").status, 0);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("public clone checks reject extra private files, symlinks and a truncated license", () => {
  const temporary = mkdtempSync(join(tmpdir(), "iris-public-")), copy = join(temporary, "clone with spaces");
  try {
    cpSync(root, copy, { recursive: true, filter: path => path !== join(root, ".git") });
    mkdirSync(join(copy, ".git"));
    writeFileSync(join(copy, ".git/HEAD"), "ref: refs/heads/main\n");
    assert.equal(runTest(copy, "the isolated package").status, 0, "a normal Git clone must be testable");

    writeFileSync(join(copy, ".dev.vars"), "fixture=not-a-secret\n");
    const boundary = runTest(copy, "the isolated package");
    assert.equal(boundary.status, 1, "adding a private configuration file must fail the package boundary check");
    assert.match(boundary.stdout, /\.dev\.vars/);
    rmSync(join(copy, ".dev.vars"));

    rmSync(join(copy, "LICENSE"));
    symlinkSync(join(root, "LICENSE"), join(copy, "LICENSE"));
    assert.equal(runTest(copy, "the isolated package").status, 1, "even an allowlisted path must not be a symlink");
    rmSync(join(copy, "LICENSE"));

    writeFileSync(join(copy, "LICENSE"), "MIT License\nCopyright (c) 2026 Flowlith\n");
    const license = runTest(copy, "the public client includes");
    assert.equal(license.status, 1, "the MIT heading alone must not pass as an open-source license");
    assert.match(license.stdout, /LICENSE must contain the complete MIT license/);
    cpSync(join(root, "LICENSE"), join(copy, "LICENSE"));
    assert.equal(runTest(copy, "the public client includes|the isolated package").status, 0, "restoring the public files must restore passing checks");
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test("Connect keeps keys in one-time phone-friendly links and requires a real Test and exact-version yes", () => {
  const skill=readFileSync(join(root,"skills/iris-setup/SKILL.md"),"utf8"),docs=readFileSync(join(root,"README.md"),"utf8");
  for(const text of ["get_key_link","save_action_draft","preview_action","real_write_ok: true","owner_said_yes: true","turn_off_action","rotate","one-click sign-in"])assert(skill.includes(text),text);
  for(const text of ["<!-- connect-prompt -->","<!-- connect-steps:claude -->","<!-- connect-steps:chatgpt -->","<!-- connect-steps:grok -->","<!-- connect-steps:cursor -->","No verified one-time Codex setup steps","get_key_link","Test is real"])assert(docs.includes(text),text);
  for(const text of ["phone or computer","no sign-in","15 minutes","fresh link"]){assert(skill.includes(text),text);assert(docs.includes(text),text);}
  assert(!/laptop or desktop computer|doesn't work on phones/.test(skill+docs));
  assert(!/Authorization:\s*Bearer\s+(?!\$)[A-Za-z0-9_-]{12,}/i.test(docs));
});

test("public instructions have no commerce flow, name the connection Flowlith and keep private reviewer configuration out", () => {
  const docs = readFileSync(join(root, "README.md"), "utf8");
  const skill = readFileSync(join(root, "skills/iris-setup/SKILL.md"), "utf8");
  const surfaces = docs + skill + JSON.stringify(manifest.extensions["com.openai"].interface) + readFileSync(join(root, "commands/setup.md"), "utf8");
  assert.doesNotMatch(surfaces, /buy_credits|buy(?:ing)? credits|purchase|upgrade|paid-credit|monthly plan|rzp\.io|section=billing|\/billing|REVIEWER_LOGIN_|portal_access|iris-website/);
  assert.match(docs, /name it \*\*Flowlith\*\*/);
  assert.match(docs, /MCP server called Flowlith/);
  assert.doesNotMatch(docs, /Reviewer password\nsign-in/);
  assert.match(skill, /get_credits/);
});

test("the setup skill explains what Flowlith does and that launch waits for Flowlith approval", () => {
  const skill = readFileSync(join(root, "skills/iris-setup/SKILL.md"), "utf8");
  assert.match(skill, /## About Flowlith/);
  assert.match(skill, /`launch_agent` works only after approval/);
  assert.match(skill, /emails the owner when it is approved/);
  assert.match(skill, /does not sell credits or take payments/);
});

test("the shared setup skill offers only Customer preview, not owner-chat mode", () => {
  const skill = readFileSync(join(root, "skills/iris-setup/SKILL.md"), "utf8");
  assert.match(skill, /offer `test_agent` as a customer preview only/);
  assert.doesNotMatch(skill, /`owner` mode|preview\s+or\s+owner(?:-chat)?\s+mode/);
  assert.match(skill, /Owner-chat mode is not available/);
  assert.match(skill, /SAME `message_id` and exact text/);
});

test("submission guidance gates previews and does not turn read-only requests into setup", () => {
  const skill = readFileSync(join(root, "skills/iris-setup/SKILL.md"), "utf8");
  assert.match(skill, /For read-only requests, perform only the requested reads/);
  assert.match(skill, /wait for the owner's explicit permission before calling `test_agent`/);
  const { review } = manifest.extensions["com.openai"];
  assert.match(review.test_cases.positive[4].description, /no live customer channels/);
  assert.match(review.test_cases.positive[4].expected_behavior, /waits for an explicit yes/);
  assert.match(review.test_cases.negative[0].description, /Unsupported digital-credit sale/);
});

test("listing checks reject unsupported categories, duplicate prompts and nonsquare icons", () => {
  const temporary = mkdtempSync(join(tmpdir(), "iris-listing-")), copy = join(temporary, "iris");
  try {
    cpSync(root, copy, { recursive: true });
    const edited = structuredClone(manifest), ui = edited.extensions["com.openai"].interface;
    const save = () => writeFileSync(join(copy, "plugin.json"), JSON.stringify(edited));
    ui.category = "Business"; save();
    assert.equal(runTest(copy, "^ChatGPT listing metadata").status, 1);
    ui.category = manifest.extensions["com.openai"].interface.category;
    ui.defaultPrompt = ["Check Iris", " Check   Iris "]; save();
    assert.equal(runTest(copy, "^ChatGPT listing metadata").status, 1);
    ui.defaultPrompt = manifest.extensions["com.openai"].interface.defaultPrompt; save();
    const icon = readFileSync(join(copy, ui.logo));
    icon.writeUInt32BE(128, 20); writeFileSync(join(copy, ui.logo), icon);
    assert.equal(runTest(copy, "^ChatGPT listing metadata").status, 1);
    cpSync(join(root, ui.logo), join(copy, ui.logo));
    assert.equal(runTest(copy, "^ChatGPT listing metadata").status, 0);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});
