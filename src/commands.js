const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { ASSET_TYPE_CHOICES } = require("./services/roblox");
const { Paginator } = require("./utils/paginator");
const { storePaginator } = require("./interactions/pagination");
const { robloxCommandBuilder, handleRobloxCommand } = require("./roblox_commands");

const UI_COLORS = {
  neutral: 0x475569,
  profile: 0x2563eb,
  social: 0x0f766e,
  list: 0x4f46e5,
  warning: 0xea580c,
};

const ITEMS_PER_PAGE = 10;

function withInstallContexts(builder) {
  return builder.setIntegrationTypes(0, 1).setContexts(0, 1, 2);
}

function safeLimit(value, fallback = 10, min = 1, max = 100) {
  if (!value) return fallback;
  return Math.max(min, Math.min(max, value));
}

function truncate(value, max = 1024) {
  if (!value) return "-";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 3)}...`;
}

function toLines(items, mapper) {
  if (!items.length) return "No results found.";
  return items.map(mapper).join("\n");
}

function makeEmbed({ title, color = UI_COLORS.neutral, description, footer }) {
  const embed = new EmbedBuilder().setTitle(title).setColor(color).setTimestamp(new Date());

  if (description) embed.setDescription(truncate(description));
  if (footer) embed.setFooter({ text: footer });

  return embed;
}

async function resolveUserBundle(roblox, username) {
  const resolved = await roblox.resolveUserByUsername(username);
  const [details, avatar] = await Promise.all([
    roblox.getUserDetails(resolved.id),
    roblox.getAvatarHeadshot(resolved.id),
  ]);
  return { resolved, details, avatar };
}

function applyAvatar(embed, avatarUrl) {
  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }
  return embed;
}

const commandBuilders = [
  robloxCommandBuilder(),

  withInstallContexts(
    new SlashCommandBuilder().setName("ping").setDescription("Replies with Pong!")
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxid")
      .setDescription("Get the Roblox user ID for a username")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxprofile")
      .setDescription("Get Roblox profile details by username")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxavatar")
      .setDescription("Get Roblox avatar thumbnail")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxwearing")
      .setDescription("See what a user is currently wearing")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxsocial")
      .setDescription("Get Roblox social counts")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxfriends")
      .setDescription("List Roblox friends")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many results total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxfollowers")
      .setDescription("List Roblox followers")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many results total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxfollowing")
      .setDescription("List Roblox following")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many results total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxgroups")
      .setDescription("List Roblox groups and roles")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many groups total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxgroupinfo")
      .setDescription("Get details for a Roblox group")
      .addStringOption((option) =>
        option.setName("group_id").setDescription("Roblox group ID").setRequired(true)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxgroupmembers")
      .setDescription("List members in a Roblox group")
      .addStringOption((option) =>
        option.setName("group_id").setDescription("Roblox group ID").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many members total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxbadges")
      .setDescription("List Roblox badges for a user")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many badges total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxinventory")
      .setDescription("List inventory items in a category")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addStringOption((option) => {
        let built = option
          .setName("category")
          .setDescription("Inventory category")
          .setRequired(true);

        for (const choice of ASSET_TYPE_CHOICES) {
          built = built.addChoices({ name: choice.name, value: String(choice.id) });
        }

        return built;
      })
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many items total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
      .addBooleanOption((option) =>
        option
          .setName("offsales_only")
          .setDescription("Show only currently offsale items")
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxoffsales")
      .setDescription("Scan all categories and list offsale items")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many offsale items total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxlimiteds")
      .setDescription("List limiteds owned by a user")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many limiteds total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxgiftcardtoys")
      .setDescription("Find likely gift card / toy code items")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many matches total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxoutfits")
      .setDescription("List saved Roblox outfits")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many outfits total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxgames")
      .setDescription("List public Roblox games created by a user")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many games total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxusernamehistory")
      .setDescription("Show Roblox username history")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addIntegerOption((option) =>
        option
          .setName("limit")
          .setDescription("How many names total (1-50)")
          .setMinValue(1)
          .setMaxValue(50)
      )
  ),

  withInstallContexts(
    new SlashCommandBuilder()
      .setName("robloxowns")
      .setDescription("Check whether a user owns a specific asset")
      .addStringOption((option) =>
        option.setName("username").setDescription("Roblox username").setRequired(true)
      )
      .addStringOption((option) =>
        option.setName("asset_id").setDescription("Roblox asset ID").setRequired(true)
      )
  ),
];

function createListEmbed(items, pageInfo, { title, color }) {
  const itemLines = toLines(items, (item) => {
    if (typeof item === "string") return item;
    return item;
  });

  const footer = `Page ${pageInfo.current}/${pageInfo.total} • ${pageInfo.totalItems} total`;
  return makeEmbed({ title, color, description: itemLines, footer });
}

async function sendPaginatedReply(interaction, paginator, renderPage) {
  const currentItems = paginator.getCurrentPageItems();
  const pageInfo = paginator.getPageInfo();
  const embed = renderPage(currentItems, pageInfo);
  const buttons = paginator.getButtons();
  const response = await interaction.editReply({ embeds: [embed], components: [buttons] });
  storePaginator(response.id, { paginator, renderPage });
}

async function handleCommand(interaction, { roblox, robloxApi }) {
  const command = interaction.commandName;

  if (command === "roblox") {
    return handleRobloxCommand(interaction, {
      robloxApi,
    });
  }

  if (command === "ping") {
    await interaction.reply("Pong!");
    return true;
  }

  if (!command.startsWith("roblox")) {
    return false;
  }

  if (command === "robloxid") {
    await interaction.deferReply();
    const username = interaction.options.getString("username", true).trim();
    const userId = await roblox.resolveUserIdByUsername(username);

    const embed = makeEmbed({
      title: `User ID Lookup`,
      color: UI_COLORS.profile,
      description: `Username: **${username}**\nUser ID: **${userId}**`,
    });

    await interaction.editReply({ embeds: [embed] });
    return true;
  }

  if (command === "robloxgroupinfo") {
    await interaction.deferReply();
    const groupIdRaw = interaction.options.getString("group_id", true).trim();
    const groupId = Number(groupIdRaw);

    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw Object.assign(new Error("Invalid group id"), {
        userMessage: "Please provide a valid positive group ID.",
      });
    }

    const group = await roblox.getGroupInfo(groupId);
    const embed = makeEmbed({
      title: `${group.name} (Group ${group.id})`,
      color: UI_COLORS.profile,
      description: group.description ? truncate(group.description) : "No description.",
      footer: `Members: ${group.memberCount || "N/A"} • Public Entry: ${group.publicEntryAllowed ? "Yes" : "No"}`,
    }).setURL(`https://www.roblox.com/groups/${group.id}`);

    await interaction.editReply({ embeds: [embed] });
    return true;
  }

  if (command === "robloxgroupmembers") {
    await interaction.deferReply();
    const groupIdRaw = interaction.options.getString("group_id", true).trim();
    const limit = safeLimit(interaction.options.getInteger("limit"), 30, 1, 50);
    const groupId = Number(groupIdRaw);

    if (!Number.isInteger(groupId) || groupId <= 0) {
      throw Object.assign(new Error("Invalid group id"), {
        userMessage: "Please provide a valid positive group ID.",
      });
    }

    const group = await roblox.getGroupInfo(groupId);
    const members = await roblox.getGroupMembers(groupId, limit);
    const paginator = new Paginator(members, ITEMS_PER_PAGE);
    const renderPage = (pageItems, pageInfo) => {
      const startIndex = (pageInfo.current - 1) * ITEMS_PER_PAGE;
      const itemLines = toLines(pageItems, (member, index) => {
        return `${startIndex + index + 1}. [${member.user?.displayName || member.user?.username || "Unknown"}](https://www.roblox.com/users/${member.user?.userId || "0"}/profile) • ${member.role?.name || "Unknown Role"}`;
      });

      return makeEmbed({
        title: `Members: ${group.name}`,
        color: UI_COLORS.list,
        description: itemLines,
        footer: `Page ${pageInfo.current}/${pageInfo.total} • ${pageInfo.totalItems} total members`,
      });
    };

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  const username = interaction.options.getString("username", true).trim();
  await interaction.deferReply();

  if (command === "robloxprofile") {
    const { details, avatar } = await resolveUserBundle(roblox, username);
    const social = await roblox.getSocialCounts(details.id);

    const embed = makeEmbed({
      title: `${details.displayName} (@${details.name})`,
      color: UI_COLORS.profile,
      footer: `Created ${roblox.formatDate(details.created)}`,
    })
      .setURL(`https://www.roblox.com/users/${details.id}/profile`)
      .addFields(
        { name: "User ID", value: String(details.id), inline: true },
        { name: "Banned", value: details.isBanned ? "Yes" : "No", inline: true },
        { name: "Friends", value: String(social.friends ?? "N/A"), inline: true },
        { name: "Followers", value: String(social.followers ?? "N/A"), inline: true },
        { name: "Following", value: String(social.following ?? "N/A"), inline: true }
      );

    if (details.description && details.description.trim()) {
      embed.addFields({ name: "Bio", value: truncate(details.description.trim()) });
    }

    await interaction.editReply({ embeds: [applyAvatar(embed, avatar)] });
    return true;
  }

  if (command === "robloxavatar") {
    const { details, avatar } = await resolveUserBundle(roblox, username);

    const embed = makeEmbed({
      title: `Avatar: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.profile,
      description: `[Open Profile](https://www.roblox.com/users/${details.id}/profile)`,
    });

    await interaction.editReply({ embeds: [applyAvatar(embed, avatar)] });
    return true;
  }

  if (command === "robloxwearing") {
    const { details, avatar } = await resolveUserBundle(roblox, username);
    const wearing = await roblox.getCurrentlyWearing(details.id);

    const accessoryNames = wearing.accessories
      .map((acc, idx) => `${idx + 1}. ${acc.name || "Unknown Accessory"}`)
      .join("\n");

    const embed = makeEmbed({
      title: `Currently Wearing: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.profile,
      description: accessoryNames || "Not wearing any accessories.",
    });

    await interaction.editReply({ embeds: [applyAvatar(embed, avatar)] });
    return true;
  }

  if (command === "robloxsocial") {
    const { details, avatar } = await resolveUserBundle(roblox, username);
    const social = await roblox.getSocialCounts(details.id);

    const embed = makeEmbed({
      title: `Social: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.social,
    }).addFields(
      { name: "Friends", value: String(social.friends ?? "N/A"), inline: true },
      { name: "Followers", value: String(social.followers ?? "N/A"), inline: true },
      { name: "Following", value: String(social.following ?? "N/A"), inline: true }
    );

    await interaction.editReply({ embeds: [applyAvatar(embed, avatar)] });
    return true;
  }

  // List-heavy commands with pagination
  const limit = safeLimit(interaction.options.getInteger("limit"), 30, 1, 50);

  if (command === "robloxfriends") {
    const { details } = await resolveUserBundle(roblox, username);
    const users = await roblox.getFriends(details.id, limit);
    const paginator = new Paginator(
      users.map(
        (user) =>
          `[${user.displayName} (@${user.name})](https://www.roblox.com/users/${user.id}/profile)`
      ),
      ITEMS_PER_PAGE
    );

    const renderPage = (pageItems, pageInfo) => createListEmbed(pageItems, pageInfo, {
      title: `Friends: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.list,
    });

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  if (command === "robloxfollowers") {
    const { details } = await resolveUserBundle(roblox, username);
    const users = await roblox.getFollowers(details.id, limit);
    const paginator = new Paginator(
      users.map(
        (user) =>
          `[${user.displayName} (@${user.name})](https://www.roblox.com/users/${user.id}/profile)`
      ),
      ITEMS_PER_PAGE
    );

    const renderPage = (pageItems, pageInfo) => createListEmbed(pageItems, pageInfo, {
      title: `Followers: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.list,
    });

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  if (command === "robloxfollowing") {
    const { details } = await resolveUserBundle(roblox, username);
    const users = await roblox.getFollowing(details.id, limit);
    const paginator = new Paginator(
      users.map(
        (user) =>
          `[${user.displayName} (@${user.name})](https://www.roblox.com/users/${user.id}/profile)`
      ),
      ITEMS_PER_PAGE
    );

    const renderPage = (pageItems, pageInfo) => createListEmbed(pageItems, pageInfo, {
      title: `Following: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.list,
    });

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  if (command === "robloxgroups") {
    const { details } = await resolveUserBundle(roblox, username);
    const groups = await roblox.getGroups(details.id);
    const paginator = new Paginator(
      groups.map(
        (groupEntry) =>
          `[${groupEntry.group.name}](https://www.roblox.com/groups/${groupEntry.group.id}) • ${groupEntry.role.name}`
      ),
      ITEMS_PER_PAGE
    );

    const renderPage = (pageItems, pageInfo) => createListEmbed(pageItems, pageInfo, {
      title: `Groups: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.list,
    });

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  if (command === "robloxbadges") {
    const { details } = await resolveUserBundle(roblox, username);
    const badges = await roblox.getBadges(details.id, limit);
    const paginator = new Paginator(
      badges.map((badge) => badge.name || "Unnamed Badge"),
      ITEMS_PER_PAGE
    );

    const renderPage = (pageItems, pageInfo) => createListEmbed(pageItems, pageInfo, {
      title: `Badges: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.list,
    });

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  if (command === "robloxinventory") {
    const offsalesOnly = interaction.options.getBoolean("offsales_only") || false;
    const categoryRaw = interaction.options.getString("category", true);
    const assetTypeId = Number(categoryRaw);
    const categoryName = ASSET_TYPE_CHOICES.find((choice) => choice.id === assetTypeId)?.name || "Unknown";

    const { details } = await resolveUserBundle(roblox, username);
    const inventory = await roblox.getInventoryWithSaleInfo(details.id, assetTypeId, Math.max(limit, 25));
    const filtered = offsalesOnly
      ? inventory.filter((item) => item.catalogDetail?.priceStatus === "Off Sale")
      : inventory;

    const paginator = new Paginator(
      filtered.map((item) => {
        const itemId = item.assetId || item.id;
        const marker = item.catalogDetail?.priceStatus === "Off Sale" ? " • Offsale" : "";
        return `[${item.name}](https://www.roblox.com/catalog/${itemId})${marker}`;
      }),
      ITEMS_PER_PAGE
    );

    const renderPage = (pageItems, pageInfo) => createListEmbed(pageItems, pageInfo, {
      title: `Inventory: ${details.displayName} (@${details.name}) • ${categoryName}`,
      color: UI_COLORS.list,
    });

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  if (command === "robloxoffsales") {
    const { details } = await resolveUserBundle(roblox, username);
    const items = await roblox.getAllOffsalesAcrossCategories(details.id, limit);
    const paginator = new Paginator(
      items.map((item) => {
        const itemId = item.assetId || item.id;
        const category = item.categoryName || "Unknown";
        return `[${item.name}](https://www.roblox.com/catalog/${itemId}) • ${category}`;
      }),
      ITEMS_PER_PAGE
    );

    const renderPage = (pageItems, pageInfo) => createListEmbed(pageItems, pageInfo, {
      title: `All Offsales: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.warning,
    });

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  if (command === "robloxlimiteds") {
    const { details } = await resolveUserBundle(roblox, username);
    const items = await roblox.getCollectibles(details.id, limit);
    const paginator = new Paginator(
      items.map((item) => {
        const rap = item.recentAveragePrice ? ` • RAP ${item.recentAveragePrice}` : "";
        return `[${item.name}](https://www.roblox.com/catalog/${item.assetId})${rap}`;
      }),
      ITEMS_PER_PAGE
    );

    const renderPage = (pageItems, pageInfo) => createListEmbed(pageItems, pageInfo, {
      title: `Limiteds: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.warning,
    });

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  if (command === "robloxgiftcardtoys") {
    const { details } = await resolveUserBundle(roblox, username);
    const items = await roblox.getGiftcardToyLikeItems(details.id, limit);
    const paginator = new Paginator(
      items.map((item) => {
        const itemId = item.assetId || item.id;
        return `[${item.name}](https://www.roblox.com/catalog/${itemId})`;
      }),
      ITEMS_PER_PAGE
    );

    const renderPage = (pageItems, pageInfo) => createListEmbed(pageItems, pageInfo, {
      title: `Giftcard/Toy-like: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.warning,
    });

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  if (command === "robloxoutfits") {
    const { details } = await resolveUserBundle(roblox, username);
    const outfits = await roblox.getOutfits(details.id, limit);
    const paginator = new Paginator(
      outfits.map((outfit) => `${outfit.name || "Unnamed Outfit"} (ID ${outfit.id})`),
      ITEMS_PER_PAGE
    );

    const renderPage = (pageItems, pageInfo) => createListEmbed(pageItems, pageInfo, {
      title: `Outfits: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.list,
    });

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  if (command === "robloxgames") {
    const { details } = await resolveUserBundle(roblox, username);
    const games = await roblox.getUserGames(details.id, limit);
    const paginator = new Paginator(
      games.map((game) => {
        const placeId = game.rootPlace?.id;
        const link = placeId ? `https://www.roblox.com/games/${placeId}` : null;
        return link ? `[${game.name}](${link})` : game.name || "Unnamed Game";
      }),
      ITEMS_PER_PAGE
    );

    const renderPage = (pageItems, pageInfo) => createListEmbed(pageItems, pageInfo, {
      title: `Games: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.list,
    });

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  if (command === "robloxusernamehistory") {
    const { details } = await resolveUserBundle(roblox, username);
    const names = await roblox.getUsernameHistory(details.id, limit);
    const paginator = new Paginator(
      names.map((entry) => entry.name),
      ITEMS_PER_PAGE
    );

    const renderPage = (pageItems, pageInfo) => createListEmbed(pageItems, pageInfo, {
      title: `Username History: ${details.displayName} (@${details.name})`,
      color: UI_COLORS.list,
    });

    await sendPaginatedReply(interaction, paginator, renderPage);
    return true;
  }

  if (command === "robloxowns") {
    const assetId = interaction.options.getString("asset_id", true).trim();
    const { details } = await resolveUserBundle(roblox, username);
    const owns = await roblox.userOwnsAsset(details.id, assetId);

    const embed = makeEmbed({
      title: `Ownership Check: ${details.displayName} (@${details.name})`,
      color: owns ? UI_COLORS.social : UI_COLORS.warning,
      description: `Asset ${assetId}: ${owns ? "✓ Owned" : "✗ Not Owned"}`,
    });

    await interaction.editReply({ embeds: [embed] });
    return true;
  }

  return false;
}

module.exports = {
  commandBuilders,
  handleCommand,
};
