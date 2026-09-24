using System.Linq;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTien.Core.World;

namespace TuTienLuc.Ui;

/// <summary>Display strings shared by the HUD and panels (always in the current locale).</summary>
public static class Text
{
    private static Locale L => Game.Instance.Locale;
    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    public static string Realm(Realm realm, int stage) =>
        realm == TuTien.Core.Realm.PhamNhan
            ? Names.Display(realm, L)
            : T($"{Names.Display(realm, L)} tầng {stage}", $"{Names.Display(realm, L)} {stage}");

    public static string Body(BodyRealm realm, int stage) =>
        realm == BodyRealm.PhamThe
            ? Names.Display(realm, L)
            : T($"{Names.Display(realm, L)} tầng {stage}", $"{Names.Display(realm, L)} {stage}");

    public static string Root(SpiritRootState root) =>
        string.Join(" · ", root.Elements.Select(e => Names.Display(e, L))) + $" ({Names.Display(root.Grade, L)})";

    public static string Path(CultivationPath path) => path switch
    {
        CultivationPath.Body => T("Thể tu", "Body cultivation"),
        CultivationPath.Kiem => T("Kiêm tu (khí + thể)", "Dual path (Qi + Body)"),
        _ => T("Khí tu", "Qi cultivation"),
    };

    public static string Karma(int karma)
    {
        var band = TuTien.Core.Rules.Karma.Band(karma);
        return $"{Names.Pick(L, band.vi, band.en)} ({(karma > 0 ? "+" : "")}{karma})";
    }

    public static string Terrain(Terrain t) => t switch
    {
        TuTien.Core.World.Terrain.Plains => T("Đồng bằng", "Plains"),
        TuTien.Core.World.Terrain.Road => T("Đường cái", "Road"),
        TuTien.Core.World.Terrain.Forest => T("Rừng", "Forest"),
        TuTien.Core.World.Terrain.DenseForest => T("Rừng rậm", "Dense forest"),
        TuTien.Core.World.Terrain.Hills => T("Đồi", "Hills"),
        TuTien.Core.World.Terrain.Mountain => T("Núi", "Mountain"),
        TuTien.Core.World.Terrain.Peak => T("Đỉnh núi", "Peak"),
        TuTien.Core.World.Terrain.Water => T("Sông hồ", "Water"),
        TuTien.Core.World.Terrain.Bridge => T("Cầu", "Bridge"),
        TuTien.Core.World.Terrain.Swamp => T("Đầm lầy", "Swamp"),
        TuTien.Core.World.Terrain.Town => T("Thôn trấn", "Town"),
        _ => T("Sơn môn", "Sect grounds"),
    };

    public static string Zone(AreaDef area) =>
        Names.Pick(L, area.Name, area.NameEn)
        + (area.IsSafe ? T(" · an toàn", " · safe") : T($" · hiểm {area.DangerLevel}", $" · danger {area.DangerLevel}"))
        + (area.CultivationBonus > 0 ? T($" · linh khí +{area.CultivationBonus}%", $" · qi +{area.CultivationBonus}%") : "");

    public static string Rank(string? rank) => rank switch
    {
        "NgoạiMôn" => T("Đệ tử ngoại môn", "Outer disciple"),
        "NộiMôn" => T("Đệ tử nội môn", "Inner disciple"),
        "ChânTruyền" => T("Chân truyền", "True disciple"),
        "TrưởngLão" => T("Trưởng lão", "Elder"),
        "ChưởngMôn" => T("Chưởng môn", "Sect master"),
        _ => T("Tán tu", "Unaffiliated"),
    };

    public static string ItemType(string type) => type switch
    {
        "Medicine" => T("Đan dược", "Medicine"),
        "Equipment" => T("Trang bị", "Equipment"),
        "Accessory" => T("Phụ kiện", "Accessory"),
        "Book" => T("Bí kíp", "Manual"),
        "Material" => T("Tài liệu", "Material"),
        "Manual" => T("Công pháp", "Technique"),
        _ => T("Tạp vật", "Misc"),
    };

