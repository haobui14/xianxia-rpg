using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTienLuc.Art;

namespace TuTienLuc.Ui.Panels;

/// <summary>The cultivator: attributes and combat profile, arts and slots, and the cultivation path.</summary>
public partial class CharacterPanel : InkPanel
{
    protected override IconKind Emblem => IconKind.Person;
    protected override string TitleText => Game.Instance.Person(E.Player.Name);
    protected override Vector2 PanelSize => new(820, 680);

    protected override void Build()
    {
        var p = E.Player;
        Para($"{Text.Realm(p.Realm, p.Stage)} · {Text.Path(p.Path)} · {T("linh căn", "root")} {Text.Root(p.Root)}", 17, Ink.InkColor);
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
        foreach (var slot in Equipment.Slots)
        {
            var g = p.Gear.TryGetValue(slot, out var worn) ? worn : new TuTien.Core.State.GearSlot();
            var info = UiKit.Column(0);
            info.AddChild(UiKit.Label(Text.Slot(slot, g.Level), 14, Ink.InkSoft));
            info.AddChild(UiKit.Label(g.ItemId != null ? Text.Worn(content, slot, g) : slot == Equipment.Weapon ? T("tay không", "bare hands") : T("(trống)", "(empty)"),
                16, g.ItemId != null ? Ink.InkColor : Ink.InkFaint, wrap: true));
            Body.AddChild(info);
        }
        if (p.Foundation != FoundationGrade.None)
        {
            var bonus = (TuTien.Core.Rules.Foundation.PowerMultiplier(p.Foundation) - 1) * 100;
            Row(UiKit.Label(T("Nền móng Trúc Cơ", "Foundation"), 16, Ink.InkSoft),
                UiKit.Label(T($"{TuTien.Core.Rules.Foundation.Name(p.Foundation, Locale.Vi)} (uy lực +{bonus:0}%)", $"{TuTien.Core.Rules.Foundation.Name(p.Foundation, Locale.En)} (+{bonus:0}% power)"),
                    16, p.Foundation >= FoundationGrade.Thuong ? Ink.GoldDeep : Ink.JadeDeep));
        }

        Section(T("Nhân quả & danh vọng", "Karma & renown"));
        Para(T("Nhân quả: ", "Karma: ") + Text.Karma(p.Karma) + T($" · danh vọng {p.Reputation}", $" · reputation {p.Reputation}"), 16, Ink.InkColor);
        if (p.SectId != null && content.Sects.TryGetValue(p.SectId, out var sect))
            Para($"{T(sect.Name, sect.NameEn)} · {Text.Rank(p.SectRank)} · {T("cống hiến", "contribution")} {p.Contribution}", 16, Ink.CinnabarDeep);
        Para(T($"Chiến tích: {p.Counters.Kills} lần hạ địch · {p.Counters.Fights} trận · {p.Counters.Defeats} lần bại · {p.Counters.AdventuresResolved} kỳ ngộ",
            $"Record: {p.Counters.Kills} kills · {p.Counters.Fights} fights · {p.Counters.Defeats} defeats · {p.Counters.AdventuresResolved} adventures"), 15, Ink.InkMute);
    }

