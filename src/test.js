let apiKey = "7c5a9de4-ece6-43c8-8bcb-342d7c1e4436";
let uuid = "79d7cb13-d0ed-4554-bdd0-4767c74de337";

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
        experience : 0,
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

        highest.experience = Math.max(highest.experience, data.leveling?.experience || 0)
		highest.magical_power = Math.max(highest.magical_power, data.accessory_bag_storage?.highest_magical_power || 0);
		highest.fairy_souls = Math.max(highest.fairy_souls, data.fairy_soul?.total_collected || 0);
		highest.total_secrets = Math.max(highest.total_secrets, data.dungeons?.secrets || 0);
        highest.healer_xp = Math.floor(Math.max(highest.healer_xp, data.dungeons?.player_classes?.healer?.experience || 0));
        highest.mage_xp = Math.floor(Math.max(highest.mage_xp, data.dungeons?.player_classes?.mage?.experience || 0));
        highest.berserk_xp = Math.floor(Math.max(highest.berserk_xp, data.dungeons?.player_classes?.berserk?.experience || 0));
        highest.archer_xp = Math.floor(Math.max(highest.archer_xp, data.dungeons?.player_classes?.archer?.experience || 0));
        highest.tank_xp = Math.floor(Math.max(highest.tank_xp, data.dungeons?.player_classes?.tank?.experience || 0));
        highest.mage_reputation = Math.max(highest.mage_reputation, data.nether_island_player_data?.mages_reputation || 0);
        highest.barbarian_reputation = Math.max(highest.barbarian_reputation, data.nether_island_player_data?.barbarians_reputation || 0);
        highest.mithril_powder = Math.max(highest.mithril_powder, data.mining_core?.powder_mithril || 0); 
        highest.gemstone_powder = Math.max(highest.gemstone_powder, data.mining_core?.powder_gemstone || 0); 
        highest.glacite_powder = Math.max(highest.glacite_powder, data.mining_core?.powder_glacite || 0);
        highest.zombie_slayer_xp = Math.max(highest.zombie_slayer_xp, data?.slayer?.slayer_bosses?.zombie?.xp || 0);
        highest.spider_slayer_xp = Math.max(highest.spider_slayer_xp, data?.slayer?.slayer_bosses?.spider?.xp || 0);
        highest.wolf_slayer_xp = Math.max(highest.wolf_slayer_xp, data?.slayer?.slayer_bosses?.wolf?.xp || 0);
        highest.enderman_slayer_xp = Math.max(highest.enderman_slayer_xp, data?.slayer?.slayer_bosses?.enderman?.xp || 0);
        highest.blaze_slayer_xp = Math.max(highest.blaze_slayer_xp, data?.slayer?.slayer_bosses?.blaze?.xp || 0);
        highest.mage_reputation = Math.max(highest.mage_reputation, data.nether_island_player_data?.mages_reputation || 0);
        highest.vampire_slayer_xp = Math.max(highest.vampire_slayer_xp, data?.slayer?.slayer_bosses?.vampire?.xp || 0);		

		if (profile.selected) {
			selectedPower = data.accessory_bag_storage?.selected_power || "none";
			selectedDungeonClass = data.dungeons?.selected_dungeon_class || "none";
			selectedArrowType = data.item_data.favorite_arrow || "none";
		}
	}

	const experiences = [
        highest.experience,
        totals.fishing_xp,
        totals.alchemy_xp,
        totals.dungeoneering_xp,
        totals.runecrafting_xp,
        totals.mining_xp,
        totals.farming_xp,
        totals.enchanting_xp,
        totals.taming_xp,
        totals.foraging_xp,
        totals.social_xp,
        totals.carpentry_xp,
        totals.combat_xp
    ];

    const money = [
        "Networth Here",
        totals.coin_purse,
        totals.bank_account,
        totals.mote_purse,
        totals.copper
    ]

    const mining = [
        totals.mineshafts_entered,
        highest.mithril_powder,
        highest.gemstone_powder,
        highest.glacite_powder
    ]

    const completions = [
        normalFloors.f0,
        normalFloors.f1,
        normalFloors.f2,
        normalFloors.f3,
        normalFloors.f4,
        normalFloors.f5,
        normalFloors.f6,
        normalFloors.f7,
        masterFloors.m1,
        masterFloors.m2,
        masterFloors.m3,
        masterFloors.m4,
        masterFloors.m5,
        masterFloors.m6,
        masterFloors.m7,
        kuudraTiers.none,
        kuudraTiers.hot,
        kuudraTiers.burning,
        kuudraTiers.fiery,
        kuudraTiers.infernal,
    ];

    const dungeon = [
        highest.total_secrets,
        highest.healer_xp,
        highest.mage_xp,
        highest.berserk_xp,
        highest.archer_xp,
        highest.tank_xp
    ];

    const slayers = [
        highest.zombie_slayer_xp,
        highest.spider_slayer_xp,
        highest.wolf_slayer_xp,
        highest.enderman_slayer_xp,
        highest.blaze_slayer_xp,
        highest.vampire_slayer_xp
    ];

    const misc = [
        totals.kills,
        totals.deaths,
        highest.magical_power,
        highest.fairy_souls,
        highest.mage_reputation,
        highest.barbarian_reputation
    ];

    const selections = [
        selectedPower,
        selectedDungeonClass,
        selectedArrowType
    ];

    console.log(experiences,money,mining,completions,dungeon,slayers,misc,selections);
}
