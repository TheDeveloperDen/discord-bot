# Database Changes

---

## Reaction Statistics System

### Summary

**1 new table** needs to be created. No existing tables require column modifications.

---

### New Table: `ReactionStats`

#### Table Configuration

- **Table Name:** `ReactionStats`
- **Timestamps:** Auto-managed (`createdAt`, `updatedAt`)

#### Columns

| Column           | Type         | Constraints                          | Description                                                     |
| ---------------- | ------------ | ------------------------------------ | --------------------------------------------------------------- |
| `id`             | INTEGER      | PRIMARY KEY, AUTO INCREMENT          | Unique record identifier (auto-generated)                       |
| `userId`         | BIGINT       | NOT NULL, FOREIGN KEY → Users.id     | The user who added the reaction                                 |
| `messageId`      | BIGINT       | NOT NULL                             | Discord message snowflake that was reacted to                   |
| `messageAuthorId`| BIGINT       | NOT NULL, FOREIGN KEY → Users.id     | The author of the message that received the reaction            |
| `channelId`      | BIGINT       | NOT NULL                             | Discord channel snowflake where the message is located          |
| `emojiName`      | VARCHAR(255) | NOT NULL                             | Emoji identifier (unicode char for standard, name for custom)   |
| `emojiId`        | BIGINT       | NULL                                 | Custom emoji snowflake ID (null for standard unicode emojis)    |
| `isCustomEmoji`  | BOOLEAN      | NOT NULL, DEFAULT false              | Whether this is a custom guild emoji                            |
| `reactedAt`      | TIMESTAMP    | NOT NULL                             | When the reaction was added (for time-based filtering/sorting)  |
| `createdAt`      | TIMESTAMP    | NOT NULL                             | When the record was created                                     |
| `updatedAt`      | TIMESTAMP    | NOT NULL                             | When the record was last updated                                |

#### Indexes

| Index Name                      | Type   | Columns                        | Purpose                                              |
| ------------------------------- | ------ | ------------------------------ | ---------------------------------------------------- |
| `unique_user_message_unicode_emoji` | UNIQUE | `userId`, `messageId`, `emojiName` | Prevents duplicate unicode emoji reactions per user/message |
| `unique_user_message_custom_emoji` | UNIQUE | `userId`, `messageId`, `emojiId` | Prevents duplicate custom emoji reactions per user/message |
| `idx_reactionstats_user_reacted`| INDEX  | `userId`, `reactedAt`          | Fast user stats with time filtering                  |
| `idx_reactionstats_message`     | INDEX  | `messageId`                    | Fast message-level aggregation                       |
| `idx_reactionstats_author_reacted` | INDEX | `messageAuthorId`, `reactedAt` | Fast "who receives most reactions" queries          |
| `idx_reactionstats_emoji_reacted` | INDEX | `emojiName`, `reactedAt`      | Fast emoji popularity queries with time filtering    |
| `idx_reactionstats_reacted_at`  | INDEX  | `reactedAt`                    | Fast time-range scans                                |

#### Foreign Keys

| Column           | References | On Delete         | On Update         |
| ---------------- | ---------- | ----------------- | ----------------- |
| `userId`         | `Users.id` | CASCADE (default) | CASCADE (default) |
| `messageAuthorId`| `Users.id` | CASCADE (default) | CASCADE (default) |

---

### Existing Table Changes: `Users` (DDUser)

**No column changes required.**

Only Sequelize relationship decorators are used in the model, which do not modify the database schema.

---

### SQL Migration (Reference)

```sql
-- Create ReactionStats table
CREATE TABLE "ReactionStats" (
    "id" SERIAL PRIMARY KEY,
    "userId" BIGINT NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "messageId" BIGINT NOT NULL,
    "messageAuthorId" BIGINT NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "channelId" BIGINT NOT NULL,
    "emojiName" VARCHAR(255) NOT NULL,
    "emojiId" BIGINT,
    "isCustomEmoji" BOOLEAN NOT NULL DEFAULT false,
    "reactedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Unique constraints for unicode vs custom emoji identity
CREATE UNIQUE INDEX "unique_user_message_unicode_emoji"
ON "ReactionStats" ("userId", "messageId", "emojiName")
WHERE "isCustomEmoji" = false;

CREATE UNIQUE INDEX "unique_user_message_custom_emoji"
ON "ReactionStats" ("userId", "messageId", "emojiId")
WHERE "isCustomEmoji" = true;

-- Performance indexes for common query patterns
CREATE INDEX "idx_reactionstats_user_reacted"
ON "ReactionStats" ("userId", "reactedAt");

CREATE INDEX "idx_reactionstats_message"
ON "ReactionStats" ("messageId");

CREATE INDEX "idx_reactionstats_author_reacted"
ON "ReactionStats" ("messageAuthorId", "reactedAt");

CREATE INDEX "idx_reactionstats_emoji_reacted"
ON "ReactionStats" ("emojiName", "reactedAt");

CREATE INDEX "idx_reactionstats_reacted_at"
ON "ReactionStats" ("reactedAt");
```

---

## Achievement System

### Summary

**1 new table** needs to be created. No existing tables require column modifications.

---

### New Table: `DDUserAchievements`

#### Table Configuration

- **Table Name:** `DDUserAchievements`
- **Paranoid:** Yes (soft deletes with `deletedAt` column)
- **Timestamps:** Auto-managed (`createdAt`, `updatedAt`, `deletedAt`)

#### Columns

| Column          | Type         | Constraints                      | Description                                                |
| --------------- | ------------ | -------------------------------- | ---------------------------------------------------------- |
| `id`            | INTEGER      | PRIMARY KEY, AUTO INCREMENT      | Unique record identifier (auto-generated)                  |
| `achievementId` | VARCHAR(255) | NOT NULL                         | Achievement definition ID (e.g., "bump_first", "level_10") |
| `ddUserId`      | BIGINT       | NOT NULL, FOREIGN KEY → Users.id | Reference to the user who earned the achievement           |
| `createdAt`     | DATETIME     | NOT NULL                         | When the record was created                                |
| `updatedAt`     | DATETIME     | NOT NULL                         | When the record was last updated                           |
| `deletedAt`     | DATETIME     | NULL                             | Soft delete timestamp (paranoid mode)                      |

#### Indexes

| Index Name                    | Type   | Columns                     | Purpose                                        |
| ----------------------------- | ------ | --------------------------- | ---------------------------------------------- |
| `unique_achievement_ddUserId` | UNIQUE | `achievementId`, `ddUserId` | Prevents duplicate achievement awards per user |

#### Foreign Keys

| Column     | References | On Delete         | On Update         |
| ---------- | ---------- | ----------------- | ----------------- |
| `ddUserId` | `Users.id` | CASCADE (default) | CASCADE (default) |

---

### Existing Table Changes: `Users` (DDUser)

**No column changes required.**

Only a Sequelize relationship decorator was added (`@HasMany`), which creates a TypeScript relationship but does not modify the database schema.

---

### SQL Migration (Reference)

```sql
-- Create DDUserAchievements table
CREATE TABLE "DDUserAchievements" (
    "id" SERIAL PRIMARY KEY,
    "achievementId" VARCHAR(255) NOT NULL,
    "ddUserId" BIGINT NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
    "deletedAt" TIMESTAMP WITH TIME ZONE
);

-- Create unique composite index
CREATE UNIQUE INDEX "unique_achievement_ddUserId"
ON "DDUserAchievements" ("achievementId", "ddUserId");
```
