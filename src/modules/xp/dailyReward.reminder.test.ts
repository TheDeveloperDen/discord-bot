import { test, expect, mock, jest, afterAll } from "bun:test";
import type { Client, Guild, GuildMember, TextChannel } from "discord.js";
import type { DDUser } from "../../store/models/DDUser.js";
import {
  scheduleAllReminders,
  scheduledReminders,
} from "./dailyReward.reminder.js";
import { beforeEach } from "node:test";
import { install } from "@sinonjs/fake-timers";

mock.module("../../store/models/DDUser.js", () => {
  return {
    DDUser: {
      findAll: async () => {
        return [
          { id: 1n, lastDailyTime: new Date() },
          { id: 2n, lastDailyTime: new Date() },
        ] as DDUser[];
      },
      findOrCreate: async (data: { where: { id: bigint } }) => {
        return [
          { id: data.where.id, lastDailyTime: new Date() } as DDUser,
          true,
        ];
      },
    },
  };
});

mock.module("../../util/users.js", () => ({
  isSpecialUser: () => true,
  actualMention: (user: GuildMember) => `<@${user.id}>`,
}));

export function fakeTimers() {
  const clock = install();

  beforeEach(() => {
    clock.reset();
  });

  afterAll(() => {
    clock.uninstall();
  });

  return clock;
}
const clock = fakeTimers();
test("scheduleAllReminders", async () => {
  jest.useFakeTimers();
  console.log(new Date().toLocaleString());
  const mockGuildFetch = mock(
    async () =>
      ({
        members: {
          fetch: mockMembersFetch,
        },
      }) as unknown as Guild,
  );
  const mockChannelSend = mock(async () => Promise.resolve());
  const mockChannelFetch = mock(
    async () =>
      ({
        isSendable: () => true,
        send: mockChannelSend,
      }) as unknown as TextChannel,
  );
  const mockMembersFetch = mock(
    async (id: string) =>
      ({
        id: id,
        user: { tag: `User#${id}` },
        lastDailyTime: new Date(),
      }) as unknown as GuildMember,
  );

  const mockClient = {
    guilds: {
      fetch: mockGuildFetch,
    },
    channels: {
      fetch: mockChannelFetch,
    },
    members: {
      fetch: mockMembersFetch,
    },
  } as unknown as Client;

  await scheduleAllReminders(mockClient);

  expect(mockGuildFetch).toHaveBeenCalledTimes(1);
  expect(mockChannelFetch).toHaveBeenCalledTimes(0); // no immediate reminders

  await clock.tickAsync(1000 * 60 * 60 * 25); // fast forward 24 hours

  expect(scheduledReminders.size).toBe(2); // two users should have reminders scheduled

  expect(mockChannelFetch).toHaveBeenCalledTimes(2); // should have sent reminders for both users
  expect(scheduledReminders.size).toBe(2);
  expect(mockChannelSend).toHaveBeenCalledTimes(2);
  expect(mockChannelSend).toHaveBeenCalledWith({
    content: expect.stringContaining("<@1>"),
  });
  expect(mockChannelSend).toHaveBeenCalledWith({
    content: expect.stringContaining("<@2>"),
  });
});
