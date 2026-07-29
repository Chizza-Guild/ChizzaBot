import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function loadEnvFromSupabase() {
	const { data, error } = await supabase.from("misc_settings").select("*").single();
	if (error) throw error;

	const guildNames = [];
	let i = 1;
	while (true) {
		const key = i == 1 ? "guild_name" : `guild_name${i}`;
		if (data[key]) {
			guildNames.push(data[key]);
			i++;
		} else {
			break;
		}
	}

	return {
		dcToken: data.dc_token,
		guildNames,
		botTextSendChannelId: data.channel_id,
		wordleChannelId: data.wordle_channel,
		serverId: data.server_id,
	};
}

export async function loadBannedPlayers() {
	const { data, error } = await supabase.from("banned_uuids").select("uuid");
	if (error) throw error;

	return new Set(data.map(row => row.uuid));
}

export async function addChangelogEntry(text, timestamp) {
	const { error } = await supabase.from("changelog").insert({ text, timestamp });
	if (error) throw error;
}

export async function getAllPlayerCredentials() {
	const { data, error } = await supabase.from("player_credentials").select("*").neq("status", "Not in guild");
	if (error) throw error;

	const credentialsMap = new Map();
	data.forEach(player => {
		credentialsMap.set(player.uuid.replace(/-/g, ""), { ...player, uuid: player.uuid.replace(/-/g, "") });
	});

	return credentialsMap;
}

export async function getMostRecentStats() {
	try {
		const { data, error } = await supabase.from("player_all_statistics").select("uuid, experiences, money").order("day", { ascending: false });
		if (error) throw error;

		const statsMap = new Map();
		data.forEach(stat => {
			const normalizedUuid = stat.uuid.replace(/-/g, "");
			if (!statsMap.has(normalizedUuid)) {
				statsMap.set(normalizedUuid, {
					skyblockLevel: stat.experiences[0],
					catacombsLevel: stat.experiences[3],
					networth: stat.money[0],
				});
			}
		});

		return statsMap;
	} catch (error) {
		console.log(error);
		return new Map();
	}
}

export async function insertPlayerStatistics(newStatsToInsert) {
	try {
		const { data, error } = await supabase.from("player_all_statistics").upsert(newStatsToInsert, { onConflict: ["uuid", "day"] });
		if (error) throw error;
	} catch (err) {
		console.error("Supabase insert failed:", err);
	}
}

export async function upsertPlayerCredentials(uuid, ign, discordId, status) {
	const { error } = await supabase.from("player_credentials").upsert(
		{
			uuid: uuid.replace(/-/g, ""),
			ign,
			discord_id: discordId,
			status: status,
		},
		{
			onConflict: "uuid",
		},
	);

	if (error) throw error;
}

export async function updatePlayerIgn(mc_uuid, newIgn) {
	const { error } = await supabase.from("player_credentials").update({ ign: newIgn }).eq("uuid", mc_uuid.replace(/-/g, ""));
	if (error) throw error;
}

export async function updatePlayerStatus(mc_uuid, status) {
	const { error } = await supabase.from("player_credentials").update({ status: status }).eq("uuid", mc_uuid.replace(/-/g, ""));
	if (error) throw error;
}
