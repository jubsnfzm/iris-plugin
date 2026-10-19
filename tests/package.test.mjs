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
  assert.equal(openai.onboardingSkill, "./skills/iris-setup/SKILL.md");
  assert.match(readFileSync(join(root, openai.onboardingSkill), "utf8"), /^---\nname: iris-setup\n/);
  assert.deepEqual(mcp.mcpServers.iris.extensions["com.openai"].auth, { type: "oauth", client: { mode: "cimd" } });
  assert.equal(read(".mcp.json").mcpServers.iris.extensions, undefined);
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
  assert.match(docs, /not ready for ChatGPT public-directory submission/);
  assert.match(docs, /MIT License/);
  assert.match(docs, /Grok Bot only/);
  assert.match(docs, /separate paid-credit service/);
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
