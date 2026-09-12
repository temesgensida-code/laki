import nodemailer from 'nodemailer';

/**
 * Creates or retrieves a nodemailer transporter if SMTP is configured
 */
function getTransporter() {
	const host = process.env.SMTP_HOST;
	const port = Number(process.env.SMTP_PORT) || 587;
	const user = process.env.SMTP_USER;
	const pass = process.env.SMTP_PASS;

	if (!host || !user || !pass) {
		return null;
	}

	return nodemailer.createTransporter({
		host,
		port,
		secure: port === 465,
		auth: { user, pass }
	});
}

/**
 * Sends fulfillment notification email to requester and all subscribers
 * @param {object} params
 * @param {string} params.requestTitle
 * @param {string} params.requesterEmail
 * @param {Array<{ email: string, name?: string }>} params.subscribers
 * @param {string} params.fulfilledByName
 * @param {string} params.downloadUrl
 * @param {Date} params.expiresAt
 * @param {string} params.siteUrl
 */
export async function sendResourceFulfilledNotification({
	requestTitle,
	requesterEmail,
	subscribers = [],
	fulfilledByName,
	downloadUrl,
	expiresAt,
	siteUrl
}) {
	// Collect all unique notification emails
	const emailSet = new Set();
	if (requesterEmail) emailSet.add(requesterEmail.trim().toLowerCase());
	for (const sub of subscribers) {
		if (sub.email) emailSet.add(sub.email.trim().toLowerCase());
	}

	const recipients = Array.from(emailSet);
	if (recipients.length === 0) {
		console.log('[Email] No recipients found for notification.');
		return;
	}

	const formattedExpiry = new Intl.DateTimeFormat('en-US', {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone: 'UTC'
	}).format(expiresAt) + ' UTC';

	const subject = `[LakiDrop] Resource Ready: "${requestTitle}" has been shared!`;

	const html = `
<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #16191E; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #DEDCDC;">
	<table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; margin: 0 auto; background-color: #191D23; border: 1px solid #57707A; border-radius: 12px; overflow: hidden;">
		<tr>
			<td style="padding: 24px 32px; background-color: #21262F; border-bottom: 1px solid #57707A;">
				<h1 style="margin: 0; font-size: 20px; font-weight: 700; color: #DEDCDC; letter-spacing: -0.02em;">LakiDrop Community</h1>
			</td>
		</tr>
		<tr>
			<td style="padding: 32px;">
				<div style="display: inline-block; padding: 4px 10px; background-color: rgba(52, 211, 153, 0.15); border: 1px solid #34D399; border-radius: 6px; font-size: 12px; font-weight: 600; color: #34D399; margin-bottom: 16px;">
					Resource Fulfilled
				</div>

				<h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #FFFFFF;">
					"${requestTitle}" is now available to download!
				</h2>

				<p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #989DAA;">
					A community volunteer <strong style="color: #DEDCDC;">${fulfilledByName || 'A Volunteer'}</strong> has uploaded the file you were waiting for via file.io.
				</p>

				<!-- 24h Expiration Alert -->
				<div style="margin: 20px 0; padding: 16px; background-color: rgba(245, 158, 11, 0.1); border: 1px solid #F59E0B; border-radius: 8px;">
					<strong style="color: #FBBF24; font-size: 13px;">⏳ 24-Hour Expiration Rule:</strong>
					<p style="margin: 4px 0 0; font-size: 13px; color: #DEDCDC;">
						This file will only remain available for <strong>24 hours</strong> and will expire on <strong style="color: #FBBF24;">${formattedExpiry}</strong>. Please download it promptly.
					</p>
				</div>

				<!-- Download Button -->
				<div style="margin: 28px 0; text-align: center;">
					<a href="${downloadUrl}" style="display: inline-block; padding: 12px 28px; background-color: #57707A; color: #FFFFFF; text-decoration: none; font-size: 14px; font-weight: 600; border-radius: 8px; border: 1px solid #7B919C;">
						Download Resource Now
					</a>
				</div>

				<p style="margin: 24px 0 0; font-size: 12px; color: #7B919C; line-height: 1.5;">
					You received this message because you requested this resource or clicked "I need this too" on the LakiDrop community board.
				</p>
			</td>
		</tr>
		<tr>
			<td style="padding: 16px 32px; background-color: #16191E; border-top: 1px solid rgba(87, 112, 122, 0.4); text-align: center; font-size: 11px; color: #57707A;">
				LakiDrop P2P & Community Resource Exchange &bull; <a href="${siteUrl}" style="color: #7B919C; text-decoration: none;">Visit Site</a>
			</td>
		</tr>
	</table>
</body>
</html>
	`.trim();

	const transporter = getTransporter();

	if (transporter) {
		try {
			const fromAddress = process.env.SMTP_FROM || `"LakiDrop Community" <${process.env.SMTP_USER}>`;
			console.log(`[Email] Sending fulfillment emails to ${recipients.length} recipient(s)...`);

			await transporter.sendMail({
				from: fromAddress,
				to: recipients,
				subject,
				html
			});

			console.log(`[Email] Notification sent successfully to: ${recipients.join(', ')}`);
		} catch (err) {
			console.error('[Email] Failed to send email via SMTP:', /** @type {Error} */ (err).message);
		}
	} else {
		// Development mode fallback logging
		console.log('\n================== [COMMUNITY NOTIFICATION EMAIL SIMULATION] ==================');
		console.log(`To: ${recipients.join(', ')}`);
		console.log(`Subject: ${subject}`);
		console.log(`Resource: "${requestTitle}"`);
		console.log(`Fulfilled By: ${fulfilledByName}`);
		console.log(`Download Link: ${downloadUrl}`);
		console.log(`Expires At: ${formattedExpiry}`);
		console.log('NOTE: To send live emails, define SMTP_HOST, SMTP_USER, and SMTP_PASS in .env');
		console.log('===============================================================================\n');
	}
}