    /// <summary>
    /// The four spirit-art slots and the arts learned. Every art carries its own row of slot buttons: tap one
    /// to put the art there, tap it again to take the art out. (Drop-down pickers opened a popup window on
    /// every touch that landed on them, including a thumb scrolling the page, and were the one place in the
    /// panels that did.)
    /// </summary>
    private void Arts()
    {
        var p = E.Player;
        var content = E.Content;
        Section(T("Ô linh kỹ", "Art slots"));
        var grid = new GridContainer { Columns = 2 };
        grid.AddThemeConstantOverride("h_separation", 8);
        grid.AddThemeConstantOverride("v_separation", 8);
        for (var i = 0; i < 4; i++)
            grid.AddChild(SlotCard(SlotName(i), content.Skill(i < p.SkillSlots.Count ? p.SkillSlots[i] : null)));
        Body.AddChild(grid);
        Para(TouchUi.Active
                ? T("Trong trận, bốn nút linh kỹ vây quanh nút kiếm: ô 1 bên trái, ô 4 trên cùng. Nút kiếm luôn là võ kỹ cơ bản; hình sao là tuyệt kỹ khi sát ý đầy.",
                    "In a fight the four art buttons ring the sword button: slot 1 on the left, slot 4 at the top. The sword is always your basic martial art; the starburst is the ultimate once killing intent is full.")
                : T($"Chuột trái luôn là võ kỹ cơ bản; {KeyMap.Label("ultimate")} là tuyệt kỹ khi sát ý đầy; {KeyMap.Label("dash")} là thân pháp; {KeyMap.Label("pill")} uống đan dược.",
                    $"Left click is always your basic martial art; {KeyMap.Label("ultimate")} is the ultimate once killing intent is full; {KeyMap.Label("dash")} dodges; {KeyMap.Label("pill")} takes a pill."),
            14, Ink.InkMute);

        Section(T("Linh kỹ đã lĩnh ngộ", "Arts learned"));
        if (p.Skills.Count == 0)
            Para(T("Chưa có linh kỹ — đột phá Luyện Khí để khai mở linh kỹ đầu tiên theo linh căn.", "No arts yet — reach Qi Condensation to awaken your root's first art."));
        foreach (var s in p.Skills)
        {
            var def = content.Skill(s.Id);
            if (def == null) continue;
            var color = def.Element is { } e ? Ink.Element(e) : Ink.InkColor;
            var element = def.Element is { } el ? T($" · hệ {Names.Display(el, Locale.Vi)}", $" · {Names.Display(el, Locale.En)}") : "";
            var head = new HBoxContainer();
            head.AddThemeConstantOverride("separation", 10);
            head.AddChild(new IconView(Icons.ForSkill(def), color, 0.86f) { CustomMinimumSize = new Vector2(32, 32) });
            var title = UiKit.Label($"{Text.Name(def)} — {T("cấp", "lv")} {s.Level} ({s.Exp}/{s.Level * 100}){element}", 17, color.Darkened(0.2f), wrap: true);
            title.SizeFlagsHorizontal = SizeFlags.ExpandFill;
            title.VerticalAlignment = VerticalAlignment.Center;
            head.AddChild(title);
            Body.AddChild(head);
            var cost = CombatRules.QiCost(def, p.Root.Elements);
            Para($"{Text.Desc(def)}  ·  {T("linh lực", "Qi")} {cost} · {T("hồi", "cooldown")} {def.Cooldown:0.#}s · ×{def.DamageMultiplier * Skills.LevelMultiplier(p, s.Id):0.##}", 14, Ink.InkMute);
            Body.AddChild(SlotButtons(s.Id));
            if (Mastery.SkillCost(s) is { } price)
            {
                var id = s.Id;
                var train = UiKit.Button(T($"Khổ luyện lên cấp {s.Level + 1} ({price} bạc)", $"Train to level {s.Level + 1} ({price} silver)"),
                    () => Say(E.TrainSkill(id)), enabled: p.Silver >= price);
                train.Name = $"train_{s.Id}";
                Buttons(train);
            }
        }

        Section(T("Công pháp", "Techniques"));
        if (p.Techniques.Count == 0)
            Para(T("Chưa có công pháp — tìm bí kíp ở chợ, bí cảnh hoặc tông môn.", "No technique yet — find manuals in markets, secret realms or sects."));
        foreach (var t in p.Techniques)
        {
            var fit = t.Elements.Count == 0 ? 0.2 : Elements.TechniqueCompatibility(p.Root.Elements, t.Elements);
            var effective = t.SpeedBonus * (1 + 0.1 * (System.Math.Max(1, t.Level) - 1));
            Para(T($"{t.Name} · {Mastery.GradeName(t.Grade, Locale.Vi)} · tầng {t.Level}/{Mastery.TechniqueMaxLevel} · tu luyện +{effective:0.#}% · hợp linh căn {Text.Signed(fit * 100)}%",
                $"{t.NameEn} · {Mastery.GradeName(t.Grade, Locale.En)} · level {t.Level}/{Mastery.TechniqueMaxLevel} · cultivation +{effective:0.#}% · root fit {Text.Signed(fit * 100)}%"), 16, Ink.JadeDeep);
            if (Mastery.TechniqueCost(t) is { } stones)
            {
                var id = t.Id;
                var deepen = UiKit.Button(T($"Lĩnh ngộ tầng {t.Level + 1} ({stones} linh thạch)", $"Deepen to level {t.Level + 1} ({stones} spirit stones)"),
                    () => Say(E.DeepenTechnique(id)), enabled: p.SpiritStones >= stones);
                deepen.Name = $"deepen_{t.Id}";
                Buttons(deepen);
            }
        }
        Para(T($"Tổng hệ số công pháp: ×{Cultivation.TechniqueMultiplier(p):0.00}", $"Total technique multiplier: ×{Cultivation.TechniqueMultiplier(p):0.00}"), 15, Ink.InkSoft);
    }

