const profileApi = await fetch(`https://api.hypixel.net/v2/skyblock/profiles?key=${apiKey}&uuid=${uuid}`);
const profileApiJson = await profileApi.json();

if (profileApiJson.success && profileApiJson.profiles.length) {
	const totals = {
		kills: 0,
		deaths: 0,
		fishing_xp: 0,
		alchemy_xp: 0,
		dungeoneering_xp: 0,
		runecrafting_xp: 0,
		mining_xp: 0,
		farming_xp: 0,
		enchanting_xp: 0,
		taming_xp: 0,
		foraging_xp: 0,
		social_xp: 0,
		carpentry_xp: 0,
		combat_xp: 0,
		coin_purse: 0,
		mote_purse: 0,
		copper: 0,
		bank_account: 0,
		mineshafts_entered: 0,
	};

	const normalFloors = { f0: 0, f1: 0, f2: 0, f3: 0, f4: 0, f5: 0, f6: 0, f7: 0 };
	const masterFloors = { m1: 0, m2: 0, m3: 0, m4: 0, m5: 0, m6: 0, m7: 0 };
	const kuudraTiers = {
		none: 0,
		hot: 0,
		burning: 0,
		fiery: 0,
		infernal: 0,
	};

	const highest = {
		magical_power: 0,
		fairy_souls: 0,
		total_secrets: 0,
		healer_xp: 0,
		mage_xp: 0,
		berserk_xp: 0,
		archer_xp: 0,
		tank_xp: 0,
		mage_reputation: 0,
		barbarian_reputation: 0,
		mithril_powder: 0,
		gemstone_powder: 0,
		glacite_powder: 0,
		zombie_slayer_xp: 0,
		spider_slayer_xp: 0,
		wolf_slayer_xp: 0,
		enderman_slayer_xp: 0,
		blaze_slayer_xp: 0,
		vampire_slayer_xp: 0,
	};

	let selectedPower = "none";
	let selectedDungeonClass = "none";
	let selectedArrowType = "none";

	for (const profile of profileApiJson.profiles) {
		const data = profile.members?.[uuid.replace(/-/g, "")];
		if (!data) continue;

		totals.kills += data.player_stats?.kills.total || 0;
		totals.deaths += data.player_data?.death_count || 0;
		totals.fishing_xp += Math.trunc(data.player_data?.experience?.SKILL_FISHING || 0);
		totals.alchemy_xp += Math.trunc(data.player_data?.experience?.SKILL_ALCHEMY || 0);
		totals.dungeoneering_xp += Math.trunc(data.dungeons?.dungeon_types?.catacombs?.experience || 0);
		totals.runecrafting_xp += Math.trunc(data.player_data?.experience?.SKILL_RUNECRAFTING || 0);
		totals.mining_xp += Math.trunc(data.player_data?.experience?.SKILL_MINING || 0);
		totals.farming_xp += Math.trunc(data.player_data?.experience?.SKILL_FARMING || 0);
		totals.enchanting_xp += Math.trunc(data.player_data?.experience?.SKILL_ENCHANTING || 0);
		totals.taming_xp += Math.trunc(data.player_data?.experience?.SKILL_TAMING || 0);
		totals.foraging_xp += Math.trunc(data.player_data?.experience?.SKILL_FORAGING || 0);
		totals.social_xp += Math.trunc(data.player_data?.experience?.SKILL_SOCIAL || 0);
		totals.carpentry_xp += Math.trunc(data.player_data?.experience?.SKILL_CARPENTRY || 0);
		totals.combat_xp += Math.trunc(data.player_data?.experience?.SKILL_COMBAT || 0);
		totals.coin_purse += Math.trunc(data.currencies?.coin_purse || 0);
		totals.mote_purse += Math.trunc(data.currencies?.motes_purse || 0);
		totals.copper += data.garden_player_data?.copper || 0;
		totals.bank_account += Math.trunc(data.profile?.bank_account) || Math.trunc(profile?.banking?.balance) || 0;

		const normal = data.dungeons?.dungeon_types?.catacombs?.tier_completions || {};
		normalFloors.f0 += normal[0] || 0;
		normalFloors.f1 += normal[1] || 0;
		normalFloors.f2 += normal[2] || 0;
		normalFloors.f3 += normal[3] || 0;
		normalFloors.f4 += normal[4] || 0;
		normalFloors.f5 += normal[5] || 0;
		normalFloors.f6 += normal[6] || 0;
		normalFloors.f7 += normal[7] || 0;

		const master = data.dungeons?.dungeon_types?.master_catacombs?.tier_completions || {};
		masterFloors.m1 += master[1] || 0;
		masterFloors.m2 += master[2] || 0;
		masterFloors.m3 += master[3] || 0;
		masterFloors.m4 += master[4] || 0;
		masterFloors.m5 += master[5] || 0;
		masterFloors.m6 += master[6] || 0;
		masterFloors.m7 += master[7] || 0;

		const kuudra = data.nether_island_player_data?.kuudra_completed_tiers || {};
		kuudraTiers.none += kuudra.none || 0;
		kuudraTiers.hot += kuudra.hot || 0;
		kuudraTiers.burning += kuudra.burning || 0;
		kuudraTiers.fiery += kuudra.fiery || 0;
		kuudraTiers.infernal += kuudra.infernal || 0;

		totals.mineshafts_entered += data.glacite_player_data?.mineshafts_entered || 0;

		highest.magical_power = Math.max(highest.magical_power, data.accessory_bag_storage?.highest_magical_power || 0);
		highest.fairy_souls = Math.max(highest.fairy_souls, data.fairy_soul?.total_collected || 0);
		highest.total_secrets = Math.max(highest.total_secrets, data.dungeons?.secrets || 0);

		if (profile.selected) {
			selectedPower = data.accessory_bag_storage?.selected_power || "none";
			selectedDungeonClass = data.dungeons?.selected_dungeon_class || "none";
			selectedArrowType = data.item_data.favorite_arrow || "none";
		}
	}

	console.log("=== misc ===");
	console.log("kill count:", totals.kills);
	console.log("death count:", totals.deaths);
	console.log("magical power:", highest.magical_power);
	console.log("fairy souls:", highest.fairy_souls);
	console.log("mage reputation:", highest.mage_reputation);
	console.log("barbarian reputation:", highest.barbarian_reputation);

	console.log("experienc");
	console.log("ADD SKYBLOCK LEVEL BUT IN XP FORM HERE");
	console.log("fishing xp:", totals.fishing_xp);
	console.log("alchemy xp:", totals.alchemy_xp);
	console.log("dungeoneering xp:", totals.dungeoneering_xp);
	console.log("runecrafting xp:", totals.runecrafting_xp);
	console.log("mining xp:", totals.mining_xp);
	console.log("farming xp:", totals.farming_xp);
	console.log("enchanting xp:", totals.enchanting_xp);
	console.log("taming xp:", totals.taming_xp);
	console.log("foraging xp:", totals.foraging_xp);
	console.log("social xp:", totals.social_xp);
	console.log("carpentry xp:", totals.carpentry_xp);
	console.log("combat xp:", totals.combat_xp);

	console.log("mONEY");
	console.log("ADD NETWORTH HERE");
	console.log("coin purse:", totals.coin_purse);
	console.log("bank account:", totals.bank_account);
	console.log("mote purse:", totals.mote_purse);
	console.log("copper:", totals.copper);

	console.log("mining");
	console.log("mineshafts entered:", totals.mineshafts_entered);
	console.log("mithril powder:", highest.mithril_powder);
	console.log("gemstone powder:", highest.gemstone_powder);
	console.log("glacite powder:", highest.glacite_powder);

	console.log("\n=== DUNGEONS AND KUUDRA ===");
	console.log("normal floors:", normalFloors);
	console.log("master floors:", masterFloors);
	console.log("kuudra comps:", kuudraTiers);

	console.log("\n=== dubngeons ===");
	console.log("total secrets:", highest.total_secrets);
	console.log("healer xp:", highest.healer_xp);
	console.log("mage xp:", highest.mage_xp);
	console.log("berserk xp:", highest.berserk_xp);
	console.log("archer xp:", highest.archer_xp);
	console.log("tank xp:", highest.tank_xp);

	console.log("slayers");
	console.log("zombie slayer xp:", highest.zombie_slayer_xp);
	console.log("spider slayer xp:", highest.spider_slayer_xp);
	console.log("wolf slayer xp:", highest.wolf_slayer_xp);
	console.log("enderman slayer xp:", highest.enderman_slayer_xp);
	console.log("blaze slayer xp:", highest.blaze_slayer_xp);
	console.log("vampire slayer xp:", highest.vampire_slayer_xp);

	console.log("\n=== SELECTED PROFILE ===");
	console.log("selected power:", selectedPower);
	console.log("selected dungeon class:", selectedDungeonClass);
	console.log("selected arrow type:", selectedArrowType);
}
