# Roblox Endpoints Used

This document lists Roblox endpoints consumed by the slash-command system in this repository.

## users.roblox.com
- `POST /v1/usernames/users`
  - Resolve username to user ID.
- `GET /v1/users/{userId}`
  - Public user profile metadata.
- `GET /v1/users/authenticated` (auth cookie only)
  - Account identity for auth-scoped calls.

## thumbnails.roblox.com
- `GET /v1/users/avatar`
  - Full avatar image.
- `GET /v1/users/avatar-headshot`
  - Headshot image.
- `GET /v1/users/avatar-bust`
  - Bust image.
- `GET /v1/assets`
  - Asset thumbnail image URLs.
- `GET /v1/users/outfits`
  - Outfit thumbnails.
- `GET /v1/games/icons`
  - Game icon thumbnails.
- `GET /v1/games/multiget/thumbnails`
  - Game banner images.
- `GET /v1/groups/icons`
  - Group icon thumbnails.
- `GET /v1/badges/icons`
  - Badge thumbnails.
- `GET /v1/bundles/thumbnails`
  - Bundle thumbnails.

## games.roblox.com
- `GET /v2/users/{userId}/games`
  - Games created by a user.
- `GET /v1/games?universeIds={ids}`
  - Universe/game details.
- `GET /v1/games/multiget-place-details`
  - Place to universe mapping.
- `GET /v1/games/votes`
  - Vote and favorite counts.
- `GET /v1/games/{placeId}/servers/Public`
  - Public server list.
- `GET /v1/games/{universeId}/game-passes`
  - Game pass listing.
- `GET /v2/groups/{groupId}/games`
  - Group-owned games.
- `GET /v1/games/{universeId}/social-links/list` (fallback)
  - Game social links.

## catalog.roblox.com
- `GET /v1/catalog/items/details`
  - Catalog item details by ID.
- `GET /v1/search/items`
  - Asset search.
- `GET /v1/bundles/{bundleId}/details`
  - Bundle details.

## economy.roblox.com
- `GET /v2/assets/{assetId}/details`
  - Asset details including sale flags.
- `GET /v1/assets/{assetId}/resellers`
  - Reseller listings for limiteds.
- `GET /v1/assets/{assetId}/resale-data`
  - Resale chart and averages.
- `GET /v1/user/currency` (auth cookie only)
  - Robux balance for auth account.
- `GET /v2/transactions?transactionType=Sale` (auth cookie only)
  - Recent sales.
- `GET /v2/transactions?transactionType=Purchase` (auth cookie only)
  - Recent purchases.

## groups.roblox.com
- `GET /v2/users/{userId}/groups/roles`
  - Groups a user belongs to + role metadata.
- `GET /v1/groups/{groupId}`
  - Group details + shout + owner.
- `GET /v1/groups/{groupId}/roles`
  - Group role list.
- `GET /v1/groups/{groupId}/users`
  - Group members.
- `GET /v1/groups/{groupId}/social-links`
  - Group social links.

## friends.roblox.com
- `GET /v1/users/{userId}/friends/count`
  - Friend count.
- `GET /v1/users/{userId}/followers/count`
  - Followers count.
- `GET /v1/users/{userId}/followings/count`
  - Following count.
- `GET /v1/users/{userId}/friends`
  - Friend list.

## presence.roblox.com
- `POST /v1/presence/users`
  - Presence status, game location, online timestamps.

## badges.roblox.com
- `GET /v1/users/{userId}/badges`
  - User badge list.
- `GET /v1/universes/{universeId}/badges`
  - Game badge list.
- `GET /v1/badges/{badgeId}`
  - Badge metadata.
- `GET /v1/badges/{badgeId}/statistics`
  - Badge award/win-rate stats.

## inventory.roblox.com
- `GET /v2/users/{userId}/inventory/{assetTypeId}`
  - User inventory by asset type.

## avatar.roblox.com
- `GET /v1/users/{userId}/avatar`
  - Equipped items, body colors, scales.
- `GET /v1/users/{userId}/outfits`
  - Saved outfits.

## develop.roblox.com
- `GET /v1/universes/{universeId}/social-links/list`
  - Game social links (primary endpoint).

## auth.roblox.com (public/auth-scoped only)
- No mandatory public endpoint required by current commands.
- Auth-scoped behavior is indirectly supported by cookie-dependent economy/users endpoints.

## accountinformation.roblox.com (public/auth-scoped only)
- No mandatory public endpoint required by current commands.

## followings.roblox.com
- Follow counts are resolved through `friends.roblox.com` count endpoints.

## chat.roblox.com (public endpoints only)
- No public endpoints consumed.

## trades.roblox.com (public endpoints only)
- No public endpoints consumed.

## premiumfeatures.roblox.com
- No public endpoint consumed.

## www.roblox.com / asset-thumbnail
- `GET /asset-thumbnail/image?assetId={id}&width=420&height=420&format=png`
  - Raw clothing template image for shirts/pants/t-shirts.

## assetdelivery.roblox.com
- `GET /v1/asset/?id={id}`
  - Attempted texture delivery link for clothing assets.

## Cursor Pagination Notes
- Cursor-based endpoints are traversed until `nextPageCursor` is null.
- Deep pagination is implemented in `paginateCursor` and used by friends, badges, inventory,
  group members, game servers, game passes, and game badges.
