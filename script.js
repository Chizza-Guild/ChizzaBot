require("dotenv").config();
const fetch = require("node-fetch");
const { Client, GatewayIntentBits } = require("discord.js");
const { checkWordleResults, parseWordleMessage } = require("./wordle.js");
const { loadEnvFromSupabase, loadBannedPlayers, addChangelogEntry, getAllPlayerCredentials, getMostRecentStats, insertPlayerStats, upsertPlayerCredentials, updatePlayerIgn } = require("./supabase.js");

const apiKey = process.env.HYPIXEL_API_KEY;
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
	if (high > 480) return `${low}+`;
	return `${low} - ${high}`;
}

async function logChange(message) {
	console.log(message);
	const timestamp = new Date().toISOString();
	await addChangelogEntry(message, timestamp);
	if (channel) await channel.send(message);
}

async function updateDiscordNickname(discordMember, newNickname) {
	if (!discordMember) return;
	try {
		if (discordMember.displayName !== newNickname) {
			await discordMember.setNickname(newNickname);
			console.log(`Updated Discord nickname for ${discordMember.user.username} to ${newNickname}`);
		}
	} catch (error) {
		console.error(`Error updating nickname for ${discordMember.user.username}:`, error);
		if (error.code === 50013) {
			console.error("Bot lacks permissions to manage nicknames. Make sure the bot has 'Manage Nicknames' permission.");
		}
	}
}

