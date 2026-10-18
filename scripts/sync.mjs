import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

// Claude uses its own manifest location and "http" transport name, not the portable names.
assert(process.argv.length <= 3 && (!process.argv[2] || process.argv[2] === "--check"), "Usage: node scripts/sync.mjs [--check]");
const root = new URL("../", import.meta.url);
const read = name => JSON.parse(readFileSync(new URL(name, root), "utf8"));
const { $schema, extensions, ...metadata } = read("plugin.json");
const { mcpServers } = read("mcp.json");
const ui = extensions["com.openai"].interface;
const files = {
  ".claude-plugin/plugin.json": {
    ...metadata,
    icon: ui.logo,
    privacyPolicyUrl: ui.privacyPolicyURL,
    termsOfServiceUrl: ui.termsOfServiceURL,
  },
  ".mcp.json": {
    mcpServers: Object.fromEntries(Object.entries(mcpServers).map(([name, { extensions, ...server }]) => {
      assert.equal(server.type, "streamable-http", "The shared Iris server must use Streamable HTTP");
      return [name, { ...server, type: "http" }];
    })),
  },
};
for (const [name, data] of Object.entries(files)) {
  const path = new URL(name, root), content = JSON.stringify(data, null, 2) + "\n";
  if (process.argv[2] === "--check") assert.equal(readFileSync(path, "utf8"), content, `${name} is stale; run npm run sync`);
  else {
    mkdirSync(new URL(".", path), { recursive: true });
    writeFileSync(path, content);
  }
}
console.log(process.argv[2] ? "Iris compatibility files verified" : "Iris compatibility files synchronized");
