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
