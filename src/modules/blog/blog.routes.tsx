import { ButtonStyle, type Client } from "discord.js";
import { ActionRow, Button, Message, renderDiscordMessage } from "disjsx";
import { config } from "../../Config.js";
import { logger } from "../../logging.js";
import { findUserByGitHubUsername } from "../../store/models/DDUser.js";
import { Card } from "../../ui/Card.js";
import { withoutPings } from "../../ui/index.js";
import { excerpt, truncateTo } from "../../util/strings.js";
import { hasValidToken } from "../../web/auth.js";

const WEBSITE_URL = process.env.WEBSITE_URL ?? "https://developerden.org";

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const GITHUB_LOGIN_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const MAX_POSTS = 10;
const MAX_LIST = 10;

const MAX_THREAD_NAME_LENGTH = 100;
const MAX_EXCERPT_LENGTH = 1500;

/**
 * A newly published post, as sent by the blog repo's `tools/announce.ts`.
 * A kind of dumb carbon copy of the `Announcement` type in the blog's `tools/post.ts`.
 * One day I will replace with something nicer
 */
interface Announcement {
	slug: string;
	title: string;
	authors: string[];
	tags: string[];
	/** The start of the post, as markdown that is shown as it is */
	excerpt: string;
}

const isList = (value: unknown, pattern: RegExp): value is string[] =>
	Array.isArray(value) &&
	value.length <= MAX_LIST &&
	value.every((item) => typeof item === "string" && pattern.test(item));

/** The request is authenticated, but transmitted over an HTTP request so this is more of a sanity check than an actual security check */
function parseAnnouncement(value: unknown): Announcement | undefined {
	if (typeof value !== "object" || value === null) return undefined;
	const { slug, title, authors, tags, excerpt } = value as Record<
		string,
		unknown
	>;
	if (
		typeof slug !== "string" ||
		!SLUG_PATTERN.test(slug) ||
		typeof title !== "string" ||
		!title.trim() ||
		typeof excerpt !== "string" ||
		!isList(authors, GITHUB_LOGIN_PATTERN) ||
		!isList(tags, SLUG_PATTERN)
	)
		return undefined;
	return { slug, title, authors, tags, excerpt };
}

const escapeMarkdown = (text: string) =>
	text.replace(/[\\*_~`|>#[\]<]/g, "\\$&");

const linkedUserId = async (login: string) =>
	(await findUserByGitHubUsername(login))?.id.toString();

async function announce(
	client: Pick<Client, "channels">,
	channelId: string,
	post: Announcement,
) {
	const channel = await client.channels.fetch(channelId);
	if (!channel?.isSendable()) throw new Error("blog channel is not sendable");

	// the first author is shown with their avatar, any others in the footer
	const [first, ...others] = post.authors;
	const [firstUserId, ...otherUserIds] = await Promise.all(
		post.authors.map(linkedUserId),
	);
	const coAuthors = others.map((login, i) =>
		otherUserIds[i]
			? `<@${otherUserIds[i]}>`
			: `[${login}](https://github.com/${login})`,
	);
	const footer = [
		coAuthors.length > 0 && `with ${coAuthors.join(", ")}`,
		post.tags.map((tag) => `\`${tag}\``).join(" "),
	]
		.filter(Boolean)
		.join(" · ");

	const message = await channel.send(
		withoutPings({
			...renderDiscordMessage(
				<Message isV2>
					<Card
						author={
							first
								? {
										name: first,
										url: `https://github.com/${first}`,
										iconUrl: `https://github.com/${first}.png`,
										userId: firstUserId,
									}
								: undefined
						}
						title={escapeMarkdown(truncateTo(post.title.trim(), 200))}
						description={excerpt(post.excerpt.trim(), {
							maxLength: MAX_EXCERPT_LENGTH,
						})}
						footer={footer || undefined}
					/>
					<ActionRow>
						<Button
							style={ButtonStyle.Link}
							url={`${WEBSITE_URL}/blog/${post.slug}`}
						>
							Read the full post
						</Button>
					</ActionRow>
				</Message>,
			),
		}),
	);

	// try and make a thread to discuss the post
	await message
		.startThread({
			name: truncateTo(post.title.trim(), MAX_THREAD_NAME_LENGTH),
		})
		.catch((error) =>
			logger.warn(
				`Could not start a thread for blog post ${post.slug}: ${error}`,
			),
		);
}

/**
 * Called by the blog repo's `publish` action with the posts it just added.
 * Requires authentication with the `GITHUB_LOOKUP_TOKEN`
 */
export function blogRoutes(
	client: Pick<Client, "channels">,
): Record<string, (req: Request) => Promise<Response>> {
	const token = process.env.GITHUB_LOOKUP_TOKEN;
	const channelId = config.channels.blog;
	if (!token || !channelId) return {};
	const announced = new Set<string>(); // simple in-memory cache to avoid potential double posts

	return {
		"/api/blog/announce": async (req: Request) => {
			if (req.method !== "POST") {
				return Response.json({ error: "Method not allowed" }, { status: 405 });
			}
			if (!hasValidToken(req, token)) {
				return Response.json({ error: "Unauthorized" }, { status: 401 });
			}
			const body = (await req.json().catch(() => null)) as {
				posts?: unknown;
			} | null;
			const parsed = Array.isArray(body?.posts)
				? body.posts.map(parseAnnouncement)
				: [];
			const posts = parsed.filter((post) => post !== undefined);
			if (
				posts.length === 0 ||
				posts.length !== parsed.length ||
				posts.length > MAX_POSTS
			) {
				return Response.json(
					{ error: `Expected 1-${MAX_POSTS} valid posts` },
					{ status: 400 },
				);
			}

			const results = [];
			let failed = false;
			for (const post of posts) {
				const { slug } = post;
				if (announced.has(slug)) {
					results.push({ slug, posted: false, duplicate: true });
					continue;
				}

				announced.add(slug);
				try {
					await announce(client, channelId, post);
					results.push({ slug, posted: true });
				} catch (error) {
					announced.delete(slug);
					failed = true;
					logger.error(`Could not announce blog post ${slug}: ${error}`);
					results.push({ slug, posted: false, error: String(error) });
				}
			}
			return Response.json({ results }, { status: failed ? 502 : 200 });
		},
	};
}
