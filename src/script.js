require("dotenv").config();
const fetch = require("node-fetch");
const { Client, GatewayIntentBits } = require("discord.js");
const { checkWordleResults, parseWordleMessage } = require("./wordle.js");
const { loadEnvFromSupabase, loadBannedPlayers, addChangelogEntry, getAllPlayerCredentials, getMostRecentStats, insertPlayerStats, upsertPlayerCredentials, updatePlayerIgn, updatePlayerStatus } = require("./supabase.js");

const apiKey = process.env.HYPIXEL_API_KEY;
const codeRunner = process.env.CODE_RUNNER_NAME;
const SKYBLOCK_ROLES = ["480+", "440 - 479", "400 - 439", "360 - 399", "320 - 359", "280 - 319", "240 - 279", "200 - 239", "160 - 199", "120 - 159", "80 - 119", "40 - 79", "0 - 39"];
const CATACOMBS_ROLES = ["Cata 30+", "Cata 35+", "Cata 40+", "Cata 45+", "Cata 50+"];
const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

let channel;
let wordleChannel;
let discordGuild;
let dcToken;
let guildName;
let botTextSendChannelId;
let wordleChannelId;
let serverId;

function getDungeonLevel(experience) {
	const catacombsXpTable = [50, 75, 110, 160, 230, 330, 470, 670, 950, 1340, 1890, 2665, 3760, 5260, 7380, 10300, 14400, 20000, 27600, 38000, 52500, 71500, 97000, 132000, 180000, 243000, 328000, 445000, 600000, 800000, 1065000, 1410000, 1900000, 2500000, 3300000, 4300000, 5600000, 7200000, 9200000, 12000000, 15000000, 19000000, 24000000, 30000000, 38000000, 48000000, 60000000, 75000000, 93000000, 116250000];
	let totalExperience = 0;
	for (let levelIndex = 0; levelIndex < catacombsXpTable.length; levelIndex++) {
		totalExperience += catacombsXpTable[levelIndex];
		if (experience < totalExperience) return levelIndex;
	}
	return 50;
}

function getCatacombsBracket(level) {
	if (level >= 50) return "Cata 50+";
	if (level >= 45) return "Cata 45+";
	if (level >= 40) return "Cata 40+";
	if (level >= 35) return "Cata 35+";
	if (level >= 30) return "Cata 30+";
	return null;
}

function getSkyblockBracket(level) {
	const low = Math.floor(level / 40) * 40;
	const high = low + 39;
	if (high > 480) return `480+`;
	return `${low} - ${high}`;
}

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

