/**
 * Curated schema of commonly-adjusted worldserver.conf directives for AzerothCore.
 *
 * This schema drives the friendly Worldserver Config UI. It is imported directly
 * by the client-side component (not fetched via API) since it never changes at runtime.
 *
 * Managed directives (RealmID, DB connection strings, ports, RA/SOAP, paths) are
 * intentionally excluded — those are controlled by RealmManager's realm-compose layer.
 */

export type DirectiveType = "number" | "boolean" | "string" | "select";

export interface SelectOption {
  value: string | number;
  label: string;
}

export interface Directive {
  /** The exact conf key (e.g. "Rate.XP.Kill"). Dots are allowed. */
  key: string;
  /** Human-readable label shown in the form. */
  label: string;
  /** Input type — determines which form control is rendered. */
  type: DirectiveType;
  /** Default value as it appears in worldserver.conf.dist. Always a string. */
  default: string;
  /** Short description used for tooltips. */
  description: string;
  /** For `select` type: the list of labeled options. */
  options?: SelectOption[];
  /** For `number` type: minimum allowed value. */
  min?: number;
  /** For `number` type: maximum allowed value. */
  max?: number;
  /** For `number` type: step size (1 for integers, 0.1 for rates). */
  step?: number;
}

export interface Category {
  id: string;
  label: string;
  directives: Directive[];
}

export interface WorldserverSchema {
  categories: Category[];
}

// Reusable option sets
const GM_STATE: SelectOption[] = [
  { value: 0, label: "Disabled" },
  { value: 1, label: "Enabled" },
  { value: 2, label: "Last save state" },
];

const SECURITY_LEVEL: SelectOption[] = [
  { value: 0, label: "Player (Everyone)" },
  { value: 1, label: "Moderator+" },
  { value: 2, label: "Game Master+" },
  { value: 3, label: "Admin only" },
  { value: 4, label: "Disabled" },
];

const STRICT_NAMES: SelectOption[] = [
  { value: 0, label: "Disabled (client default)" },
  { value: 1, label: "Basic Latin only" },
  { value: 2, label: "Realm zone specific" },
  { value: 3, label: "Basic Latin + timezone" },
];

const rateField = (key: string, label: string, description: string, def = "1"): Directive => ({
  key,
  label,
  type: "number",
  default: def,
  description,
  min: 0,
  step: 0.1,
});

const boolField = (key: string, label: string, description: string, def = "0"): Directive => ({
  key,
  label,
  type: "boolean",
  default: def,
  description,
});

const intField = (
  key: string,
  label: string,
  description: string,
  def: string,
  min?: number,
  max?: number,
): Directive => ({
  key,
  label,
  type: "number",
  default: def,
  description,
  ...(min !== undefined ? { min } : {}),
  ...(max !== undefined ? { max } : {}),
  step: 1,
});

