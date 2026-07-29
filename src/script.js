require("dotenv").config();
const fetch = require("node-fetch");
const { Client, GatewayIntentBits } = require("discord.js");
const { checkWordleResults, parseWordleMessage } = require("./wordle.js");
const { loadEnvFromSupabase, loadBannedPlayers, addChangelogEntry, getAllPlayerCredentials, getMostRecentStats, insertPlayerStatistics, upsertPlayerCredentials, updatePlayerIgn, updatePlayerStatus } = require("./supabase.js");
const { getDataFromPlayer, getCatacombsBracket, getSkyblockBracket, getNetworthBracket } = require("./datafetch.js");

const apiKey = process.env.HYPIXEL_API_KEY;
const codeRunner = process.env.CODE_RUNNER_NAME;
const SKYBLOCK_ROLES = ["480+", "440 - 479", "400 - 439", "360 - 399", "320 - 359", "280 - 319", "240 - 279", "200 - 239", "160 - 199", "120 - 159", "80 - 119", "40 - 79", "0 - 39"];
const CATACOMBS_ROLES = ["Cata 30+", "Cata 35+", "Cata 40+", "Cata 45+", "Cata 50+"];
const NETWORTH_ROLES = ["1B+", "5B+", "10B+", "25B+", "100B+"];
let GUILD_ROLES = [];
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

let channel;
let wordleChannel;
let discordGuild;
let dcToken;
let guildNames;
let botTextSendChannelId;
let wordleChannelId;
let serverId;

async function logChange(message) {
	console.log(message);
	const timestamp = new Date().toISOString();
	await addChangelogEntry(message, timestamp);
	if (channel) await channel.send(message);
}

function warnWithBigText(message) {
	console.log("##############################################");
	console.log("##############################################");
	console.log("##############################################");
	console.log(message);
	console.log("##############################################");
	process.exit(1);
}

async function manageUserRoles(discordMember, skyblockBracket, catacombsBracket, networthBracket, guildRole) {
	if (!discordMember) return;

	const allRoles = discordGuild.roles.cache;
	const notInGuildRole = allRoles.find(role => role.name == "Not in guild");

	try {
		const desiredRoles = new Set();

		if (!guildRole) {
			if (notInGuildRole) desiredRoles.add(notInGuildRole.id);
		} else {
			const sbRole = allRoles.find(role => role.name == skyblockBracket);
			const cataRole = allRoles.find(role => role.name == catacombsBracket);
			const nwRole = allRoles.find(role => role.name == networthBracket);
			const gRole = allRoles.find(role => role.name == guildRole);

			if (sbRole) desiredRoles.add(sbRole.id);
			if (cataRole) desiredRoles.add(cataRole.id);
			if (nwRole) desiredRoles.add(nwRole.id);
			if (gRole) desiredRoles.add(gRole.id);
		}

		const managedRoles = [...Object.values(SKYBLOCK_ROLES), ...Object.values(CATACOMBS_ROLES), ...Object.values(NETWORTH_ROLES), ...GUILD_ROLES, "Not in guild"];

		for (const roleName of managedRoles) {
			const role = allRoles.find(role => role.name == roleName);
			if (!role) continue;

			const hasRole = discordMember.roles.cache.has(role.id);
			const shouldHave = desiredRoles.has(role.id);

			if (hasRole && !shouldHave) await discordMember.roles.remove(role);
			if (!hasRole && shouldHave) await discordMember.roles.add(role);
		}
	} catch (error) {
		console.error(`Error managing roles for ${discordMember.displayName}:`, error);
	}
}

async function fetchWithRetry(url, retries = 5) {
	for (let i = 0; i < retries; i++) {
		try {
			const res = await fetch(url);
			if (res.ok) return res;
			console.warn(`Request failed (attempt ${i + 1}/${retries}): ${url} — status ${res.status}`);
		} catch (err) {
			console.warn(`Request error (attempt ${i + 1}/${retries}): ${url} — ${err.message}`);
		}
		if (i < retries - 1) await new Promise(resolve => setTimeout(resolve, 1000));
	}
	return null;
}

async function fetchGuildMembers(name, label) {
	const findRes = await fetch(`https://api.hypixel.net/findGuild?key=${apiKey}&byName=${name}`);
	const findResText = await findRes.text();
	if (findRes.status == 403 || findResText.includes("Forbidden")) warnWithBigText("Invalid API Key");

	const { success, guild: guildId } = JSON.parse(findResText);
	if (!success || !guildId) warnWithBigText(`Hypixel guild not found: ${label}`);

	const guildRes = await fetch(`https://api.hypixel.net/guild?key=${apiKey}&id=${guildId}`);
	const guildJson = await guildRes.json();
	if (!guildJson.success || !guildJson.guild) warnWithBigText(`Failed to fetch guild data: ${label}`);

	return guildJson.guild.members;
}

