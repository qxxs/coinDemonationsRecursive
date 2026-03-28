const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { RobloxAPI, ASSET_TYPE_MAP } = require("./services/roblox_api");
const { storePaginator } = require("./interactions/pagination");
const {
  RobloxPaginator,
  PREV_ID,
  NEXT_ID,
  makeFooter,
} = require("./utils/roblox_paginator");

const ROBLOX_LOGO = "https://images.rbxcdn.com/e01635a51df65e98b28ee3c6ed0b8f55.png";

const COLORS = {
  user: 0x00b2ff,
  game: 0x02b757,
  asset: 0xff6b35,
  group: 0x9b59b6,
  error: 0xff0000,
};

const inventoryChoices = [
  "shirts",
  "pants",
  "hats",
  "faces",
  "gear",
  "badges",
  "gamepasses",
  "places",
  "accessories",
  "hair",
  "heads",
  "torsos",
  "leftarm",
  "rightarm",
  "leftleg",
  "rightleg",
  "packages",
  "emotes",
  "animations",
  "all",
];

function withInstallContexts(builder) {
  return builder.setIntegrationTypes(0, 1).setContexts(0, 1, 2);
}

function nowStamp() {
  return formatDate(new Date().toISOString());
}

function formatDate(isoDate) {
  if (!isoDate) return "Unknown";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date);
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "N/A";
  return num.toLocaleString("en-US");
}

function toLimitText(text, max = 1024) {
  if (!text) return "-";
  const str = String(text);
  return str.length <= max ? str : `${str.slice(0, max - 3)}...`;
}

function baseEmbed(title, color, timestampText, pageInfo = null) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp(new Date())
    .setAuthor({ name: "Roblox Data", iconURL: ROBLOX_LOGO });

  if (pageInfo) {
    embed.setFooter({ text: makeFooter(timestampText, pageInfo.current, pageInfo.total) });
  } else {
    embed.setFooter({ text: `Roblox Data • Fetched at ${timestampText}` });
  }

  return embed;
}

function errorEmbed(message, details) {
  const embed = baseEmbed("Roblox Error", COLORS.error, nowStamp());
  embed.setDescription(message || "Unknown error while fetching Roblox data.");
  if (details) embed.addFields({ name: "Details", value: toLimitText(details) });
  return embed;
}

function mapPresenceType(type) {
  const map = {
    0: "Offline",
    1: "Online",
    2: "In Game",
    3: "In Studio",
  };
  return map[type] || "Unknown";
}

function isClothingAsset(item) {
  const typeName = String(item.assetType || item.assetTypeName || item.itemType || "").toLowerCase();
  const sourceType = String(item.sourceAssetType || "").toLowerCase();
  return ["shirt", "pants", "t-shirt", "tshirt"].some((k) => typeName.includes(k) || sourceType.includes(k));
}

function extractThumbFromApiUrl(url) {
  if (!url) return null;
  const marker = "thumbnails.roblox.com/v1/assets?assetIds=";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const assetId = url.slice(idx + marker.length).split("&")[0];
  return `https://tr.rbxcdn.com/${assetId}/420/420/Image/Png`;
}

async function replyWithPagination(interaction, items, perPage, renderPage) {
  const paginator = new RobloxPaginator(items, perPage);
  const timestamp = nowStamp();

  const first = renderPage(paginator.pageItems(), {
    current: paginator.index + 1,
    total: paginator.totalPages,
    timestamp,
    paginator,
  });

  const reply = await interaction.editReply({
    embeds: first.embeds,
    components: items.length ? paginator.components() : [],
  });

  if (!items.length) return;

  storePaginator(reply.id, {
    async onButton(buttonInteraction, buttonId) {
      if (buttonId !== PREV_ID && buttonId !== NEXT_ID) return false;

      if (paginator.isExpired()) {
        await buttonInteraction.reply({
          embeds: [errorEmbed("This pagination session expired. Run the command again.")],
          ephemeral: true,
        });
        return true;
      }

      const moved = paginator.change(buttonId);
      if (!moved) {
        await buttonInteraction.deferUpdate();
        return true;
      }

      paginator.createdAt = Date.now();

      const rendered = renderPage(paginator.pageItems(), {
        current: paginator.index + 1,
        total: paginator.totalPages,
        timestamp,
        paginator,
      });

      await buttonInteraction.update({
        embeds: rendered.embeds,
        components: paginator.components(),
      });
      return true;
    },
  });
}

function asListOrDash(items, mapFn) {
  if (!items || !items.length) return "No results.";
  return items.map(mapFn).join("\n");
}

