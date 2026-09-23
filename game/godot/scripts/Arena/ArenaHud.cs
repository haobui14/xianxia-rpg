using System.Linq;
using Godot;
using TuTien.Core.Content;
using TuTienLuc.Ui;

namespace TuTienLuc.Arena;

/// <summary>The fight HUD: bars top-left, title top-center, the skill bar at the bottom, banners.</summary>
public partial class ArenaHud : Control
{
    private readonly ArenaScreen _a;

    public ArenaHud(ArenaScreen arena) => _a = arena;

    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    public override void _Ready()
    {
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        MouseFilter = MouseFilterEnum.Ignore;
    }

    public override void _Process(double delta) => QueueRedraw();

    public override void _Draw()
    {
        if (_a.Player == null) return;
        var size = Size;
        Bars(new Vector2(18, 14));
        Heading(size);
        if (_a.Trial != null) TrialBar(size, _a.Trial);
        else
        {
            BossBar(size);
            SkillBar(size);
        }
        var hint = _a.Trial != null
            ? T("WASD di chuyển · Space lướt xuyên tâm ma · chuột trái chém tâm ma · Esc tạm dừng",
                "WASD move · Space dash through demons · left click cuts demons · Esc pause")
            : T("WASD di chuyển · chuột ngắm · Space lướt né · Esc tạm dừng / bỏ chạy",
                "WASD move · mouse aims · Space dodge · Esc pause / flee");
        DrawString(Ink.UiFont, new Vector2(18, size.Y - 14), hint, HorizontalAlignment.Left, -1, 13, new Color(Ink.InkMute, 0.9f));
        Banner(size);
    }

    private void Panel(Rect2 r) => DrawRect(r, new Color(Ink.Card, 0.9f));

    private void Bar(Vector2 pos, float w, float h, float value, float max, Color fill, string label, bool glow = false)
    {
        DrawRect(new Rect2(pos, new Vector2(w, h)), Ink.PaperDarker);
        DrawRect(new Rect2(pos, new Vector2(w * Mathf.Clamp(max <= 0 ? 0 : value / max, 0, 1), h)), fill);
        DrawRect(new Rect2(pos, new Vector2(w, h)), glow ? Ink.Violet : Ink.LineStrong, false, glow ? 2 : 1);
        DrawString(Ink.UiFont, pos + new Vector2(6, h - 4), label, HorizontalAlignment.Left, -1, 12, Ink.InkColor);
    }

    private void Bars(Vector2 at)
    {
        var p = _a.Player;
        Panel(new Rect2(at - new Vector2(8, 6), new Vector2(330, _a.QiMax > 0 ? 128 : 108)));
        DrawString(Ink.Serif, at + new Vector2(0, 20), p.Name, HorizontalAlignment.Left, -1, 20, Ink.InkColor);
        var y = at.Y + 30;
        Bar(new Vector2(at.X, y), 314, 16, p.Hp, p.HpMax, Ink.Cinnabar, T($"Khí huyết {Mathf.Ceil(p.Hp)}/{p.HpMax}", $"Health {Mathf.Ceil(p.Hp)}/{p.HpMax}"));
        y += 20;
        if (_a.QiMax > 0)
        {
            Bar(new Vector2(at.X, y), 314, 14, _a.Qi, _a.QiMax, Ink.WaterBlue, T($"Linh lực {_a.Qi:0}/{_a.QiMax}", $"Qi {_a.Qi:0}/{_a.QiMax}"));
            y += 18;
        }
        Bar(new Vector2(at.X, y), 314, 12, _a.Stamina, _a.StaminaMax, Ink.Gold, T("Thể lực", "Stamina"));
        y += 16;
        var full = _a.Intent >= 100;
        var pulse = full ? 0.75f + 0.25f * Mathf.Sin(_a.Clock * 8) : 1f;
        Bar(new Vector2(at.X, y), 314, 12, _a.Intent, 100, new Color(Ink.Violet, pulse),
            full ? T("Sát ý đầy — R", "Killing intent full — R") : T("Sát ý", "Killing intent"), full);
        if (p.Shield > 0) DrawString(Ink.UiFont, new Vector2(at.X + 230, at.Y + 20), T($"Hộ thể {p.Shield:0}", $"Shield {p.Shield:0}"), HorizontalAlignment.Left, -1, 13, Ink.JadeDeep);
    }

