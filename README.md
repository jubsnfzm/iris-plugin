# Iris by Flowlith

One open-source client plugin for Grok Bot, Claude, ChatGPT and Cursor. Connect
your AI app to Iris to set up and manage the agent answering your business's
Instagram, WhatsApp, Messenger and website chats. This package connects to the
hosted Flowlith MCP service; it does not run a second agent or include the server.

**Repository:** [jubsnfzm/iris-plugin](https://github.com/jubsnfzm/iris-plugin) ·
**Client license:** [MIT](LICENSE)

**MCP URL:** `https://mcp.flowlith.com/mcp` · **Authentication:** browser OAuth

The plugin is free. The separate hosted Iris service requires a Flowlith account;
customer and test replies use paid credits. Installing this MIT-licensed client
does not include service credits, a free hosted plan or the private server source.
See [Flowlith](https://www.flowlith.com) for the current service offering.

## One maintained package

```text
iris/
  plugin.json                  Shared metadata (Agent Plugins format)
  mcp.json                     Shared remote MCP connection
  LICENSE                      MIT license for this client package
  skills/iris-setup/SKILL.md    One setup and management workflow
  assets/iris-512.png           One logo
  commands/setup.md            Existing Claude /iris:setup alias
  .claude-plugin/plugin.json   Generated Claude metadata adapter
  .mcp.json                    Generated Claude transport adapter
  scripts/sync.mjs             Rebuilds the two compatibility files
  tests/package.test.mjs       Dependency-free package checks
```

Edit `plugin.json`, `mcp.json`, the skill or the logo once. Run `npm run sync` after
metadata or MCP changes; do not hand-edit the generated files. The generated
Claude files are checked in so installation does not need Node or a build step.

The root Agent Plugins files support Grok Bot and Cursor as well as compatible
ChatGPT imports. Claude still needs its own manifest location and calls the remote
transport `http`, rather than `streamable-http`. These are adapters, not separate
implementations. No separate Grok or Cursor implementation is needed.
The shared manifest declares cloud execution and the bundled setup skill;
`mcp.json` declares OAuth with CIMD discovery. OpenAI-specific connection metadata
is not copied into Claude's generated transport file.

## Connect

All clients use the same Flowlith browser sign-in: enter your email, enter the
email code on the website, then choose Allow. Never paste a password, login code,
session token, card number or UPI PIN into chat or plugin configuration.
After connecting, say **"Set up Iris for my business"**. MCP cannot start a chat
by itself. Iris asks one onboarding question at a time and saves each answer.

### Grok Bot

Tell the Bot: **"Add a custom MCP server called Iris at
https://mcp.flowlith.com/mcp"**. Say "custom server" so it does not search only the
catalog. Approve the connect card and finish browser authorization. Do not add an
Authorization header manually. After connection succeeds, say **"Set up Iris"**.

For a read-only connection check, ask **"List my Iris businesses. Do not change
anything."** An empty list is valid for a new account. If authorization has been
revoked or expired, reconnect in the app and complete browser sign-in again.

The current marketplace submission target is **Grok Bot only**, not the separate
Grok chatbot or Cursor marketplace. Public source and a working custom connection
do not imply marketplace approval.

### Claude and Claude Code

- Claude: add a custom connector with the MCP URL above and finish browser sign-in.
- Claude Code: clone this public repository, then run
  `claude --plugin-dir /path/to/iris-plugin`.
- The existing `/iris:setup` command remains available. If authentication is
  needed, use `/mcp`, choose Iris, then Authenticate.
- A marketplace entry must point to this folder, not the old platform folders.

### ChatGPT

In **Plugins → + → Add custom MCP server**, name it **Iris by Flowlith**, enter the
MCP URL, choose OAuth and complete sign-in. Select **Create as a plugin**, review
the discovered tools, then enable Iris in a new chat. Account/workspace policies
may restrict custom connections. This tests the MCP server, not the bundled skill.

For private packaged testing, upload the runtime ZIP with `plugin.json`,
`mcp.json`, `skills/`, `assets/` and the Claude compatibility files at its root.
For an already imported plugin, use its **More actions → Upload new version**;
don't use Add plugin again for the same identity. Choose **Install plugin**, then
**Set up Iris** to launch the packaged `iris-setup` skill in a new browser chat.
The manifest explicitly sets `requires_local_executor: false`; Iris has no local
server or executable. A desktop opener is not a successful browser-install test.
No registered app ID, access token or separate ChatGPT skill belongs in this package.

### Cursor and other MCP clients

Use the portable package in clients that support Agent Plugins, or add the MCP
URL in the client's remote-MCP settings and finish OAuth. Cursor's native JSON
configuration can also be added manually:

```json
{
  "mcpServers": {
    "iris": { "url": "https://mcp.flowlith.com/mcp" }
  }
}
```

For the separate Grok chatbot, use `https://grok.com/connectors` → New Connector →
Custom, enter the same MCP URL and finish authentication.

## Capabilities and browser-only actions

- Set up a business, check status and connect its customer channels.
- Review/update business Info; interview, preview and save approved skills.
- Launch Iris, test a customer question and check credits.
- Test chats use the currently applied skills, just like the dashboard; saved or
  pending drafts aren't substituted. Each reply uses one credit. If skills change
  before a test starts, check their status before requesting another test.
- Meta authorization, private account settings, API keys/secrets, customer Memory,
  file attachments and payments happen on their websites, not inside model prompts.
- The current hosted server also exposes `buy_credits`, returning a hosted Razorpay
  link for a credit pack or monthly plan. This public client does not remove or
  hide that paid-service capability.

## Publishing is separate from packaging

This shared package is **not ready for ChatGPT public-directory submission**:
the current hosted server exposes digital-credit checkout and plan promotions.
OpenAI's current rules prohibit those purchase flows, including direct links to
transactional pages. Open-sourcing the client does not remove that blocker or make a Billing
redirect an exemption. Resolve it before submitting the ChatGPT integration.

Prepare reviewer access to an isolated, approved demo business, sample data,
working sign-in instructions, example prompts and a demo recording. Put reviewer
credentials only in the platform's secure reviewer fields, never this package.
Use the existing logo; privacy and terms links are below. Supply the real support
contact when the listing asks for it; do not invent one.

- **Claude:** submit the hosted MCP URL, or an approved plugin-repository location,
  through its directory portal. A local plugin is not a directory approval.
- **ChatGPT:** use **With MCP** and the hosted HTTPS endpoint in OpenAI Platform
  Plugins, upload the package ZIP, complete publisher and domain verification,
  connect OAuth, scan tools and resolve review findings. Private import isn't approval.
- **Grok Bot:** the submission form accepts **an MCP server URL or public repository**.
  Use this public client repository and disclose the hosted MCP URL, browser OAuth
  and separate paid-credit service. Local checks and actual in-app testing are
  required. This repository does not claim approval of the paid-service model.
- **Cursor:** the root Agent Plugins manifest is a supported format, and this
  client is MIT-licensed. No Cursor marketplace submission or approval is claimed.

Official references (requirements can change):
- [Claude directory submission](https://claude.com/resources/articles/build-plugins-for-claude)
- [OpenAI packaging](https://developers.openai.com/plugins/build/plugins)
- [OpenAI submission](https://developers.openai.com/plugins/deploy/submission)
- [OpenAI commerce rules](https://developers.openai.com/plugins/plugin-guidelines#commerce-and-monetization)
- [Grok Bot / Cursor submission](https://x.ai/bot/marketplace/submit-a-plugin)
- [Cursor plugin formats](https://cursor.com/docs/reference/plugins)

## Develop and verify

Node 22.13 or later; no dependency installation is needed for this package.

```bash
git clone https://github.com/jubsnfzm/iris-plugin.git
cd iris-plugin
npm run sync
npm run check
npm test
# Optional, if Claude Code is installed:
claude plugin validate --strict --json .
```

The package tests check shared metadata, synchronized adapters, the skill and logo,
the complete MIT license, an exact file boundary (excluding local Git metadata),
and an isolated copy including paths with spaces. They deliberately reject an
extra private-config file, changed license, symlink and stale adapter.
Claude validation checks structure, not sign-in or a
model workflow. The private server has separate OAuth/protocol/tool integration
tests; no passing automated test proves installation works in every live app.

Before publishing, test fresh sign-in, tools, onboarding, skills, a real agent
test reply, reconnect and revoked access in **each target app**. Resolve live
Cloudflare/network restrictions. Do not claim those checks or directory approvals
based only on these package tests. No live deployment or submission is performed
by `sync`, `check` or `test`.

## Ownership and distribution

This client package is licensed under the **MIT License** in [LICENSE](LICENSE).
The `private: true` npm setting only prevents accidental npm publication; it does
not change the open-source license. Flowlith and Iris names and logos identify
the service; the MIT license does not grant trademark rights or imply endorsement.

This folder contains only client metadata, a skill, a logo and development checks.
It has no Cloudflare bindings, backend source, customer data or credentials. Do not
publish the surrounding private repository or its Git history. Copying this
package does not make the hosted service self-hostable or grant rights to its
private server, control plane or execution plane. Service use remains subject to
the linked terms and privacy policy.

For client-package bugs, [open an issue](https://github.com/jubsnfzm/iris-plugin/issues).
Never include credentials, login codes, account records or customer conversations
in public issues.

[Website](https://www.flowlith.com) · [Privacy](https://www.flowlith.com/privacy) ·
[Terms](https://www.flowlith.com/terms)