function commandBuilder() {
  const builder = withInstallContexts(
    new SlashCommandBuilder().setName("roblox").setDescription("Roblox profile, game, asset, and group lookups")
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("user")
      .setDescription("Lookup user profile summary")
      .addStringOption((opt) =>
        opt
          .setName("username_or_id")
          .setDescription("Roblox username or numeric user ID")
          .setRequired(true)
      )
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("user_avatar")
      .setDescription("Show avatar images and equipped items")
      .addStringOption((opt) => opt.setName("username_or_id").setDescription("Username or user ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("user_presence")
      .setDescription("Show live user presence status")
      .addStringOption((opt) => opt.setName("username_or_id").setDescription("Username or user ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("user_friends")
      .setDescription("List all friends, followers, and following")
      .addStringOption((opt) => opt.setName("username_or_id").setDescription("Username or user ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("user_groups")
      .setDescription("List groups and ranks for a user")
      .addStringOption((opt) => opt.setName("username_or_id").setDescription("Username or user ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("user_badges")
      .setDescription("List all badges earned by a user")
      .addStringOption((opt) => opt.setName("username_or_id").setDescription("Username or user ID").setRequired(true))
  );

  builder.addSubcommand((sub) => {
    const configured = sub
      .setName("user_inventory")
      .setDescription("List owned inventory items by type")
      .addStringOption((opt) => opt.setName("username_or_id").setDescription("Username or user ID").setRequired(true))
      .addStringOption((opt) => {
        let choiceOpt = opt.setName("asset_type").setDescription("Inventory asset type").setRequired(true);
        for (const choice of inventoryChoices) {
          choiceOpt = choiceOpt.addChoices({ name: choice, value: choice });
        }
        return choiceOpt;
      });

    return configured;
  });

  builder.addSubcommand((sub) =>
    sub
      .setName("user_outfits")
      .setDescription("List saved user outfits")
      .addStringOption((opt) => opt.setName("username_or_id").setDescription("Username or user ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("user_games")
      .setDescription("List games created by a user")
      .addStringOption((opt) => opt.setName("username_or_id").setDescription("Username or user ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("user_transactions")
      .setDescription("Show balance and recent transactions")
      .addStringOption((opt) => opt.setName("username_or_id").setDescription("Username or user ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("game")
      .setDescription("Lookup game data by place or universe ID")
      .addStringOption((opt) => opt.setName("place_id_or_universe_id").setDescription("Place ID or Universe ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("game_servers")
      .setDescription("List live public servers for a place")
      .addStringOption((opt) => opt.setName("place_id").setDescription("Roblox place ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("game_passes")
      .setDescription("List game passes for a universe")
      .addStringOption((opt) => opt.setName("universe_id").setDescription("Roblox universe ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("game_badges")
      .setDescription("List badges for a universe")
      .addStringOption((opt) => opt.setName("universe_id").setDescription("Roblox universe ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("game_social_links")
      .setDescription("List social links for a game")
      .addStringOption((opt) => opt.setName("universe_id").setDescription("Roblox universe ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("asset")
      .setDescription("Lookup detailed asset metadata")
      .addStringOption((opt) => opt.setName("asset_id").setDescription("Roblox asset ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("asset_search")
      .setDescription("Search Roblox catalog assets")
      .addStringOption((opt) => opt.setName("keyword").setDescription("Search keyword").setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName("category")
          .setDescription("Category filter")
          .addChoices(
            { name: "all", value: "all" },
            { name: "clothing", value: "Clothing" },
            { name: "accessories", value: "Accessories" },
            { name: "gear", value: "Gear" },
            { name: "packages", value: "Packages" }
          )
      )
      .addStringOption((opt) =>
        opt
          .setName("sort")
          .setDescription("Sort mode")
          .addChoices(
            { name: "relevance", value: "relevance" },
            { name: "mostFavorited", value: "mostFavorited" },
            { name: "bestseller", value: "bestseller" },
            { name: "recentlyUpdated", value: "recentlyUpdated" },
            { name: "priceAsc", value: "priceAsc" },
            { name: "priceDesc", value: "priceDesc" }
          )
      )
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("limited_sales")
      .setDescription("Show limited resale market data")
      .addStringOption((opt) => opt.setName("asset_id").setDescription("Limited asset ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("group")
      .setDescription("Lookup Roblox group details")
      .addStringOption((opt) => opt.setName("group_id").setDescription("Roblox group ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("group_roles")
      .setDescription("List all group roles and counts")
      .addStringOption((opt) => opt.setName("group_id").setDescription("Roblox group ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("group_members")
      .setDescription("List group members, optionally by role")
      .addStringOption((opt) => opt.setName("group_id").setDescription("Roblox group ID").setRequired(true))
      .addStringOption((opt) => opt.setName("role_id").setDescription("Optional role ID"))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("group_games")
      .setDescription("List games owned by a group")
      .addStringOption((opt) => opt.setName("group_id").setDescription("Roblox group ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("group_social_links")
      .setDescription("List social links for a group")
      .addStringOption((opt) => opt.setName("group_id").setDescription("Roblox group ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("badge")
      .setDescription("Lookup detailed badge info")
      .addStringOption((opt) => opt.setName("badge_id").setDescription("Roblox badge ID").setRequired(true))
  );

  builder.addSubcommand((sub) =>
    sub
      .setName("bundle")
      .setDescription("Lookup Roblox bundle data")
      .addStringOption((opt) => opt.setName("bundle_id").setDescription("Roblox bundle ID").setRequired(true))
  );

  return builder;
}

async function handleRobloxCommand(interaction, context = {}) {
  if (interaction.commandName !== "roblox") return false;

  const api = context.robloxApi || new RobloxAPI();
  const sub = interaction.options.getSubcommand(true);

  await interaction.deferReply();

  try {
    if (sub === "user") {
      const key = interaction.options.getString("username_or_id", true);
      const user = await api.resolveUser(key);
      const thumbs = await api.getUserAvatarThumbs(user.id);
      const embed = baseEmbed(`${user.displayName} (@${user.name})`, COLORS.user, nowStamp())
        .setURL(`https://www.roblox.com/users/${user.id}/profile`)
        .addFields(
          { name: "Display Name", value: user.displayName || "-", inline: true },
          { name: "Username", value: user.name || "-", inline: true },
          { name: "User ID", value: String(user.id), inline: true },
          { name: "Created", value: formatDate(user.created), inline: false },
          { name: "Banned", value: user.isBanned ? "Yes" : "No", inline: true },
          { name: "Verified Badge", value: user.hasVerifiedBadge ? "Yes" : "No", inline: true },
          { name: "Profile URL", value: `https://www.roblox.com/users/${user.id}/profile`, inline: false },
          { name: "Description", value: toLimitText(user.description || "No bio provided."), inline: false }
        );

      if (thumbs.avatar) embed.setImage(thumbs.avatar);
      await interaction.editReply({ embeds: [embed] });
      return true;
    }

    if (sub === "user_avatar") {
      const key = interaction.options.getString("username_or_id", true);
      const user = await api.resolveUser(key);
      const [thumbs, avatar] = await Promise.all([
        api.getUserAvatarThumbs(user.id),
        api.getAvatarDetails(user.id),
      ]);

      const equipped = asListOrDash(
        avatar.assets || [],
        (item) => `${item.name || "Unknown"} (${item.id || "N/A"})`
      );

      const bodyColors = avatar.bodyColors
        ? Object.entries(avatar.bodyColors)
            .map(([part, value]) => `${part}: ${value}`)
            .join("\n")
        : "No body color data";

      const embed = baseEmbed(`Avatar: ${user.displayName}`, COLORS.user, nowStamp())
        .addFields(
          { name: "Full Avatar", value: thumbs.avatar || "Unavailable", inline: false },
          { name: "Headshot", value: thumbs.headshot || "Unavailable", inline: false },
          { name: "Bust", value: thumbs.bust || "Unavailable", inline: false },
          { name: "Avatar Type", value: avatar.playerAvatarType || "Unknown", inline: true },
          {
            name: "Scales",
            value: avatar.scales
              ? `H:${avatar.scales.height} W:${avatar.scales.width} Head:${avatar.scales.head} D:${avatar.scales.depth} P:${avatar.scales.proportion} B:${avatar.scales.bodyType}`
              : "No scale data",
            inline: false,
          },
          { name: "Body Colors", value: toLimitText(bodyColors), inline: false },
          { name: "Equipped Items", value: toLimitText(equipped), inline: false }
        );

      if (thumbs.avatar) embed.setImage(thumbs.avatar);
      if (thumbs.headshot) embed.setThumbnail(thumbs.headshot);

      await interaction.editReply({ embeds: [embed] });
      return true;
    }

    if (sub === "user_presence") {
      const key = interaction.options.getString("username_or_id", true);
      const user = await api.resolveUser(key);
      const presence = await api.getPresence(user.id);

      const embed = baseEmbed(`Presence: ${user.displayName}`, COLORS.user, nowStamp()).addFields(
        { name: "Status", value: mapPresenceType(presence?.userPresenceType), inline: true },
        { name: "Last Location", value: presence?.lastLocation || "Unknown", inline: true },
        { name: "Last Online", value: formatDate(presence?.lastOnline), inline: false },
        { name: "Place ID", value: presence?.placeId ? String(presence.placeId) : "N/A", inline: true },
        { name: "Universe ID", value: presence?.universeId ? String(presence.universeId) : "N/A", inline: true }
      );

      await interaction.editReply({ embeds: [embed] });
      return true;
    }

    if (sub === "user_friends") {
      const key = interaction.options.getString("username_or_id", true);
      const user = await api.resolveUser(key);
      const [friends, counts] = await Promise.all([
        api.getFriends(user.id),
        api.getFriendCounts(user.id),
      ]);

      await replyWithPagination(interaction, friends, 10, (pageItems, pageInfo) => {
        const embed = baseEmbed(`Friends: ${user.displayName}`, COLORS.user, pageInfo.timestamp, pageInfo)
          .addFields(
            { name: "Total Friends", value: formatNumber(counts.friends), inline: true },
            { name: "Following", value: formatNumber(counts.followings), inline: true },
            { name: "Followers", value: formatNumber(counts.followers), inline: true }
          )
          .setDescription(
            asListOrDash(
              pageItems,
              (f) => `${f.displayName} (@${f.name}) • ID ${f.id}`
            )
          );

        return { embeds: [embed] };
      });

      return true;
    }

    if (sub === "user_groups") {
      const key = interaction.options.getString("username_or_id", true);
      const user = await api.resolveUser(key);
      const groups = await api.getGroupsForUser(user.id);

      await replyWithPagination(interaction, groups, 8, (pageItems, pageInfo) => {
        const embed = baseEmbed(`Groups: ${user.displayName}`, COLORS.user, pageInfo.timestamp, pageInfo).setDescription(
          asListOrDash(
            pageItems,
            (g) => `${g.group?.name || "Unknown"} (${g.group?.id || "-"})\nRole: ${g.role?.name || "-"} • Rank ${g.role?.rank ?? "-"}`
          )
        );
        return { embeds: [embed] };
      });

      return true;
    }

    if (sub === "user_badges") {
      const key = interaction.options.getString("username_or_id", true);
      const user = await api.resolveUser(key);
      const badges = await api.getUserBadges(user.id);

      await replyWithPagination(interaction, badges, 8, (pageItems, pageInfo) => {
        const embed = baseEmbed(`Badges: ${user.displayName}`, COLORS.user, pageInfo.timestamp, pageInfo).setDescription(
          asListOrDash(
            pageItems,
            (b) => `${b.name || "Unnamed"} • ID ${b.id}\nGame: ${b.statistics?.universeName || "Unknown"} • Awarded ${formatDate(b.awardedDate)}`
          )
        );
        return { embeds: [embed] };
      });

      return true;
    }

    if (sub === "user_inventory") {
      const key = interaction.options.getString("username_or_id", true);
      const assetType = interaction.options.getString("asset_type", true);
      const user = await api.resolveUser(key);

      const items = await api.getUserInventory(user.id, assetType);
      const ids = items.map((i) => Number(i.assetId || i.id)).filter((x) => Number.isInteger(x) && x > 0);
      const thumbs = await api.getAssetThumbs(ids);

      const enriched = items.map((item) => {
        const id = Number(item.assetId || item.id);
        return {
          ...item,
          _id: id,
          thumbnailUrl: thumbs.get(id) || null,
        };
      });

      await replyWithPagination(interaction, enriched, 3, (pageItems, pageInfo) => {
        const embeds = pageItems.map((item) => {
          const clothing = isClothingAsset(item);
          const images = api.buildClothingImages(item._id);
          const embed = baseEmbed(
            `${item.name || "Unnamed Item"} (${item._id || "N/A"})`,
            COLORS.asset,
            pageInfo.timestamp,
            pageInfo
          ).addFields(
            { name: "Asset ID", value: String(item._id || "N/A"), inline: true },
            { name: "Type", value: item.assetType || item.assetTypeName || item.sourceAssetType || "Unknown", inline: true },
            { name: "Catalog", value: item._id ? `https://www.roblox.com/catalog/${item._id}` : "N/A", inline: false }
          );

          if (item.thumbnailUrl) embed.setThumbnail(item.thumbnailUrl);

          if (clothing && images) {
            embed.addFields(
              { name: "Preview Thumbnail", value: item.thumbnailUrl || "Unavailable", inline: false },
              { name: "Raw Template", value: images.template, inline: false }
            );
            if (item.thumbnailUrl) embed.setThumbnail(item.thumbnailUrl);
            embed.setImage(images.template);
          } else if (item.thumbnailUrl) {
            embed.setImage(item.thumbnailUrl);
          }

          return embed;
        });

        if (!embeds.length) {
          embeds.push(
            baseEmbed(`Inventory: ${user.displayName}`, COLORS.asset, pageInfo.timestamp, pageInfo).setDescription(
              "No inventory results for this filter."
            )
          );
        }

        return { embeds };
      });

      return true;
    }

    if (sub === "user_outfits") {
      const key = interaction.options.getString("username_or_id", true);
      const user = await api.resolveUser(key);
      const outfits = await api.getUserOutfits(user.id);

      await replyWithPagination(interaction, outfits, 6, (pageItems, pageInfo) => {
        const embed = baseEmbed(`Outfits: ${user.displayName}`, COLORS.user, pageInfo.timestamp, pageInfo).setDescription(
          asListOrDash(
            pageItems,
            (o) => `${o.name || "Unnamed Outfit"} • Outfit ID ${o.id}\nThumb: ${o.thumbnailUrl || "Unavailable"}`
          )
        );
        return { embeds: [embed] };
      });

      return true;
    }

    if (sub === "user_games") {
      const key = interaction.options.getString("username_or_id", true);
      const user = await api.resolveUser(key);
      const games = await api.getUserGames(user.id);

      await replyWithPagination(interaction, games, 5, (pageItems, pageInfo) => {
        const embed = baseEmbed(`Games by ${user.displayName}`, COLORS.game, pageInfo.timestamp, pageInfo).setDescription(
          asListOrDash(
            pageItems,
            (g) => `${g.name || "Unnamed"}\nPlace ${g.rootPlace?.id || "N/A"} • Universe ${g.id} • Visits ${formatNumber(g.placeVisits)}\nCreated ${formatDate(g.created)} • Updated ${formatDate(g.updated)}`
          )
        );
        return { embeds: [embed] };
      });

      return true;
    }

    if (sub === "user_transactions") {
      const key = interaction.options.getString("username_or_id", true);
      const user = await api.resolveUser(key);
      const transactions = await api.getUserTransactions(user.id);

      const salesLines = asListOrDash(transactions.sales.slice(0, 10), (t) => {
        return `${t.name || "Item"} • ${formatNumber(t.currency?.amount)} Robux • ${formatDate(t.created)}`;
      });
      const purchaseLines = asListOrDash(transactions.purchases.slice(0, 10), (t) => {
        return `${t.name || "Item"} • ${formatNumber(t.currency?.amount)} Robux • ${formatDate(t.created)}`;
      });

      const embed = baseEmbed(`Transactions: ${user.displayName}`, COLORS.user, nowStamp())
        .addFields(
          {
            name: "Robux Balance",
            value: transactions.balance ? formatNumber(transactions.balance.robux) : "Unavailable",
            inline: true,
          },
          { name: "Recent Sales", value: toLimitText(salesLines), inline: false },
          { name: "Recent Purchases", value: toLimitText(purchaseLines), inline: false }
        );

      if (transactions.note) {
        embed.addFields({ name: "Auth Note", value: transactions.note, inline: false });
      }

      await interaction.editReply({ embeds: [embed] });
      return true;
    }

    if (sub === "game") {
      const rawId = interaction.options.getString("place_id_or_universe_id", true);
      const game = await api.getGame(rawId);
      if (!game) {
        await interaction.editReply({ embeds: [errorEmbed("Game not found.")] });
        return true;
      }

      const activePlayers = game.playing ?? game.players ?? null;
      const genre = game.genre || game.genre_l1 || "Unknown";
      const subGenre = game.genre_l2 || "Unknown";

      const embed = baseEmbed(game.name || "Game", COLORS.game, nowStamp())
        .setDescription(toLimitText(game.description || "No description"))
        .addFields(
          { name: "Universe ID", value: String(game.id || "N/A"), inline: true },
          { name: "Root Place ID", value: String(game.rootPlaceId || game.placeDetails?.placeId || "N/A"), inline: true },
          {
            name: "Creator",
            value: `${game.creator?.name || "Unknown"} (${game.creator?.id || "N/A"}) ${game.creator?.type || ""}`,
            inline: false,
          },
          { name: "Genre", value: `${genre} / ${subGenre}`, inline: true },
          { name: "Max Players", value: formatNumber(game.maxPlayers), inline: true },
          { name: "Visit Count", value: formatNumber(game.visits), inline: true },
          { name: "Favorites", value: formatNumber(game.favoritedCount), inline: true },
          { name: "Active Players", value: formatNumber(activePlayers), inline: true },
          { name: "Created", value: formatDate(game.created), inline: true },
          { name: "Updated", value: formatDate(game.updated), inline: true },
          { name: "Paid Access", value: game.price > 0 ? `Yes (${formatNumber(game.price)} R$)` : "No", inline: true },
          { name: "Copylocked", value: game.copyingAllowed === false ? "Yes" : "No", inline: true },
          { name: "API Access", value: game.studioAccessToApisAllowed ? "Allowed" : "Not allowed", inline: true },
          { name: "Universe Avatar Type", value: game.universeAvatarType || "Unknown", inline: true }
        );

      if (game.iconUrl) embed.setThumbnail(game.iconUrl);

      await replyWithPagination(interaction, game.banners || [], 1, (pageItems, pageInfo) => {
        const cloned = EmbedBuilder.from(embed);
        if (pageItems[0]) cloned.setImage(pageItems[0]);
        cloned.setFooter({ text: makeFooter(pageInfo.timestamp, pageInfo.current, pageInfo.total) });
        return { embeds: [cloned] };
      });

      return true;
    }

    if (sub === "game_servers") {
      const placeId = interaction.options.getString("place_id", true);
      const servers = await api.getGameServers(placeId);

      await replyWithPagination(interaction, servers, 8, (pageItems, pageInfo) => {
        const embed = baseEmbed(`Servers: Place ${placeId}`, COLORS.game, pageInfo.timestamp, pageInfo).setDescription(
          asListOrDash(
            pageItems,
            (s) => `Server ${s.id}\nPlayers ${s.playing}/${s.maxPlayers} • Ping ${s.ping || "N/A"} • FPS ${s.fps || "N/A"}`
          )
        );
        return { embeds: [embed] };
      });

      return true;
    }

    if (sub === "game_passes") {
      const universeId = interaction.options.getString("universe_id", true);
      const passes = await api.getGamePasses(universeId);
      const thumbs = await api.getAssetThumbs(passes.map((p) => Number(p.id)).filter((x) => Number.isInteger(x) && x > 0));

      const enriched = passes.map((p) => ({ ...p, thumbnailUrl: thumbs.get(Number(p.id)) || null }));

      await replyWithPagination(interaction, enriched, 5, (pageItems, pageInfo) => {
        const embed = baseEmbed(`Game Passes: ${universeId}`, COLORS.game, pageInfo.timestamp, pageInfo).setDescription(
          asListOrDash(
            pageItems,
            (p) => `${p.name || "Unnamed"} • Pass ${p.id} • Price ${p.priceInRobux ? `${formatNumber(p.priceInRobux)} R$` : "N/A"}\n${toLimitText(p.description || "No description", 120)}`
          )
        );

        if (pageItems[0]?.thumbnailUrl) embed.setThumbnail(pageItems[0].thumbnailUrl);
        return { embeds: [embed] };
      });

      return true;
    }

    if (sub === "game_badges") {
      const universeId = interaction.options.getString("universe_id", true);
      const badges = await api.getGameBadges(universeId);

      await replyWithPagination(interaction, badges, 6, (pageItems, pageInfo) => {
        const embed = baseEmbed(`Game Badges: ${universeId}`, COLORS.game, pageInfo.timestamp, pageInfo).setDescription(
          asListOrDash(
            pageItems,
            (b) => `${b.name || "Unnamed"} • ID ${b.id}\nEnabled: ${b.enabled ? "Yes" : "No"} • Win Rate: ${b.statistics?.winRatePercentage ?? "N/A"}% • Awarded: ${formatNumber(b.statistics?.awardedCount)}`
          )
        );
        return { embeds: [embed] };
      });

      return true;
    }

    if (sub === "game_social_links") {
      const universeId = interaction.options.getString("universe_id", true);
      const links = await api.getGameSocialLinks(universeId);

      const embed = baseEmbed(`Game Social Links: ${universeId}`, COLORS.game, nowStamp()).setDescription(
        asListOrDash(links, (l) => `${l.type || "Unknown"}: ${l.url || "N/A"}`)
      );

      await interaction.editReply({ embeds: [embed] });
      return true;
    }

    if (sub === "asset") {
      const assetId = interaction.options.getString("asset_id", true);
      const asset = await api.getAsset(assetId);

      const isClothing = isClothingAsset({
        assetType: asset.AssetType,
        assetTypeName: asset.catalogItem?.itemType,
      });

      const main = baseEmbed(asset.Name || "Asset", COLORS.asset, nowStamp())
        .setDescription(toLimitText(asset.Description || "No description."))
        .addFields(
          { name: "Asset ID", value: String(asset.AssetId || assetId), inline: true },
          { name: "Asset Type", value: String(asset.AssetType || asset.AssetTypeId || "Unknown"), inline: true },
          {
            name: "Creator",
            value: `${asset.Creator?.Name || "Unknown"} (${asset.Creator?.CreatorTargetId || "N/A"}) ${asset.Creator?.CreatorType || ""}`,
            inline: false,
          },
          { name: "Created", value: formatDate(asset.Created), inline: true },
          { name: "Updated", value: formatDate(asset.Updated), inline: true },
          { name: "For Sale", value: asset.IsForSale ? "Yes" : "No", inline: true },
          { name: "Price", value: asset.PriceInRobux ? `${formatNumber(asset.PriceInRobux)} R$` : "N/A", inline: true },
          { name: "Limited", value: asset.IsLimited ? "Yes" : "No", inline: true },
          { name: "Limited Unique", value: asset.IsLimitedUnique ? "Yes" : "No", inline: true },
          { name: "Remaining", value: formatNumber(asset.Remaining), inline: true },
          { name: "Sales", value: formatNumber(asset.Sales), inline: true }
        );

      if (asset.thumbnailUrl) main.setImage(asset.thumbnailUrl);

      const embeds = [main];

      if (isClothing) {
        const clothingEmbed = baseEmbed(`Clothing Template: ${asset.Name || assetId}`, COLORS.asset, nowStamp())
          .setDescription(
            `Preview Thumbnail: ${asset.thumbnailUrl || "Unavailable"}\nRaw Template: ${asset.clothingTemplateUrl}\nTexture Delivery: ${asset.textureDeliveryUrl}`
          )
          .setImage(asset.clothingTemplateUrl);

        if (asset.thumbnailUrl) clothingEmbed.setThumbnail(asset.thumbnailUrl);
        embeds.push(clothingEmbed);
      }

      await interaction.editReply({ embeds });
      return true;
    }

    if (sub === "asset_search") {
      const keyword = interaction.options.getString("keyword", true);
      const category = interaction.options.getString("category") || "all";
      const sort = interaction.options.getString("sort") || "relevance";

      const items = await api.searchAssets(keyword, category, sort);

      await replyWithPagination(interaction, items, 5, (pageItems, pageInfo) => {
        const embed = baseEmbed(`Asset Search: ${keyword}`, COLORS.asset, pageInfo.timestamp, pageInfo).setDescription(
          asListOrDash(
            pageItems,
            (i) => `${i.name || "Unnamed"} • ID ${i.id}\nPrice: ${i.lowestPrice ? `${formatNumber(i.lowestPrice)} R$` : "N/A"} • Creator: ${i.creatorName || "Unknown"}`
          )
        );

        if (pageItems[0]?.thumbnailUrl) embed.setThumbnail(pageItems[0].thumbnailUrl);
        return { embeds: [embed] };
      });

      return true;
    }

    if (sub === "limited_sales") {
      const assetId = interaction.options.getString("asset_id", true);
      const sales = await api.getLimitedSales(assetId);

      const rows = sales.volumeData.slice(0, 12).map((p) => {
        const date = String(p.date).slice(0, 10);
        return `${date} | price ${formatNumber(p.value)} | volume ${formatNumber(p.volume)}`;
      });

      const listings = asListOrDash(
        sales.listings.slice(0, 10),
        (l) => `Price ${formatNumber(l.price)} R$ • Seller ${l.seller?.name || "Unknown"} • Serial ${l.serialNumber ?? "N/A"}`
      );

      const embed = baseEmbed(`Limited Sales: ${assetId}`, COLORS.asset, nowStamp()).addFields(
        { name: "Floor", value: sales.floor ? `${formatNumber(sales.floor)} R$` : "N/A", inline: true },
        { name: "Ceiling", value: sales.ceiling ? `${formatNumber(sales.ceiling)} R$` : "N/A", inline: true },
        { name: "Average", value: sales.average ? `${formatNumber(sales.average)} R$` : "N/A", inline: true },
        { name: "Recent Listings", value: toLimitText(listings), inline: false },
        { name: "Volume Chart (text)", value: toLimitText(rows.length ? rows.join("\n") : "No chart points."), inline: false }
      );

      await interaction.editReply({ embeds: [embed] });
      return true;
    }

    if (sub === "group") {
      const groupId = interaction.options.getString("group_id", true);
      const group = await api.getGroup(groupId);

      const embed = baseEmbed(`${group.name || "Group"} (${group.id})`, COLORS.group, nowStamp())
        .setDescription(toLimitText(group.description || "No description."))
        .addFields(
          {
            name: "Owner",
            value: group.owner ? `${group.owner.username} (${group.owner.userId})` : "No owner",
            inline: true,
          },
          { name: "Member Count", value: formatNumber(group.memberCount), inline: true },
          { name: "Public", value: group.publicEntryAllowed ? "Yes" : "No", inline: true },
          { name: "Approval Required", value: group.isApprovalRequired ? "Yes" : "No", inline: true },
          { name: "Verified Badge", value: group.hasVerifiedBadge ? "Yes" : "No", inline: true },
          {
            name: "Latest Shout",
            value: group.shout
              ? `${group.shout.poster?.username || "Unknown"}: ${toLimitText(group.shout.body, 300)}\n${formatDate(group.shout.updated)}`
              : "No shout",
            inline: false,
          }
        );

      if (group.iconUrl) embed.setThumbnail(group.iconUrl);
      await interaction.editReply({ embeds: [embed] });
      return true;
    }

    if (sub === "group_roles") {
      const groupId = interaction.options.getString("group_id", true);
      const roles = await api.getGroupRoles(groupId);

      await replyWithPagination(interaction, roles, 10, (pageItems, pageInfo) => {
        const embed = baseEmbed(`Group Roles: ${groupId}`, COLORS.group, pageInfo.timestamp, pageInfo).setDescription(
          asListOrDash(
            pageItems,
            (r) => `${r.name} • Role ID ${r.id} • Rank ${r.rank} • Members ${formatNumber(r.memberCount)}`
          )
        );
        return { embeds: [embed] };
      });

      return true;
    }

    if (sub === "group_members") {
      const groupId = interaction.options.getString("group_id", true);
      const roleId = interaction.options.getString("role_id") || null;
      const members = await api.getGroupMembers(groupId, roleId);

      await replyWithPagination(interaction, members, 10, (pageItems, pageInfo) => {
        const embed = baseEmbed(`Group Members: ${groupId}`, COLORS.group, pageInfo.timestamp, pageInfo).setDescription(
          asListOrDash(
            pageItems,
            (m) => `${m.user?.displayName || m.user?.username || "Unknown"} (${m.user?.userId || "N/A"}) • ${m.role?.name || "Unknown role"}`
          )
        );
        return { embeds: [embed] };
      });

      return true;
    }

    if (sub === "group_games") {
      const groupId = interaction.options.getString("group_id", true);
      const games = await api.getGroupGames(groupId);

      await replyWithPagination(interaction, games, 6, (pageItems, pageInfo) => {
        const embed = baseEmbed(`Group Games: ${groupId}`, COLORS.group, pageInfo.timestamp, pageInfo).setDescription(
          asListOrDash(
            pageItems,
            (g) => `${g.name || "Unnamed"} • Universe ${g.id} • Place ${g.rootPlace?.id || "N/A"} • Visits ${formatNumber(g.placeVisits)}`
          )
        );
        return { embeds: [embed] };
      });

      return true;
    }

    if (sub === "group_social_links") {
      const groupId = interaction.options.getString("group_id", true);
      const links = await api.getGroupSocialLinks(groupId);

      const embed = baseEmbed(`Group Social Links: ${groupId}`, COLORS.group, nowStamp()).setDescription(
        asListOrDash(links, (l) => `${l.type || "Unknown"}: ${l.url || "N/A"}`)
      );

      await interaction.editReply({ embeds: [embed] });
      return true;
    }

    if (sub === "badge") {
      const badgeId = interaction.options.getString("badge_id", true);
      const badge = await api.getBadge(badgeId);

      const embed = baseEmbed(`${badge.name || "Badge"} (${badge.id || badgeId})`, COLORS.asset, nowStamp())
        .setDescription(toLimitText(badge.description || "No description."))
        .addFields(
          { name: "Enabled", value: badge.enabled ? "Yes" : "No", inline: true },
          { name: "Awarded Count", value: formatNumber(badge.statistics?.awardedCount), inline: true },
          { name: "Win Rate", value: `${badge.statistics?.winRatePercentage ?? "N/A"}%`, inline: true },
          { name: "Universe ID", value: String(badge.statistics?.universeId || "N/A"), inline: true },
          { name: "Created", value: formatDate(badge.created), inline: true },
          { name: "Updated", value: formatDate(badge.updated), inline: true }
        );

      if (badge.thumbnailUrl) embed.setImage(badge.thumbnailUrl);
      await interaction.editReply({ embeds: [embed] });
      return true;
    }

    if (sub === "bundle") {
      const bundleId = interaction.options.getString("bundle_id", true);
      const bundle = await api.getBundle(bundleId);

      const items = asListOrDash(
        bundle.items || [],
        (i) => `${i.name || "Unnamed"} (${i.id || "N/A"})`
      );

      const embed = baseEmbed(`${bundle.name || "Bundle"} (${bundle.id || bundleId})`, COLORS.asset, nowStamp())
        .setDescription(toLimitText(bundle.description || "No description."))
        .addFields(
          { name: "Bundle Type", value: bundle.bundleType || "Unknown", inline: true },
          { name: "For Sale", value: bundle.product?.isForSale ? "Yes" : "No", inline: true },
          {
            name: "Price",
            value: bundle.product?.priceInRobux ? `${formatNumber(bundle.product.priceInRobux)} R$` : "N/A",
            inline: true,
          },
          {
            name: "Creator",
            value: bundle.creator ? `${bundle.creator.name || "Unknown"} (${bundle.creator.id || "N/A"})` : "Unknown",
            inline: false,
          },
          { name: "Items", value: toLimitText(items), inline: false }
        );

      if (bundle.thumbnailUrl) embed.setImage(bundle.thumbnailUrl);
      await interaction.editReply({ embeds: [embed] });
      return true;
    }

    await interaction.editReply({ embeds: [errorEmbed("Unknown /roblox subcommand.")] });
    return true;
  } catch (error) {
    const message = error?.userMessage || error?.message || "Unhandled Roblox command failure.";
    const details = error?.retryAfterMs
      ? `Retry in about ${Math.ceil(error.retryAfterMs / 1000)} seconds.`
      : null;

    await interaction.editReply({ embeds: [errorEmbed(message, details)] });
    return true;
  }
}

module.exports = {
  robloxCommandBuilder: commandBuilder,
  handleRobloxCommand,
  inventoryChoices,
  ASSET_TYPE_MAP,
};