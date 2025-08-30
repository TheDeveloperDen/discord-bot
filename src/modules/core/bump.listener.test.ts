import { afterEach, beforeAll, expect, mock, test } from "bun:test";
import type {
  Client,
  Message,
  MessageInteraction,
  PartialTextBasedChannelFields,
  User,
} from "discord.js";
import { Bump } from "../../store/models/Bump.js";
import { clearBumpsCache } from "../../store/models/bumps.js";
import {
  clearUserCache,
  getOrCreateUserById,
} from "../../store/models/DDUser.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import {
  handleBumpStreak,
  setLastBumpNotificationTime,
} from "./bump.listener.js";

beforeAll(async () => {
  await initStorage();
});

afterEach(async () => {
  await getSequelizeInstance().destroyAll();
  clearUserCache();
  clearBumpsCache();
  resetLastBumpNotificationTime();
});

function createFakeUser(id: bigint) {
  return {
    id: id.toString(),
    roles: {
      cache: {
        has: (roleId: string) => roleId === "123",
      },
    },
  } as unknown as User;
}

function resetLastBumpNotificationTime() {
  setLastBumpNotificationTime(new Date(0));
}

async function setupMocks() {
  const fakeUserId = 1n;
  const fakeUser = createFakeUser(fakeUserId);
  const ddUser = await getOrCreateUserById(fakeUserId);
  await Bump.create({
    userId: BigInt(fakeUserId),
    timestamp: new Date(),
    messageId: BigInt(2),
  });

  const mockReact = mock(async () => Promise.resolve());

  const mockChannel = {
    send: mock(async () => Promise.resolve()),
  };

  return { ddUser, fakeUser, mockReact, mockChannel };
}

test("simple bump", async () => {
  const { ddUser, fakeUser, mockReact, mockChannel } = await setupMocks();
  await handleBumpStreak(
    ddUser,
    { user: fakeUser } as unknown as MessageInteraction,
    { channel: mockChannel, react: mockReact } as unknown as Message & {
      channel: PartialTextBasedChannelFields;
    },
    {} as unknown as Client,
  );

  expect(mockReact).toHaveBeenCalledTimes(1);
  expect(mockReact).toHaveBeenCalledWith("❤️");
});

test("simple bump with streak", async () => {
  const { ddUser, fakeUser, mockReact, mockChannel } = await setupMocks();
  await Bump.create({
    userId: BigInt(fakeUser.id),
    timestamp: new Date(),
    messageId: BigInt(3),
  });

  await handleBumpStreak(
    ddUser,
    { user: fakeUser } as unknown as MessageInteraction,
    { channel: mockChannel, react: mockReact } as unknown as Message & {
      channel: PartialTextBasedChannelFields;
    },
    {} as unknown as Client,
  );

  expect(mockReact).toHaveBeenCalledTimes(2);
  expect(mockReact).toHaveBeenNthCalledWith(1, "❤️");
  expect(mockReact).toHaveBeenNthCalledWith(2, "🩷");

  expect(mockChannel.send).toHaveBeenCalledTimes(0);
});

test("simple bump with big streak", async () => {
  const { ddUser, fakeUser, mockReact, mockChannel } = await setupMocks();
  for (let i = 0; i < 9; i++) {
    await Bump.create({
      userId: BigInt(fakeUser.id),
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * (10 - i)),
      messageId: BigInt(10 + i),
    });
  }
  await handleBumpStreak(
    ddUser,
    { user: fakeUser } as unknown as MessageInteraction,
    { channel: mockChannel, react: mockReact } as unknown as Message & {
      channel: PartialTextBasedChannelFields;
    },
    {} as unknown as Client,
  );

  expect(mockReact).toHaveBeenCalledTimes(10);
  expect(mockChannel.send).toHaveBeenCalledTimes(2);
  expect(mockChannel.send).toHaveBeenNthCalledWith(
    1,
    expect.stringContaining("max bump streak"),
  );
  expect(mockChannel.send).toHaveBeenNthCalledWith(
    2,
    expect.stringContaining("highest EVER"),
  );
});

