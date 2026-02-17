const https = require('https');
const { URL } = require('url');

/**
 * Send a Discord webhook notification
 * @param {string} webhookUrl - Discord webhook URL
 * @param {object} match - Match data
 * @param {string} eventType - Event type (ban/pick/side/ready/coin/match_created/match_complete)
 * @param {object} data - Additional event data
 */
async function sendDiscordNotification(webhookUrl, match, eventType, data = {}) {
    if (!webhookUrl || !isValidDiscordWebhook(webhookUrl)) {
        console.log('[WEBHOOK] Invalid or missing webhook URL, skipping notification');
        return;
    }

    // Only send notification when match is complete
    if (eventType !== 'match_complete') {
        return;
    }

    let embed;

    try {
        embed = formatMatchCompleteMessage(match);
        await sendWebhookRequest(webhookUrl, { embeds: [embed] });
        console.log(`[WEBHOOK] Match complete notification sent`);
    } catch (error) {
        console.error('[WEBHOOK] Error sending notification:', error.message);
    }
}

/**
 * Test webhook connectivity
 */
async function testWebhook(webhookUrl) {
    if (!isValidDiscordWebhook(webhookUrl)) {
        throw new Error('Invalid Discord webhook URL format');
    }

    const embed = {
        title: '✅ Webhook Test Successful',
        description: 'Your Discord webhook is properly configured and working!',
        color: 0x00ff00, // Green
        timestamp: new Date().toISOString(),
        footer: {
            text: 'CS2 Map Veto Bot'
        }
    };

    await sendWebhookRequest(webhookUrl, { embeds: [embed] });
}

/**
 * Validate Discord webhook URL format
 */
function isValidDiscordWebhook(url) {
    if (!url || typeof url !== 'string') return false;

    try {
        const parsed = new URL(url);
        return parsed.hostname === 'discord.com' &&
            parsed.pathname.startsWith('/api/webhooks/');
    } catch {
        return false;
    }
}

/**
 * Send HTTPS request to Discord webhook
 */
function sendWebhookRequest(webhookUrl, payload) {
    return new Promise((resolve, reject) => {
        const url = new URL(webhookUrl);
        const data = JSON.stringify(payload);

        const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve();
                } else {
                    reject(new Error(`Webhook request failed with status ${res.statusCode}: ${responseData}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(data);
        req.end();
    });
}


// Message formatter for match complete with all veto logs

function formatMatchCompleteMessage(match) {
    // Format all logs as a single string
    const vetoLogs = match.logs.join('\n') || 'No veto actions recorded';

    return {
        title: '🏁 CS2 Map Veto Complete',
        description: `**${match.teamA}** vs **${match.teamB}**`,
        color: 0x00d4ff, // Blue
        fields: [
            {
                name: 'Format',
                value: match.format.toUpperCase(),
                inline: true
            },
            {
                name: 'Match ID',
                value: match.id,
                inline: true
            },
            {
                name: '📋 Veto Summary',
                value: `\`\`\`\n${vetoLogs}\n\`\`\``,
                inline: false
            }
        ],
        timestamp: new Date().toISOString(),
        footer: {
            text: 'CS2 Map Veto Bot'
        }
    };
}

module.exports = {
    sendDiscordNotification,
    testWebhook,
    isValidDiscordWebhook
};
