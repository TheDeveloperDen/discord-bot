import { pgTable, bigint, integer, timestamp, text } from "drizzle-orm/pg-core";

import { relations } from "drizzle-orm";
// import { warnings } from "./moderation"; // Import other tables

export const users = pgTable("Users", {
    id: bigint({ mode: "bigint" }).primaryKey(),
    xp: bigint({ mode: "bigint" }).notNull(),
    level: integer().notNull(),
    bumps: integer().notNull(),
    currentDailyStreak: integer().notNull(),
    highestDailyStreak: integer().notNull(),
    lastDailyTime: timestamp({ withTimezone: true, mode: 'string' }),
    createdAt: timestamp({ withTimezone: true, mode: 'string' }),
    updatedAt: timestamp({ withTimezone: true, mode: 'string' }),
    reputationScore: integer().default(0).notNull(),
    lastReputationUpdate: timestamp({ mode: 'string' }),
    // ... other fields
});


export const usersRelations = relations(users, ({ many }) => ({
    warnings: many(warnings),
    bumps: many(bumps),
}));