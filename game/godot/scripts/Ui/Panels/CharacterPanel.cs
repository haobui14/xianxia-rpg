using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Rules;

namespace TuTienLuc.Ui.Panels;

/// <summary>The cultivator: attributes and combat profile, arts and slots, and the cultivation path.</summary>
public partial class CharacterPanel : InkPanel
{
    protected override string Glyph => "吾";
    protected override string TitleText => E.Player.Name;
    protected override Vector2 PanelSize => new(820, 680);

    protected override void Build()
    {
        var p = E.Player;
        Para($"{Text.Realm(p.Realm, p.Stage)} ({Names.Han(p.Realm)}) · {Text.Path(p.Path)} · {T("linh căn", "root")} {Text.Root(p.Root)}", 17, Ink.InkColor);
        Tabs(T("Căn cơ", "Foundation"), T("Võ học", "Arts"), T("Tu luyện", "Cultivation"));
        switch (Tab)
        {
            case 0:
                Foundation();
                break;
            case 1:
                Arts();
                break;
            default:
                Path();
                break;
        }
    }

    private void Foundation()
    {
        var p = E.Player;
        var content = E.Content;
        var a = CombatRules.EffectiveAttrs(content, p);
        Section(T("Thuộc tính", "Attributes"));
        (string vi, string en, int total, int basis)[] attrs =
        {
            ("Lực", "Strength", a.Str, p.Attrs.Str),
            ("Thân pháp", "Agility", a.Agi, p.Attrs.Agi),
            ("Ngộ tính", "Insight", a.Int, p.Attrs.Int),
            ("Cảm tri", "Perception", a.Per, p.Attrs.Per),
            ("Vận khí", "Luck", a.Luck, p.Attrs.Luck),
        };
        foreach (var (vi, en, total, basis) in attrs)
        {
            var bonus = total - basis;
            Row(UiKit.Label(T(vi, en), 16, Ink.InkSoft), UiKit.Label(total + (bonus != 0 ? $"  ({basis} {Text.Signed(bonus)})" : ""), 16, Ink.InkColor));
        }

        var c = CombatRules.PlayerCombatant(content, p);
        Section(T("Chiến lực", "Combat profile"));
        var reduce = (1 - CombatRules.Mitigation(c.Def)) * 100;
        var resist = (1 - CombatRules.Mitigation(c.Res)) * 100;
        (string, string, string)[] rows =
        {
            ("Công vật lý", "Physical power", $"{c.PhysicalPower:0}"),
            ("Công linh lực", "Spirit power", $"{c.SpiritPower:0}"),
            ("Phòng thủ", "Defense", T($"{c.Def:0} (giảm {reduce:0}% sát thương vật lý)", $"{c.Def:0} (−{reduce:0}% physical damage)")),
            ("Kháng pháp", "Resistance", T($"{c.Res:0} (giảm {resist:0}% sát thương linh lực)", $"{c.Res:0} (−{resist:0}% spirit damage)")),
            ("Bạo kích", "Critical", $"{CombatRules.CritChance(c.Per, c.Luck) * 100:0}% × {CombatRules.CritDamage(c.Luck):0.00}"),
            ("Tốc độ", "Move speed", $"{CombatRules.PlayerMoveSpeed(content, p):0}"),
            ("Cảnh giới áp chế", "Realm weight", $"{c.RealmValue:0.0}"),
        };
        foreach (var (vi, en, value) in rows)
            Row(UiKit.Label(T(vi, en), 16, Ink.InkSoft), UiKit.Label(value, 16, Ink.InkColor));
        var weapon = content.Item(p.WeaponId);
        Row(UiKit.Label(T("Binh khí", "Weapon"), 16, Ink.InkSoft), UiKit.Label(weapon != null ? Text.Name(weapon) + " · " + Text.Effects(weapon) : T("tay không", "bare hands"), 16, Ink.InkColor));

        Section(T("Nhân quả & danh vọng", "Karma & renown"));
        Para(T("Nhân quả: ", "Karma: ") + Text.Karma(p.Karma) + T($" · danh vọng {p.Reputation}", $" · reputation {p.Reputation}"), 16, Ink.InkColor);
        if (p.SectId != null && content.Sects.TryGetValue(p.SectId, out var sect))
            Para($"{T(sect.Name, sect.NameEn)} · {Text.Rank(p.SectRank)} · {T("cống hiến", "contribution")} {p.Contribution}", 16, Ink.CinnabarDeep);
        Para(T($"Chiến tích: {p.Counters.Kills} lần hạ địch · {p.Counters.Fights} trận · {p.Counters.Defeats} lần bại · {p.Counters.AdventuresResolved} kỳ ngộ",
            $"Record: {p.Counters.Kills} kills · {p.Counters.Fights} fights · {p.Counters.Defeats} defeats · {p.Counters.AdventuresResolved} adventures"), 15, Ink.InkMute);
    }

