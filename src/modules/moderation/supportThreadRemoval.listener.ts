import {
	type AnyThreadChannel,
	type Interaction,
	PermissionFlagsBits,
} from "discord.js";
import { logger } from "../../logging.js";
import type { ModMailTicket } from "../../store/models/ModMailTicket.js";
import { getMemberFromInteraction } from "../../util/member.js";
import {
	closeModMailTicketByModMail,
	createArchiveAttachment,
	getActiveModMailByChannel,
	type ModMailArchiveAttachmentResult,
} from "../modmail/modmail.js";
import {
	sealModMailThreadForRemoval,
	unsealModMailThreadForRemoval,
	withModMailThreadLock,
} from "../modmail/modmailThreadLock.js";
import type { EventListener } from "../module.js";
import {
	createSupportThreadRemovalDm,
	getEligibleSupportThread,
	isSupportThreadRemovalReason,
	parseSupportThreadRemovalCustomId,
	SUPPORT_THREAD_REMOVAL_CUSTOM_ID_PREFIX,
} from "./supportThreadRemoval.js";

const removalInFlightThreadIds = new Set<string>();

export interface SupportThreadRemovalDependencies {
	getActiveModMailByChannel(threadId: bigint): Promise<ModMailTicket | null>;
	createArchiveAttachment(
		thread: AnyThreadChannel,
		modMail: ModMailTicket,
	): Promise<ModMailArchiveAttachmentResult>;
	closeModMailTicketByModMail(modMail: ModMailTicket): Promise<ModMailTicket>;
}

const defaultDependencies: SupportThreadRemovalDependencies = {
	getActiveModMailByChannel,
	createArchiveAttachment,
	closeModMailTicketByModMail,
};

