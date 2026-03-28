const DEFAULT_TTL_MS = 5 * 60 * 1000;
const PRESENCE_TTL_MS = 30 * 1000;
const MAX_RETRIES = 3;
const ROBLOX_USER_AGENT = "coinDemonationsRecursive-bot/2.0 (+https://github.com/qxxs/coinDemonationsRecursive)";

const ASSET_TYPE_MAP = {
  shirts: 11,
  pants: 12,
  hats: 8,
  faces: 18,
  gear: 19,
  badges: 21,
  gamepasses: 34,
  places: 9,
  accessories: 41,
  hair: 41,
  heads: 17,
  torsos: 27,
  leftarm: 29,
  rightarm: 28,
  leftleg: 30,
  rightleg: 31,
  packages: 32,
  emotes: 61,
  animations: 24,
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNumeric(value) {
  return /^\d+$/.test(String(value || "").trim());
}

function normalizeError(error, contextMessage = "Roblox request failed") {
  if (error && error.userMessage) return error;

  const normalized = new Error(contextMessage);
  normalized.cause = error;
  normalized.status = error?.status;

  if (error?.status === 404) {
    normalized.userMessage = "Requested Roblox data was not found.";
  } else if (error?.status === 429) {
    normalized.userMessage = "Roblox API rate limited this request. Please retry shortly.";
  } else if (error?.status >= 500) {
    normalized.userMessage = "Roblox API is currently unavailable. Please retry in a moment.";
  } else {
    normalized.userMessage = "Failed to fetch Roblox data.";
  }

  return normalized;
}

class RobloxAPI {
  constructor(options = {}) {
    this.cache = new Map();
    this.cookie = options.cookie || process.env.ROBLOX_COOKIE || null;
    this.userAgent = options.userAgent || ROBLOX_USER_AGENT;
  }

  makeHeaders(extra = {}, includeAuth = false) {
    const headers = {
      "Content-Type": "application/json",
      "User-Agent": this.userAgent,
      ...extra,
    };

    if (includeAuth && this.cookie) {
      headers.Cookie = `.ROBLOSECURITY=${this.cookie}`;
    }

    return headers;
  }

  cacheKey(method, url, body) {
    return `${method}:${url}:${body ? JSON.stringify(body) : ""}`;
  }

  getCached(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return entry.value;
  }

  setCached(key, value, ttlMs) {
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  async request(method, url, options = {}) {
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    const body = options.body || null;
    const includeAuth = Boolean(options.includeAuth);
    const useCache = method === "GET" || options.cacheable === true;

    const key = this.cacheKey(method, url, body);
    if (useCache) {
      const cached = this.getCached(key);
      if (cached) return cached;
    }

    let lastError;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: this.makeHeaders(options.headers, includeAuth),
        body: body ? JSON.stringify(body) : undefined,
      }).catch((error) => {
        throw normalizeError(error, "Network error while contacting Roblox API.");
      });

      if (response.status === 429) {
        const retryAfterHeader = response.headers.get("retry-after");
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : null;
        const backoffMs = Number.isFinite(retryAfterSeconds)
          ? Math.max(250, retryAfterSeconds * 1000)
          : 500 * 2 ** attempt;

        if (attempt < MAX_RETRIES - 1) {
          await sleep(backoffMs);
          continue;
        }

        const rateError = new Error("Roblox API rate limited request");
        rateError.status = 429;
        rateError.retryAfterMs = backoffMs;
        rateError.userMessage = `Roblox rate limit reached. Retry in ${Math.ceil(backoffMs / 1000)}s.`;
        throw rateError;
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        const error = new Error(`Roblox API responded with ${response.status}`);
        error.status = response.status;
        error.body = text;
        lastError = error;

        if (response.status >= 500 && attempt < MAX_RETRIES - 1) {
          await sleep(500 * 2 ** attempt);
          continue;
        }

        throw normalizeError(error);
      }

      const json = await response.json().catch(() => ({}));
      if (useCache) this.setCached(key, json, ttlMs);
      return json;
    }

    throw normalizeError(lastError);
  }

  async paginateCursor(urlBuilder, options = {}) {
    const items = [];
    let cursor = null;
    const itemLimit = options.itemLimit ?? Infinity;
    const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;

    do {
      const url = urlBuilder(cursor);
      const payload = await this.request("GET", url, { ttlMs, includeAuth: options.includeAuth });
      const batch = Array.isArray(payload.data) ? payload.data : [];
      items.push(...batch);
      cursor = payload.nextPageCursor || null;
    } while (cursor && items.length < itemLimit);

    return items.slice(0, itemLimit);
  }

  async resolveUser(usernameOrId) {
    const value = String(usernameOrId || "").trim();

    if (!value) {
      const err = new Error("Missing username or id");
      err.userMessage = "Provide a Roblox username or user ID.";
      throw err;
    }

    if (isNumeric(value)) {
      return this.getUserById(Number(value));
    }

    const payload = await this.request("POST", "https://users.roblox.com/v1/usernames/users", {
      body: {
        usernames: [value],
        excludeBannedUsers: false,
      },
      cacheable: true,
    });

    if (!payload.data || payload.data.length === 0) {
      const err = new Error("User not found");
      err.userMessage = "User not found.";
      throw err;
    }

    return this.getUserById(payload.data[0].id);
  }

  async getUserById(userId) {
    return this.request("GET", `https://users.roblox.com/v1/users/${userId}`);
  }

  async getUserAvatarThumbs(userId) {
    const [avatar, headshot, bust] = await Promise.all([
      this.request(
        "GET",
        `https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=720x720&format=Png&isCircular=false`
      ),
      this.request(
        "GET",
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`
      ),
      this.request(
        "GET",
        `https://thumbnails.roblox.com/v1/users/avatar-bust?userIds=${userId}&size=420x420&format=Png&isCircular=false`
      ),
    ]);

    return {
      avatar: avatar?.data?.[0]?.imageUrl || null,
      headshot: headshot?.data?.[0]?.imageUrl || null,
      bust: bust?.data?.[0]?.imageUrl || null,
    };
  }

  async getAvatarDetails(userId) {
    return this.request("GET", `https://avatar.roblox.com/v1/users/${userId}/avatar`);
  }

  async getPresence(userId) {
    const payload = await this.request("POST", "https://presence.roblox.com/v1/presence/users", {
      body: { userIds: [Number(userId)] },
      ttlMs: PRESENCE_TTL_MS,
      cacheable: true,
    });

    return payload.userPresences?.[0] || null;
  }

  async getFriendCounts(userId) {
    const [friends, followers, followings] = await Promise.all([
      this.request("GET", `https://friends.roblox.com/v1/users/${userId}/friends/count`),
      this.request("GET", `https://friends.roblox.com/v1/users/${userId}/followers/count`),
      this.request("GET", `https://friends.roblox.com/v1/users/${userId}/followings/count`),
    ]);

    return {
      friends: friends?.count ?? 0,
      followers: followers?.count ?? 0,
      followings: followings?.count ?? 0,
    };
  }

  async getFriends(userId) {
    return this.paginateCursor(
      (cursor) =>
        `https://friends.roblox.com/v1/users/${userId}/friends?limit=100&sortOrder=Asc${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`
    );
  }

  async getGroupsForUser(userId) {
    const payload = await this.request("GET", `https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    return payload.data || [];
  }

  async getUserBadges(userId) {
    return this.paginateCursor(
      (cursor) =>
        `https://badges.roblox.com/v1/users/${userId}/badges?limit=100&sortOrder=Asc${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`
    );
  }

  async getAssetThumbs(assetIds) {
    if (!assetIds.length) return new Map();
    const chunks = [];
    for (let i = 0; i < assetIds.length; i += 50) chunks.push(assetIds.slice(i, i + 50));

    const thumbMap = new Map();
    for (const chunk of chunks) {
      const payload = await this.request(
        "GET",
        `https://thumbnails.roblox.com/v1/assets?assetIds=${chunk.join(",")}&size=420x420&format=Png&isCircular=false`
      );
      for (const entry of payload.data || []) {
        thumbMap.set(Number(entry.targetId), entry.imageUrl || null);
      }
    }

    return thumbMap;
  }

  async getUserInventoryByAssetType(userId, assetTypeId) {
    return this.paginateCursor(
      (cursor) =>
        `https://inventory.roblox.com/v2/users/${userId}/inventory/${assetTypeId}?limit=100&sortOrder=Asc${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`
    );
  }

  async getUserInventory(userId, assetType) {
    if (assetType === "all") {
      const all = [];
      for (const [name, typeId] of Object.entries(ASSET_TYPE_MAP)) {
        const items = await this.getUserInventoryByAssetType(userId, typeId).catch(() => []);
        for (const item of items) {
          all.push({ ...item, sourceAssetType: name });
        }
      }
      return all;
    }

    const typeId = ASSET_TYPE_MAP[assetType];
    if (!typeId) return [];
    const items = await this.getUserInventoryByAssetType(userId, typeId);
    return items.map((item) => ({ ...item, sourceAssetType: assetType }));
  }

  async getUserOutfits(userId) {
    let page = 1;
    const items = [];

    while (true) {
      const payload = await this.request(
        "GET",
        `https://avatar.roblox.com/v1/users/${userId}/outfits?page=${page}&itemsPerPage=100`
      );

      const batch = payload.data || [];
      items.push(...batch);

      if (!batch.length || items.length >= (payload.total || Infinity)) break;
      page += 1;
    }

    if (!items.length) return [];

    const ids = items.map((item) => item.id).filter(Boolean);
    const thumbs = await this.request(
      "GET",
      `https://thumbnails.roblox.com/v1/users/outfits?userOutfitIds=${ids.join(",")}&size=420x420&format=Png&isCircular=false`
    ).catch(() => ({ data: [] }));

    const thumbMap = new Map((thumbs.data || []).map((entry) => [entry.targetId, entry.imageUrl]));
    return items.map((item) => ({ ...item, thumbnailUrl: thumbMap.get(item.id) || null }));
  }

  async getUserGames(userId) {
    return this.paginateCursor(
      (cursor) =>
        `https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&sortOrder=Asc&limit=50${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`
    );
  }

  async getUserTransactions(userId) {
    const result = {
      balance: null,
      sales: [],
      purchases: [],
      note: null,
    };

    if (!this.cookie) {
      result.note = "No auth cookie configured; private transaction endpoints are unavailable.";
      return result;
    }

    // Auth-only endpoints are account-scoped; they may not match arbitrary requested user IDs.
    result.balance = await this.request("GET", "https://economy.roblox.com/v1/user/currency", {
      includeAuth: true,
      ttlMs: 30 * 1000,
    }).catch(() => null);

    result.sales = await this.request(
      "GET",
      "https://economy.roblox.com/v2/transactions?transactionType=Sale&limit=25",
      { includeAuth: true, ttlMs: 30 * 1000 }
    ).then((r) => r.data || []).catch(() => []);

    result.purchases = await this.request(
      "GET",
      "https://economy.roblox.com/v2/transactions?transactionType=Purchase&limit=25",
      { includeAuth: true, ttlMs: 30 * 1000 }
    ).then((r) => r.data || []).catch(() => []);

    if (isNumeric(userId)) {
      const authUser = await this.request("GET", "https://users.roblox.com/v1/users/authenticated", {
        includeAuth: true,
        ttlMs: 30 * 1000,
      }).catch(() => null);

      if (authUser && Number(authUser.id) !== Number(userId)) {
        result.note = "Auth endpoints return data for the bot cookie account, not the requested user.";
      }
    }

    return result;
  }

  async getUniverseFromPlaceId(placeId) {
    const payload = await this.request(
      "GET",
      `https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`
    );
    return payload?.[0] || null;
  }

  async getGame(universeOrPlaceId) {
    let universeId = Number(universeOrPlaceId);
    let placeDetails = null;

    if (!Number.isInteger(universeId) || universeId <= 0) {
      return null;
    }

    const maybePlace = await this.getUniverseFromPlaceId(universeId).catch(() => null);
    if (maybePlace?.universeId) {
      universeId = maybePlace.universeId;
      placeDetails = maybePlace;
    }

    const detailsPayload = await this.request(
      "GET",
      `https://games.roblox.com/v1/games?universeIds=${universeId}`
    );
    const game = detailsPayload.data?.[0] || null;
    if (!game) return null;

    const [votes, icon, thumbnails] = await Promise.all([
      this.request("GET", `https://games.roblox.com/v1/games/votes?universeIds=${universeId}`).catch(() => null),
      this.request(
        "GET",
        `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=512x512&format=Png&isCircular=false`
      ).catch(() => null),
      this.request(
        "GET",
        `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&countPerUniverse=5&defaults=true&size=768x432&format=Png&isCircular=false`
      ).catch(() => null),
    ]);

    return {
      ...game,
      placeDetails,
      votes: votes?.data?.[0] || null,
      iconUrl: icon?.data?.[0]?.imageUrl || null,
      banners: thumbnails?.data?.filter((x) => x.imageUrl).map((x) => x.imageUrl) || [],
    };
  }

  async getGameServers(placeId) {
    return this.paginateCursor(
      (cursor) =>
        `https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`,
      { ttlMs: 30 * 1000 }
    );
  }

  async getGamePasses(universeId) {
    return this.paginateCursor(
      (cursor) =>
        `https://games.roblox.com/v1/games/${universeId}/game-passes?limit=100&sortOrder=Asc${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`
    );
  }

  async getGameBadges(universeId) {
    return this.paginateCursor(
      (cursor) =>
        `https://badges.roblox.com/v1/universes/${universeId}/badges?limit=100&sortOrder=Asc${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`
    );
  }

  async getGameSocialLinks(universeId) {
    const primary = await this.request(
      "GET",
      `https://develop.roblox.com/v1/universes/${universeId}/social-links/list`
    ).catch(() => null);

    if (primary?.data) return primary.data;

    const fallback = await this.request(
      "GET",
      `https://games.roblox.com/v1/games/${universeId}/social-links/list`
    ).catch(() => ({ data: [] }));

    return fallback.data || [];
  }

  async getCatalogAssetDetails(assetId) {
    return this.request("GET", `https://economy.roblox.com/v2/assets/${assetId}/details`);
  }

  async getAssetProductInfo(assetId) {
    const payload = await this.request(
      "GET",
      `https://catalog.roblox.com/v1/catalog/items/details?itemIds=${assetId}&itemType=Asset`
    ).catch(() => ({ data: [] }));

    return payload.data?.[0] || null;
  }

  async getAsset(assetId) {
    const [details, catalogItem, thumb] = await Promise.all([
      this.getCatalogAssetDetails(assetId),
      this.getAssetProductInfo(assetId),
      this.getAssetThumbs([Number(assetId)]),
    ]);

    return {
      ...details,
      catalogItem,
      thumbnailUrl: thumb.get(Number(assetId)) || null,
      clothingTemplateUrl: `https://www.roblox.com/asset-thumbnail/image?assetId=${assetId}&width=420&height=420&format=png`,
      textureDeliveryUrl: `https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`,
    };
  }

  async searchAssets(keyword, category = "all", sort = "relevance") {
    const sortMap = {
      relevance: 1,
      mostFavorited: 3,
      bestseller: 5,
      recentlyUpdated: 4,
      priceAsc: 2,
      priceDesc: 2,
    };

    const query = new URLSearchParams({
      Category: "All",
      CreatorType: "All",
      IncludeNotForSale: "True",
      Keyword: keyword,
      Limit: "30",
      SortType: String(sortMap[sort] || 1),
    });

    if (category && category !== "all") query.set("Subcategory", category);
    if (sort === "priceAsc") query.set("SortAggregation", "5");
    if (sort === "priceDesc") query.set("SortAggregation", "6");

    const payload = await this.request("GET", `https://catalog.roblox.com/v1/search/items?${query.toString()}`);
    const items = payload.data || [];

    const assetIds = items.map((item) => item.id).filter(Boolean);
    const thumbs = await this.getAssetThumbs(assetIds);

    return items.map((item) => ({
      ...item,
      thumbnailUrl: thumbs.get(Number(item.id)) || null,
    }));
  }

  async getLimitedSales(assetId) {
    const [resellers, avgPricePoints] = await Promise.all([
      this.request("GET", `https://economy.roblox.com/v1/assets/${assetId}/resellers?limit=100`),
      this.request("GET", `https://economy.roblox.com/v1/assets/${assetId}/resale-data`).catch(() => null),
    ]);

    return {
      listings: resellers?.data || [],
      floor: resellers?.data?.[0]?.price || null,
      ceiling: resellers?.data?.length ? resellers.data[resellers.data.length - 1].price : null,
      average: avgPricePoints?.recentAveragePrice || null,
      volumeData: avgPricePoints?.priceDataPoints || [],
    };
  }

  async getGroup(groupId) {
    const group = await this.request("GET", `https://groups.roblox.com/v1/groups/${groupId}`);
    const icon = await this.request(
      "GET",
      `https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupId}&size=420x420&format=Png&isCircular=false`
    ).catch(() => ({ data: [] }));

    return {
      ...group,
      iconUrl: icon?.data?.[0]?.imageUrl || null,
    };
  }

  async getGroupRoles(groupId) {
    const payload = await this.request("GET", `https://groups.roblox.com/v1/groups/${groupId}/roles`);
    return payload.roles || [];
  }

  async getGroupMembers(groupId, roleId = null) {
    const all = await this.paginateCursor(
      (cursor) =>
        `https://groups.roblox.com/v1/groups/${groupId}/users?limit=100&sortOrder=Asc${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`
    );

    if (!roleId) return all;
    return all.filter((member) => Number(member.role?.id) === Number(roleId));
  }

  async getGroupGames(groupId) {
    return this.paginateCursor(
      (cursor) =>
        `https://games.roblox.com/v2/groups/${groupId}/games?accessFilter=Public&sortOrder=Asc&limit=50${
          cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""
        }`
    );
  }

  async getGroupSocialLinks(groupId) {
    const payload = await this.request(
      "GET",
      `https://groups.roblox.com/v1/groups/${groupId}/social-links`
    ).catch(() => ({ data: [] }));

    return payload.data || [];
  }

  async getBadge(badgeId) {
    const [badge, stats, thumb] = await Promise.all([
      this.request("GET", `https://badges.roblox.com/v1/badges/${badgeId}`),
      this.request("GET", `https://badges.roblox.com/v1/badges/${badgeId}/statistics`).catch(() => null),
      this.request(
        "GET",
        `https://thumbnails.roblox.com/v1/badges/icons?badgeIds=${badgeId}&size=420x420&format=Png`
      ).catch(() => ({ data: [] })),
    ]);

    return {
      ...badge,
      statistics: stats,
      thumbnailUrl: thumb?.data?.[0]?.imageUrl || null,
    };
  }

  async getBundle(bundleId) {
    const details = await this.request("GET", `https://catalog.roblox.com/v1/bundles/${bundleId}/details`);
    const thumb = await this.request(
      "GET",
      `https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${bundleId}&size=420x420&format=Png&isCircular=false`
    ).catch(() => ({ data: [] }));

    return {
      ...details,
      thumbnailUrl: thumb?.data?.[0]?.imageUrl || null,
    };
  }

  assetTypeToId(assetType) {
    if (assetType === "all") return "all";
    return ASSET_TYPE_MAP[assetType] || null;
  }

  buildClothingImages(assetId) {
    const numeric = Number(assetId);
    if (!Number.isInteger(numeric) || numeric <= 0) return null;

    return {
      preview: `https://thumbnails.roblox.com/v1/assets?assetIds=${numeric}&size=420x420&format=Png&isCircular=false`,
      template: `https://www.roblox.com/asset-thumbnail/image?assetId=${numeric}&width=420&height=420&format=png`,
    };
  }
}

module.exports = {
  RobloxAPI,
  ASSET_TYPE_MAP,
};