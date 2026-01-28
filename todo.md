### Test:

- Is it detecting changes for levels-catas?
- Status column does not turn to false if someone leaves or not in guild

We can collect more data like networth or skill average to keep track of statistics

Other data to collect:
NETWORTH USING PAPIER

profiles[i]
-> members
--> uuid[i]
---> player_data
----> death_count
----> experience

profiles[i]
-> members
--> uuid[i]
---> player_data
----> experience
-----> Everything below;
SKILL_FISHING 3.810805843377298E7
SKILL_ALCHEMY 6.112938655750045E7
SKILL_DUNGEONEERING 10.0
SKILL_RUNECRAFTING 1374450.210353869
SKILL_MINING 3.2528764469123614E8
SKILL_FARMING 1.2604156026419193E8
SKILL_ENCHANTING 5.716958838179103E8
SKILL_TAMING 1.9134363491849973E9
SKILL_FORAGING 9.702555712193044E7
SKILL_SOCIAL 35044.4059000055
SKILL_CARPENTRY 8.363358699737631E7
SKILL_COMBAT 2.2320819331343207E9

profiles[i]
-> members
--> uuid[i]
---> glacite_player_data
----> mineshafts_entered

profiles[i]
-> members
--> uuid[i]
---> garden_player_data
----> copper

profiles[i]
-> members
--> uuid[i]
---> accessory_bag_storage
----> selected_power

profiles[i]
-> members
--> uuid[i]
---> accessory_bag_storage
----> highest_magical_power

profiles[i]
-> members
--> uuid[i]
---> currencies
----> coin_purse

profiles[i]
-> members
--> uuid[i]
---> currencies
----> motes_purse

profiles[i]
-> members
--> uuid[i]
---> dungeons
----> selected_dungeon_class (string, like "Archer")

profiles[i]
-> members
--> uuid[i]
---> dungeons
----> secrets (secret amount in numbers)

profiles[i]
-> members
--> uuid[i]
---> dungeons
----> dungeon_types
-----> catacombs
------> tier_completions
        0 5.0
        1 33.0
        2 16.0
        3 25.0
        4 33.0
        5 61.0
        6 257.0
        7 2664.0
        total 866.0 --> Dont use this

profiles[i]
-> members
--> uuid[i]
---> dungeons
----> dungeon_types
-----> master_catacombs
------> tier_completions
        1 67.0
        2 9.0
        3 354.0
        4 84.0
        5 1258.0
        6 1059.0
        7 6241.0
        total 5309.0

profiles[i]
-> members
--> uuid[i]
---> dungeons
----> player_classes  
        healer { experience: 6.548806376085464E8JS:654880637.6085464 }
        mage { experience: 2.1207781239256387E9JS:2120778123.9256387 }
        berserk { experience: 8.274436369854825E8JS:827443636.9854825 }
        archer { experience: 1.2216248734474375E9JS:1221624873.4474375 }
        tank { experience: 7.002182014853263E8JS:700218201.4853263 }

profiles[i]
-> members
--> uuid[i]
---> profile
----> bank_account

profiles[i]
-> members
--> uuid[i]
---> nether_island_player_data
----> mages_reputation

profiles[i]
-> members
--> uuid[i]
---> nether_island_player_data
----> barbarians_reputation

profiles[i]
-> members
--> uuid[i]
---> nether_island_player_data
----> kuudra_completed_tiers
        none 14
        hot 49
        burning 18
        highest_wave_none 10
        highest_wave_hot 14
        highest_wave_burning 7
        fiery 3
        highest_wave_fiery 11
        highest_wave_infernal 11
        infernal 36 ??? Check the diff between normal and highest_wave

profiles[i]
-> members
--> uuid[i]
---> mining_core
----> powder_mithril

profiles[i]
-> members
--> uuid[i]
---> mining_core
----> powder_gemstone

profiles[i]
-> members
--> uuid[i]
---> mining_core
----> powder_glacite

profiles[i]
-> members
--> uuid[i]
---> player_stats
----> kills

profiles[i]
-> members
--> uuid[i]
---> player_stats
----> auctions
-----> bids

profiles[i]
-> members
--> uuid[i]
---> player_stats
----> auctions
-----> gold_spent

profiles[i]
-> members
--> uuid[i]
---> player_stats
----> auctions
-----> completed

profiles[i]
-> members
--> uuid[i]
---> player_stats
----> auctions
-----> fees

profiles[i]
-> members
--> uuid[i]
---> fairy_soul
----> total_collected

profiles[i]
-> members
--> uuid[i]
---> player_stats
----> slayer
-----> slayer_bosses
------> spider (NEED FOr ALL BOSSES)
-------> xp 1037391
