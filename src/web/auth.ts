import { timingSafeEqual } from "node:crypto";

export function hasValidToken(req: Request, token: string) {
	const given = Buffer.from(
		req.headers.get("authorization")?.replace(/^Bearer /, "") ?? "",
	);
	const expected = Buffer.from(token);
	// yay i love not being vulnerable to timing attacks :D
	return given.length === expected.length && timingSafeEqual(given, expected);
}