(async () => {
	if (!codeRunner) return console.log("No code runner found. Please add it in the .env file.");
	console.log("Fetching .env from supabase...");
	const env = await loadEnvFromSupabase();

	dcToken = env.dcToken;
	guildNames = env.guildNames;
	botTextSendChannelId = env.botTextSendChannelId;
	wordleChannelId = env.wordleChannelId;
	serverId = env.serverId;
	GUILD_ROLES = guildNames;

	client.login(dcToken);
	client.once("ready", async () => {
		try {
			channel = await client.channels.fetch(botTextSendChannelId);
			discordGuild = await client.guilds.fetch(serverId);

			if (wordleChannelId) {
				try {
					wordleChannel = await client.channels.fetch(wordleChannelId);
					console.log(`Connected to Wordle channel: ${wordleChannel.name}`);
				} catch (error) {
					console.error("Error setting up Wordle channel:", error);
					console.log("Make sure WORDLE_CHANNEL is correct in your .env file");
				}
			} else {
				console.log("WORDLE_CHANNEL not configured in .env file");
			}

			console.log(`Connected to Discord server: ${discordGuild.name}`);
		} catch (error) {
			console.error("Error setting up Discord connection:", error);
			console.log("Make sure GUILD_ID and CHANNEL_ID are correct in your .env file");
		}
	});

	console.log("Waiting for Discord client to be ready...");
	await new Promise(resolve => {
		if (client.isReady()) {
			resolve();
		} else {
			client.once("ready", resolve);
		}
	});

	await new Promise(resolve => setTimeout(resolve, 2000));

	// return channel.send("what the hell");

	await checkWordleResults(wordleChannel);

	if (process.argv.slice(2).includes("wordle")) {
		console.log("Wordle-only mode complete.");
		if (client) client.destroy();
		process.exit(1);
		return;
	}

	const bannedSet = await loadBannedPlayers();

	console.log("Loading player credentials from Supabase...");
	const credentialsMap = await getAllPlayerCredentials();
	console.log(`Loaded ${credentialsMap.size} player credentials from Supabase`);

	console.log("Loading most recent stats from Supabase...");
	const previousStatsMap = await getMostRecentStats();
	console.log(`Loaded stats for ${previousStatsMap.size} players from Supabase`);

	if (!discordGuild) warnWithBigText("Discord server information missing.");

	const guildMembersResults = await Promise.all(guildNames.map((name, i) => fetchGuildMembers(name, `Guild ${i + 1}`)));
	const allMembers = guildMembersResults.flatMap((members, i) => members.map(m => ({ ...m, guildRole: guildNames[i] })));

	let dcUsersByNickname = new Map();
	let dcUsersById = new Map();

	try {
		console.log("Fetching Discord server members...");
		await discordGuild.members.fetch();
		const discordMembers = discordGuild.members.cache;

		discordMembers.forEach(member => {
			const discordId = member.user.id;
			const nickname = member.displayName;

			dcUsersById.set(discordId, member);
			dcUsersByNickname.set(nickname, member);
		});

		console.log(`Loaded ${dcUsersById.size} Discord members by ID`);
	} catch (error) {
		console.error("Error fetching Discord members:", error);
	}

	const currentCredentials = {};
	const newStatsToInsert = [];
	const claimedDiscordIds = new Set();
	const skippedMembers = new Set();
	const newDuplicateDiscordIdLog = [];
	let count = 0;

	for (const member of allMembers) {
		try {
			member.uuid = member.uuid.replace(/-/g, "");
			count++;
			console.log(`Processing ${count}/${allMembers.length}: ${member.uuid}`);

			const [mojangRes, profileApi] = await Promise.all([fetchWithRetry(`https://sessionserver.mojang.com/session/minecraft/profile/${member.uuid}`), fetchWithRetry(`https://api.hypixel.net/v2/skyblock/profiles?key=${apiKey}&uuid=${member.uuid}`)]);

			let username = mojangRes ? (await mojangRes.json()).name : "undefined";

			if (bannedSet.has(member.uuid)) await logChange(`Banned player detected in guild: ${username} (${member.uuid})`);

			let allData = null;
			let fetchFailed = false;

			if (!profileApi) {
				console.warn(`Skipping stats for ${username} — Hypixel API failed after retries.`);
				fetchFailed = true;
			} else {
				const profileApiJson = await profileApi.json();
				allData = await getDataFromPlayer(profileApiJson, member.uuid);
			}

			let discordMember = null;
			const existingCredentials = credentialsMap.get(member.uuid);

			if (existingCredentials) {
				const discordId = existingCredentials.discord_id ?? null;

				if (discordId && discordId != "undefined") {
					discordMember = dcUsersById.get(discordId) ?? null;
				}

				if (existingCredentials.ign != username && username != "undefined") {
					await logChange(`${existingCredentials.ign} changed their Minecraft username to ${username}.`);
					await updatePlayerIgn(member.uuid, username);
				}
			}

			if (!discordMember) {
				discordMember = dcUsersByNickname.get(username) ?? null;
			}

			if (discordMember) {
				if (claimedDiscordIds.has(discordMember.user.id)) {
					discordMember = null;
				} else {
					claimedDiscordIds.add(discordMember.user.id);

					if (discordMember.nickname != username) {
						try {
							const oldDisplayName = discordMember.displayName;
							await logChange(`Updated Discord nickname for ${discordMember.nickname || discordMember.user.username} to ${username}.`);
							await discordMember.setNickname(username);
							dcUsersByNickname.delete(oldDisplayName);
							dcUsersByNickname.set(username, discordMember);
						} catch (error) {
							if (error.code == 50013) {
								console.error("Bot lacks permissions to manage nicknames.");
							} else {
								console.error(`Error updating nickname for ${discordMember.user.username}:`, error);
							}
						}
					}
				}
			}

			const discordIdFromMember = discordMember ? discordMember.user.id : null;

			if (discordIdFromMember) {
				for (const [otherUuid, otherCredentials] of credentialsMap.entries()) {
					if (otherUuid != member.uuid && otherCredentials.discord_id == discordIdFromMember) {
						newDuplicateDiscordIdLog.push({ discordId: discordIdFromMember, uuids: [otherUuid, member.uuid], igns: [otherCredentials.ign, username] });
					}
				}
			}

			await upsertPlayerCredentials(member.uuid, username, discordIdFromMember, member.guildRole);

			credentialsMap.set(member.uuid, {
				ign: username,
				discord_id: discordIdFromMember,
			});

			if (username != "undefined" && !discordMember) {
				console.log(`Discord member not found for Minecraft user: ${username}`);
			}

			currentCredentials[member.uuid] = {
				username,
				discordIdFromMember,
				guildRole: member.guildRole,
			};

			if (fetchFailed) {
				skippedMembers.add(member.uuid);
			} else if (!newStatsToInsert.find(s => s.uuid == member.uuid)) {
				newStatsToInsert.push({
					uuid: member.uuid,
					experiences: allData.experiences,
					money: allData.money,
					mining: allData.mining,
					completions: allData.completions,
					dungeon: allData.dungeon,
					slayers: allData.slayers,
					misc: allData.misc,
					selections: allData.selections,
				});
			}

			await new Promise(resolve => setTimeout(resolve, 1000));
		} catch (error) {
			console.log(error);
		}
	}

	console.log("Managing Discord roles for all members...");

	const discordIdToUUID = new Map();
	const duplicateDiscordIdLog = [];

	for (const [uuid, credentials] of credentialsMap.entries()) {
		const discordId = credentials.discord_id;
		if (!discordId || discordId == "undefined") continue;

		if (discordIdToUUID.has(discordId)) {
			duplicateDiscordIdLog.push({ discordId, uuids: [discordIdToUUID.get(discordId), uuid] });
		} else {
			discordIdToUUID.set(discordId, uuid);
		}
	}

	for (const [discordId, discordMember] of dcUsersById.entries()) {
		const linkedUUID = discordIdToUUID.get(discordId) ?? null;

		if (linkedUUID && currentCredentials[linkedUUID]) {
			const stats = newStatsToInsert.find(item => item.uuid == linkedUUID);
			const guildRole = currentCredentials[linkedUUID].guildRole;

			if (!stats) {
				if (skippedMembers.has(linkedUUID) && previousStatsMap.has(linkedUUID)) {
					const previousStats = previousStatsMap.get(linkedUUID);
					const skyBracket = getSkyblockBracket(previousStats.skyblockLevel);
					const cataBracket = getCatacombsBracket(previousStats.catacombsLevel);
					const networthBracket = getNetworthBracket(previousStats.networth);
					await manageUserRoles(discordMember, skyBracket, cataBracket, networthBracket, guildRole);
				}
				continue;
			}

			const skyBracket = getSkyblockBracket(stats.experiences[0]);
			const cataBracket = getCatacombsBracket(stats.experiences[3]);
			const networthBracket = getNetworthBracket(stats.money[0]);
			await manageUserRoles(discordMember, skyBracket, cataBracket, networthBracket, guildRole);
		} else {
			await manageUserRoles(discordMember, null, null, null, null);
		}
	}

	if (duplicateDiscordIdLog.length > 0) {
		console.log("##############################################");
		console.log("DUPLICATE DISCORD_ID ENTRIES FOUND IN credentialsMap:");
		duplicateDiscordIdLog.forEach(entry => {
			console.log(`  discord_id ${entry.discordId} is linked to multiple uuids: ${entry.uuids.join(", ")}`);
		});
		console.log("Only the first uuid found for each discord_id was used for role assignment this run.");
		console.log("Please check the player_credentials table and clear the stale discord_id manually.");
		console.log("##############################################");
	}

	if (newDuplicateDiscordIdLog.length > 0) {
		console.log("##############################################");
		console.log("NEW DUPLICATE DISCORD_ID ASSIGNMENTS DETECTED THIS RUN:");
		newDuplicateDiscordIdLog.forEach(entry => {
			console.log(`  discord_id ${entry.discordId}: uuid ${entry.uuids[0]} (ign: ${entry.igns[0]}) already had it, uuid ${entry.uuids[1]} (ign: ${entry.igns[1]}) was just assigned the same discord_id.`);
		});
		console.log("Please check the player_credentials table and clear the stale discord_id manually.");
		console.log("##############################################");
	}

	if (newStatsToInsert.length > 0) {
		console.log(`Inserting ${newStatsToInsert.length} player stats to Supabase...`);
		await insertPlayerStatistics(newStatsToInsert);
	}

	if (previousStatsMap.size > 0) {
		const previousUUIDs = new Set(previousStatsMap.keys());
		const currentUUIDs = new Set(Object.keys(currentCredentials));

		const joined = [];
		const left = [];

		for (const uuid of currentUUIDs) {
			if (!previousUUIDs.has(uuid)) {
				joined.push(currentCredentials[uuid].username);
				updatePlayerStatus(uuid, currentCredentials[uuid].guildRole);
			}
		}

		for (const uuid of previousUUIDs) {
			if (!currentUUIDs.has(uuid)) {
				const credentials = credentialsMap.get(uuid);
				if (credentials) {
					left.push(credentials.ign);
					updatePlayerStatus(uuid, "Not in guild");
				}
			}
		}

		for (const uuid of currentUUIDs) {
			if (previousUUIDs.has(uuid)) {
				updatePlayerStatus(uuid, currentCredentials[uuid].guildRole);
			}
		}

		if (joined.length) await logChange(`Welcome to our guild: ${joined.join(", ")}!`);
		if (left.length) await logChange(`Members left: ${left.join(", ")}.`);

		for (const uuid of currentUUIDs) {
			if (previousUUIDs.has(uuid)) {
				const previousStats = previousStatsMap.get(uuid);
				const currentStats = currentCredentials[uuid];

				const previousSBBracket = getSkyblockBracket(previousStats.skyblockLevel);
				const currentSBBracket = getSkyblockBracket(newStatsToInsert.find(item => item.uuid == uuid)?.experiences[0]);

				if (currentSBBracket && previousSBBracket != currentSBBracket) {
					await logChange(`Congratulations ${currentStats.username} on reaching Skyblock level bracket ${currentSBBracket}! Enjoy your new role!`);
				}

				const previousCataBracket = getCatacombsBracket(previousStats.catacombsLevel);
				const currentCataBracket = getCatacombsBracket(newStatsToInsert.find(item => item.uuid == uuid)?.experiences[3]);

				if (currentCataBracket && previousCataBracket != currentCataBracket) {
					await logChange(`Congratulations ${currentStats.username} on reaching Catacombs level bracket ${currentCataBracket}! Enjoy your new role!`);
				}

				const previousNWBracket = getNetworthBracket(previousStats.networth);
				const currentNWBracket = getNetworthBracket(newStatsToInsert.find(item => item.uuid == uuid)?.money[0]);

				if (currentNWBracket && previousNWBracket != currentNWBracket) {
					await logChange(`Congratulations ${currentStats.username} on reaching Networth bracket ${currentNWBracket}! Enjoy your new role!`);
				}
			}
		}
	} else {
		console.log("No previous stats found, skipping change detection.");
	}

	await logChange("Code running completed by " + codeRunner + ".");
	if (client) client.destroy();
	process.exit(0);
})();