test("speedy bump ", async () => {
  const { ddUser, fakeUser, mockReact, mockChannel } = await setupMocks();
  setLastBumpNotificationTime(new Date(Date.now() - 1000));
  await handleBumpStreak(
    ddUser,
    { user: fakeUser } as unknown as MessageInteraction,
    { channel: mockChannel, react: mockReact } as unknown as Message & {
      channel: PartialTextBasedChannelFields;
    },
    {} as unknown as Client,
  );

  expect(mockReact).toHaveBeenCalledTimes(1);
  expect(mockChannel.send).toHaveBeenCalledTimes(1);
  expect(mockChannel.send).toHaveBeenCalledWith(expect.stringContaining("⚡"));
});

test("End other user's streak", async () => {
  const { fakeUser, mockReact, mockChannel } = await setupMocks();
  // user 1 has a nice streak going
  for (let i = 0; i < 5; i++) {
    await Bump.create({
      userId: BigInt(fakeUser.id),
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * (10 - i)),
      messageId: BigInt(10 + i),
    });
  }

  // until evil user 2 comes along
  const otherUserId = 2n;
  const otherUser = await getOrCreateUserById(otherUserId);
  await Bump.create({
    userId: BigInt(otherUserId),
    timestamp: new Date(),
    messageId: BigInt(20),
  });
  await handleBumpStreak(
    otherUser,
    { user: createFakeUser(otherUserId) } as unknown as MessageInteraction,
    { channel: mockChannel, react: mockReact } as unknown as Message & {
      channel: PartialTextBasedChannelFields;
    },
    {
      users: {
        fetch: mock(async (id: string) => {
          if (id === otherUserId.toString())
            return { id: otherUserId.toString() };
          if (id === fakeUser.id) return fakeUser;
          throw new Error("Unknown user");
        }),
      },
    } as unknown as Client,
  );

  expect(mockReact).toHaveBeenCalledTimes(1);
  expect(mockChannel.send).toHaveBeenCalledTimes(1);
  expect(mockChannel.send).toHaveBeenCalledWith(
    expect.stringContaining("ended"),
  );
});
test("End other user's streak with real data", async () => {
  const { fakeUser, mockReact, mockChannel } = await setupMocks();

  await getOrCreateUserById(266973575225933824n);
  await getOrCreateUserById(1118501031488274517n);
  const fake266 = createFakeUser(266973575225933824n);
  const bumps = [
    {
      messageId: 1409196765260943511n,
      userId: 1118501031488274517n,
      timestamp: "2025-08-24 15:24:53.372000 +00:00",
    },
    {
      messageId: 1409229323868700832n,
      userId: 266973575225933824n,
      timestamp: "2025-08-24 17:34:13.906000 +00:00",
    },
    {
      messageId: 1409260216125489343n,
      userId: 266973575225933824n,
      timestamp: "2025-08-24 19:36:59.894000 +00:00",
    },
    {
      messageId: 1409290444470354060n,
      userId: 266973575225933824n,
      timestamp: "2025-08-24 21:37:07.134000 +00:00",
    },
  ];

  await Bump.destroy({
    where: { userId: 1n },
  }); // remove user 1
  for (const bump of bumps) {
    await Bump.create({
      userId: BigInt(bump.userId),
      timestamp: new Date(bump.timestamp),
      messageId: BigInt(bump.messageId),
    });
  }

  // until evil user 2 comes along
  const otherUserId = 2n;
  const otherUser = await getOrCreateUserById(otherUserId);
  await Bump.create({
    userId: BigInt(otherUserId),
    timestamp: new Date(),
    messageId: BigInt(20),
  });

  await handleBumpStreak(
    otherUser,
    { user: createFakeUser(otherUserId) } as unknown as MessageInteraction,
    { channel: mockChannel, react: mockReact } as unknown as Message & {
      channel: PartialTextBasedChannelFields;
    },
    {
      users: {
        fetch: mock(async (id: string) => {
          if (id === otherUserId.toString())
            return { id: otherUserId.toString() };
          if (id === fakeUser.id) return fakeUser;
          if (id === fake266.id) return fake266;
          throw new Error("Unknown user");
        }),
      },
    } as unknown as Client,
  );

  expect(mockReact).toHaveBeenCalledTimes(1);
  expect(mockChannel.send).toHaveBeenCalledTimes(1);
  expect(mockChannel.send).toHaveBeenCalledWith(
    expect.stringContaining("ended"),
  );
});