    private void Heading(Vector2 size)
    {
        var title = _a.Title;
        var font = Ink.Serif;
        var w = font.GetStringSize(title, HorizontalAlignment.Left, -1, 24).X;
        var sub = _a.Subtitle;
        var sw = Ink.UiFont.GetStringSize(sub, HorizontalAlignment.Left, -1, 13).X;
        var boxW = Mathf.Max(w, sw) + 40;
        Panel(new Rect2(size.X / 2 - boxW / 2, 8, boxW, sub.Length > 0 ? 56 : 38));
        DrawString(font, new Vector2(size.X / 2 - w / 2, 34), title, HorizontalAlignment.Left, -1, 24, Ink.InkColor);
        if (sub.Length > 0) DrawString(Ink.UiFont, new Vector2(size.X / 2 - sw / 2, 54), sub, HorizontalAlignment.Left, -1, 13, Ink.InkMute);
        var clock = $"{(int)_a.Clock / 60}:{(int)_a.Clock % 60:00}";
        DrawString(Ink.UiFont, new Vector2(size.X - 70, 30), clock, HorizontalAlignment.Left, -1, 16, Ink.InkSoft);
    }

    private void BossBar(Vector2 size)
    {
        var boss = _a.Enemies.FirstOrDefault(e => e.Active && (e.Archetype == "boss" || e.HpMax >= 300));
        if (boss == null) return;
        var w = 560f;
        var pos = new Vector2(size.X / 2 - w / 2, 74);
        Panel(new Rect2(pos - new Vector2(10, 22), new Vector2(w + 20, 44)));
        DrawString(Ink.Serif, pos + new Vector2(0, -5), boss.Name + (boss.Enraged ? T(" — cuồng nộ", " — enraged") : ""), HorizontalAlignment.Left, -1, 16,
            boss.Enraged ? Ink.Cinnabar : Ink.InkColor);
        Bar(pos, w, 14, boss.Hp, boss.HpMax, Ink.Cinnabar, $"{Mathf.Ceil(boss.Hp)}/{boss.HpMax}");
    }

    private void SkillBar(Vector2 size)
    {
        const float box = 62, gap = 10;
        var slots = new (string Key, SkillDef? Skill, string Fallback)[]
        {
            (T("Trái", "LMB"), _a.Basic, ""),
            (T("Phải", "RMB"), _a.SlotSkill(0), ""),
            ("1", _a.SlotSkill(1), ""),
            ("2", _a.SlotSkill(2), ""),
            ("3", _a.SlotSkill(3), ""),
            ("R", _a.Ultimate, ""),
            ("Q", null, "丹"),
            ("Space", null, "遁"),
        };
        var total = slots.Length * box + (slots.Length - 1) * gap;
        var x0 = size.X / 2 - total / 2;
        var y = size.Y - box - 34;
        Panel(new Rect2(x0 - 12, y - 10, total + 24, box + 36));
        for (var i = 0; i < slots.Length; i++)
        {
            var (key, skill, fallback) = slots[i];
            var r = new Rect2(x0 + i * (box + gap), y, box, box);
            var usable = true;
            float cdFrac = 0;
            string glyph, name, cost = "";
            var color = Ink.InkColor;
            if (i == 6)
            {
                var (id, count) = _a.Pill();
                glyph = fallback;
                name = count > 0 ? $"×{count}" : "—";
                usable = count > 0 && _a.PillCd <= 0;
                cdFrac = Mathf.Clamp(_a.PillCd / 5f, 0, 1);
                color = Ink.Jade;
            }
            else if (i == 7)
            {
                glyph = fallback;
                name = T("Lướt", "Dash");
                usable = _a.Stamina >= ArenaScreen.DashCost;
                cost = $"{ArenaScreen.DashCost:0}";
                color = Ink.GoldDeep;
            }
            else if (skill == null)
            {
                glyph = "";
                name = T("trống", "empty");
                usable = false;
            }
            else
            {
                glyph = skill.Glyph;
                name = T(skill.Name, skill.NameEn);
                var left = _a.CooldownLeft(skill.Id);
                cdFrac = skill.Cooldown > 0 ? Mathf.Clamp(left / (float)skill.Cooldown, 0, 1) : 0;
                if (i == 5)
                {
                    cdFrac = 1 - Mathf.Clamp(_a.Intent / 100f, 0, 1);
                    usable = _a.Intent >= 100;
                    color = Ink.Violet;
                }
                else
                {
                    var qi = _a.QiCost(skill);
                    usable = qi <= _a.Qi;
                    if (qi > 0) cost = qi.ToString();
                    if (skill.Element != null) color = Ink.Element(skill.Element.Value);
                }
            }

            DrawRect(r, usable ? Ink.Card : Ink.PaperDeep);
            DrawRect(r, usable ? color : Ink.LineStrong, false, usable ? 2 : 1);
            if (glyph.Length > 0)
            {
                var gs = Ink.Han.GetStringSize(glyph, HorizontalAlignment.Left, -1, 30);
                DrawString(Ink.Han, r.GetCenter() + new Vector2(-gs.X / 2, 11), glyph, HorizontalAlignment.Left, -1, 30, usable ? color : Ink.InkFaint);
            }
            if (cdFrac > 0) DrawRect(new Rect2(r.Position, new Vector2(box, box * cdFrac)), new Color(Ink.InkColor, 0.45f));
            DrawString(Ink.UiFont, r.Position + new Vector2(4, 13), key, HorizontalAlignment.Left, -1, 11, Ink.InkMute);
            if (cost.Length > 0) DrawString(Ink.UiFont, r.Position + new Vector2(box - 22, box - 5), cost, HorizontalAlignment.Left, -1, 11, Ink.WaterBlue);
            var ns = Ink.UiFont.GetStringSize(name, HorizontalAlignment.Left, -1, 11);
            var shown = ns.X > box + gap ? name[..System.Math.Min(name.Length, 9)] + "…" : name;
            ns = Ink.UiFont.GetStringSize(shown, HorizontalAlignment.Left, -1, 11);
            DrawString(Ink.UiFont, new Vector2(r.GetCenter().X - ns.X / 2, r.End.Y + 14), shown, HorizontalAlignment.Left, -1, 11, Ink.InkSoft);
        }
    }

