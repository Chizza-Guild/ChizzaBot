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

async function manageUserRoles(discordMember, skyblockBracket, catacombsBracket, networthBracket, isInGuild) {
	if (!discordMember) return;

	const allRoles = discordGuild.roles.cache;
	const notInGuildRole = allRoles.find(role => role.name == "Not in guild");

	try {
		const desiredRoles = new Set();

		if (!isInGuild) {
			if (notInGuildRole) desiredRoles.add(notInGuildRole.id);
		} else {
			const sbRole = allRoles.find(role => role.name == skyblockBracket);
			const cataRole = allRoles.find(role => role.name == catacombsBracket);
			const nwRole = allRoles.find(role => role.name == networthBracket);

			if (sbRole) desiredRoles.add(sbRole.id);
			if (cataRole) desiredRoles.add(cataRole.id);
			if (nwRole) desiredRoles.add(nwRole.id);
		}

		const managedRoles = [...Object.values(SKYBLOCK_ROLES), ...Object.values(CATACOMBS_ROLES), ...Object.values(NETWORTH_ROLES), "Not in guild"];

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

(async () => {
	if (!codeRunner) return console.log("No code runner found. Please add it in the .env file.");
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
	let count = 0;

	for (const member of members) {
		try {
			count++;
			console.log(`Processing ${count}/${members.length}: ${member.uuid}`);

			const response = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${member.uuid}`);
			let username = response.ok ? (await response.json()).name : "undefined";

			if (bannedSet.has(member.uuid)) await logChange(`Banned player detected in guild: ${username} (${member.uuid})`);

			const profileApi = await fetch(`https://api.hypixel.net/v2/skyblock/profiles?key=${apiKey}&uuid=${member.uuid}`);
			const profileApiJson = await profileApi.json();
			const allData = await getDataFromPlayer(profileApiJson, member.uuid);

			let discordMember = null;
			const existingCredentials = credentialsMap.get(member.uuid);

			if (existingCredentials) {
				// User data already in supabase db
				const discordId = existingCredentials.discord_id ?? dcUsersByNickname.get(username)?.user?.id ?? null;

				if (discordId && discordId != "undefined") {
					discordMember = dcUsersById.get(discordId) ?? null;
				}

				if (existingCredentials.ign != username && username != "undefined") {
					await logChange(`${existingCredentials.ign} changed their Minecraft username to ${username}.`);
					await updatePlayerIgn(member.uuid, username);
				}

				if (discordMember && discordMember.nickname != username) {
					try {
						await logChange(`Updated Discord nickname for ${discordMember.nickname || discordMember.user.username} to ${username}.`);
						await discordMember.setNickname(username);
					} catch (error) {
						if (error.code == 50013) {
							console.error("Bot lacks permissions to manage nicknames.");
						} else {
							console.error(`Error updating nickname for ${discordMember.user.username}:`, error);
						}
					}
				}
			} else {
				// User data not in supabase db, we have to insert a row
				discordMember = dcUsersByNickname.get(username) ?? null;
			}

			const discordIdFromMember = discordMember ? discordMember.user.id : null;
			await upsertPlayerCredentials(member.uuid, username, discordIdFromMember, true);

			if (username !== "undefined" && !discordMember) {
				console.log(`Discord member not found for Minecraft user: ${username}`);
			}

			currentCredentials[member.uuid] = {
				username,
				discordIdFromMember,
			};

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
		} catch (error) {
			console.log(error);
		}
	}

	console.log("Managing Discord roles for all members...");

	for (const [discordId, discordMember] of dcUsersById.entries()) {
		let linkedUUID = null;
		for (const [uuid, credentials] of credentialsMap.entries()) {
			if (credentials.discord_id == discordId) {
				linkedUUID = uuid;
				break;
			}
		}

		if (linkedUUID) {
			const skyBracket = getSkyblockBracket(newStatsToInsert.find(item => item.uuid == linkedUUID)?.experiences[0]);
			const cataBracket = getCatacombsBracket(newStatsToInsert.find(item => item.uuid == linkedUUID)?.experiences[3]);
			const networthBracket = getNetworthBracket(newStatsToInsert.find(item => item.uuid == linkedUUID)?.money[0]);
			await manageUserRoles(discordMember, skyBracket, cataBracket, networthBracket, true);
		} else {
			await manageUserRoles(discordMember, null, null, null, false);
		}
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
				const currentStats = currentCredentials[uuid];

				const previousSBBracket = getSkyblockBracket(previousStats.skyblockLevel);
				const currentSBBracket = getSkyblockBracket(newStatsToInsert.find(item => item.uuid == uuid)?.experiences[0]);

				if (previousSBBracket !== currentSBBracket) {
					await logChange(`Congratulations ${currentStats.username} on reaching Skyblock level bracket ${currentSBBracket}! Enjoy your new role!`);
				}

				const previousCataBracket = getCatacombsBracket(previousStats.catacombsLevel);
				const currentCataBracket = getCatacombsBracket(newStatsToInsert.find(item => item.uuid == uuid)?.experiences[3]);

				if (previousCataBracket !== currentCataBracket) {
					await logChange(`Congratulations ${currentStats.username} on reaching Catacombs level bracket ${currentCataBracket}! Enjoy your new role!`);
				}

				const previousNWBracket = getNetworthBracket(previousStats.networth);
				const currentNWBracket = getNetworthBracket(newStatsToInsert.find(item => item.uuid == uuid)?.money[0]);

				if (previousNWBracket !== currentNWBracket) {
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
