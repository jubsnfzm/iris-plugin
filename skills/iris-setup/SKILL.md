---
name: iris-setup
description: Set up or manage Iris (Flowlith's AI agent for a business's Instagram, WhatsApp, Messenger and website chats). Use when the user wants to onboard their business to Iris, check its status, change what Iris knows, teach it, launch it, test it, or buy credits.
---

# Iris setup

The `iris` MCP server does the work; this skill is how to talk to the owner while using it.

1. Call `list_businesses` first.
   - No business: run onboarding (step 2).
   - Has one: call `get_business_status` and walk through its `next_steps`.
2. Onboarding: call `get_onboarding_questions`, then go through it as a conversation.
   - Ask the business name, location and website, then the owner's name and how Flowlith should contact them (WhatsApp with country code, or a LinkedIn username).
   - Ask each setup question **one at a time**. Show the choices as a short numbered list, mention `max_choices` when it is set, and offer the follow-up hint as an optional extra.
   - Save after every answer with `save_onboarding_answers`. Map numbers the owner types back to the choice text; put anything in their own words into `details`.
   - Ask where Iris should answer customers (`channels`).
   - Summarise everything. Share https://www.flowlith.com/terms and https://www.flowlith.com/privacy. Call `submit_onboarding` only after the owner clearly agrees.
3. Browser steps: `connect_channel` returns a dashboard link. `buy_credits` returns a Razorpay payment link (valid 24 hours) for a pack or the monthly plan. Give the link, wait for the owner to say they're done, then check `get_business_status` or `get_credits`. Credits can take a minute to appear. Never ask for card numbers, UPI PINs, passwords or Meta tokens.
4. Skills (how Iris handles a specific job, e.g. delivery questions):
   - Call `get_skill_questions`, ask each question ONE at a time, then call `preview_skill` and ask whatever it says is missing.
   - Show the owner the full preview. Save with `save_skill` and the preview's `preview_id` only after they approve; any change needs a new preview.
   - Never invent rules, prices or promises. If the server refuses text (a secret, or something unsafe), explain why and help rephrase.
   - Documents and API keys for a skill: send the `open_dashboard` page `teach` link.
   Settings, customer Memory, website API keys, data export and account deletion are browser-only: send the matching `open_dashboard` link.
5. Ask before changing anything customers will see: `update_business_info` (show the new text first), `launch_agent`, `save_skill`, `remove_skill`.
6. After launch, offer `test_agent` with a realistic customer question. Mention that it uses 1 credit.

Keep replies short and plain. If a tool returns an error, explain it in one sentence and say what to do next.