export function createSupportThreadRemovalListener(
	dependencies: SupportThreadRemovalDependencies = defaultDependencies,
): EventListener {
	return {
		async interactionCreate(_, interaction: Interaction) {
			if (
				!interaction.isStringSelectMenu() ||
				!interaction.customId.startsWith(
					`${SUPPORT_THREAD_REMOVAL_CUSTOM_ID_PREFIX}:`,
				)
			) {
				return;
			}

			const request = parseSupportThreadRemovalCustomId(interaction.customId);
			const reason = interaction.values[0];
			if (
				request == null ||
				request.moderatorId !== interaction.user.id ||
				interaction.values.length !== 1 ||
				reason == null ||
				!isSupportThreadRemovalReason(reason)
			) {
				await interaction.deferUpdate();
				await interaction.editReply({
					content: "This support-thread removal request is no longer valid.",
					components: [],
				});
				return;
			}

			if (reason === "cancel") {
				await interaction.deferUpdate();
				await interaction.editReply({
					content:
						"Support-thread removal cancelled. The post was not changed.",
					components: [],
				});
				return;
			}

			if (removalInFlightThreadIds.has(request.threadId)) {
				await interaction.deferUpdate();
				await interaction.editReply({
					content: "A removal for this support post is already in progress.",
					components: [],
				});
				return;
			}

			await interaction.deferUpdate();

			removalInFlightThreadIds.add(request.threadId);
			try {
				return await withModMailThreadLock(request.threadId, async () => {
					if (!interaction.inGuild()) {
						await interaction.editReply({
							content: "This action can only be used in a server.",
							components: [],
						});
						return;
					}

					const thread = await getEligibleSupportThread(
						interaction.client,
						request.threadId,
					);
					if (
						thread == null ||
						interaction.guild == null ||
						thread.guildId !== interaction.guild.id
					) {
						await interaction.editReply({
							content:
								"This support thread is no longer available in a configured support channel.",
							components: [],
						});
						return;
					}

					const member = await getMemberFromInteraction(interaction);
					if (
						member == null ||
						thread
							.permissionsFor(member)
							?.has(PermissionFlagsBits.ManageThreads)
					) {
						await interaction.editReply({
							content:
								"You need the Manage Threads permission to remove support tickets.",
							components: [],
						});
						return;
					}

					if (!thread.manageable) {
						await interaction.editReply({
							content:
								"I cannot manage this support ticket thread, so it was not changed.",
							components: [],
						});
						return;
					}

					if (
						!thread
							.permissionsFor(interaction.client.user)
							?.has(PermissionFlagsBits.ReadMessageHistory)
					) {
						await interaction.editReply({
							content:
								"I cannot read this support ticket's complete message history, so it was not changed.",
							components: [],
						});
						return;
					}

					let modMail: ModMailTicket | null;
					try {
						modMail = await dependencies.getActiveModMailByChannel(
							BigInt(thread.id),
						);
					} catch (error) {
						logger.warn("Unable to load the active ModMail ticket", error);
						await interaction.editReply({
							content:
								"I could not load this support ticket, so the thread was not changed.",
							components: [],
						});
						return;
					}
					if (modMail == null) {
						await interaction.editReply({
							content:
								"This thread is not an active ModMail support ticket, so it was not changed.",
							components: [],
						});
						return;
					}

					let shouldRestoreArchivedState = false;
					let shouldRestoreLockedState = false;
					let sealedForRemoval = false;
					try {
						const barrierReason = `Preparing support ticket removal requested by ${interaction.user.tag} (${interaction.user.id})`;
						try {
							if (!thread.locked) {
								await thread.setLocked(true, barrierReason);
								shouldRestoreLockedState = true;
							}
							if (!thread.archived) {
								await thread.setArchived(true, barrierReason);
								shouldRestoreArchivedState = true;
							}
						} catch (error) {
							logger.warn(
								"Unable to freeze a ModMail ticket before preserving it",
								error,
							);
							await interaction.editReply({
								content:
									"I could not prevent new messages while preserving this ticket, so it was not changed.",
								components: [],
							});
							return;
						}

						let archiveResult: ModMailArchiveAttachmentResult;
						try {
							archiveResult = await dependencies.createArchiveAttachment(
								thread,
								modMail,
							);
						} catch (error) {
							logger.warn("Unable to create a ModMail ticket archive", error);
							await interaction.editReply({
								content:
									"I could not create a recoverable copy of the ticket conversation, so the thread is unchanged.",
								components: [],
							});
							return;
						}
						if (
							!archiveResult.success ||
							archiveResult.attachment == null ||
							archiveResult.latestMessageId === undefined
						) {
							logger.warn(
								"Unable to create a ModMail ticket archive",
								archiveResult.error,
							);
							await interaction.editReply({
								content:
									"I could not create a recoverable copy of the ticket conversation, so the thread is unchanged.",
								components: [],
							});
							return;
						}

						try {
							const creator = await interaction.client.users.fetch(
								modMail.creatorId.toString(),
							);
							await creator.send(
								createSupportThreadRemovalDm(
									thread,
									archiveResult.attachment,
									reason,
								),
							);
						} catch (error) {
							logger.warn(
								"Unable to send the ModMail creator their archive",
								error,
							);
							await interaction.editReply({
								content:
									"I could not send the ticket creator a recoverable copy, so the ticket is still open and the thread is unchanged.",
								components: [],
							});
							return;
						}

						if (!sealModMailThreadForRemoval(request.threadId)) {
							await interaction.editReply({
								content:
									"A new ticket message arrived while its copy was being prepared. The ticket is still open and the thread was not deleted.",
								components: [],
							});
							return;
						}
						sealedForRemoval = true;

						let latestMessageId: string | null;
						try {
							const latestMessages = await thread.messages.fetch({ limit: 1 });
							latestMessageId = latestMessages.first()?.id ?? null;
						} catch (error) {
							logger.warn(
								"Unable to verify the ModMail ticket archive is current",
								error,
							);
							await interaction.editReply({
								content:
									"The ticket creator received a copy, but I could not verify that it was complete. The ticket is still open and the thread was not deleted.",
								components: [],
							});
							return;
						}
						if (latestMessageId !== archiveResult.latestMessageId) {
							await interaction.editReply({
								content:
									"The ticket changed while its copy was being delivered. The ticket is still open and the thread was not deleted.",
								components: [],
							});
							return;
						}
						try {
							await dependencies.closeModMailTicketByModMail(modMail);
						} catch (error) {
							logger.warn(
								"Unable to close a ModMail ticket after preserving it",
								error,
							);
							await interaction.editReply({
								content:
									"The ticket creator received a copy, but I could not close the ticket. The thread was not deleted.",
								components: [],
							});
							return;
						}
						shouldRestoreArchivedState = false;
						shouldRestoreLockedState = false;

						try {
							await thread.delete(
								`Support ticket removed by ${interaction.user.tag} (${interaction.user.id}): ${reason}`,
							);
						} catch (error) {
							logger.warn(
								"Unable to delete a closed ModMail ticket after preserving it",
								error,
							);
							await interaction.editReply({
								content:
									"The ticket creator received a copy and the ticket was closed, but I could not delete the thread.",
								components: [],
							});
							return;
						}

						await interaction.editReply({
							content:
								"The support ticket was removed and its creator received a conversation archive.",
							components: [],
						});
					} finally {
						let restorationFailed = false;
						if (shouldRestoreArchivedState) {
							try {
								await thread.setArchived(
									false,
									"Support ticket removal was aborted",
								);
							} catch (error) {
								restorationFailed = true;
								logger.warn(
									"Unable to reopen a ModMail ticket after aborting removal",
									error,
								);
							}
						}
						if (shouldRestoreLockedState) {
							try {
								await thread.setLocked(
									false,
									"Support ticket removal was aborted",
								);
							} catch (error) {
								restorationFailed = true;
								logger.warn(
									"Unable to unlock a ModMail ticket after aborting removal",
									error,
								);
							}
						}
						if (restorationFailed) {
							try {
								await interaction.editReply({
									content:
										"The ticket was not deleted, but I could not fully restore its thread state. A moderator must reopen or unlock it manually.",
									components: [],
								});
							} catch (replyError) {
								logger.warn(
									"Unable to report that a retained ModMail thread stayed restricted",
									replyError,
								);
							}
						}
						if (sealedForRemoval) {
							unsealModMailThreadForRemoval(request.threadId);
						}
					}
				});
			} finally {
				removalInFlightThreadIds.delete(request.threadId);
			}
		},
	};
}

export const SupportThreadRemovalListener =
	createSupportThreadRemovalListener();
