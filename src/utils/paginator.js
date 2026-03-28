const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require("discord.js");

const BUTTON_ID_PREV = "paginate_prev";
const BUTTON_ID_NEXT = "paginate_next";

function createPaginationButtons(currentPage, totalPages, disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_ID_PREV)
      .setLabel("◀ Prev")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || currentPage === 0),
    new ButtonBuilder()
      .setCustomId(`page_${currentPage}`)
      .setLabel(`${currentPage + 1}/${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(BUTTON_ID_NEXT)
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled || currentPage === totalPages - 1)
  );
}

class Paginator {
  constructor(items, itemsPerPage = 10) {
    this.items = items;
    this.itemsPerPage = Math.max(1, itemsPerPage);
    this.currentPage = 0;
    this.totalPages = Math.max(1, Math.ceil(items.length / this.itemsPerPage));
  }

  getCurrentPageItems() {
    const start = this.currentPage * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.items.slice(start, end);
  }

  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      return true;
    }
    return false;
  }

  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      return true;
    }
    return false;
  }

  handleButtonClick(buttonId) {
    if (buttonId === BUTTON_ID_NEXT) {
      return { success: this.nextPage(), action: "next" };
    } else if (buttonId === BUTTON_ID_PREV) {
      return { success: this.prevPage(), action: "prev" };
    }
    return { success: false, action: null };
  }

  getButtons(disabled = false) {
    return createPaginationButtons(this.currentPage, this.totalPages, disabled);
  }

  getPageInfo() {
    return {
      current: this.currentPage + 1,
      total: this.totalPages,
      itemsOnPage: this.getCurrentPageItems().length,
      totalItems: this.items.length,
    };
  }
}

module.exports = { Paginator, createPaginationButtons, BUTTON_ID_PREV, BUTTON_ID_NEXT };