    private void Arts()
    {
        var p = E.Player;
        var content = E.Content;
        Section(T("Ô linh kỹ (chuột phải · 1 · 2 · 3)", "Art slots (right click · 1 · 2 · 3)"));
        string[] keys = { T("Chuột phải", "Right click"), "1", "2", "3" };
        for (var i = 0; i < 4; i++)
        {
            var slot = i;
            var current = i < p.SkillSlots.Count ? p.SkillSlots[i] : "";
            var picker = new OptionButton { FocusMode = FocusModeEnum.None, CustomMinimumSize = new Vector2(300, 0) };
            picker.AddItem(T("(trống)", "(empty)"));
            var ids = p.Skills.Select(s => s.Id).Where(id => content.Skill(id) != null).ToList();
            foreach (var id in ids) picker.AddItem(Text.Name(content.Skill(id)!));
            picker.Selected = current.Length == 0 ? 0 : ids.IndexOf(current) + 1;
            picker.ItemSelected += index =>
            {
                E.SetSkillSlot(slot, index == 0 ? "" : ids[(int)index - 1]);
                Game.Instance.Changed();
            };
            Row(UiKit.Label(keys[i], 16, Ink.InkSoft), picker);
        }
        Para(T("Chuột trái luôn là võ kỹ cơ bản; R là tuyệt kỹ khi sát ý đầy; Space là thân pháp; Q uống đan dược.",
            "Left click is always your basic martial art; R is the ultimate once killing intent is full; Space dodges; Q takes a pill."), 14, Ink.InkMute);

        Section(T("Linh kỹ đã lĩnh ngộ", "Arts learned"));
        if (p.Skills.Count == 0)
            Para(T("Chưa có linh kỹ — đột phá Luyện Khí để khai mở linh kỹ đầu tiên theo linh căn.", "No arts yet — reach Qi Condensation to awaken your root's first art."));
        foreach (var s in p.Skills)
        {
            var def = content.Skill(s.Id);
            if (def == null) continue;
            var element = def.Element != null ? $" · {Names.Han(def.Element.Value)} {Names.Display(def.Element.Value, Game.Instance.Locale)}" : "";
            var cost = CombatRules.QiCost(def, p.Root.Elements);
            Para($"{def.Glyph} {Text.Name(def)} — {T("cấp", "lv")} {s.Level} ({s.Exp}/{s.Level * 100}){element}", 17, def.Element != null ? Ink.Element(def.Element.Value).Darkened(0.2f) : Ink.InkColor);
            Para($"    {Text.Desc(def)}  ·  {T("linh lực", "Qi")} {cost} · {T("hồi", "cooldown")} {def.Cooldown:0.#}s · ×{def.DamageMultiplier * Skills.LevelMultiplier(p, s.Id):0.##}", 14, Ink.InkMute);
        }

        Section(T("Công pháp", "Techniques"));
        if (p.Techniques.Count == 0)
            Para(T("Chưa có công pháp — tìm bí kíp ở chợ, bí cảnh hoặc tông môn.", "No technique yet — find manuals in markets, secret realms or sects."));
        foreach (var t in p.Techniques)
        {
            var fit = t.Elements.Count == 0 ? 0.2 : Elements.TechniqueCompatibility(p.Root.Elements, t.Elements);
            Para($"{T(t.Name, t.NameEn)} · {t.Grade} · {T("tu luyện", "cultivation")} +{t.SpeedBonus}% · {T("hợp linh căn", "root fit")} {Text.Signed(fit * 100)}%", 16, Ink.JadeDeep);
        }
        Para(T($"Tổng hệ số công pháp: ×{Cultivation.TechniqueMultiplier(p):0.00}", $"Total technique multiplier: ×{Cultivation.TechniqueMultiplier(p):0.00}"), 15, Ink.InkSoft);
    }

