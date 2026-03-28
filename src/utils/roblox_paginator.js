const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require("discord.js");

const PREV_ID = "roblox_paginate_prev";
const NEXT_ID = "roblox_paginate_next";
const EXPIRE_MS = 5 * 60 * 1000;

function buildButtons(currentIndex, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(PREV_ID)
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentIndex <= 0),
    new ButtonBuilder()
      .setCustomId(`roblox_page_${currentIndex + 1}`)
      .setLabel(`Page ${currentIndex + 1} of ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(NEXT_ID)
      .setLabel("▶ Next")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentIndex >= totalPages - 1)
  );
}

class RobloxPaginator {
  constructor(items, perPage = 5) {
    this.items = Array.isArray(items) ? items : [];
    this.perPage = Math.max(1, perPage);
    this.index = 0;
    this.createdAt = Date.now();
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this.items.length / this.perPage));
  }

  isExpired() {
    return Date.now() - this.createdAt > EXPIRE_MS;
  }

  pageItems() {
    const start = this.index * this.perPage;
    return this.items.slice(start, start + this.perPage);
  }

  change(direction) {
    if (direction === PREV_ID && this.index > 0) {
      this.index -= 1;
      return true;
    }

    if (direction === NEXT_ID && this.index < this.totalPages - 1) {
      this.index += 1;
      return true;
    }

    return false;
  }

  components() {
    return [buildButtons(this.index, this.totalPages)];
  }
}

function makeFooter(timestampText, pageIndex, totalPages) {
  return `Roblox Data • Fetched at ${timestampText} • Page ${pageIndex} of ${totalPages}`;
}

function ensureEmbeds(result) {
  if (!result) {
    return { embeds: [], components: [] };
  }

  if (Array.isArray(result)) {
    return { embeds: result, components: [] };
  }

  if (result instanceof EmbedBuilder) {
    return { embeds: [result], components: [] };
  }

  const embeds = Array.isArray(result.embeds)
    ? result.embeds
    : result.embed
      ? [result.embed]
      : [];

  const components = Array.isArray(result.components) ? result.components : [];
  return { embeds, components };
}

module.exports = {
  RobloxPaginator,
  PREV_ID,
  NEXT_ID,
  EXPIRE_MS,
  makeFooter,
  ensureEmbeds,
};