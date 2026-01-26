import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export async function loadEnvFromSupabase() {
	const { data, error } = await supabase.from("misc_settings").select("*").single();
	if (error) {
		throw error;
	}
	return {
		dcToken: data.dc_token,
		guildName: data.guild_name,
		botTextSendChannelId: data.channel_id,
		wordleChannelId: data.wordle_channel,
		serverId: data.server_id,
	};
}

export async function loadBannedPlayers() {
	const { data, error } = await supabase.from("banned_uuids").select("uuid");
	if (error) {
		throw error;
	}
	return new Set(data.map(row => row.uuid));
}

export async function addChangelogEntry(text, timestamp) {
	const { error } = await supabase.from("changelog").insert({
		text,
		timestamp,
	});
	if (error) {
		throw error;
	}
}

export async function getAllPlayerCredentials() {
	const { data, error } = await supabase.from("player_credentials").select("*");
	if (error) {
		throw error;
	}

	const credentialsMap = new Map();
	data.forEach(player => {
		credentialsMap.set(player.uuid.replace(/-/g, ""), player);
	});

	return credentialsMap;
}

export async function getMostRecentStats() {
	const { data, error } = await supabase.from("player_stats").select("uuid, timestamp, skyblock_level, catacombs_level, farmingxp").order("timestamp", { ascending: false });

	if (error) {
		throw error;
	}

	const statsMap = new Map();
	data.forEach(stat => {
		if (!statsMap.has(stat.uuid.replace(/-/g, ""))) {
			statsMap.set(stat.uuid.replace(/-/g, ""), {
				skyblockLevel: stat.skyblock_level,
				catacombsLevel: stat.catacombs_level,
				farmingXp: stat.farmingxp,
				timestamp: stat.timestamp,
			});
		}
	});

	return statsMap;
}

export async function insertPlayerStats(statsArray) {
	const { error } = await supabase.from("player_stats").insert(statsArray);
	if (error) {
		throw error;
	}
}

export async function upsertPlayerCredentials(uuid, ign, discordId, status) {
	const { error } = await supabase.from("player_credentials").upsert(
		{
			uuid,
			ign,
			discord_id: discordId,
			status: status,
		},
		{
			onConflict: "uuid",
		},
	);

	if (error) {
		throw error;
	}
}

export async function updatePlayerIgn(mc_uuid, newIgn) {
	const { error } = await supabase.from("player_credentials").update({ ign: newIgn }).eq("uuid", mc_uuid);

	if (error) {
		throw error;
	}
}

export async function updatePlayerStatus(dc_uuid, status) {
	const { error } = await supabase.from("player_credentials").update({ status: status }).eq("discord_id", dc_uuid);

	if (error) {
		throw error;
	}
}
