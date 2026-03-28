# Discord Bot Starter

A minimal Discord bot built with Node.js and `discord.js`.

## Features

- Logs in and reports when ready
- Expanded Roblox command suite with profile, social, groups, badges, inventory, limiteds, all-category offsales, games, outfits, username history, ownership checks, and toy/giftcard-like lookup
- User-install and server-install slash command contexts

## Setup

1. Create a Discord application and bot in the Discord Developer Portal.
2. Copy your bot token.
4. In this project, create a `.env` file based on `.env.example`:

   ```bash
   cp .env.example .env
   ```

5. Set your token in `.env`:

   ```
   DISCORD_TOKEN=your_real_bot_token
   DISCORD_CLIENT_ID=your_application_id
   DISCORD_PUBLIC_KEY=your_public_key
   DISCORD_CLIENT_SECRET=your_client_secret
   DISCORD_GUILD_ID=your_server_id_optional
   ```

   With your values:

   ```
   DISCORD_CLIENT_ID=1487358197302951946
   DISCORD_PUBLIC_KEY=510e5007c6529b6eb79a52a621b04806cd88b452ba023a0d8ee2c2ba8bfa691a
   ```

6. Register slash commands:

   ```bash
   npm run deploy-commands
   ```

   Notes:
   - If `DISCORD_GUILD_ID` is set, commands are registered to that server and appear almost instantly.
   - If `DISCORD_GUILD_ID` is not set, commands are global and can take up to 1 hour to appear.

7. Start the bot:

   ```bash
   npm start
   ```

## Commands

### Info
- `/ping` — Health check, responds with "Pong!"
- `/robloxid username:<roblox_username>` — Resolve username to Roblox user ID
- `/robloxprofile username:<roblox_username>` — Full profile with created date, ID, ban status, and bios
- `/robloxavatar username:<roblox_username>` — Avatar thumbnail
- `/robloxwearing username:<roblox_username>` — Currently equipped accessories

### Social
- `/robloxsocial username:<roblox_username>` — Friends, followers, following counts
- `/robloxfriends username:<roblox_username> [limit]` — Friend list with pagination
- `/robloxfollowers username:<roblox_username> [limit]` — Followers list with pagination
- `/robloxfollowing username:<roblox_username> [limit]` — Following list with pagination

### Groups
- `/robloxgroups username:<roblox_username> [limit]` — Group list with roles and pagination
- `/robloxgroupinfo group_id:<roblox_group_id>` — Group details (description, member count, public entry)
- `/robloxgroupmembers group_id:<roblox_group_id> [limit]` — Group member list with pagination

### Achievements
- `/robloxbadges username:<roblox_username> [limit]` — Badge list with pagination

### Inventory & Collection
- `/robloxinventory username:<roblox_username> category:<asset_type> [limit] [offsales_only]` — Inventory by category with offsale filtering and pagination
- `/robloxoffsales username:<roblox_username> [limit]` — All offsale items across categories with pagination
- `/robloxlimiteds username:<roblox_username> [limit]` — Collectible trading cards/limiteds with RAP and pagination
- `/robloxgiftcardtoys username:<roblox_username> [limit]` — Gift card and toy-code matching items with pagination

### Creation & Customization
- `/robloxoutfits username:<roblox_username> [limit]` — Saved outfit list with pagination
- `/robloxgames username:<roblox_username> [limit]` — User-created public games with pagination
- `/robloxusernamehistory username:<roblox_username> [limit]` — Name change history with pagination

### Utility
- `/robloxowns username:<roblox_username> asset_id:<roblox_asset_id>` — Check if user owns an asset

## Coverage Notes

- The bot now covers a broad set of callable public Roblox user data endpoints.
- Some Roblox data is privacy-gated by user settings (for example inventory/limiteds can be private).
- `robloxoffsales` scans multiple inventory categories and returns offsale matches.
- `robloxgiftcardtoys` uses a keyword heuristic because Roblox does not provide a single official gift-card ownership flag endpoint.
- All list-heavy commands (`friends`, `followers`, `groups`, `badges`, etc.) support interactive pagination with prev/next buttons, 10 items per page.

## Production Deployment

### 24/7 Cloud Runtime (Recommended)

