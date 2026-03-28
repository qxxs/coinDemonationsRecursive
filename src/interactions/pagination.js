const { BUTTON_ID_PREV, BUTTON_ID_NEXT } = require("../utils/paginator");

const paginators = new Map();
const PAGINATION_TTL_MS = 5 * 60 * 1000;

function storePaginator(messageId, entry) {
  paginators.set(messageId, entry);
  setTimeout(() => paginators.delete(messageId), PAGINATION_TTL_MS);
}

function getPaginator(messageId) {
  return paginators.get(messageId);
}

async function handlePaginationButton(interaction) {
  const customId = interaction.customId;

  if (
    customId !== BUTTON_ID_PREV &&
    customId !== BUTTON_ID_NEXT &&
    !customId.startsWith("roblox_paginate_")
  ) {
    return false;
  }

  const entry = getPaginator(interaction.message.id);
  if (entry && typeof entry.onButton === "function") {
    return entry.onButton(interaction, customId);
  }

  if (!entry || !entry.paginator || typeof entry.renderPage !== "function") {
    await interaction.reply({
      content: "This pagination session has expired. Please run the command again.",
      ephemeral: true,
    });
    return true;
  }

  const { paginator, renderPage } = entry;

  const { success } = paginator.handleButtonClick(customId);
  if (!success) {
    await interaction.deferUpdate();
    return true;
  }

  const currentItems = paginator.getCurrentPageItems();
  const pageInfo = paginator.getPageInfo();

  const embed = renderPage(currentItems, pageInfo);
  const buttons = paginator.getButtons();

  await interaction.update({ embeds: [embed], components: [buttons] });
  return true;
}

module.exports = { storePaginator, getPaginator, handlePaginationButton };
