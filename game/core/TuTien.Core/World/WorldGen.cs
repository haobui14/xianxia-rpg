using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;

namespace TuTien.Core.World
{
    public static class WorldGen
    {
        public const string StartRegion = "thanh_van";
        public const int RandomNpcCount = 22;

        /// <summary>Port of the web game's generateSpiritRoot: 60/25/12/3% grades, 70% single element.</summary>
        public static SpiritRootState RollRoot(Pcg32 rng)
        {
            var g = rng.NextDouble();
            var grade = g < 0.6 ? RootGrade.PhoThong : g < 0.85 ? RootGrade.Kha : g < 0.97 ? RootGrade.Hiem : RootGrade.ThienPham;
            var elements = new List<Element> { rng.Pick(Elements.All) };
            if (!rng.Chance(0.7))
            {
                var second = rng.Pick(Elements.All.Where(e => e != elements[0]).ToList());
                elements.Add(second);
            }
            return new SpiritRootState { Elements = elements, Grade = grade };
        }

        public static GameState NewGame(ContentDb content, ulong seed, string name, int age, SpiritRootState root,
            CultivationPath path, Locale locale)
        {
            var state = new GameState { WorldSeed = seed.ToString(CultureInfo.InvariantCulture), Locale = locale };
            var p = state.Player;
            p.Name = name;
            p.Age = age;
            p.Root = root;
            p.Path = path;
            p.Hp = p.HpMax = 100;
            p.Qi = p.QiMax = 0; // mortals have no qi until Dẫn khí nhập thể
            p.Stamina = p.StaminaMax = 100;
            p.Silver = 100;

            foreach (var starter in new[] { ("wooden_sword", 1), ("hoi_huyet_tan", 2) })
            {
                if (content.Item(starter.Item1) != null) Inventory.Add(p, Inventory.Resolve(content, starter.Item1, starter.Item2));
            }
            p.WeaponId = content.Item("wooden_sword") != null ? "wooden_sword" : null;

            var mapDef = content.MapForRegion(StartRegion) ?? throw new KeyNotFoundException("No map for the starting region");
            var map = new MapGrid(mapDef);
            p.Region = StartRegion;
            p.X = mapDef.Start.X;
            p.Y = mapDef.Start.Y;
            p.FootworkMax = WorldTick.FootworkMax(p);
            p.Footwork = p.FootworkMax;

            var fog = FogMask.For(p, map);
            fog.RevealCircle(p.X, p.Y, MapGrid.SenseRadius(p));
            // The home village is known ground from the start.
            var town = mapDef.Pois.FirstOrDefault(x => x.Kind == "town");
            if (town != null) fog.RevealCircle(town.X, town.Y, 6);
            fog.SaveTo(p, map);

            var rng = Seeds.Stream(seed, "worldgen");
            state.World.Npcs.AddRange(NpcSim.Generate(state, content, map, RandomNpcCount, rng));
            Spawns.FillBeasts(state, content, map, rng);
            Spawns.RefreshAdventures(state, content, map, rng);

            var region = content.Region(StartRegion);
            state.Chronicle.Add(new ChronicleEntry
            {
                MonthIndex = 0,
                Text = $"{name}, {age} tuổi, linh căn {string.Join("/", root.Elements.Select(e => Names.Display(e, Locale.Vi)))} "
                       + $"({Names.Display(root.Grade, Locale.Vi)}), bước chân ra khỏi {town?.Name ?? region?.Name ?? "làng"}.",
                TextEn = $"{name}, aged {age}, with a {Names.Display(root.Grade, Locale.En)} "
                         + $"{string.Join("/", root.Elements.Select(e => Names.Display(e, Locale.En)))} spirit root, "
                         + $"sets out from {town?.NameEn ?? region?.NameEn ?? "the village"}.",
            });
            return state;
        }
    }
}