Use Render worker deployment so the bot runs even when your PC is off.

1. Push this repo to GitHub.
2. In Render, create a Blueprint from the repo.
3. Render auto-detects [render.yaml](render.yaml).
4. Set required env vars (`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_PUBLIC_KEY`, `DISCORD_CLIENT_SECRET`).
5. Deploy and verify logs show `Logged in as ...`.

Full guide: [DEPLOY_24_7.md](DEPLOY_24_7.md)

### Docker (Recommended)

Build the image:
```bash
docker build -t roblox-discord-bot .
```

Run the container with environment variables:
```bash
docker run -d \
  -e DISCORD_TOKEN="your_token" \
  -e DISCORD_CLIENT_ID="your_client_id" \
  -e DISCORD_PUBLIC_KEY="your_public_key" \
  -e DISCORD_CLIENT_SECRET="your_client_secret" \
  --restart unless-stopped \
  --name roblox-bot \
  roblox-discord-bot
```

View logs:
```bash
docker logs -f roblox-bot
```

Stop the bot:
```bash
docker stop roblox-bot
```

### PM2 (Process Manager)

Install PM2 globally:
```bash
npm install -g pm2
```

Start the bot with PM2:
```bash
pm2 start ecosystem.config.js
```

View logs:
```bash
pm2 logs roblox-discord-bot
```

Restart the bot:
```bash
pm2 restart roblox-discord-bot
```

Set up auto-start on system reboot:
```bash
pm2 startup
pm2 save
```

### Heroku

1. Create a Heroku account and install the Heroku CLI.
2. Create a new Heroku app:
   ```bash
   heroku create your-app-name
   ```

3. Set environment variables:
   ```bash
   heroku config:set DISCORD_TOKEN="your_token"
   heroku config:set DISCORD_CLIENT_ID="your_client_id"
   heroku config:set DISCORD_PUBLIC_KEY="your_public_key"
   heroku config:set DISCORD_CLIENT_SECRET="your_client_secret"
   ```

4. Deploy:
   ```bash
   git push heroku main
   ```

### Railway / Self-Hosted VPS

**Railway:**
1. Connect your GitHub repo to Railway.
2. Set environment variables in the Railway dashboard.
3. Railway auto-detects `Procfile` and starts the bot.

**Self-Hosted (Ubuntu/Debian):**
1. Clone the repo and install Node.js 20+.
2. Run:
   ```bash
   npm ci --production
   npm run deploy-commands  # One-time setup
   npm start  # OR use PM2 for auto-restart
   ```

### Environment Variables

Required:
- `DISCORD_TOKEN` — Bot token from Discord Developer Portal
- `DISCORD_CLIENT_ID` — Application ID
- `DISCORD_PUBLIC_KEY` — Public key
- `DISCORD_CLIENT_SECRET` — Client secret

Optional:
- `DISCORD_GUILD_ID` — If set, commands deploy to this guild only (instant). If unset, global deployment (up to 1 hour propagation).
- `NODE_ENV` — Set to `production` in production environments.

### Monitoring & Health Checks

- The Docker image includes a health check (30-second interval) that verifies the bot process is alive.
- PM2 auto-restarts the bot if it crashes (max 5 retarts before backing off).
- Logs are written to `logs/` directory if using PM2.

## Coverage Notes

- The bot now covers a broad set of callable public Roblox user data endpoints.
- Some Roblox data is privacy-gated by user settings (for example inventory/limiteds can be private).
- `robloxoffsales` scans multiple inventory categories and returns offsale matches.
- `robloxgiftcardtoys` uses a keyword heuristic because Roblox does not provide a single official gift-card ownership flag endpoint.
- All list-heavy commands (`friends`, `followers`, `groups`, `badges`, etc.) support interactive pagination with prev/next buttons, 10 items per page.

## Invite Bot to Server

When generating an OAuth2 URL in Discord Developer Portal:

- Scopes: `bot`, `applications.commands`
- Bot Permissions: `Send Messages`, `Read Message History`, `View Channels`

Then open the generated URL and add the bot to your server.

Direct invite URL template with your Application ID:

```text
https://discord.com/api/oauth2/authorize?client_id=1487358197302951946&permissions=274877907968&scope=bot%20applications.commands
```