export const WORLDSERVER_SCHEMA: WorldserverSchema = {
  categories: [
    {
      id: "rates-xp",
      label: "Rates & Experience",
      directives: [
        rateField("Rate.XP.Kill", "XP Rate (Kill)", "Multiplier for XP gained from killing creatures."),
        rateField("Rate.XP.Quest", "XP Rate (Quest)", "Multiplier for XP gained from completing quests."),
        rateField("Rate.XP.Quest.DF", "XP Rate (Dungeon Finder Quest)", "Multiplier for XP from Dungeon Finder / LFG quests only."),
        rateField("Rate.XP.Explore", "XP Rate (Exploration)", "Multiplier for XP gained from exploring new areas."),
        rateField("Rate.XP.Pet", "XP Rate (Pet)", "Multiplier for XP gained by hunter pets."),
        rateField("Rate.XP.BattlegroundKillAV", "XP Rate (AV Kills)", "Experience rate for honorable kills in Alterac Valley. Requires Battleground.GiveXPForKills = 1."),
        rateField("Rate.XP.BattlegroundKillWSG", "XP Rate (WSG Kills)", "Experience rate for honorable kills in Warsong Gulch."),
        rateField("Rate.XP.BattlegroundKillAB", "XP Rate (AB Kills)", "Experience rate for honorable kills in Arathi Basin."),
        rateField("Rate.XP.BattlegroundKillEOTS", "XP Rate (EotS Kills)", "Experience rate for honorable kills in Eye of the Storm."),
        rateField("Rate.XP.BattlegroundKillSOTA", "XP Rate (SotA Kills)", "Experience rate for honorable kills in Strand of the Ancients."),
        rateField("Rate.XP.BattlegroundKillIC", "XP Rate (IoC Kills)", "Experience rate for honorable kills in Isle of Conquest."),
        rateField("Rate.XP.BattlegroundBonus", "XP Rate (BG Objectives)", "Experience multiplier for battleground objectives like flag captures."),
        rateField("Rate.Pet.LevelXP", "Pet Level XP Rate", "Modifies XP required to level up a pet. Lower = faster.", "0.05"),
        intField("MaxGroupXPDistance", "Max Group XP Distance", "Maximum distance in yards for group members to get XP at creature death.", "74", 1, 1000),
        rateField("Rate.Rest.InGame", "Rest Rate (In-Game)", "Resting points grow rate while logged in."),
        rateField("Rate.Rest.Offline.InTavernOrCity", "Rest Rate (Offline Tavern)", "Resting rate while offline in a tavern or city."),
        rateField("Rate.Rest.Offline.InWilderness", "Rest Rate (Offline Wilderness)", "Resting rate while offline in the wilderness."),
        rateField("Rate.Rest.MaxBonus", "Max Rest Bonus", "Maximum rested XP bonus cap.", "1.5"),
      ],
    },
    {
      id: "drop-rates",
      label: "Drop Rates",
      directives: [
        rateField("Rate.Drop.Item.Poor", "Drop Rate (Poor / Grey)", "Drop rate multiplier for poor quality items."),
        rateField("Rate.Drop.Item.Normal", "Drop Rate (Common / White)", "Drop rate multiplier for common items."),
        rateField("Rate.Drop.Item.Uncommon", "Drop Rate (Uncommon / Green)", "Drop rate multiplier for uncommon items."),
        rateField("Rate.Drop.Item.Rare", "Drop Rate (Rare / Blue)", "Drop rate multiplier for rare items."),
        rateField("Rate.Drop.Item.Epic", "Drop Rate (Epic / Purple)", "Drop rate multiplier for epic items."),
        rateField("Rate.Drop.Item.Legendary", "Drop Rate (Legendary / Orange)", "Drop rate multiplier for legendary items."),
        rateField("Rate.Drop.Item.Artifact", "Drop Rate (Artifact / Red)", "Drop rate multiplier for artifact items."),
        rateField("Rate.Drop.Item.Referenced", "Drop Rate (Referenced)", "Drop rate multiplier for referenced loot."),
        rateField("Rate.Drop.Money", "Drop Rate (Money)", "Multiplier for coin drops from creatures."),
        rateField("Rate.Drop.Item.ReferencedAmount", "Referenced Loot Amount", "Multiplier for referenced loot count — affects raid bosses drop counts."),
        rateField("Rate.Drop.Item.GroupAmount", "Group Loot Amount", "Multiplier for grouped items — affects dungeon bosses drop counts."),
      ],
    },
    {
      id: "character-creation",
      label: "Character Creation",
      directives: [
        intField("MinPlayerName", "Min Player Name Length", "Minimum length for player names.", "2", 1, 12),
        intField("MinPetName", "Min Pet Name Length", "Minimum length for pet names.", "2", 1, 12),
        intField("CharactersPerAccount", "Characters Per Account", "Total characters allowed per account across all realms.", "50", 1, 200),
        intField("CharactersPerRealm", "Characters Per Realm", "Characters per account on this realm. Client max is 10.", "10", 1, 10),
        intField("HeroicCharactersPerRealm", "Heroic Characters Per Realm", "Death Knight characters allowed per account on this realm.", "1", 0, 10),
        intField("CharacterCreating.MinLevelForHeroicCharacter", "DK Unlock Level", "Level required on another character to unlock Death Knight creation. 0 disables.", "55", 0, 80),
        intField("StartPlayerLevel", "Starting Level", "Level new characters start at.", "1", 1, 80),
        intField("StartHeroicPlayerLevel", "DK Starting Level", "Level Death Knights start at.", "55", 1, 80),
        intField("StartPlayerMoney", "Starting Money (copper)", "Starting money in copper. 10000 = 1 gold.", "0", 0),
        intField("StartHeroicPlayerMoney", "DK Starting Money", "Starting money for Death Knights in copper.", "2000", 0),
        {
          key: "SkipCinematics",
          label: "Skip Cinematics",
          type: "select",
          default: "0",
          description: "Disable cinematic intro at first login after character creation.",
          options: [
            { value: 0, label: "Show for each new character" },
            { value: 1, label: "Show only for first character of a race" },
            { value: 2, label: "Disable for all classes" },
          ],
        },
        boolField("DeclinedNames", "Allow Declined Names", "Allow Russian clients to set and use declined names.", "0"),
        {
          key: "StrictPlayerNames",
          label: "Strict Player Names",
          type: "select",
          default: "0",
          description: "Symbol set restriction for player names.",
          options: STRICT_NAMES,
        },
        {
          key: "StrictPetNames",
          label: "Strict Pet Names",
          type: "select",
          default: "0",
          description: "Symbol set restriction for pet names.",
          options: STRICT_NAMES,
        },
        {
          key: "CharacterCreating.Disabled",
          label: "Disable Character Creation",
          type: "select",
          default: "0",
          description: "Disable character creation for specific factions.",
          options: [
            { value: 0, label: "Enabled (all factions)" },
            { value: 1, label: "Disable Alliance" },
            { value: 2, label: "Disable Horde" },
            { value: 3, label: "Disable both factions" },
          ],
        },
      ],
    },
    {
      id: "character",
      label: "Character",
      directives: [
        intField("MaxPlayerLevel", "Max Player Level", "Maximum level characters can reach. Above 100 is not recommended.", "80", 1, 255),
        intField("MinDualSpecLevel", "Min Dual Spec Level", "Level required to use dual talent specialization.", "40", 1, 80),
        rateField("Rate.MoveSpeed.Player", "Player Movement Speed", "Multiplier for player movement speed."),
        rateField("Rate.MoveSpeed.NPC", "NPC Movement Speed", "Multiplier for NPC movement speed."),
        rateField("Rate.Damage.Fall", "Fall Damage Rate", "Multiplier for fall damage taken by players."),
        rateField("Rate.Talent", "Talent Point Rate", "Multiplier for talent points earned per level."),
        rateField("Rate.Talent.Pet", "Pet Talent Rate", "Multiplier for pet talent points."),
        rateField("Rate.Health", "Health Regen Rate", "Multiplier for player health regeneration."),
        rateField("Rate.Mana", "Mana Regen Rate", "Multiplier for player mana regeneration."),
        boolField("NoResetTalentsCost", "Free Talent Resets", "Resetting talents costs nothing.", "0"),
        intField("PlayerSaveInterval", "Player Save Interval (ms)", "Time between automatic character saves.", "900000", 60000),
        boolField("EnableLowLevelRegenBoost", "Low Level Regen Boost", "Greatly increases HP/Mana regen for players under level 15.", "1"),
      ],
    },
    {
      id: "game-master",
      label: "Game Master",
      directives: [
        {
          key: "GM.LoginState",
          label: "GM Mode at Login",
          type: "select",
          default: "2",
          description: "Whether GM mode is active when a GM logs in.",
          options: GM_STATE,
        },
        {
          key: "GM.Visible",
          label: "GM Visibility at Login",
          type: "select",
          default: "2",
          description: "Whether GM is visible to players at login.",
          options: [
            { value: 0, label: "Invisible" },
            { value: 1, label: "Visible" },
            { value: 2, label: "Last save state" },
          ],
        },
        {
          key: "GM.Chat",
          label: "GM Chat Mode",
          type: "select",
          default: "2",
          description: "GM chat tag mode at login.",
          options: GM_STATE,
        },
        {
          key: "GM.WhisperingTo",
          label: "GM Accepts Whispers",
          type: "select",
          default: "2",
          description: "Whether GMs accept whispers from players by default.",
          options: GM_STATE,
        },
        intField("GM.StartLevel", "GM Start Level", "Starting level for new GM characters.", "1", 1, 80),
        boolField("GM.AllowInvite", "Allow GM Invites", "Allow players to invite GM characters to groups.", "0"),
        boolField("GM.AllowFriend", "Allow GM Friends", "Allow players to add GMs to their friends list.", "0"),
        boolField("GM.LowerSecurity", "Allow Lower Security", "Allow lower security levels to use commands on higher security characters.", "0"),
        intField("GM.TicketSystem.ChanceOfGMSurvey", "GM Survey Chance (%)", "Chance of sending a GM survey after ticket completion.", "50", 0, 100),
      ],
    },
    {
      id: "cheats-convenience",
      label: "Cheats & Convenience",
      directives: [
        {
          key: "DisableWaterBreath",
          label: "Water Breathing",
          type: "select",
          default: "4",
          description: "Minimum security level that can breathe underwater.",
          options: SECURITY_LEVEL,
        },
        boolField("AllFlightPaths", "All Flight Paths", "Character knows all flight paths of both factions after creation.", "0"),
        {
          key: "InstantFlightPaths",
          label: "Instant Flight Paths",
          type: "select",
          default: "0",
          description: "Make flight paths instant instead of waiting.",
          options: [
            { value: 0, label: "Disabled (normal)" },
            { value: 1, label: "Always instant" },
            { value: 2, label: "Toggleable at each flight master" },
          ],
        },
        boolField("AlwaysMaxSkillForLevel", "Always Max Skill For Level", "Players automatically gain max skill level when logging in or leveling up.", "0"),
        boolField("AlwaysMaxWeaponSkill", "Always Max Weapon Skill", "Players automatically gain max weapon/defense skill.", "0"),
        boolField("PlayerStart.AllReputation", "Start With All Reputations", "New players start with most high-level reputations.", "0"),
        boolField("PlayerStart.CustomSpells", "Custom Start Spells", "Players start with spells from playercreateinfo_spell_custom table.", "0"),
        boolField("PlayerStart.MapsExplored", "Start With Maps Explored", "New characters start with all maps explored.", "0"),
        {
          key: "InstantLogout",
          label: "Instant Logout",
          type: "select",
          default: "1",
          description: "Security level that can instantly log out anywhere (not during combat).",
          options: SECURITY_LEVEL,
        },
        boolField("AllowPlayerCommands", "Allow Player Commands", "Allow players to use non-admin commands.", "1"),
        boolField("InfiniteAmmo.Enabled", "Infinite Ammo", "Disable ammo consumption for ranged attacks.", "0"),
        boolField("Daze.Enabled", "Daze Enabled", "Allow mob melee attacks to daze the victim (Blizzlike).", "1"),
      ],
    },
    {
      id: "skills-professions",
      label: "Skills & Professions",
      directives: [
        intField("MaxPrimaryTradeSkill", "Max Primary Professions", "Maximum primary professions a character can learn.", "2", 0, 11),
        rateField("Rate.Skill.Discovery", "Skill Discovery Rate", "Multiplier for skill discovery chance."),
        rateField("SkillGain.Crafting", "Crafting Skill Gain", "Multiplier for crafting skill gain."),
        rateField("SkillGain.Defense", "Defense Skill Gain", "Multiplier for defense skill gain."),
        rateField("SkillGain.Gathering", "Gathering Skill Gain", "Multiplier for gathering skill gain."),
        rateField("SkillGain.Weapon", "Weapon Skill Gain", "Multiplier for weapon skill gain."),
        intField("SkillChance.Orange", "Skill Chance (Orange)", "Chance to increase skill on orange recipes.", "100", 0, 100),
        intField("SkillChance.Yellow", "Skill Chance (Yellow)", "Chance to increase skill on yellow recipes.", "75", 0, 100),
        intField("SkillChance.Green", "Skill Chance (Green)", "Chance to increase skill on green recipes.", "25", 0, 100),
        intField("SkillChance.Grey", "Skill Chance (Grey)", "Chance to increase skill on grey recipes.", "0", 0, 100),
        boolField("SkillChance.Prospecting", "Prospecting Skill Gain", "Allow skill increase from prospecting.", "0"),
        boolField("SkillChance.Milling", "Milling Skill Gain", "Allow skill increase from milling.", "0"),
      ],
    },
    {
      id: "stats-reputation",
      label: "Stats & Reputation",
      directives: [
        rateField("Rate.Reputation.Gain", "Reputation Gain Rate", "Global multiplier for reputation gain."),
        rateField("Rate.Reputation.LowLevel.Kill", "Low Level Kill Rep Rate", "Reputation gain from killing low-level (grey) creatures."),
        rateField("Rate.Reputation.LowLevel.Quest", "Low Level Quest Rep Rate", "Reputation gain from low-level quests."),
        rateField("Rate.Reputation.Gain.WSG", "WSG Reputation Bonus", "Extra reputation gain multiplier in Warsong Gulch."),
        rateField("Rate.Reputation.Gain.AB", "AB Reputation Bonus", "Extra reputation gain multiplier in Arathi Basin."),
        rateField("Rate.Reputation.Gain.AV", "AV Reputation Bonus", "Extra reputation gain multiplier in Alterac Valley."),
        boolField("Stats.Limits.Enable", "Enable Stat Limits", "Enable percentage caps on dodge/parry/block/crit ratings.", "0"),
        { key: "Stats.Limits.Dodge", label: "Dodge Limit (%)", type: "number", default: "95.0", description: "Maximum dodge percentage.", min: 0, max: 100, step: 0.1 },
        { key: "Stats.Limits.Parry", label: "Parry Limit (%)", type: "number", default: "95.0", description: "Maximum parry percentage.", min: 0, max: 100, step: 0.1 },
        { key: "Stats.Limits.Block", label: "Block Limit (%)", type: "number", default: "95.0", description: "Maximum block percentage.", min: 0, max: 100, step: 0.1 },
        { key: "Stats.Limits.Crit", label: "Crit Limit (%)", type: "number", default: "95.0", description: "Maximum crit percentage.", min: 0, max: 100, step: 0.1 },
      ],
    },
    {
      id: "pvp-honor",
      label: "PvP & Honor",
      directives: [
        intField("MaxHonorPoints", "Max Honor Points", "Maximum honor points a character can have.", "75000", 0),
        intField("StartHonorPoints", "Starting Honor Points", "Honor points new characters have after creation.", "0", 0),
        intField("HonorPointsAfterDuel", "Honor After Duel", "Honor points the duel winner receives. 0 disables.", "0", 0),
        rateField("Rate.Honor", "Honor Gain Rate", "Multiplier for honor gained from honorable kills."),
        intField("MaxArenaPoints", "Max Arena Points", "Maximum arena points a character can have.", "10000", 0),
        intField("StartArenaPoints", "Starting Arena Points", "Arena points characters have after creation.", "0", 0),
        boolField("Arena.LegacyArenaPoints", "Legacy Arena Points", "Use TBC arena point calculation for seasons 1-5 (rating <= 1500).", "0"),
        rateField("Rate.ArenaPoints", "Arena Points Gain Rate", "Multiplier for arena points gain."),
        rateField("Rate.ArenaPoints2v2", "2v2 Arena Points Rate", "Arena points gain rate for 2v2 bracket.", "0.76"),
        rateField("Rate.ArenaPoints3v3", "3v3 Arena Points Rate", "Arena points gain rate for 3v3 bracket.", "0.88"),
        boolField("PvPToken.Enable", "PvP Token System", "Grant a token after defeating another player that yields honor.", "0"),
        {
          key: "PvPToken.MapAllowType",
          label: "PvP Token Where",
          type: "select",
          default: "4",
          description: "Where PvP tokens can be obtained.",
          options: [
            { value: 1, label: "Battlegrounds + FFA areas" },
            { value: 2, label: "FFA areas only" },
            { value: 3, label: "Battlegrounds only" },
            { value: 4, label: "All maps" },
          ],
        },
        intField("PvPToken.ItemID", "PvP Token Item ID", "Item ID granted as a PvP token.", "29434", 1),
        intField("PvPToken.ItemCount", "PvP Token Count", "Number of tokens granted per kill.", "1", 1),
        boolField("DurabilityLoss.InPvP", "Durability Loss in PvP", "Lose durability on death during PvP.", "0"),
        intField("FFAPvPTimer", "FFA PvP Timer (sec)", "Delay before FFA PvP flag is removed after leaving an FFA area.", "30", 0),
      ],
    },
    {
      id: "battlegrounds-arena",
      label: "Battlegrounds & Arena",
      directives: [
        intField("Battleground.PrepTime", "BG Prep Time (sec)", "Battleground preparation phase duration.", "120", 0),
        intField("Arena.PrepTime", "Arena Prep Time (sec)", "Arena preparation phase duration.", "60", 0),
        boolField("Battleground.CastDeserter", "Cast Deserter (BG)", "Cast Deserter on players who leave battlegrounds in progress.", "1"),
        boolField("Battleground.QueueAnnouncer.Enable", "BG Queue Announcer", "Announce battleground queue status to chat.", "0"),
        boolField("Battleground.QueueAnnouncer.PlayerOnly", "BG Queue Private", "Only show queue announcements to queued players.", "0"),
        intField("Battleground.PrematureFinishTimer", "BG Premature Finish (ms)", "Time before BG ends if not enough players. 0 disables.", "300000", 0),
        boolField("Battleground.GiveXPForKills", "BG XP For Kills", "Give XP for honorable kills in battlegrounds.", "0"),
        {
          key: "Battleground.InvitationType",
          label: "BG Invitation Type",
          type: "select",
          default: "0",
          description: "How players are invited to battlegrounds.",
          options: [
            { value: 0, label: "Normal (don't balance)" },
            { value: 1, label: "Experimental: limit dominant faction" },
            { value: 2, label: "Experimental: even teams" },
          ],
        },
        intField("Battleground.RewardWinnerHonorFirst", "Winner Honor (First Win)", "Honor rewarded to BG winners for the first win of the day.", "30", 0),
        intField("Battleground.RewardWinnerArenaFirst", "Winner Arena (First Win)", "Arena points rewarded for first BG win.", "25", 0),
        intField("Battleground.RewardWinnerHonorLast", "Winner Honor (Subsequent)", "Honor rewarded for subsequent BG wins.", "15", 0),
        intField("Battleground.RewardLoserHonorFirst", "Loser Honor (First Loss)", "Honor rewarded to BG losers for first loss.", "5", 0),
        intField("Battleground.RewardLoserHonorLast", "Loser Honor (Subsequent)", "Honor rewarded for subsequent BG losses.", "5", 0),
        intField("Battleground.PlayerRespawn", "BG Respawn Time (sec)", "Battleground player resurrection interval.", "30", 0),
        intField("Arena.MaxRatingDifference", "Arena Rating Difference", "Maximum rating difference between matched teams. 0 disables.", "150", 0),
        boolField("Arena.AutoDistributePoints", "Auto Distribute Arena Points", "Automatically distribute arena points on schedule.", "0"),
        intField("Arena.AutoDistributeInterval", "Arena Distribution Days", "Days between automatic arena point distribution.", "7", 1),
        intField("Arena.GamesRequired", "Arena Games Required", "Arena matches required to be eligible for point distribution.", "10", 0),
        boolField("Arena.QueueAnnouncer.Enable", "Arena Queue Announcer", "Announce arena queue status to chat.", "0"),
        intField("Arena.ArenaStartRating", "Arena Team Start Rating", "Starting rating for new arena teams (season 6+).", "0", 0),
        intField("Arena.ArenaStartMatchmakerRating", "Arena Start MMR", "Starting matchmaker rating for players.", "1500", 0),
        {
          key: "Wintergrasp.Enable",
          label: "Wintergrasp",
          type: "select",
          default: "1",
          description: "Enable the Wintergrasp battlefield.",
          options: [
            { value: 0, label: "Battleground disabled (world processing continues)" },
            { value: 1, label: "Fully enabled" },
            { value: 2, label: "Completely disabled" },
          ],
        },
        intField("Wintergrasp.PlayerMax", "Wintergrasp Max Players/Team", "Max players allowed per team in Wintergrasp.", "120", 1),
        intField("Wintergrasp.PlayerMin", "Wintergrasp Min Players/Team", "Minimum players required per team.", "0", 0),
        intField("Wintergrasp.PlayerMinLvl", "Wintergrasp Min Level", "Required character level for Wintergrasp.", "75", 1, 80),
        intField("Wintergrasp.BattleTimer", "Wintergrasp Battle Time (min)", "Duration of the Wintergrasp battle in minutes.", "30", 1),
        intField("Wintergrasp.NoBattleTimer", "Wintergrasp Peace Time (min)", "Time between Wintergrasp battles in minutes.", "150", 1),
      ],
    },
    {
      id: "instances-dungeons",
      label: "Instances & Dungeons",
      directives: [
        boolField("Instance.GMSummonPlayer", "GM Summon In Instance", "Allow GMs to summon regular players into instances.", "0"),
        boolField("Instance.IgnoreLevel", "Ignore Instance Level Req", "Ignore level requirements when entering instances.", "0"),
        boolField("Instance.IgnoreRaid", "Ignore Raid Requirement", "Allow entering raid instances without being in a raid group.", "0"),
        intField("Instance.ResetTimeHour", "Instance Reset Hour", "Hour of the day for global instance reset (0-23).", "4", 0, 23),
        rateField("Rate.InstanceResetTime", "Instance Reset Time Rate", "Multiplier for time between global raid/heroic resets."),
        intField("Instance.UnloadDelay", "Instance Unload Delay (ms)", "Time before empty instance maps are unloaded. 0 never unloads.", "1800000", 0),
        intField("AccountInstancesPerHour", "Account Instances Per Hour", "Maximum different instances per account per hour.", "5", 1),
        boolField("Instance.SharedNormalHeroicId", "ICC/RS Shared Lockouts", "Force ICC and RS normal/heroic to share lockouts.", "1"),
        {
          key: "DungeonFinder.OptionsMask",
          label: "Dungeon Finder Mode",
          type: "select",
          default: "5",
          description: "Dungeon finder feature bitmask.",
          options: [
            { value: 0, label: "Disabled" },
            { value: 1, label: "Dungeon Finder only" },
            { value: 2, label: "Raid Browser only" },
            { value: 3, label: "Dungeon Finder + Raid Browser" },
            { value: 4, label: "Seasonal Bosses only" },
            { value: 5, label: "Dungeon Finder + Seasonal Bosses" },
            { value: 7, label: "All features" },
          ],
        },
        boolField("DungeonFinder.CastDeserter", "Cast Deserter (LFG)", "Cast Deserter on players who leave a dungeon prematurely.", "1"),
        intField("LFG.MaxKickCount", "LFG Max Kicks", "Maximum kicks allowed in LFG groups (max 3).", "2", 0, 3),
        intField("LFG.KickPreventionTimer", "LFG Kick Prevention (sec)", "How long new members are protected from being kicked.", "900", 0),
      ],
    },
    {
      id: "guild-groups",
      label: "Guild & Groups",
      directives: [
        intField("Guild.EventLogRecordsCount", "Guild Event Log Size", "Number of event log entries stored per guild.", "100", 1),
        intField("Guild.ResetHour", "Guild Daily Reset Hour", "Hour of day when daily guild caps reset (0-23).", "6", 0, 23),
        intField("MinPetitionSigns", "Guild Charter Signatures", "Required signatures on charters to create a guild.", "9", 0, 9),
        intField("Guild.CharterCost", "Guild Charter Cost (copper)", "Cost of guild petition in copper. 1000 = 10 silver.", "1000", 0),
        boolField("Guild.AllowMultipleGuildMaster", "Multiple Guild Masters", "Allow more than one guild master per guild.", "0"),
        intField("Guild.BankInitialTabs", "Free Guild Bank Tabs", "Number of guild bank tabs given at guild creation.", "0", 0, 6),
        intField("Guild.MemberLimit", "Guild Member Limit", "Maximum guild members. 0 disables the limit.", "0", 0),
        intField("Group.Raid.LevelRestriction", "Raid Min Level", "Minimum level to be in a raid group.", "10", 1, 80),
        intField("Group.RandomRollMaximum", "Group Roll Max", "Maximum value for /roll command.", "1000000", 2),
        boolField("LeaveGroupOnLogout.Enabled", "Leave Group on Logout", "Player leaves their group on logout (not raids or LFG).", "0"),
      ],
    },
    {
      id: "chat-communication",
      label: "Chat & Communication",
      directives: [
        intField("ChatFlood.MessageCount", "Chat Flood Message Count", "Messages before player is muted. 0 disables.", "10", 0),
        intField("ChatFlood.MessageDelay", "Chat Flood Delay (sec)", "Time between messages for flood counting.", "1", 0),
        intField("ChatFlood.MuteTime", "Chat Flood Mute (sec)", "How long players are muted for flooding.", "10", 0),
        intField("ChatFlood.AddonMessageCount", "Addon Flood Count", "Addon messages before player is muted. 0 disables.", "100", 0),
        intField("ChatFlood.AddonMessageDelay", "Addon Flood Delay (sec)", "Time between addon messages for flood counting.", "1", 0),
        boolField("Chat.MuteFirstLogin", "Mute New Players", "Mute world chat for new players until they have played long enough.", "0"),
        intField("Chat.MuteTimeFirstLogin", "New Player Mute (min)", "Minutes new players must play before they can use chat.", "120", 0),
        intField("ChatLevelReq.Channel", "Channel Chat Min Level", "Minimum level to write in chat channels.", "1", 1, 80),
        intField("ChatLevelReq.Whisper", "Whisper Min Level", "Minimum level to whisper other players.", "1", 1, 80),
        intField("ChatLevelReq.Say", "Say/Yell Min Level", "Minimum level to say/yell/emote.", "1", 1, 80),
        intField("PartyLevelReq", "Party Invite Min Level", "Minimum level to invite to party (friends bypass).", "1", 1, 80),
        boolField("AddonChannel", "Addon Channel", "Enable the server-wide addon chat channel.", "1"),
        boolField("PreserveCustomChannels", "Preserve Custom Channels", "Store custom chat channels in the database.", "0"),
      ],
    },
    {
      id: "faction-interaction",
      label: "Faction Interaction",
      directives: [
        boolField("AllowTwoSide.Accounts", "Both Factions Per Account", "Allow creating characters of both factions on the same account.", "1"),
        boolField("AllowTwoSide.Interaction.Calendar", "Cross-Faction Calendar", "Allow calendar invites between factions.", "0"),
        boolField("AllowTwoSide.Interaction.Chat", "Cross-Faction Say", "Allow say chat between factions.", "0"),
        boolField("AllowTwoSide.Interaction.Emote", "Cross-Faction Emotes", "Allow emote messages between factions.", "0"),
        boolField("AllowTwoSide.Interaction.Channel", "Cross-Faction Channels", "Allow channel chat between factions.", "0"),
        boolField("AllowTwoSide.Interaction.Group", "Cross-Faction Groups", "Allow group joining between factions.", "0"),
        boolField("AllowTwoSide.Interaction.Guild", "Cross-Faction Guilds", "Allow guild joining between factions.", "0"),
        boolField("AllowTwoSide.Interaction.Arena", "Cross-Faction Arena", "Allow joining arena teams between factions.", "0"),
        boolField("AllowTwoSide.Interaction.Auction", "Cross-Faction Auction", "Allow auctions between factions (neutral AH).", "0"),
        boolField("AllowTwoSide.Interaction.Mail", "Cross-Faction Mail", "Allow sending mails between factions.", "0"),
        boolField("AllowTwoSide.WhoList", "Cross-Faction /who", "Show characters from both factions in /who.", "0"),
        boolField("AllowTwoSide.AddFriend", "Cross-Faction Friends", "Allow adding opposite faction to friends list.", "0"),
        boolField("AllowTwoSide.Trade", "Cross-Faction Trade", "Allow trading between factions.", "0"),
        boolField("TalentsInspecting", "Cross-Faction Inspect", "Allow inspecting characters of the opposing faction.", "1"),
      ],
    },
    {
      id: "creatures",
      label: "Creatures & NPCs",
      directives: [
        rateField("Rate.Creature.Aggro", "Aggro Radius Rate", "Aggro radius multiplier. 1 = 100%, 0 = disabled."),
        rateField("Rate.Creature.Normal.Damage", "Normal Creature Damage", "Damage multiplier for normal creatures."),
        rateField("Rate.Creature.Elite.Elite.Damage", "Elite Creature Damage", "Damage multiplier for elite creatures."),
        rateField("Rate.Creature.Elite.WORLDBOSS.Damage", "World Boss Damage", "Damage multiplier for world bosses."),
        rateField("Rate.Creature.Normal.HP", "Normal Creature HP", "HP multiplier for normal creatures."),
        rateField("Rate.Creature.Elite.Elite.HP", "Elite Creature HP", "HP multiplier for elite creatures."),
        rateField("Rate.Creature.Elite.WORLDBOSS.HP", "World Boss HP", "HP multiplier for world bosses."),
        rateField("Rate.Creature.Normal.SpellDamage", "Normal Spell Damage", "Spell damage multiplier for normal creatures."),
        rateField("Rate.Creature.Elite.Elite.SpellDamage", "Elite Spell Damage", "Spell damage multiplier for elite creatures."),
        intField("Corpse.Decay.NORMAL", "Normal Corpse Decay (sec)", "Time before normal creature corpses decay.", "60", 1),
        intField("Corpse.Decay.RARE", "Rare Corpse Decay (sec)", "Time before rare creature corpses decay.", "300", 1),
        intField("Corpse.Decay.ELITE", "Elite Corpse Decay (sec)", "Time before elite creature corpses decay.", "300", 1),
        intField("Corpse.Decay.WORLDBOSS", "World Boss Decay (sec)", "Time before world boss corpses decay.", "3600", 1),
        rateField("Rate.Corpse.Decay.Looted", "Looted Corpse Decay", "Multiplier applied to corpse decay after looting.", "0.5"),
        intField("CreatureLeashRadius", "Creature Leash Radius", "Distance for creature leashing. 0 disables.", "30", 0),
        intField("WorldBossLevelDiff", "World Boss Level Diff", "Level difference added to world bosses.", "3", 0),
        { key: "MonsterSight", label: "Monster Sight (yards)", type: "number", default: "50.000000", description: "Maximum distance a creature can see a player.", min: 1, step: 1 },
      ],
    },
    {
      id: "death-durability",
      label: "Death & Durability",
      directives: [
        intField("Death.SicknessLevel", "Rez Sickness Start Level", "Starting level for resurrection sickness.", "11", 1),
        boolField("Death.CorpseReclaimDelay.PvP", "PvP Corpse Delay", "Increase corpse reclaim delay at PvP deaths.", "1"),
        boolField("Death.CorpseReclaimDelay.PvE", "PvE Corpse Delay", "Increase corpse reclaim delay at PvE deaths.", "1"),
        intField("DurabilityLoss.OnDeath", "Durability Loss on Death (%)", "Percentage of durability lost on death.", "10", 0, 100),
        { key: "DurabilityLossChance.Damage", label: "Durability Loss (Damage)", type: "number", default: "0.5", description: "Chance to lose durability per damage taken.", min: 0, step: 0.01 },
        { key: "DurabilityLossChance.Absorb", label: "Durability Loss (Absorb)", type: "number", default: "0.5", description: "Chance to lose durability on armor when absorbing damage.", min: 0, step: 0.01 },
        { key: "DurabilityLossChance.Parry", label: "Durability Loss (Parry)", type: "number", default: "0.05", description: "Chance to lose weapon durability on parry.", min: 0, step: 0.01 },
        { key: "DurabilityLossChance.Block", label: "Durability Loss (Block)", type: "number", default: "0.05", description: "Chance to lose shield durability on block.", min: 0, step: 0.01 },
        boolField("Death.Bones.World", "Bones in World", "Create bones instead of corpses after resurrection.", "1"),
      ],
    },
    {
      id: "economy-mail",
      label: "Economy, Mail & Auction",
      directives: [
        rateField("Rate.RepairCost", "Repair Cost Rate", "Multiplier for repair costs."),
        rateField("Rate.SellValue.Item.Poor", "Sell Rate (Poor)", "Vendor sell value multiplier for poor items."),
        rateField("Rate.SellValue.Item.Normal", "Sell Rate (Normal)", "Vendor sell value multiplier for common items."),
        rateField("Rate.SellValue.Item.Uncommon", "Sell Rate (Uncommon)", "Vendor sell value multiplier for uncommon items."),
        rateField("Rate.SellValue.Item.Rare", "Sell Rate (Rare)", "Vendor sell value multiplier for rare items."),
        rateField("Rate.SellValue.Item.Epic", "Sell Rate (Epic)", "Vendor sell value multiplier for epic items."),
        rateField("Rate.BuyValue.Item.Poor", "Buy Rate (Poor)", "Vendor buy value multiplier for poor items."),
        rateField("Rate.BuyValue.Item.Normal", "Buy Rate (Normal)", "Vendor buy value multiplier for common items."),
        rateField("Rate.BuyValue.Item.Uncommon", "Buy Rate (Uncommon)", "Vendor buy value multiplier for uncommon items."),
        rateField("Rate.BuyValue.Item.Rare", "Buy Rate (Rare)", "Vendor buy value multiplier for rare items."),
        rateField("Rate.BuyValue.Item.Epic", "Buy Rate (Epic)", "Vendor buy value multiplier for epic items."),
        rateField("Rate.Auction.Time", "Auction Duration Rate", "Multiplier for auction duration."),
        rateField("Rate.Auction.Deposit", "Auction Deposit Rate", "Multiplier for auction deposit cost."),
        rateField("Rate.Auction.Cut", "Auction Cut Rate", "Multiplier for auction house cut on sales."),
        intField("MailDeliveryDelay", "Mail Delivery Delay (sec)", "Time mail with items is delayed.", "3600", 0),
        intField("LevelReq.Mail", "Mail Min Level", "Minimum level to send/receive mail.", "1", 1, 80),
        intField("LevelReq.Trade", "Trade Min Level", "Minimum level to initiate a trade.", "1", 1, 80),
        intField("LevelReq.Auction", "Auction Min Level", "Minimum level to use the auction house.", "1", 1, 80),
      ],
    },
    {
      id: "quests-misc",
      label: "Quests & Misc",
      directives: [
        boolField("Quests.EnableQuestTracker", "Quest Tracker Logging", "Store quest completion/abandonment data for debugging bugged quests.", "0"),
        intField("Quests.LowLevelHideDiff", "Low Level Quest Hide", "Level difference at which quests are considered low-level.", "4", 0, 80),
        intField("Quests.HighLevelHideDiff", "High Level Quest Hide", "Level difference at which quests are considered high-level.", "7", 0, 80),
        boolField("Quests.IgnoreRaid", "Allow Raid Quests", "Allow non-raid quests to be completed while in a raid.", "0"),
        rateField("Rate.RewardQuestMoney", "Quest Money Rate", "Multiplier for money rewarded by quests."),
        rateField("Rate.RewardBonusMoney", "Quest Bonus Money Rate", "Multiplier for extra money rewarded at max level."),
        intField("Event.Announce", "Announce Events", "Announce game events (0 or 1).", "0", 0, 1),
        boolField("Calculate.Creature.Zone.Area.Data", "Calculate Creature Zones", "WARNING: Slow startup. Calculates creature zone/area IDs at load time.", "0"),
      ],
    },
  ],
};

/**
 * Flat map of all curated directive keys for O(1) lookup.
 */
export const CURATED_KEYS: Set<string> = new Set(
  WORLDSERVER_SCHEMA.categories.flatMap((c) => c.directives.map((d) => d.key)),
);

/**
 * Flat map from directive key to directive metadata. Useful for server-side
 * validation of PUT payloads against schema constraints (min/max).
 */
export const DIRECTIVE_BY_KEY: Map<string, Directive> = new Map(
  WORLDSERVER_SCHEMA.categories.flatMap((c) => c.directives.map((d) => [d.key, d] as const)),
);
