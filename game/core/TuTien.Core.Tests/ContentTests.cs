using TuTien.Core.World;

namespace TuTien.Core.Tests;

public class ContentTests
{
    private static Content.ContentDb C => TestContent.Content;

    [Fact]
    public void Loads_all_exported_web_content()
    {
        Assert.Equal(5, C.Regions.Count);
        Assert.Equal(20, C.Areas.Count);
        Assert.Equal(5, C.Dungeons.Count);
        Assert.Equal(18, C.Events.Count);
        Assert.Equal(5, C.Sects.Count);
        // The web game's 10, and 4 hand-authored in activities.json (ore, deep ore, sunken things, the bandits' hoard).
        Assert.Equal(14, C.LootTables.Count);
        Assert.NotEmpty(C.Missions);
        Assert.Equal(100, C.Progression.CultivationExp["PhàmNhân"][0]);
    }

    [Fact]
    public void Thanh_van_slice_has_no_broken_references()
    {
        var sliceIssues = C.Validate()
            .Where(i => i.Contains("thanh_van") || i.Contains("verdant_forest") || i.Contains("spirit_herb")
                        || i.Contains("ancient_tree_hollow") || i.StartsWith("enemy ") || i.StartsWith("map ") || i.StartsWith("town "))
            .Where(i => !i.Contains("is not authored")) // event pools are known content debt (design §7.12)
            .ToList();
        Assert.Empty(sliceIssues);
    }

    [Fact]
    public void Hand_authored_creatures_join_the_zones_they_name()
    {
        var hollow = C.Area("ancient_tree_hollow")!;
        foreach (var id in new[] { "black_bear", "fire_fox", "blood_bat", "wandering_wraith", "azure_python" })
            Assert.Contains(id, hollow.EnemyPool);
        Assert.True(C.Enemy("azure_python")!.Solitary);
        Assert.DoesNotContain("black_bear", C.Area("verdant_forest")!.EnemyPool);
    }

    [Fact]
    public void Every_element_has_a_second_art_and_a_manual_for_it()
    {
        foreach (var element in new[] { Element.Kim, Element.Moc, Element.Thuy, Element.Hoa, Element.Tho })
        {
            var art = C.Skill(Rules.Skills.SecondArt(element));
            Assert.NotNull(art);
            Assert.Equal(element, art!.Element);
            Assert.Contains(C.Items.Values, i => i.TeachesSkillId == art.Id);
        }
        Assert.DoesNotContain(C.Validate(), i => i.StartsWith("item "));
    }

    [Fact]
    public void Reports_known_content_debt_for_other_regions()
    {
        var issues = C.Validate();
        Assert.Contains(issues, i => i.Contains("has no catalog entry")); // 71 ids, catalog covers the slice
        Assert.Contains(issues, i => i.Contains("is not authored"));      // 59 event-pool ids
    }

    [Fact]
    public void Map_parses_and_every_poi_is_reachable_from_the_start_by_a_mortal()
    {
        var def = C.MapForRegion("thanh_van")!;
        var map = new MapGrid(def);
        var engine = TestContent.NewEngine();
        var start = new Cell(def.Start.X, def.Start.Y);
        Assert.True(map.StepCost(start.X, start.Y, engine.Player) > 0);

        foreach (var poi in def.Pois)
        {
            Assert.True(map.InBounds(poi.X, poi.Y), poi.Id);
            var path = map.FindPath(start, new Cell(poi.X, poi.Y), engine.Player);
            Assert.True(path != null, $"{poi.Id} at {poi.X},{poi.Y} is unreachable");
        }
    }

    [Fact]
    public void Every_zone_in_the_legend_is_painted_on_the_map()
    {
        var map = new MapGrid(C.MapForRegion("thanh_van")!);
        foreach (var zone in map.Def.ZoneLegend.Values.Distinct())
            Assert.NotEmpty(map.CellsInZone(zone));
    }

    [Fact]
    public void Loot_alias_resolution_matches_the_web_game()
    {
        Assert.Equal("common_herbs", C.ResolveLootTable("common_herbs"));
        Assert.Equal("thanh_van_wilds", C.ResolveLootTable("forest_tier1"));
        Assert.Equal("dungeon_boss", C.ResolveLootTable("something_tier3"));
        Assert.Equal("cave_treasure", C.ResolveLootTable("unknown_table", 2));
    }
}
