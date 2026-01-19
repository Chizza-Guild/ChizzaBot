require("dotenv").config();
const fetch = require("node-fetch");
const { promises: fs } = require("fs");
const fsSync = require("fs");
const path = require("path");
const { Client, GatewayIntentBits } = require("discord.js");
const { SKYBLOCK_ROLES, CATACOMBS_ROLES, NOT_IN_GUILD_ROLE } = require("./rolenames.js");
const { checkWordleResults, parseWordleMessage } = require("./wordle.js");
const { loadEnvFromSupabase, loadBannedPlayers, addChangelogEntry } = require("./supabase.js");

let dcToken;
let guildName;
let botTextSendChannelId;
let wordleChannelId;
let serverId;
const apiKey = process.env.HYPIXEL_API_KEY;

const CHANGES_LOG_FILE = path.resolve(__dirname, "changes_log.txt");
const CSV_FILE = path.resolve(__dirname, "guild_members.csv");
const OLD_CSV_FILE = path.resolve(__dirname, "guild_members_old.csv");

const client = new Client({
	intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

let channel;
let wordleChannel;
let discordGuild;

function waitForDiscordReady() {
	return new Promise(resolve => {
		if (client.isReady()) {
			resolve();
		} else {
			client.once("ready", resolve);
		}
	});
}

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
	if (level >= 50) return "MAX";
	if (level >= 45) return "45-50";
	if (level >= 40) return "40-45";
	if (level >= 35) return "35-40";
	if (level >= 30) return "30-35";
	return "Below 30";
}

function getSkyblockBracket(level) {
	const low = Math.floor(level / 40) * 40;
	const high = low + 39;
	if (high > 480) return `${low}+`;
	return `${low}-${high}`;
}

async function logChange(message) {
	console.log(message);
	const timestamp = new Date().toISOString();

	await addChangelogEntry(message, timestamp);

	if (channel) await channel.send(message);
}

async function detectChangesAndLog(previousData, currentData) {
	const prev = new Set(Object.keys(previousData));
	const curr = new Set(Object.keys(currentData));
	const joined = [];
	const left = [];

	for (const uuid of curr) {
		if (!prev.has(uuid)) joined.push(currentData[uuid].username);
	}

	for (const uuid of prev) {
		if (!curr.has(uuid)) left.push(previousData[uuid].username);
	}

	if (joined.length) await logChange(`Welcome to our guild: ${joined.join(", ")}!`);
	if (left.length) await logChange(`Members left: ${left.join(", ")}.`);

	for (const uuid of curr) {
		if (prev.has(uuid)) {
			const a = previousData[uuid],
				b = currentData[uuid];
			if (a.catacombsBracket !== b.catacombsBracket) {
				await logChange(`Congratulations ${b.username} on reaching Catacombs level bracket ${b.catacombsBracket}! Enjoy your new role!`);
			}
			if (a.skyblockLevel !== b.skyblockLevel) {
				await logChange(`Congratulations ${b.username} on reaching Skyblock level bracket ${b.skyblockLevel}! Enjoy your new role!`);
			}
		}
	}
}

async function getDiscordMemberMapping() {
	if (!discordGuild) {
		console.log("Discord guild not available, skipping Discord integration");
		return { nicknameMap: new Map(), memberObjectMap: new Map() };
	}

	try {
		console.log("Fetching Discord server members...");
		await discordGuild.members.fetch();
		const members = discordGuild.members.cache;

		const nicknameMap = new Map();
		const memberObjectMap = new Map();

		members.forEach(member => {
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
		return { nicknameMap, memberObjectMap };
	} catch (error) {
		console.error("Error fetching Discord members:", error);
		return { nicknameMap: new Map(), memberObjectMap: new Map() };
	}
}

function findDiscordUsername(minecraftIGN, discordMap) {
	if (!minecraftIGN || minecraftIGN === "undefined") return null;
	const lowerIGN = minecraftIGN.toLowerCase();
	return discordMap.get(lowerIGN) || null;
}

function findDiscordMemberByUsername(username, memberObjectMap) {
	if (!username || username === "undefined") return null;
	return memberObjectMap.get(username.toLowerCase()) || null;
}

function hasAnyRoles(discordMember) {
	return discordMember.roles.cache.size > 1;
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
		const notInGuildRole = allRoles.find(r => r.name === NOT_IN_GUILD_ROLE);
		const botRole = allRoles.find(r => r.name === "Bot");

		if (!hasAnyRoles(discordMember)) {
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

async function handleNotInGuildMembers(currentUsernames, memberObjectMap) {
	if (!discordGuild) return;
	console.log("Checking for Discord members not in guild...");
	for (const discordMember of memberObjectMap.values()) {
		if (!hasAnyRoles(discordMember)) continue;
		const name = discordMember.user.username.toLowerCase();
		const nick = discordMember.displayName.toLowerCase();
		if (!currentUsernames.includes(name) && !currentUsernames.includes(nick)) {
			await manageUserRoles(discordMember, null, null, false);
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
	await waitForDiscordReady();

	await new Promise(resolve => setTimeout(resolve, 2000));

	await checkWordleResults(wordleChannel);

	if (process.argv.slice(2).includes("wordle")) {
		console.log("Wordle-only mode complete.");
		if (client) client.destroy();
		return;
	}

	const bannedSet = await loadBannedPlayers();

	let previousMembers = {};
	const csvData = await fs.readFile(CSV_FILE, "utf8").catch(() => "");
	if (csvData) {
		const lines = csvData.trim().split("\n");
		for (let i = 1; i < lines.length; i++) {
			const parts = lines[i].split(",");
			const [uuid, ign, bracket, lvl] = parts;
			const discordUsername = parts[4] || null;
			const farmingXp = parts[5] || 0;
			previousMembers[uuid] = {
				username: ign,
				catacombsBracket: bracket,
				skyblockLevel: isNaN(+lvl) ? lvl : getSkyblockBracket(+lvl),
				discordUsername: discordUsername === "null" ? null : discordUsername,
				farmingXp: +farmingXp,
			};
		}
	}
	console.log(`Loaded ${Object.keys(previousMembers).length} previous members from CSV`);

	const findRes = await fetch(`https://api.hypixel.net/findGuild?key=${apiKey}&byName=${guildName}`);
	const findResText = await findRes.text();
	if (findRes.status == 403 || findResText.includes("Forbidden")) {
		console.error("Invalid API Key");
		process.exit(1);
	}

	const { success, guild: guildId } = JSON.parse(findResText);
	if (!success || !guildId) {
		console.error("Guild not found");
		process.exit(1);
	}

	const guildRes = await fetch(`https://api.hypixel.net/guild?key=${apiKey}&id=${guildId}`);
	const guildJson = await guildRes.json();
	if (!guildJson.success || !guildJson.guild) throw new Error("Failed to fetch guild data");
	const members = guildJson.guild.members;

	const { nicknameMap, memberObjectMap } = await getDiscordMemberMapping();

	const currentData = {};
	const csvLines = ["uuid,ign,catacombs,skyblock_bracket,discord_username,farming_xp"];
	let cnt = 0;

	for (const m of members) {
		cnt++;
		console.log(`Processing ${cnt}/${members.length}: ${m.uuid}`);
		let username = "undefined";
		const resp = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${m.uuid}`);
		if (resp.ok) username = (await resp.json()).name || "undefined";

		let bracket = "Below 30",
			maxSB = 0,
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
				if (lvl > maxSB) maxSB = lvl;
				addedFarmingXp = Math.trunc(dat.player_data?.experience?.SKILL_FARMING || 0);
				totalFarmingXp += addedFarmingXp;
				console.log("Added", addedFarmingXp, "farming xp to", username);
			}
			bracket = getCatacombsBracket(getDungeonLevel(maxXP));
		}

		const skyBracket = getSkyblockBracket(maxSB);

		let discordUsername = null;
		let discordMember = null;

		if (previousMembers[m.uuid] && previousMembers[m.uuid].discordUsername) {
			discordUsername = previousMembers[m.uuid].discordUsername;
			discordMember = findDiscordMemberByUsername(discordUsername, memberObjectMap);
			if (discordMember) {
				const previousIGN = previousMembers[m.uuid].username;
				if (previousIGN !== username && username !== "undefined") {
					await logChange(`${previousIGN} changed their Minecraft username to ${username}.`);
					await updateDiscordNickname(discordMember, username);
				}
			}
		} else {
			discordUsername = findDiscordUsername(username, nicknameMap);
			discordMember = username !== "undefined" ? memberObjectMap.get(username.toLowerCase()) : null;
		}

		if (discordMember) {
			await manageUserRoles(discordMember, skyBracket, bracket, true);
		} else if (username !== "undefined") {
			console.log(`Discord member not found for Minecraft user: ${username}`);
		}

		currentData[m.uuid] = {
			username,
			catacombsBracket: bracket,
			skyblockLevel: skyBracket,
			discordUsername: discordUsername,
			farmingXp: totalFarmingXp,
		};

		const discordUsernameForCSV = discordUsername || "null";
		csvLines.push(`${m.uuid},${username},${bracket},${skyBracket},${discordUsernameForCSV},${totalFarmingXp}`);

		if (bannedSet.has(m.uuid)) {
			await logChange(`Banned player detected in guild: ${username} (${m.uuid})`);
		}
	}

	const currentDiscordUsernames = Object.values(currentData)
		.map(u => u.discordUsername)
		.filter(Boolean)
		.map(n => n.toLowerCase());
	await handleNotInGuildMembers(currentDiscordUsernames, memberObjectMap);

	if (fsSync.existsSync("guild_members.csv")) {
		await fs.copyFile(CSV_FILE, OLD_CSV_FILE);
		console.log(`Wrote ${csvLines.length - 1} members to CSV with Discord usernames`);
		await detectChangesAndLog(previousMembers, currentData);
	} else {
		console.log("CSV file does not exist, not sending any messages in the channel.");
	}

	await fs.writeFile(CSV_FILE, csvLines.join("\n"), "utf8");

	console.log("Done.");
	if (client) client.destroy();
})();
