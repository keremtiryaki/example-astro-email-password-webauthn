import {
	createEmailVerificationRequest,
	getUserEmailVerificationRequestFromRequest,
	sendVerificationEmailBucket,
	sendVerificationEmail,
	setEmailVerificationRequestCookie
} from "@lib/server/email-verification";

import type { APIContext } from "astro";

export async function POST(context: APIContext): Promise<Response> {
	if (context.locals.session === null || context.locals.user === null) {
		return new Response("Not authenticated", {
			status: 401
		});
	}
	if (context.locals.user.registered2FA && !context.locals.session.twoFactorVerified) {
		return new Response("Forbidden", {
			status: 403
		});
	}

	if (!sendVerificationEmailBucket.check(context.locals.user.id, 1)) {
		return new Response("Too many requests", {
			status: 429
		});
	}

	let verificationRequest = getUserEmailVerificationRequestFromRequest(context);
	if (verificationRequest === null) {
		if (context.locals.user.emailVerified) {
			return new Response("Forbidden", {
				status: 403
			});
		}
		if (!sendVerificationEmailBucket.consume(context.locals.user.id, 1)) {
			return new Response("Too many requests", {
				status: 429
			});
		}
		verificationRequest = createEmailVerificationRequest(context.locals.user.id, context.locals.user.email);
	} else {
		if (!sendVerificationEmailBucket.consume(context.locals.user.id, 1)) {
			return new Response("Too many requests", {
				status: 429
			});
		}
		verificationRequest = createEmailVerificationRequest(context.locals.user.id, verificationRequest.email);
	}

	sendVerificationEmail(verificationRequest.email, verificationRequest.code);
	setEmailVerificationRequestCookie(context, verificationRequest);
	return new Response(null, { status: 204 });
}