    private void Path()
    {
        var p = E.Player;
        var content = E.Content;
        Section(T("Con đường", "The path"));
        Para(Text.Path(p.Path) + " — " + (p.Path switch
        {
            CultivationPath.Body => T("tu vi đổ hết vào luyện thể: trâu bò, sống ngắn hơn khí tu.", "all cultivation tempers the body: tough, but shorter-lived than qi cultivators."),
            CultivationPath.Kiem => T("chia tu vi giữa khí và thể. Chậm hơn, nhưng toàn diện.", "cultivation splits between qi and body. Slower, but well-rounded."),
            _ => T("dẫn linh khí, luyện linh lực và linh kỹ.", "draw in qi, grow spiritual power and arts."),
        }), 16, Ink.InkSoft);
        if (p.Path == CultivationPath.Kiem)
        {
            Row(UiKit.Label(T($"Phân bổ: khí {p.QiShare}% · thể {100 - p.QiShare}%", $"Split: qi {p.QiShare}% · body {100 - p.QiShare}%"), 16, Ink.InkColor),
                UiKit.Button("− 10", () => { E.SetQiShare(p.QiShare - 10); Game.Instance.Changed(); }),
                UiKit.Button("+ 10", () => { E.SetQiShare(p.QiShare + 10); Game.Instance.Changed(); }));
        }
        Para(T("Thể: ", "Body: ") + Text.Body(p.BodyRealm, p.BodyStage) + T($" · tu vi thể {p.BodyExp}", $" · body exp {p.BodyExp}"), 16, Ink.Ochre);

        var month = E.PreviewMonth(seclusion: false);
        Section(T("Một tháng bình thường tại đây", "A normal month here"));
        Para(T($"≈ {month.Total} tu vi (bế quan ×{Cultivation.SeclusionMultiplier} — nhiều hơn ở linh mạch).",
            $"≈ {month.Total} cultivation (seclusion ×{Cultivation.SeclusionMultiplier} — more at a spirit vein)."), 16, Ink.JadeDeep);

        Section(T("Thọ nguyên", "Lifespan"));
        var max = Progression.MaxLifespan(content, p);
        Para(T($"{p.Age} tuổi / thọ tối đa {max} — còn {max - p.Age} năm. Mỗi đại cảnh giới kéo dài tuổi thọ.",
            $"Age {p.Age} of {max} — {max - p.Age} years left. Each major realm extends it."), 16, Ink.InkColor);

        if (p.Injuries.Count > 0)
        {
            Section(T("Thương thế", "Injuries"));
            foreach (var i in p.Injuries)
                Para(T($"{i.Name}: còn {i.MonthsLeft} tháng · tu luyện ×{i.CultivationMultiplier:0.##}", $"{i.NameEn}: {i.MonthsLeft} months left · cultivation ×{i.CultivationMultiplier:0.##}"), 15, Ink.CinnabarDeep);
        }

        Section(T("Đột phá kế tiếp", "Next breakthrough"));
        var threshold = Cultivation.MajorBreakthroughThreshold(p);
        Para(T($"Độ khó hiện tại: cần đạt {threshold * 100:0}% trong thử thách đột phá. Linh căn tốt, nhiều công pháp và thân thể lành lặn giúp dễ hơn.",
            $"Current difficulty: you need {threshold * 100:0}% in the breakthrough trial. A good root, more techniques and no injuries make it easier."), 15, Ink.InkSoft);
        if (E.BreakthroughReady)
            Buttons(UiKit.Button(T("✦ Đột phá", "✦ Break through"), () => Open(new BreakthroughPanel()), primary: true));
    }
}