async function manageUserRoles(discordMember, skyblockBracket, catacombsBracket, isInGuild = true) {
	if (!discordMember || !discordGuild) {
		console.log("Discord member or guild not available for role management");
		return;
	}

	try {
		console.log(`Managing roles for ${discordMember.displayName}: SB Bracket ${skyblockBracket}, Catacombs ${catacombsBracket}, In Guild: ${isInGuild}`);
		const allRoles = discordGuild.roles.cache;
		const notInGuildRole = allRoles.find(r => r.name == "Not in guild");
		const botRole = allRoles.find(r => r.name === "Bot");

		if (discordMember.roles.cache.size <= 1) {
			console.log(`${discordMember.displayName} has no roles (unverified), skipping role management`);
			return;
		}

		const hasBotRole = botRole && discordMember.roles.cache.has(botRole.id);

		if (!isInGuild) {
			if (notInGuildRole && !discordMember.roles.cache.has(notInGuildRole.id) && !hasBotRole) {
				await discordMember.roles.add(notInGuildRole);
				console.log(`Added "Not in guild" role to ${discordMember.displayName}`);
			}

			const skyblockRolesToRemove = [];
			Object.values(SKYBLOCK_ROLES).forEach(roleName => {
				if (roleName) {
					const role = allRoles.find(r => r.name === roleName);
					if (role && discordMember.roles.cache.has(role.id)) {
						skyblockRolesToRemove.push(role);
					}
				}
			});

			const catacombsRolesToRemove = [];
			Object.values(CATACOMBS_ROLES).forEach(roleName => {
				if (roleName) {
					const role = allRoles.find(r => r.name === roleName);
					if (role && discordMember.roles.cache.has(role.id)) {
						catacombsRolesToRemove.push(role);
					}
				}
			});

			if (skyblockRolesToRemove.length > 0) {
				await discordMember.roles.remove(skyblockRolesToRemove);
				console.log(`Removed Skyblock roles from ${discordMember.displayName} (not in guild): ${skyblockRolesToRemove.map(r => r.name).join(", ")}`);
			}

			if (catacombsRolesToRemove.length > 0) {
				await discordMember.roles.remove(catacombsRolesToRemove);
				console.log(`Removed Catacombs roles from ${discordMember.displayName} (not in guild): ${catacombsRolesToRemove.map(r => r.name).join(", ")}`);
			}

			return;
		} else {
			if (notInGuildRole && discordMember.roles.cache.has(notInGuildRole.id)) {
				await discordMember.roles.remove(notInGuildRole);
				console.log(`Removed "Not in guild" role from ${discordMember.displayName}`);
			}
		}

		const skyblockRolesToRemove = [];
		Object.values(SKYBLOCK_ROLES).forEach(roleName => {
			if (roleName && roleName !== SKYBLOCK_ROLES[skyblockBracket]) {
				const role = allRoles.find(r => r.name === roleName);
				if (role && discordMember.roles.cache.has(role.id)) {
					skyblockRolesToRemove.push(role);
				}
			}
		});

		const catacombsRolesToRemove = [];
		Object.values(CATACOMBS_ROLES).forEach(roleName => {
			if (roleName && roleName !== CATACOMBS_ROLES[catacombsBracket]) {
				const role = allRoles.find(r => r.name === roleName);
				if (role && discordMember.roles.cache.has(role.id)) {
					catacombsRolesToRemove.push(role);
				}
			}
		});

		if (skyblockRolesToRemove.length > 0) {
			await discordMember.roles.remove(skyblockRolesToRemove);
			console.log(`Removed old Skyblock roles from ${discordMember.displayName}: ${skyblockRolesToRemove.map(r => r.name).join(", ")}`);
		}

		if (catacombsRolesToRemove.length > 0) {
			await discordMember.roles.remove(catacombsRolesToRemove);
			console.log(`Removed old Catacombs roles from ${discordMember.displayName}: ${catacombsRolesToRemove.map(r => r.name).join(", ")}`);
		}

		const skyblockRoleName = SKYBLOCK_ROLES[skyblockBracket];
		if (skyblockRoleName) {
			const skyblockRole = allRoles.find(r => r.name === skyblockRoleName);
			if (skyblockRole) {
				if (!discordMember.roles.cache.has(skyblockRole.id)) {
					await discordMember.roles.add(skyblockRole);
					console.log(`Added Skyblock role "${skyblockRoleName}" to ${discordMember.displayName}`);
				} else {
					console.log(`${discordMember.displayName} already has Skyblock role "${skyblockRoleName}"`);
				}
			} else {
				console.log(`Skyblock role "${skyblockRoleName}" not found on server`);
			}
		} else {
			console.log(`No Skyblock role mapping found for bracket "${skyblockBracket}"`);
		}

		const catacombsRoleName = CATACOMBS_ROLES[catacombsBracket];
		if (catacombsRoleName) {
			const catacombsRole = allRoles.find(r => r.name === catacombsRoleName);
			if (catacombsRole) {
				if (!discordMember.roles.cache.has(catacombsRole.id)) {
					await discordMember.roles.add(catacombsRole);
					console.log(`Added Catacombs role "${catacombsRoleName}" to ${discordMember.displayName}`);
				} else {
					console.log(`${discordMember.displayName} already has Catacombs role "${catacombsRoleName}"`);
				}
			} else {
				console.log(`Catacombs role "${catacombsRoleName}" not found on server`);
			}
		} else {
			console.log(`No Catacombs role for bracket "${catacombsBracket}"`);
		}
	} catch (error) {
		console.error(`Error managing roles for ${discordMember.displayName}:`, error);
		if (error.code === 50013) {
			console.error("Bot lacks permissions to manage roles. Make sure the bot role is above the roles it needs to manage and has 'Manage Roles' permission.");
		}
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
	if (findRes.status == 403 || findResText.includes("Forbidden")) {
		console.log("##############################################");
		console.log("##############################################");
		console.log("##############################################");
		console.log("Invalid API Key");
		console.log("##############################################");
		process.exit(1);
	}

	const { success, guild: guildId } = JSON.parse(findResText);
	if (!success || !guildId) {
		console.log("##############################################");
		console.log("##############################################");
		console.log("##############################################");
		console.log("Guild not found");
		console.log("##############################################");
		process.exit(1);
	}

	const guildRes = await fetch(`https://api.hypixel.net/guild?key=${apiKey}&id=${guildId}`);
	const guildJson = await guildRes.json();
	if (!guildJson.success || !guildJson.guild) throw new Error("Failed to fetch guild data");
	const members = guildJson.guild.members;

	let nicknameMap = new Map();
	let memberObjectMap = new Map();

	if (discordGuild) {
		try {
			console.log("Fetching Discord server members...");
			await discordGuild.members.fetch();
			const discordMembers = discordGuild.members.cache;

			discordMembers.forEach(member => {
				const displayName = member.displayName;
				const username = member.user.username;
				nicknameMap.set(displayName.toLowerCase(), username);
				memberObjectMap.set(displayName.toLowerCase(), member);
				if (displayName !== username) {
					nicknameMap.set(username.toLowerCase(), username);
					memberObjectMap.set(username.toLowerCase(), member);
				}
			});

			console.log(`Loaded ${nicknameMap.size} Discord member mappings`);
		} catch (error) {
			console.error("Error fetching Discord members:", error);
		}
	} else {
		console.log("Discord guild not available, skipping Discord integration");
	}

	const currentData = {};
	const statsToInsert = [];
	const currentTimestamp = new Date().toISOString();
	let cnt = 0;

	for (const m of members) {
		cnt++;
		console.log(`Processing ${cnt}/${members.length}: ${m.uuid}`);

		let username = "undefined";
		const resp = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${m.uuid}`);
		if (resp.ok) username = (await resp.json()).name || "undefined";

		let catacombsLevel = 0,
			skyblockLevel = 0,
			totalFarmingXp = 0;

		const p = await fetch(`https://api.hypixel.net/v2/skyblock/profiles?key=${apiKey}&uuid=${m.uuid}`);
		const pj = await p.json();

		if (pj.success && pj.profiles.length) {
			let maxXP = 0;
			for (const prof of pj.profiles) {
				const dat = prof.members?.[m.uuid];
				if (!dat) continue;
				const xp = dat.dungeons?.dungeon_types?.catacombs?.experience || 0;
				if (xp > maxXP) maxXP = xp;
				const lvl = Math.floor((dat.leveling?.experience || 0) / 100);
				if (lvl > skyblockLevel) skyblockLevel = lvl;
				const addedFarmingXp = Math.trunc(dat.player_data?.experience?.SKILL_FARMING || 0);
				totalFarmingXp += addedFarmingXp;
				console.log("Added", addedFarmingXp, "farming xp to", username);
			}
			catacombsLevel = getDungeonLevel(maxXP);
		}

		const skyBracket = getSkyblockBracket(skyblockLevel);
		const cataBracket = getCatacombsBracket(catacombsLevel);

		let discordUsername = null;
		let discordMember = null;

		const existingCredentials = credentialsMap.get(m.uuid);

		if (existingCredentials) {
			discordUsername = existingCredentials.discord_username;
			discordMember = discordUsername && discordUsername !== "undefined" ? memberObjectMap.get(discordUsername.toLowerCase()) || null : null;

			if (existingCredentials.ign !== username && username !== "undefined") {
				await logChange(`${existingCredentials.ign} changed their Minecraft username to ${username}.`);
				await updatePlayerIgn(m.uuid, username);
				if (discordMember) {
					await updateDiscordNickname(discordMember, username);
				}
			}
		} else {
			const lowerIGN = username !== "undefined" ? username.toLowerCase() : null;
			discordUsername = lowerIGN ? nicknameMap.get(lowerIGN) || null : null;
			discordMember = username !== "undefined" ? memberObjectMap.get(username.toLowerCase()) : null;
		}

		await upsertPlayerCredentials(m.uuid, username, discordUsername);

		if (discordMember) {
			await manageUserRoles(discordMember, skyBracket, cataBracket, true);
		} else if (username !== "undefined") {
			console.log(`Discord member not found for Minecraft user: ${username}`);
		}

		currentData[m.uuid] = {
			username,
			catacombsLevel,
			skyblockLevel,
			discordUsername,
			farmingXp: totalFarmingXp,
		};

		statsToInsert.push({
			timestamp: currentTimestamp,
			uuid: m.uuid,
			skyblock_level: skyblockLevel,
			catacombs_level: catacombsLevel,
			farmingxp: totalFarmingXp,
		});

		if (bannedSet.has(m.uuid)) {
			await logChange(`Banned player detected in guild: ${username} (${m.uuid})`);
		}
	}

	const currentGuildUUIDs = new Set(Object.keys(currentData));

	for (const uuid of currentGuildUUIDs) {
		if (currentData[uuid].discordUsername) {
			const existing = credentialsMap.get(uuid);
			if (existing) {
				existing.discord_username = currentData[uuid].discordUsername;
				existing.ign = currentData[uuid].username;
			} else {
				credentialsMap.set(uuid, {
					discord_username: currentData[uuid].discordUsername,
					ign: currentData[uuid].username,
				});
			}
		}
	}

	if (discordGuild) {
		console.log("Checking for Discord members not in guild...");

		for (const [uuid, credentials] of credentialsMap.entries()) {
			if (currentGuildUUIDs.has(uuid)) continue;
			if (!credentials.discord_username) continue;

			const discordMember = credentials.discord_username && credentials.discord_username !== "undefined" ? memberObjectMap.get(credentials.discord_username.toLowerCase()) || null : null;
			if (discordMember && discordMember.roles.cache.size > 1) {
				await manageUserRoles(discordMember, null, null, false);
			}
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
			}
		}

		for (const uuid of previousUUIDs) {
			if (!currentUUIDs.has(uuid)) {
				const credentials = credentialsMap.get(uuid);
				if (credentials) {
					left.push(credentials.ign);
				}
			}
		}

		if (joined.length) await logChange(`Welcome to our guild: ${joined.join(", ")}!`);
		if (left.length) await logChange(`Members left: ${left.join(", ")}.`);

		for (const uuid of currentUUIDs) {
			if (previousUUIDs.has(uuid)) {
				const prevStats = previousStatsMap.get(uuid);
				const currData = currentData[uuid];

				const prevCataBracket = getCatacombsBracket(prevStats.catacombsLevel);
				const currCataBracket = getCatacombsBracket(currData.catacombsLevel);

				if (prevCataBracket !== currCataBracket) {
					await logChange(`Congratulations ${currData.username} on reaching Catacombs level bracket ${currCataBracket}! Enjoy your new role!`);
				}

				const prevSBBracket = getSkyblockBracket(prevStats.skyblockLevel);
				const currSBBracket = getSkyblockBracket(currData.skyblockLevel);

				if (prevSBBracket !== currSBBracket) {
					await logChange(`Congratulations ${currData.username} on reaching Skyblock level bracket ${currSBBracket}! Enjoy your new role!`);
				}
			}
		}
	} else {
		console.log("No previous stats found, skipping change detection.");
	}

	console.log("Done.");
	if (client) client.destroy();
})();
