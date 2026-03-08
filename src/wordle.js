export function parseWordleMessage(content) {
	const patterns = [/X\/6:\s*(<@\d+>(?:\s+<@\d+>)*)/, /X\/6[:\s]+(<@[^>]+>(?:\s+<@[^>]+>)*)/];
	for (const pattern of patterns) {
		const match = content.match(pattern);
		if (match) {
			console.log("Found X/6 match:", match[1]);
			const mentions = match[1].match(/<@(\d+)>/g);
			if (mentions) {
				const userIds = mentions.map(mention => mention.match(/<@(\d+)>/)[1]);
				console.log("Extracted user IDs:", userIds);
				return userIds;
			}
		}
	}
	if (content.includes("X/6")) {
		const afterX6 = content.split("X/6")[1];
		if (afterX6) {
			console.log("Content after X/6:", afterX6);
			const mentions = afterX6.match(/<@(\d+)>/g);
			if (mentions) {
				const userIds = mentions.map(mention => mention.match(/<@(\d+)>/)[1]);
				console.log("Aggressively extracted user IDs:", userIds);
				return userIds;
			}
		}
	}
	return [];
}

export async function checkWordleResults(wordleChannel) {
	if (!wordleChannel) {
		console.log("Wordle channel not configured, skipping Wordle check");
		return;
	}
	try {
		console.log("Checking for today's Wordle results...");
		const today = new Date().toISOString().split("T")[0];
		const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
		console.log("Looking for messages from:", today);
		const messages = await wordleChannel.messages.fetch({ limit: 50 });
		console.log(`Fetched ${messages.size} messages`);

		const botId = wordleChannel.client.user.id;
		let foundTodaysWordle = false;

		function formatMentions(ids) {
			if (ids.length == 1) return `<@${ids[0]}>`;
			const mentions = ids.map(id => `<@${id}>`);
			return `${mentions.slice(0, -1).join(", ")} and ${mentions.slice(-1)}`;
		}

		const botSentMessageToday = messages.some(msg => msg.author.id == botId && msg.createdAt.toISOString().split("T")[0] == today);

		if (botSentMessageToday) {
			console.log("Bot has already sent a message in this channel today, skipping");
			return;
		}

		for (const message of messages.values()) {
			const messageDate = message.createdAt.toISOString().split("T")[0];
			if (messageDate != today) {
				continue;
			}

			const content = message.content;
			if (content.includes("Here are yesterday's results:") && content.includes("X/6")) {
				console.log("Found today's Wordle results message!");
				foundTodaysWordle = true;

				const failedUserIds = parseWordleMessage(content);
				console.log(`Found ${failedUserIds.length} failed Wordle attempts.`);
				const mentionsFormatted = formatMentions(failedUserIds);
				const messageTemplates = failedUserIds.length == 1 ? singleFailureMessages : multipleFailureMessages;
				const replyText = messageTemplates[Math.floor(Math.random() * messageTemplates.length)].replace("%s", mentionsFormatted);

				if (wordleChannel) {
					await message.reply(replyText);
					console.log("Replied to Wordle results message");
				}
				break;
			}
		}

		if (!foundTodaysWordle) {
			console.log("No Wordle results found for today, checking yesterday...");
			console.log("Looking for messages from:", yesterday);
			for (const message of messages.values()) {
				const messageDate = message.createdAt.toISOString().split("T")[0];
				if (messageDate != yesterday) {
					continue;
				}

				const content = message.content;
				if (content.includes("Here are yesterday's results:") && content.includes("X/6")) {
					console.log("Found yesterday's Wordle results message!");

					const failedUserIds = parseWordleMessage(content);
					console.log(`Found ${failedUserIds.length} failed Wordle attempts from yesterday.`);
					const mentionsFormatted = formatMentions(failedUserIds);
					const messageTemplates = failedUserIds.length == 1 ? singleFailureMessages : multipleFailureMessages;
					const replyText = messageTemplates[Math.floor(Math.random() * messageTemplates.length)].replace("%s", mentionsFormatted);

					if (wordleChannel) {
						await message.reply(replyText);
						console.log("Replied to yesterday's Wordle results message");
					}
					break;
				}
			}
		}

		if (!foundTodaysWordle) {
			console.log("No Wordle results found for today or yesterday");
		}
	} catch (error) {
		console.error("Error checking Wordle results:", error);
	}
}