async function manageUserRoles(discordMember, skyblockBracket, catacombsBracket, isInGuild) {
	if (!discordMember) return;

	const allRoles = discordGuild.roles.cache;
	const notInGuildRole = allRoles.find(r => r.name === "Not in guild");

	try {
		const desiredRoles = new Set();

		if (!isInGuild) {
			if (notInGuildRole) desiredRoles.add(notInGuildRole.id);
		} else {
			const sbRole = allRoles.find(r => r.name === skyblockBracket);
			const cataRole = allRoles.find(r => r.name === catacombsBracket);

			if (sbRole) desiredRoles.add(sbRole.id);
			if (cataRole) desiredRoles.add(cataRole.id);
		}

		const managedRoles = [...Object.values(SKYBLOCK_ROLES), ...Object.values(CATACOMBS_ROLES), "Not in guild"];

		for (const roleName of managedRoles) {
			const role = allRoles.find(r => r.name == roleName);
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

(async () => {
	console.log("Fetching .env from supabase...");
	const env = await loadEnvFromSupabase();

	dcToken = env.dcToken;
	guildName = env.guildName;
	botTextSendChannelId = env.botTextSendChannelId;
	wordleChannelId = env.wordleChannelId;
	serverId = env.serverId;

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

	const findRes = await fetch(`https://api.hypixel.net/findGuild?key=${apiKey}&byName=${guildName}`);
	const findResText = await findRes.text();
	if (findRes.status == 403 || findResText.includes("Forbidden")) warnWithBigText("Invalid API Key");

	const { success, guild: guildId } = JSON.parse(findResText);
	if (!success || !guildId) warnWithBigText("Hypixel guild not found.");
	if (!discordGuild) warnWithBigText("Discord server information missing.");

	const guildRes = await fetch(`https://api.hypixel.net/guild?key=${apiKey}&id=${guildId}`);
	const guildJson = await guildRes.json();
	if (!guildJson.success || !guildJson.guild) warnWithBigText("Failed to fetch guild data.");

	const members = guildJson.guild.members;
	let dcUsersByNickname = new Map();
	let dcUsersById = new Map();

	try {
		console.log("Fetching Discord server members...");
		await discordGuild.members.fetch();
		const discordMembers = discordGuild.members.cache;

		discordMembers.forEach(member => {
			const nickname = member.nickname ? member.nickname.toLowerCase() : null;
			const discordId = member.user.id;

			dcUsersById.set(discordId, member);

			if (nickname) {
				dcUsersByNickname.set(nickname, member);
			} else {
				dcUsersByNickname.set(discordId, member);
			}
		});

		console.log(`Loaded ${dcUsersById.size} Discord members by ID`);
		console.log(`Loaded ${dcUsersByNickname.size} Discord members by nickname`);
	} catch (error) {
		console.error("Error fetching Discord members:", error);
	}

	const currentData = {};
	const statsToInsert = [];
	const currentTimestamp = new Date().toISOString();
	let count = 0;

	for (const member of members) {
		try {
			count++;
			console.log(`Processing ${count}/${members.length}: ${member.uuid}`);

			const response = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${member.uuid}`);
			let username = response.ok ? (await response.json()).name : "undefined";

			if (bannedSet.has(member.uuid)) {
				await logChange(`Banned player detected in guild: ${username} (${member.uuid})`);
			}

			let catacombsLevel = 0;
			let skyblockLevel = 0;
			let totalFarmingXp = 0;

			const profileApi = await fetch(`https://api.hypixel.net/v2/skyblock/profiles?key=${apiKey}&uuid=${member.uuid}`);
			const profileApiJson = await profileApi.json();

			if (profileApiJson.success && profileApiJson.profiles.length) {
				let catacombsMaxXP = 0;
				for (const profile of profileApiJson.profiles) {
					const data = profile.members?.[member.uuid];
					if (!data) continue;

					const catacombsXp = data.dungeons?.dungeon_types?.catacombs?.experience || 0;
					if (catacombsXp > catacombsMaxXP) catacombsMaxXP = catacombsXp;

					const skyblockXp = Math.floor((data.leveling?.experience || 0) / 100);
					if (skyblockXp > skyblockLevel) skyblockLevel = skyblockXp;

					const addedFarmingXp = Math.trunc(data.player_data?.experience?.SKILL_FARMING || 0);
					totalFarmingXp += addedFarmingXp;
				}
				catacombsLevel = getDungeonLevel(catacombsMaxXP);
			}

			const skyBracket = getSkyblockBracket(skyblockLevel);
			const cataBracket = getCatacombsBracket(catacombsLevel);

			let discordMember = null;
			const existingCredentials = credentialsMap.get(member.uuid);

			if (existingCredentials) {
				const discordId = existingCredentials.discord_username;

				if (discordId && discordId != "undefined") {
					discordMember = dcUsersById.get(discordId) ?? null;
				}

				if (existingCredentials.ign != username && username != "undefined") {
					await logChange(`${existingCredentials.ign} changed their Minecraft username to ${username}.`);
					await updatePlayerIgn(member.uuid, username);
				}

				if (discordMember && discordMember.nickname !== username) {
					try {
						await discordMember.setNickname(username);
						await logChange(`Updated Discord nickname for ${discordMember.user.username} to ${username}`);
					} catch (error) {
						if (error.code == 50013) {
							console.error("Bot lacks permissions to manage nicknames.");
						} else {
							console.error(`Error updating nickname for ${discordMember.user.username}:`, error);
						}
					}
				}
			} else {
				const lowerIGN = username !== "undefined" ? username.toLowerCase() : null;

				if (lowerIGN) {
					discordMember = dcUsersByNickname.get(lowerIGN) ?? null;
				}
			}

			const discordIdFromMember = discordMember ? discordMember.user.id : null;
			await upsertPlayerCredentials(member.uuid, username, discordIdFromMember, true);

			if (username !== "undefined" && !discordMember) {
				console.log(`Discord member not found for Minecraft user: ${username}`);
			}

			currentData[member.uuid] = {
				username,
				catacombsLevel,
				skyblockLevel,
				discordIdFromMember,
				farmingXp: totalFarmingXp,
			};

			statsToInsert.push({
				timestamp: currentTimestamp,
				uuid: member.uuid,
				skyblock_level: skyblockLevel,
				catacombs_level: catacombsLevel,
				farmingxp: totalFarmingXp,
			});
		} catch (error) {
			console.log(error);
		}
	}

	console.log("Managing Discord roles for all members...");

	for (const [discordId, discordMember] of dcUsersById.entries()) {
		let linkedUUID = null;
		for (const [uuid, credentials] of credentialsMap.entries()) {
			if (credentials.discord_username == discordId) {
				linkedUUID = uuid;
				break;
			}
		}

		const entry = Object.entries(currentData).find(([uuid, data]) => data.discordIdFromMember == discordId);

		if (entry) {
			const [linkedUUID, stats] = entry;
			const skyBracket = getSkyblockBracket(stats.skyblockLevel);
			const cataBracket = getCatacombsBracket(stats.catacombsLevel);
			await manageUserRoles(discordMember, skyBracket, cataBracket, true);
		} else if (discordMember.roles.cache.size > 1) {
			await manageUserRoles(discordMember, null, null, false);
		}
	}

	if (statsToInsert.length > 0) {
		console.log(`Inserting ${statsToInsert.length} player stats to Supabase...`);
		await insertPlayerStats(statsToInsert);
	}

	if (previousStatsMap.size > 0) {
		const previousUUIDs = new Set(previousStatsMap.keys());
		const currentUUIDs = new Set(Object.keys(currentData));

		const joined = [];
		const left = [];

		for (const uuid of currentUUIDs) {
			if (!previousUUIDs.has(uuid)) {
				joined.push(currentData[uuid].username);
				updatePlayerStatus(uuid, true);
			}
		}

		for (const uuid of previousUUIDs) {
			if (!currentUUIDs.has(uuid)) {
				const credentials = credentialsMap.get(uuid);
				if (credentials) {
					left.push(credentials.ign);
					updatePlayerStatus(uuid, false);
				}
			}
		}

		if (joined.length) await logChange(`Welcome to our guild: ${joined.join(", ")}!`);
		if (left.length) await logChange(`Members left: ${left.join(", ")}.`);

		for (const uuid of currentUUIDs) {
			if (previousUUIDs.has(uuid)) {
				const previousStats = previousStatsMap.get(uuid);
				const currentStats = currentData[uuid];

				const previousCataBracket = getCatacombsBracket(previousStats.catacombsLevel);
				const currentCataBracket = getCatacombsBracket(currentStats.catacombsLevel);

				if (previousCataBracket !== currentCataBracket) {
					await logChange(`Congratulations ${currentStats.username} on reaching Catacombs level bracket ${currentCataBracket}! Enjoy your new role!`);
				}

				const previousSBBracket = getSkyblockBracket(previousStats.skyblockLevel);
				const currentSBBracket = getSkyblockBracket(currentStats.skyblockLevel);

				if (previousSBBracket !== currentSBBracket) {
					await logChange(`Congratulations ${currentStats.username} on reaching Skyblock level bracket ${currentSBBracket}! Enjoy your new role!`);
				}
			}
		}
	} else {
		console.log("No previous stats found, skipping change detection.");
	}

	await logChange("Code running completed by " + codeRunner);
	if (client) client.destroy();
})();
