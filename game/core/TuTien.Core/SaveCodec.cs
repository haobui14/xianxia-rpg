using System;
using System.Text.Json;
using TuTien.Core.State;

namespace TuTien.Core
{
    /// <summary>Versioned save files. Bump <see cref="CurrentVersion"/> and add a migration step for every format change.</summary>
    public static class SaveCodec
    {
        public const int CurrentVersion = 1;

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
            // v1 is the first format. Future steps go here: if (state.Version < 2) { …; state.Version = 2; }
            while (state.Player.SkillSlots.Count < 4) state.Player.SkillSlots.Add("");
            state.Version = CurrentVersion;
        }
    }
}