const singleFailureMessages = [
	"%s got folded by five letters. Pathetic.",
	"Wordle dunked on %s without mercy.",
	"Five letters. Infinite brain farts. Nice work, %s.",
	"%s tried. Wordle laughed.",
	"Today's Wordle MVP: not %s, that's for sure.",
	"One braincell was not enough, %s.",
	"Wordle handed %s a personal L.",
	"%s got outplayed by the dictionary.",
	"Utter collapse by %s. Shameful stuff.",
	"%s couldn't spell 'win' today.",
	"%s's Wordle skills just entered witness protection.",
	"The word was easy. %s still failed gloriously.",
	"%s just invented a new way to fail Wordle.",
	"%s made Wordle look like rocket science.",
	"%s guessed vibes instead of letters.",
	"One guess in, %s was already lost.",
	"%s just got sent to Wordle rehab.",
	"Retire from Wordle, %s. For everyone's sake.",
	"This wasn't even a hard word, %s.",
	"%s failed so hard, it echoed.",
	"%s dropped the ball, then stomped on it.",
	"You misspelled failure as %s.",
	"Wordle took %s's lunch money.",
	"%s's guesses looked like static noise.",
	"%s just nuked a streak in record time.",
	"We expected failure. %s still surprised us.",
	"Even random letters would've done better than %s.",
	"No notes. Just embarrassment for %s.",
	"Wordle said 'Try again.' %s said 'I can't.'",
	"%s guessed everything but the answer.",
	"We watched it happen in slow motion. %s failed hard.",
	"Next time, just don't, %s.",
	"If losing was art, %s is Picasso.",
	"%s forgot how words work.",
	"%s's performance was aggressively incorrect.",
	"Another day, another L for %s.",
	"%s went full chaos mode. No survivors.",
	"This isn't Wordle. It's %s's crime scene.",
	"Nobody failed like %s failed today.",
	"%s got lost somewhere between W and E.",
	"%s went in confident and came out crying.",
	"%s versus Wordle: fatality.",
	"Five-letter word: loser. Synonym: %s.",
	"Disappointment has a name. It's %s.",
	"%s just rage quit learning altogether.",
	"%s: a cautionary tale in real time.",
	"%s guessed like they were blindfolded and panicking.",
	"%s needs a dictionary and a hug.",
	"You tried, %s. You shouldn't have.",
	"Wordle wasn't hard. %s just is.",
];

const multipleFailureMessages = [
	"%s fumbled the bag in glorious sync.",
	"Not one of you, %s, got it right. Impressive.",
	"%s turned Wordle into a public meltdown.",
	"So much failure in one group. Thanks, %s.",
	"Five-letter word for disaster? %s.",
	"%s: collective proof that guessing is not thinking.",
	"%s made it look like a group challenge to lose.",
	"Nobody expected a group fail. Then came %s.",
	"Every single guess from %s was worse than the last.",
	"Wordle wasn't ready for the mess %s brought.",
	"At least %s were consistent — consistently wrong.",
	"Guessing blindfolded? %s sure were.",
	"United in chaos: %s.",
	"Wordle delivered a curb stomp to %s.",
	"Zero for %s. Absolute carnage.",
	"Wordle posted your results to 'r/cringe', %s.",
	"Today we mourn the attempt by %s.",
	"%s turned five letters into a horror show.",
	"If there were a team trophy for failing, %s just earned it.",
	"%s tanked like it was a group project.",
	"We witnessed synchronized defeat. Thanks, %s.",
	"%s treated Wordle like a spelling bee from hell.",
	"%s are banned from vocabulary permanently.",
	"This wasn't solving. It was butchery by %s.",
	"%s guessed like they were dodging the answer.",
	"Wordle beat %s with a five-letter word and a dream.",
	"%s failed in stereo. Outstanding.",
	"Even auto-fill would've done better than %s.",
	"A dictionary cried when it saw %s play.",
	"Everyone lost. %s just lost louder.",
	"It's called Wordle, not 'How to Fail' — take notes, %s.",
	"%s managed to disappoint expectations already on the floor.",
	"%s redefined what group failure looks like.",
	"This wasn't a puzzle. It was a trap, and %s fell in.",
	"Watching %s fail was today's entertainment.",
	"Six guesses, zero brain cells. Well done, %s.",
	"We hoped for the best. Then %s showed up.",
	"Not even divine intervention could've helped %s.",
	"%s vs. Wordle: history's saddest war.",
	"Wordle walked. %s tripped over it.",
	"Group chat now muted due to %s's performance.",
	"Nobody failed harder, faster, or dumber than %s.",
	"Wordle will never recover from witnessing %s.",
	"Hope died the moment %s started guessing.",
	"Wordle was easy. %s still summoned disaster.",
	"A storm of dumb hit today. It was %s.",
	"%s ruined a streak and some friendships.",
	"We expected noise. We got catastrophe. Thanks, %s.",
	"Let's never speak of %s's Wordle attempt again.",
	"Worst-case scenario: %s made it real.",
];