    private void TrialBar(Vector2 size, QiTrial trial)
    {
        var w = 620f;
        var pos = new Vector2(size.X / 2 - w / 2, 84);
        Panel(new Rect2(pos - new Vector2(12, 26), new Vector2(w + 24, 104)));
        DrawString(Ink.Serif, pos + new Vector2(0, -6), T($"Linh khí {trial.Score:0}/{QiTrial.Target:0}", $"Qi gathered {trial.Score:0}/{QiTrial.Target:0}"),
            HorizontalAlignment.Left, -1, 17, Ink.InkColor);
        var tl = $"{trial.TimeLeft:0.0}s";
        DrawString(Ink.UiFont, pos + new Vector2(w - 50, -6), tl, HorizontalAlignment.Left, -1, 15, trial.TimeLeft < 5 ? Ink.Cinnabar : Ink.InkSoft);
        var passed = trial.Performance >= trial.Threshold;
        Bar(pos, w, 18, trial.Score, QiTrial.Target, passed ? Ink.Jade : Ink.Gold, "");
        var tx = pos.X + w * trial.Threshold;
        DrawLine(new Vector2(tx, pos.Y - 4), new Vector2(tx, pos.Y + 22), Ink.CinnabarDeep, 3);
        DrawString(Ink.UiFont, new Vector2(tx - 30, pos.Y + 36), T($"cần {trial.Threshold * 100:0}%", $"need {trial.Threshold * 100:0}%"), HorizontalAlignment.Left, -1, 12, Ink.CinnabarDeep);
        DrawString(Ink.UiFont, pos + new Vector2(0, 56), T("hợp linh căn +3 · khác +1 · trảm tâm ma +1 · trúng tâm ma −4", "your element +3 · others +1 · cut a demon +1 · touched −4"),
            HorizontalAlignment.Left, -1, 12, Ink.InkMute);
    }

    private void Banner(Vector2 size)
    {
        if (_a.BannerTime <= 0 || _a.Banner.Length == 0) return;
        var alpha = Mathf.Clamp(_a.BannerTime * 2.5f, 0, 1);
        var font = Ink.Serif;
        var s = font.GetStringSize(_a.Banner, HorizontalAlignment.Left, -1, 76);
        var center = new Vector2(size.X / 2, size.Y / 2 - 40);
        DrawRect(new Rect2(0, center.Y - 70, size.X, _a.BannerSub.Length > 0 ? 130 : 100), new Color(Ink.Card, 0.72f * alpha));
        DrawStringOutline(font, center - new Vector2(s.X / 2, -10), _a.Banner, HorizontalAlignment.Left, -1, 76, 8, new Color(Ink.Card, alpha));
        DrawString(font, center - new Vector2(s.X / 2, -10), _a.Banner, HorizontalAlignment.Left, -1, 76, new Color(_a.BannerColor, alpha));
        if (_a.BannerSub.Length == 0) return;
        var ss = Ink.Serif.GetStringSize(_a.BannerSub, HorizontalAlignment.Left, -1, 22);
        DrawString(Ink.Serif, center + new Vector2(-ss.X / 2, 48), _a.BannerSub, HorizontalAlignment.Left, -1, 22, new Color(Ink.InkSoft, alpha));
    }
}
