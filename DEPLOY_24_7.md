# 24/7 Deployment (No PC Required)

This bot can run continuously on Render as a background worker.

## 1. Push Current Code

Make sure your latest code is in GitHub.

## 2. Create a Render Worker

1. Go to Render dashboard.
2. Click New + -> Blueprint.
3. Select this repository.
4. Render will detect `render.yaml` and create `roblox-discord-bot` as a worker.

## 3. Set Required Environment Variables

In the Render service settings, set:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_PUBLIC_KEY`
- `DISCORD_CLIENT_SECRET`

Optional:

- `DISCORD_GUILD_ID` (for instant guild command updates)
- `ROBLOX_COOKIE` (for auth-only Roblox endpoints like balances/transactions)

## 4. Deploy

Trigger deploy once env vars are set.

The worker start command is:

`npm run deploy-commands && npm start`

This means each restart re-publishes slash commands and then starts the bot.

## 5. Verify

Check worker logs for:

- command deploy success message
- `Logged in as ...`

Then run `/roblox user` in Discord.

## Notes

- If `DISCORD_GUILD_ID` is not set, commands deploy globally and may take up to an hour to appear.
- Render restarts workers automatically if they crash.
- Auto deploy is enabled on git push.

## Security

If bot secrets were ever exposed, rotate them immediately in the Discord Developer Portal and update Render env vars.
