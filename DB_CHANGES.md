# Database Changes for Achievement System

## Summary

**1 new table** needs to be created. No existing tables require column modifications.

---

## New Table: `DDUserAchievements`

### Table Configuration

- **Table Name:** `DDUserAchievements`
- **Paranoid:** Yes (soft deletes with `deletedAt` column)
- **Timestamps:** Auto-managed (`createdAt`, `updatedAt`, `deletedAt`)

### Columns

| Column          | Type         | Constraints                      | Description                                                |
| --------------- | ------------ | -------------------------------- | ---------------------------------------------------------- |
| `id`            | BIGINT       | PRIMARY KEY, UNIQUE, NOT NULL    | Unique record identifier                                   |
| `achievementId` | VARCHAR(255) | NOT NULL                         | Achievement definition ID (e.g., "bump_first", "level_10") |
| `ddUserId`      | BIGINT       | NOT NULL, FOREIGN KEY → Users.id | Reference to the user who earned the achievement           |
| `createdAt`     | DATETIME     | NOT NULL                         | When the record was created                                |
| `updatedAt`     | DATETIME     | NOT NULL                         | When the record was last updated                           |
| `deletedAt`     | DATETIME     | NULL                             | Soft delete timestamp (paranoid mode)                      |

### Indexes

| Index Name                    | Type   | Columns                     | Purpose                                        |
| ----------------------------- | ------ | --------------------------- | ---------------------------------------------- |
| `unique_achievement_ddUserId` | UNIQUE | `achievementId`, `ddUserId` | Prevents duplicate achievement awards per user |

### Foreign Keys

| Column     | References | On Delete         | On Update         |
| ---------- | ---------- | ----------------- | ----------------- |
| `ddUserId` | `Users.id` | CASCADE (default) | CASCADE (default) |

---

## Existing Table Changes: `Users` (DDUser)

**No column changes required.**

Only a Sequelize relationship decorator was added (`@HasMany`), which creates a TypeScript relationship but does not modify the database schema.

---

## SQL Migration (Reference)

```sql
-- Create DDUserAchievements table
CREATE TABLE "DDUserAchievements" (
    "id" BIGINT PRIMARY KEY NOT NULL UNIQUE,
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
