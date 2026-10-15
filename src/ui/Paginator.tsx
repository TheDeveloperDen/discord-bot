import { ButtonStyle, MessageFlags } from "discord.js";
import { ActionRow, Message, renderDiscordMessage } from "disjsx";
import type { ReactElement } from "react";
import {
	type ComponentArgs,
	type ComponentDefinition,
	defineComponent,
} from "../components/component.js";

export interface PageRequest {
	offset: number;
	limit: number;
}

export interface Page<T> {
	items: T[];
	/** How many items there are across every page */
	total: number;
}

export interface PageView<T> {
	items: T[];
	/** Index of the first item in the whole list, e.g. for numbering rows */
	offset: number;
	/** "Page x of N", or undefined when everything fits on one page. Meant for a `<Card>` footer */
	footer?: string;
}

export interface PaginatorDefinition<A extends readonly string[], T> {
	/** The page buttons' component id, e.g. `"leaderboard:page"` */
	id: string;
	/** What the list depends on, kept in the buttons' customIds, e.g. `["type"]`. Only the last may contain `:` */
	args?: A;
	pageSize: number;
	/** Called on every page turn, so the list is always current */
	fetch(
		args: ComponentArgs<A>,
		request: PageRequest,
	): Page<T> | Promise<Page<T>>;
	/** The page's card. The paginator adds the buttons after it */
	render(view: PageView<T>, args: ComponentArgs<A>): ReactElement;
}

export interface PageOptions {
	/** The user whose clicks turn this message's pages. Anyone else gets their own ephemeral copy */
	owner: string;
	/** Zero-based. Past the end shows the last page */
	page?: number;
	ephemeral?: boolean;
}

/** Registered as a module component so the router routes its buttons */
export type Paginator<A extends readonly string[]> = ComponentDefinition<
	"button",
	readonly string[]
> & {
	/** A message showing one page, to send or reply with */
	message(
		args: ComponentArgs<A>,
		options: PageOptions,
	): Promise<ReturnType<typeof renderDiscordMessage>>;
};

/**
 * A list split into pages with previous / next buttons. Stateless: the buttons' customIds hold the page,
 * the owner and the list's args, and every click fetches that page again, so set up caching if the queries are slow!
 * Register the result as a module component.
 */
export function definePaginator<const A extends readonly string[], T>(
	definition: PaginatorDefinition<A, T>,
): Paginator<A> {
	const { pageSize } = definition;
	const userArgs: readonly string[] = definition.args ?? [];
	for (const reserved of ["page", "owner"]) {
		if (userArgs.includes(reserved)) {
			throw new Error(
				`Paginator ${definition.id} can't have an arg named "${reserved}"`,
			);
		}
	}

	async function message(
		args: ComponentArgs<A>,
		{ owner, page = 0, ephemeral }: PageOptions,
	) {
		let current = Math.max(0, page);
		let result = await definition.fetch(args, {
			offset: current * pageSize,
			limit: pageSize,
		});
		const pages = Math.max(1, Math.ceil(result.total / pageSize));
		if (current >= pages) {
			current = pages - 1;
			result = await definition.fetch(args, {
				offset: current * pageSize,
				limit: pageSize,
			});
		}

		const card = definition.render(
			{
				items: result.items,
				offset: current * pageSize,
				footer: pages > 1 ? `Page ${current + 1} of ${pages}` : undefined,
			},
			args,
		);
		// the disabled ends point at the current page, so prev and next never share a customId
		const turnTo = (target: number, label: string, disabled: boolean) => (
			<PageButtonElement
				style={ButtonStyle.Secondary}
				disabled={disabled}
				page={String(target)}
				owner={owner}
				{...(args as Record<string, string>)}
			>
				{label}
			</PageButtonElement>
		);
		return renderDiscordMessage(
			<Message isV2 flags={ephemeral ? MessageFlags.Ephemeral : undefined}>
				{card}
				{pages > 1 && (
					<ActionRow>
						{turnTo(Math.max(0, current - 1), "◀ Previous", current === 0)}
						{turnTo(
							Math.min(pages - 1, current + 1),
							"Next ▶",
							current === pages - 1,
						)}
					</ActionRow>
				)}
			</Message>,
		);
	}

	// typed loosely inside: only this file renders the buttons, and it always passes every arg
	const PageButton = defineComponent({
		id: definition.id,
		kind: "button",
		args: ["page", "owner", ...userArgs],
		async handle(interaction, { page, owner, ...rest }) {
			const args = rest as ComponentArgs<A>;
			const target = Number(page);
			if (owner === undefined) return;
			if (interaction.user.id === owner) {
				await interaction.update(await message(args, { owner, page: target }));
			} else {
				await interaction.reply(
					await message(args, {
						owner: interaction.user.id,
						page: target,
						ephemeral: true,
					}),
				);
			}
		},
	});
	// its arg index signature would swallow the button props, so the element is called untyped
	const PageButtonElement = PageButton as unknown as (
		props: Record<string, unknown>,
	) => ReactElement;

	return Object.assign(PageButton, { message });
}