    /// <summary>A slot as the player knows it: its key, or with touch controls its place on the ring (1 to 4).</summary>
    private static string SlotName(int slot) => TouchUi.Active
        ? T($"Ô {slot + 1}", $"Slot {slot + 1}")
        : slot == 0 ? T("Chuột phải", "Right click") : T($"Phím {KeyMap.Label($"skill_{slot + 1}")}", $"Key {KeyMap.Label($"skill_{slot + 1}")}");

    /// <summary>The same on a small button.</summary>
    private static string SlotShort(int slot) => TouchUi.Active
        ? (slot + 1).ToString()
        : slot == 0 ? T("Phải", "RMB") : KeyMap.Label($"skill_{slot + 1}");

    private static PanelContainer SlotCard(string caption, SkillDef? art)
    {
        var color = art?.Element is { } e ? Ink.Element(e) : Ink.InkColor;
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 10);
        row.AddChild(new IconView(art != null ? Icons.ForSkill(art) : IconKind.None, color, 0.86f) { CustomMinimumSize = new Vector2(34, 34) });
        var text = UiKit.Column(0);
        text.AddChild(UiKit.Caption(caption));
        text.AddChild(UiKit.Label(art != null ? Text.Name(art) : T("(trống)", "(empty)"), 16, art != null ? color.Darkened(0.2f) : Ink.InkFaint));
        row.AddChild(text);
        var card = UiKit.Card(row, 8);
        card.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        return card;
    }

    /// <summary>An art's slot buttons: the slot it sits in is lit; tap another to move it, tap the lit one to take it out.</summary>
    private HBoxContainer SlotButtons(string skillId)
    {
        var p = E.Player;
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 6);
        row.AddChild(new Control { CustomMinimumSize = new Vector2(34, 0) });
        var label = UiKit.Label(T("Đặt vào ô", "Slot"), 14, Ink.InkSoft);
        label.VerticalAlignment = VerticalAlignment.Center;
        row.AddChild(label);
        for (var i = 0; i < 4; i++)
        {
            var slot = i;
            var here = i < p.SkillSlots.Count && p.SkillSlots[i] == skillId;
            var button = UiKit.Button(SlotShort(i), () =>
            {
                CrashLog.Note(here ? $"slot {slot} emptied" : $"slot {slot} ← {skillId}");
                E.SetSkillSlot(slot, here ? "" : skillId);
                Game.Instance.Changed();
            }, primary: here);
            button.Name = $"slot_{skillId}_{slot}";
            button.CustomMinimumSize = TouchUi.Active ? new Vector2(58, 42) : new Vector2(46, 0);
            row.AddChild(button);
        }
        return row;
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
