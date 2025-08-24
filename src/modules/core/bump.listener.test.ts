import { afterEach, beforeAll, expect, mock, test } from "bun:test";
import {
  handleBumpStreak,
  setLastBumpNotificationTime,
} from "./bump.listener.js";
import {
  Client,
  Message,
  MessageInteraction,
  PartialTextBasedChannelFields,
  User,
} from "discord.js";
import {
  clearUserCache,
  getOrCreateUserById,
} from "../../store/models/DDUser.js";
import { getSequelizeInstance, initStorage } from "../../store/storage.js";
import { Bump } from "../../store/models/Bump.js";
import { clearBumpsCache } from "../../store/models/bumps.js";

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
      timestamp: new Date(
        new Date().getTime() - 1000 * 60 * 60 * 24 * (10 - i),
      ),
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
  setLastBumpNotificationTime(new Date(new Date().getTime() - 1000));
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
      timestamp: new Date(
        new Date().getTime() - 1000 * 60 * 60 * 24 * (10 - i),
      ),
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