    public static string Rarity(string rarity) => rarity switch
    {
        "Uncommon" => T("Khá", "Uncommon"),
        "Rare" => T("Hiếm", "Rare"),
        "Epic" => T("Cực phẩm", "Epic"),
        "Legendary" => T("Truyền thuyết", "Legendary"),
        _ => T("Thường", "Common"),
    };

    public static string Name(ItemStack s) => Names.Pick(L, s.Name, s.NameEn);
    public static string Name(ItemDef d) => Names.Pick(L, d.Name, d.NameEn);
    public static string Name(SkillDef d) => Names.Pick(L, d.Name, d.NameEn);
    public static string Desc(ItemDef d) => Names.Pick(L, d.Description, d.DescriptionEn);
    public static string Desc(SkillDef d) => Names.Pick(L, d.Description, d.DescriptionEn);

    /// <summary>"Tháng 3 · Năm 1" and the season.</summary>
    public static string Date(CalendarState c) => T($"Tháng {c.Month} · Năm {c.Year}", $"Month {c.Month} · Year {c.Year}");

    public static string Signed(double v) => (v > 0 ? "+" : "") + v.ToString("0.##");

    /// <summary>What an item does, in one line (for shop and bag tooltips).</summary>
    public static string Effects(ItemDef def)
    {
        var parts = new System.Collections.Generic.List<string>();
        if (def.Effects != null)
        {
            foreach (var kv in def.Effects)
            {
                parts.Add(kv.Key switch
                {
                    "hp_restore" => T($"hồi {kv.Value} HP", $"restores {kv.Value} HP"),
                    "qi_restore" => T($"hồi {kv.Value} linh lực", $"restores {kv.Value} Qi"),
                    "stamina_restore" => T($"hồi {kv.Value} thể lực", $"restores {kv.Value} stamina"),
                    "cultivation_exp" => T($"+{kv.Value} tu vi", $"+{kv.Value} cultivation"),
                    "permanent_hp" => T($"+{kv.Value} HP tối đa", $"+{kv.Value} max HP"),
                    "permanent_qi" => T($"+{kv.Value} linh lực tối đa", $"+{kv.Value} max Qi"),
                    "permanent_str" => T($"+{kv.Value} lực", $"+{kv.Value} STR"),
                    "permanent_agi" => T($"+{kv.Value} thân pháp", $"+{kv.Value} AGI"),
                    "permanent_int" => T($"+{kv.Value} ngộ tính", $"+{kv.Value} INT"),
                    "permanent_perception" => T($"+{kv.Value} cảm tri", $"+{kv.Value} PER"),
                    "permanent_luck" => T($"+{kv.Value} vận khí", $"+{kv.Value} LUCK"),
                    _ => $"{kv.Key} {kv.Value}",
                });
            }
        }
        if (def.BonusStats != null)
            parts.AddRange(def.BonusStats.Select(kv => $"{Stat(kv.Key)} {Signed(kv.Value)}"));
        if (def.TeachesSkillId != null && Game.Instance.Content.Skill(def.TeachesSkillId) is { } skill)
            parts.Add(T($"dạy {skill.Name}", $"teaches {skill.NameEn}"));
        if (def.TeachesTechnique is { } tech)
            parts.Add(T($"công pháp {tech.Name} (+{tech.CultivationSpeedBonus}% tu luyện)", $"technique {tech.NameEn} (+{tech.CultivationSpeedBonus}% cultivation)"));
        return string.Join(", ", parts);
    }

    public static string Stat(string key) => key switch
    {
        "atk" => T("công", "ATK"),
        "def" => T("thủ", "DEF"),
        "str" => T("lực", "STR"),
        "agi" => T("thân pháp", "AGI"),
        "int" => T("ngộ tính", "INT"),
        "perception" => T("cảm tri", "PER"),
        "luck" => T("vận khí", "LUCK"),
        "hp" => "HP",
        "qi" => T("linh lực", "Qi"),
        _ => key,
    };
}
