using System;
using System.Text.Json;
using TuTien.Core.State;

namespace TuTien.Core
{
    /// <summary>Versioned save files. Bump <see cref="CurrentVersion"/> and add a migration step for every format change.</summary>
    public static class SaveCodec
    {
        public const int CurrentVersion = 4;

        public static string Serialize(GameState state, bool indented = false)
        {
            state.Version = CurrentVersion;
            return JsonSerializer.Serialize(state, indented ? GameJson.Indented : GameJson.Options);
        }

        public static GameState Deserialize(string json)
        {
            var state = JsonSerializer.Deserialize<GameState>(json, GameJson.Options)
                        ?? throw new FormatException("Save file is empty");
            if (state.Version > CurrentVersion)
                throw new FormatException($"Save is from a newer version ({state.Version} > {CurrentVersion})");
            Migrate(state);
            return state;
        }

        private static void Migrate(GameState state)
        {
            while (state.Player.SkillSlots.Count < 4) state.Player.SkillSlots.Add("");
            // v2: Trúc Cơ carries a foundation grade. Whoever got there before it existed laid a plain one.
            if (state.Version < 2 && state.Player.Realm >= Realm.TrucCo && state.Player.Foundation == FoundationGrade.None)
                state.Player.Foundation = FoundationGrade.Ha;
            // v3: sects keep merit (all contribution ever earned) for promotions. Before, nothing spent contribution,
            // so what a disciple holds is what they earned.
            if (state.Version < 3 && state.Player.SectId != null) state.Player.Merit = Math.Max(state.Player.Merit, state.Player.Contribution);
            // v4: gear slots. The weapon was the only thing worn; it moves into the Weapon slot (weapons add no health or Qi).
            if (state.Player.LegacyWeaponId is { } weapon && !state.Player.Gear.ContainsKey(Rules.Equipment.Weapon))
                state.Player.Gear[Rules.Equipment.Weapon] = new GearSlot { ItemId = weapon };
            state.Player.LegacyWeaponId = null;
            state.Version = CurrentVersion;
        }
    }
}
