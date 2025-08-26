import { User } from "discord.js";
import {
  ModeratorAction,
  ModeratorActions,
} from "../../store/models/ModeratorActions.js";
import { getOrCreateUserById } from "../../store/models/DDUser.js";

export const createTempBanModAction: (
  moderator: User,
  user: User,
  expires: Date,
  reason: string | null,
) => Promise<ModeratorActions> = async (
  moderator,
  user,
  expires,
  reason = null,
) => {
  const moderatorDDUser = await getOrCreateUserById(BigInt(moderator.id));
  const userDDUser = await getOrCreateUserById(BigInt(user.id));

  const existingAction = await getActiveTempBanModAction(userDDUser.id);

  if (existingAction) {
    existingAction.expires = expires;
    existingAction.reason = reason;
    await existingAction.save();
    return existingAction;
  }

  return await ModeratorActions.create({
    moderatorId: moderatorDDUser.id,
    dduserId: userDDUser.id,
    expires: expires,
    reason: reason,
    action: ModeratorAction.TEMPBAN,
  });
};

export const getActiveTempBanModAction = async (dduserId: bigint) =>
  await ModeratorActions.findOne({
    where: {
      dduserId: dduserId,
      action: ModeratorAction.TEMPBAN,
      expired: false,
    },
  });
