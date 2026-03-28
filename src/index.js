require("dotenv").config();
const http = require("node:http");
const { Client, GatewayIntentBits, Events } = require("discord.js");
const { createRobloxService } = require("./services/roblox");
const { RobloxAPI } = require("./services/roblox_api");
const { handleCommand } = require("./commands");
const { handlePaginationButton } = require("./interactions/pagination");

const token = process.env.DISCORD_TOKEN;
const port = Number(process.env.PORT || 0);

if (!token) {
  console.error("Missing DISCORD_TOKEN in environment.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});
const roblox = createRobloxService();
const robloxApi = new RobloxAPI({ cookie: process.env.ROBLOX_COOKIE || null });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isButton()) {
    const handled = await handlePaginationButton(interaction);
    if (!handled) {
      await interaction.deferUpdate().catch(() => {});
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;

  try {
    const handled = await handleCommand(interaction, { roblox, robloxApi });

    if (!handled && interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: "Unknown command.", ephemeral: true });
    }
  } catch (error) {
    // 10062 means the interaction token expired or was already acknowledged.
    if (error && error.code === 10062) {
      console.warn("Skipped stale interaction reply (code 10062).");
      return;
    }

    if (interaction.isRepliable()) {
      const content = error.userMessage || "Something went wrong while processing that command.";
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(content).catch(() => {});
      } else {
        await interaction.reply({ content, ephemeral: true }).catch(() => {});
      }
    }

    console.error("Interaction handling failed:", error);
  }
});

client.on(Events.Error, (error) => {
  console.error("Discord client error:", error);
});

// Render Web Services require an open port. For worker-style runs, PORT is usually unset.
if (Number.isInteger(port) && port > 0) {
  const server = http.createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "roblox-discord-bot" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is running.");
  });

  server.listen(port, () => {
    console.log(`Health server listening on port ${port}`);
  });
}

client.login(token);