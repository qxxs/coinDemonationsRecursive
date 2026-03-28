require("dotenv").config();
const { REST, Routes } = require("discord.js");
const { commandBuilders } = require("./commands");

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.DISCORD_CLIENT_ID;
const guildId = process.env.DISCORD_GUILD_ID;

if (!token || !clientId) {
  console.error("Missing DISCORD_TOKEN or DISCORD_CLIENT_ID in environment.");
  process.exit(1);
}

const commands = commandBuilders.map((builder) => builder.toJSON());

const rest = new REST({ version: "10" }).setToken(token);

async function deployCommands() {
  try {
    if (guildId) {
      console.log(`Deploying guild commands to ${guildId}...`);
      await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
        body: commands,
      });
      console.log("Guild slash commands deployed.");
      return;
    }

    console.log("Deploying global application commands...");
    await rest.put(Routes.applicationCommands(clientId), {
      body: commands,
    });
    console.log("Global slash commands deployed. These can take up to 1 hour to show.");
  } catch (error) {
    console.error("Failed to deploy commands:", error);
    process.exit(1);
  }
}

deployCommands();