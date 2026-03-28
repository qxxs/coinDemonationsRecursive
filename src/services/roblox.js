const CACHE_TTL_MS = 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;

const ASSET_TYPE_CHOICES = [
  { name: "Hat", id: 8 },
  { name: "Face", id: 18 },
  { name: "Gear", id: 19 },
  { name: "HairAccessory", id: 41 },
  { name: "FaceAccessory", id: 42 },
  { name: "NeckAccessory", id: 43 },
  { name: "ShoulderAccessory", id: 44 },
  { name: "FrontAccessory", id: 45 },
  { name: "BackAccessory", id: 46 },
  { name: "WaistAccessory", id: 47 },
  { name: "EmoteAnimation", id: 61 },
];

function createError(message, details = {}) {
  const error = new Error(message);
  Object.assign(error, details);
  return error;
}

function parseAllowedValuesFromErrorBody(errorBody) {
  if (!errorBody || typeof errorBody !== "string") return [];

  const match = errorBody.match(/Allowed values:\s*([0-9,\s]+)/i);
  if (!match || !match[1]) return [];

  return Array.from(
    new Set(
      match[1]
        .split(",")
        .map((value) => Number(value.trim()))
        .filter((value) => Number.isInteger(value) && value > 0)
    )
  ).sort((a, b) => a - b);
}

function selectAllowedLimit(requestedLimit, allowedValues) {
  if (!allowedValues.length) return requestedLimit;

  const normalizedRequested = Math.max(1, Number(requestedLimit) || 10);
  let selected = allowedValues[0];

  for (const value of allowedValues) {
    if (value <= normalizedRequested) {
      selected = value;
    }
  }

  return selected;
}

