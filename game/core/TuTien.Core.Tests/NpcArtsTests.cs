using TuTien.Core.Combat;
using TuTien.Core.Rules;
using TuTien.Core.State;

namespace TuTien.Core.Tests;

/// <summary>NPC cultivators fight with their own arts (root, realm, sect), not one template bolt.</summary>
public class NpcArtsTests
{
    private static Content.ContentDb C => TestContent.Content;

    private static NpcState Npc(string id, Realm realm, int stage, params Element[] elements) => new()
    {
        Id = id, Name = id, Realm = realm, Stage = stage, Elements = elements.ToList(),
    };

    [Fact]
    public void A_mortal_fights_with_fists() =>
        Assert.Equal(new[] { "vo_ky_kiem" }, NpcCombat.Kit(Npc("m", Realm.PhamNhan, 0), C));

    [Fact]
    public void A_cultivators_arts_follow_their_root_and_realm()
    {
        var low = NpcCombat.Kit(Npc("a", Realm.LuyenKhi, 2, Element.Thuy), C);
        Assert.Contains("thuy_nhan", low);
        Assert.DoesNotContain("thuy_long_ba", low);

        var high = NpcCombat.Kit(Npc("a", Realm.LuyenKhi, 6, Element.Thuy), C);
        Assert.Contains("thuy_nhan", high);
        Assert.Contains("thuy_long_ba", high);

        var dual = NpcCombat.Kit(Npc("b", Realm.LuyenKhi, 4, Element.Hoa, Element.Kim), C);
        Assert.Contains("hoa_cau_thuat", dual);
        Assert.Contains("kim_kiem_khi", dual);
    }

    [Fact]
    public void Sect_disciples_carry_their_sects_art()
    {
        var npc = Npc("s", Realm.LuyenKhi, 3, Element.Moc);
        npc.SectId = "thanh_van_kiem";
        Assert.Contains("thanh_van_kiem_quyet", NpcCombat.Kit(npc, C));
    }

    [Fact]
    public void The_same_npc_always_has_the_same_kit_and_some_carry_a_guard_or_a_heal()
    {
        var kits = Enumerable.Range(0, 60).Select(i => NpcCombat.Kit(Npc("npc_" + i, Realm.LuyenKhi, 6, Element.Kim), C)).ToList();
        Assert.Equal(kits[7], NpcCombat.Kit(Npc("npc_7", Realm.LuyenKhi, 6, Element.Kim), C));
        Assert.Contains(kits, k => k.Contains("ho_the_cuong_khi") || k.Contains("hoi_xuan_quyet"));
        Assert.Contains(kits, k => !k.Contains("ho_the_cuong_khi") && !k.Contains("hoi_xuan_quyet"));
        Assert.All(kits, k => Assert.True(k.Count >= 2));
    }

    [Fact]
    public void A_spar_brings_the_npcs_own_arts_and_element_into_the_fight()
    {
        var e = TestContent.NewEngine();
        var npc = e.State.World.Npcs.First(n => n.Alive);
        npc.Realm = Realm.LuyenKhi;
        npc.Stage = 6;
        var enc = e.ChallengeNpc(npc.Id, lethal: false)!;
        var foe = Encounters.Build(C, enc).Single();
        Assert.Equal(NpcCombat.Kit(npc, C), foe.Arts);
        Assert.True(foe.Arts.Count >= 2);
        Assert.Equal(NpcCombat.Element(npc), foe.Element);
    }

    [Fact]
    public void Human_templates_know_more_than_one_art()
    {
        foreach (var id in new[] { "sect_disciple", "rogue_cultivator", "bandit_leader" })
            Assert.True(C.Enemy(id)!.Skills.Count >= 2, id);
        Assert.All(C.Enemies.Values.SelectMany(d => d.Skills), id => Assert.NotNull(C.Skill(id)));
    }
}