function createRobloxService() {
  const cache = new Map();

  function mapRobloxApiError(error) {
    if (!error) return error;

    if (error.status === 400) {
      const allowedValues = parseAllowedValuesFromErrorBody(error.errorBody);
      if (allowedValues.length) {
        error.userMessage = `Roblox API rejected that limit. Allowed values are: ${allowedValues.join(", ")}.`;
      } else {
        error.userMessage = "Roblox API rejected that request. Please try again.";
      }
      return error;
    }

    if (error.code === "ROBLOX_TIMEOUT") {
      error.userMessage = "Roblox API timed out. Please try again in a few seconds.";
      return error;
    }

    if (error.status === 429) {
      error.userMessage = "Roblox API rate limit reached. Please wait and try again.";
      return error;
    }

    if (error.status >= 500) {
      error.userMessage = "Roblox API is having issues right now. Please try again shortly.";
      return error;
    }

    return error;
  }

  async function fetchJson(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(options.headers || {}),
        },
      });

      if (!response.ok) {
        let errorBody = "";
        try {
          errorBody = await response.text();
        } catch {
          errorBody = "";
        }

        throw createError(`Roblox API ${response.status}`, {
          status: response.status,
          url,
          errorBody,
        });
      }

      return response.json();
    } catch (error) {
      if (error.name === "AbortError") {
        throw mapRobloxApiError(createError("Roblox request timeout", { code: "ROBLOX_TIMEOUT", url }));
      }
      throw mapRobloxApiError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  async function fetchJsonWithLimitFallback(buildUrl, requestedLimit, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
    const initialLimit = Math.max(1, Number(requestedLimit) || 10);

    try {
      return await fetchJson(buildUrl(initialLimit), options, timeoutMs);
    } catch (error) {
      const allowedValues = parseAllowedValuesFromErrorBody(error.errorBody);
      if (error.status !== 400 || !allowedValues.length) {
        throw error;
      }

      const retryLimit = selectAllowedLimit(initialLimit, allowedValues);
      if (retryLimit === initialLimit) {
        throw error;
      }

      return fetchJson(buildUrl(retryLimit), options, timeoutMs);
    }
  }

  async function withCache(key, resolver, ttlMs = CACHE_TTL_MS) {
    const now = Date.now();
    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const value = await resolver();
    cache.set(key, {
      value,
      expiresAt: now + ttlMs,
    });
    return value;
  }

  async function resolveUserByUsername(username) {
    const normalized = username.trim();
    if (!normalized) {
      throw createError("Username cannot be empty", {
        userMessage: "Please provide a valid Roblox username.",
      });
    }

    const key = `resolveUser:${normalized.toLowerCase()}`;
    return withCache(key, async () => {
      const result = await fetchJson("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        body: JSON.stringify({
          usernames: [normalized],
          excludeBannedUsers: false,
        }),
      });

      if (!result.data || result.data.length === 0) {
        throw createError("User not found", {
          code: "ROBLOX_USER_NOT_FOUND",
          userMessage: `No Roblox user found for username: ${normalized}`,
        });
      }

      return result.data[0];
    });
  }

  function formatDate(isoDate) {
    if (!isoDate) return "Unknown";
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "Unknown";
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  async function getUserDetails(userId) {
    return withCache(`userDetails:${userId}`, () =>
      fetchJson(`https://users.roblox.com/v1/users/${userId}`)
    );
  }

  async function getAvatarHeadshot(userId) {
    const result = await withCache(`avatar:${userId}`, () =>
      fetchJson(
        `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
      )
    );

    if (!result.data || result.data.length === 0) return null;
    return result.data[0].imageUrl || null;
  }

  async function getSocialCounts(userId) {
    const [friends, followers, following] = await Promise.allSettled([
      fetchJson(`https://friends.roblox.com/v1/users/${userId}/friends/count`),
      fetchJson(`https://friends.roblox.com/v1/users/${userId}/followers/count`),
      fetchJson(`https://friends.roblox.com/v1/users/${userId}/followings/count`),
    ]);

    return {
      friends: friends.status === "fulfilled" ? friends.value.count : null,
      followers: followers.status === "fulfilled" ? followers.value.count : null,
      following: following.status === "fulfilled" ? following.value.count : null,
    };
  }

  async function getFriends(userId, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const result = await fetchJsonWithLimitFallback(
      (resolvedLimit) =>
        `https://friends.roblox.com/v1/users/${userId}/friends?sortOrder=Asc&limit=${resolvedLimit}`,
      safeLimit
    );
    return result.data || [];
  }

  async function getFollowers(userId, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const result = await fetchJsonWithLimitFallback(
      (resolvedLimit) =>
        `https://friends.roblox.com/v1/users/${userId}/followers?sortOrder=Desc&limit=${resolvedLimit}`,
      safeLimit
    );
    return result.data || [];
  }

  async function getFollowing(userId, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const result = await fetchJsonWithLimitFallback(
      (resolvedLimit) =>
        `https://friends.roblox.com/v1/users/${userId}/followings?sortOrder=Desc&limit=${resolvedLimit}`,
      safeLimit
    );
    return result.data || [];
  }

  async function getGroups(userId) {
    const result = await fetchJson(`https://groups.roblox.com/v2/users/${userId}/groups/roles`);
    return result.data || [];
  }

  async function getBadges(userId, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const result = await fetchJsonWithLimitFallback(
      (resolvedLimit) =>
        `https://badges.roblox.com/v1/users/${userId}/badges?sortOrder=Desc&limit=${resolvedLimit}`,
      safeLimit
    );
    return result.data || [];
  }

  async function getInventory(userId, assetTypeId, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    try {
      const result = await fetchJsonWithLimitFallback(
        (resolvedLimit) =>
          `https://inventory.roblox.com/v2/users/${userId}/inventory/${assetTypeId}?limit=${resolvedLimit}&sortOrder=Desc`,
        safeLimit
      );
      return result.data || [];
    } catch (error) {
      if (error.status === 403) {
        throw createError("Inventory is private", {
          code: "ROBLOX_INVENTORY_PRIVATE",
          userMessage: "This user's inventory is private for that category.",
        });
      }
      throw error;
    }
  }

  async function getCollectibles(userId, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    try {
      const result = await fetchJsonWithLimitFallback(
        (resolvedLimit) =>
          `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=${resolvedLimit}&sortOrder=Desc`,
        safeLimit
      );
      return result.data || [];
    } catch (error) {
      if (error.status === 403) {
        throw createError("Collectibles are private", {
          code: "ROBLOX_INVENTORY_PRIVATE",
          userMessage: "This user's limiteds are private.",
        });
      }
      throw error;
    }
  }

  async function getCatalogDetailsForAssets(assetIds) {
    if (!assetIds.length) return [];

    const uniqueAssetIds = Array.from(
      new Set(
        assetIds
          .map((id) => Number(id))
          .filter((id) => Number.isInteger(id) && id > 0)
      )
    );

    const details = await Promise.allSettled(
      uniqueAssetIds.map((assetId) =>
        withCache(`assetDetails:${assetId}`, () =>
          fetchJson(`https://economy.roblox.com/v2/assets/${assetId}/details`)
        )
      )
    );

    const fulfilled = details
      .filter((entry) => entry.status === "fulfilled")
      .map((entry) => entry.value)
      .filter(Boolean);

    // If Roblox blocks all lookups, continue without sale enrichment rather than failing commands.
    if (!fulfilled.length) return [];

    return fulfilled.map((detail) => {
      const id = detail.AssetId || detail.TargetId || detail.assetId;
      return {
        id,
        name: detail.Name || "Unknown",
        priceStatus: detail.IsForSale ? "On Sale" : "Off Sale",
        isForSale: Boolean(detail.IsForSale),
        priceInRobux: detail.PriceInRobux ?? null,
      };
    });
  }

  async function getInventoryWithSaleInfo(userId, assetTypeId, limit = 10) {
    const items = await getInventory(userId, assetTypeId, limit);
    const assetIds = items.map((item) => item.assetId).filter(Boolean);
    const details = await getCatalogDetailsForAssets(assetIds);

    const detailsById = new Map(details.map((detail) => [detail.id, detail]));
    return items.map((item) => {
      const catalogDetail = detailsById.get(item.assetId) || null;
      return {
        ...item,
        name: item.name || item.assetName || catalogDetail?.name || "Unnamed Item",
        catalogDetail,
      };
    });
  }

  async function getGiftcardToyLikeItems(userId, limit = 10) {
    const gearTypeId = 19;
    const items = await getInventoryWithSaleInfo(userId, gearTypeId, Math.max(limit * 2, 20));
    const keywordPattern = /gift\s*card|toy\s*code|virtual\s*item|chaser|figure/i;

    const matched = items.filter((item) => {
      const name = item.name || item.assetName || item.catalogDetail?.name || "";
      return keywordPattern.test(name);
    });

    return matched.slice(0, Math.min(Math.max(limit, 1), 25));
  }

  async function getAllOffsalesAcrossCategories(userId, limit = 20) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const results = await Promise.allSettled(
      ASSET_TYPE_CHOICES.map((category) =>
        getInventoryWithSaleInfo(userId, category.id, Math.max(safeLimit, 25)).then((items) => ({
          category,
          items,
        }))
      )
    );

    const fulfilled = results.filter((entry) => entry.status === "fulfilled").map((entry) => entry.value);
    const rejected = results.filter((entry) => entry.status === "rejected").map((entry) => entry.reason);

    if (!fulfilled.length && rejected.length) {
      const hasPrivate = rejected.some((error) => error.code === "ROBLOX_INVENTORY_PRIVATE");
      if (hasPrivate) {
        throw createError("Inventory is private in all scanned categories", {
          code: "ROBLOX_INVENTORY_PRIVATE",
          userMessage: "This user's inventory is private, so offsale scanning is unavailable.",
        });
      }
      throw rejected[0];
    }

    const deduped = new Map();
    for (const section of fulfilled) {
      for (const item of section.items) {
        if (item.catalogDetail?.priceStatus !== "Off Sale") continue;
        const key = item.assetId || item.id;
        if (!key || deduped.has(key)) continue;
        deduped.set(key, {
          ...item,
          categoryName: section.category.name,
        });
      }
    }

    return Array.from(deduped.values()).slice(0, safeLimit);
  }

  async function getUsernameHistory(userId, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const result = await fetchJsonWithLimitFallback(
      (resolvedLimit) =>
        `https://users.roblox.com/v1/users/${userId}/username-history?limit=${resolvedLimit}&sortOrder=Desc`,
      safeLimit
    );
    return result.data || [];
  }

  async function getOutfits(userId, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const result = await fetchJsonWithLimitFallback(
      (resolvedLimit) =>
        `https://avatar.roblox.com/v1/users/${userId}/outfits?itemsPerPage=${resolvedLimit}&page=1`,
      safeLimit
    );
    return result.data || [];
  }

  async function getUserGames(userId, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const result = await fetchJsonWithLimitFallback(
      (resolvedLimit) =>
        `https://games.roblox.com/v2/users/${userId}/games?accessFilter=Public&sortOrder=Desc&limit=${resolvedLimit}`,
      safeLimit
    );
    return result.data || [];
  }

  async function getGroupInfo(groupId) {
    return withCache(`group:${groupId}`, () =>
      fetchJson(`https://groups.roblox.com/v1/groups/${groupId}`)
    );
  }

  async function userOwnsAsset(userId, assetId) {
    const numericAssetId = Number(assetId);
    if (!Number.isInteger(numericAssetId) || numericAssetId <= 0) {
      throw createError("Invalid asset id", {
        userMessage: "Asset ID must be a positive number.",
      });
    }

    try {
      const result = await fetchJson(
        `https://inventory.roblox.com/v1/users/${userId}/items/Asset/${numericAssetId}/is-owned`
      );
      return Boolean(result);
    } catch (error) {
      if (error.status === 403) {
        throw createError("Inventory is private", {
          code: "ROBLOX_INVENTORY_PRIVATE",
          userMessage: "Cannot check ownership because this user's inventory is private.",
        });
      }
      throw error;
    }
  }

  async function resolveUserIdByUsername(username) {
    const normalized = username.trim();
    if (!normalized) {
      throw createError("Username cannot be empty", {
        userMessage: "Please provide a valid Roblox username.",
      });
    }

    const resolved = await resolveUserByUsername(normalized);
    return resolved.id;
  }

  async function getGroupMembers(groupId, limit = 10) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    try {
      const result = await fetchJsonWithLimitFallback(
        (resolvedLimit) =>
          `https://groups.roblox.com/v1/groups/${groupId}/users?limit=${resolvedLimit}&sortOrder=Desc`,
        safeLimit
      );
      return result.data || [];
    } catch (error) {
      if (error.status === 403 || error.status === 404) {
        throw createError("Group not found or inaccessible", {
          userMessage: "Cannot access this group or it does not exist.",
        });
      }
      throw error;
    }
  }

  async function getCurrentlyWearing(userId) {
    try {
      const result = await fetchJson(`https://avatar.roblox.com/v1/users/${userId}/avatar`);

      if (!result) return { accessories: [] };

      return {
        accessories: result.accessories || [],
        bodyColors: result.bodyColors || null,
        emoteAssetId: result.emoteAssetId || null,
      };
    } catch (error) {
      if (error.status === 403) {
        throw createError("Avatar is private", {
          code: "ROBLOX_PRIVATE_DATA",
          userMessage: "This user's avatar data is private.",
        });
      }
      throw error;
    }
  }

  return {
    ASSET_TYPE_CHOICES,
    formatDate,
    resolveUserByUsername,
    resolveUserIdByUsername,
    getUserDetails,
    getAvatarHeadshot,
    getSocialCounts,
    getFriends,
    getFollowers,
    getFollowing,
    getGroups,
    getBadges,
    getInventory,
    getCollectibles,
    getInventoryWithSaleInfo,
    getGiftcardToyLikeItems,
    getAllOffsalesAcrossCategories,
    getUsernameHistory,
    getOutfits,
    getUserGames,
    getGroupInfo,
    getGroupMembers,
    getCurrentlyWearing,
    userOwnsAsset,
  };
}

module.exports = {
  createRobloxService,
  ASSET_TYPE_CHOICES,
};