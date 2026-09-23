using System;
using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Combat;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTienLuc.Ui;

namespace TuTienLuc.Arena;

/// <summary>
/// The real-time layer (design §7.3): a top-down arena where the player fights with the ToI-style kit —
/// a martial art on left click, four spirit-art slots, a dash with i-frames, an ultimate charged by
/// killing intent, and pills. Every hit goes through the core's <see cref="CombatRules.Compute"/>; the
/// arena only reports a <see cref="CombatOutcome"/>, and the engine decides loot and consequences.
/// </summary>
public partial class ArenaScreen : Node2D
{
    public static readonly Vector2 Field = new(1480, 700);
    /// <summary>Spars and trials stop when someone is down to this share of health.</summary>
    public const float NonLethalFloor = 0.15f;
    public const float DashCost = 25;

    public event Action<CombatOutcome>? Finished;
    public event Action<double>? TrialFinished;

    public ArenaMode Mode { get; }
    public Encounter? Encounter { get; }
    /// <summary>Let <see cref="ArenaAutopilot"/> play (the smoke test).</summary>
    public bool Autopilot { get; set; }
    public bool Over => _ended;

    internal GameEngine E => Game.Instance.Engine!;
    internal Fighter Player = null!;
    internal readonly List<Fighter> Enemies = new();
    internal readonly List<Projectile> Projectiles = new();
    internal readonly List<Telegraph> Telegraphs = new();
    internal readonly List<Floater> Floaters = new();
    internal readonly List<Swoosh> Swooshes = new();
    internal readonly List<(Vector2 Pos, float Life)> Trail = new();
    internal Pcg32 Rng = null!;
    internal float Clock;

    internal float Qi, QiMax, Stamina, StaminaMax;
    /// <summary>Sát ý: fills from landing and taking hits; at 100 the ultimate is ready.</summary>
    internal float Intent;
    internal readonly Dictionary<string, float> Cooldowns = new();
    internal float DashTime, DashCd, StaminaDelay, PillCd, CastLock;
    internal Vector2 DashDir;
    internal float DashSpeed;
    internal SkillDef? DashSkill;
    internal float DashMult;
    internal readonly HashSet<Fighter> DashHits = new();
    internal readonly Dictionary<string, int> SkillUses = new();
    internal readonly Dictionary<string, int> ItemsUsed = new();
    internal QiTrial? Trial;
    internal SkillDef Basic = null!;
    internal SkillDef Ultimate = null!;
    internal Color FloorTint = Ink.Paper;
    internal string Title = "";
    internal string Subtitle = "";
    internal string Banner = "";
    internal string BannerSub = "";
    internal float BannerTime;
    internal Color BannerColor = Ink.InkColor;
    internal bool NonLethal;
    internal Vector2 AimPoint;

    private readonly List<string> _defeated = new();
    private bool _ended;
    private float _endTimer;
    private Action? _finish;
    private float _hitstop;
    private float _shake;
    private float _warnCd;
    private Camera2D _camera = null!;
    private PauseOverlay _pause = null!;

    public ArenaScreen(Encounter? encounter, ArenaMode mode)
    {
        Encounter = encounter;
        Mode = mode;
    }

    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    // ================================================================ setup

    public override void _Ready()
    {
        var content = E.Content;
        var p = E.Player;
        var salt = E.State.Calendar.MonthIndex;
        Rng = Seeds.Stream(E.State.Seed, "arena:" + (Encounter?.Id ?? "trial:" + salt + ":" + p.Realm), salt);

        Basic = content.Skill("vo_ky_kiem") ?? new SkillDef
        {
            Id = "vo_ky_kiem", Name = "Quyền cước", NameEn = "Fists", Glyph = "武", Damage = "physical", DamageMultiplier = 1, Cooldown = 0.45,
            Cast = new CastDef { Shape = "melee_arc", Range = 70, Arc = 110 },
        };
        Ultimate = p.Realm > Realm.LuyenKhi || (p.Realm == Realm.LuyenKhi && p.Stage >= 5)
            ? content.Skill("thanh_van_kiem_vu") ?? KillingIntentCleave()
            : KillingIntentCleave();

        Player = new Fighter
        {
            Id = "player", IsPlayer = true, Name = p.Name, Glyph = "吾",
            Pos = new Vector2(230, Field.Y / 2), Radius = 18,
            Speed = (float)CombatRules.PlayerMoveSpeed(content, p),
            Hp = Math.Max(1, p.Hp), HpMax = p.HpMax,
            Stats = CombatRules.PlayerCombatant(content, p),
        };
        Qi = p.Qi;
        QiMax = p.QiMax;
        Stamina = StaminaMax = p.StaminaMax;

        if (Mode == ArenaMode.Battle && Encounter != null) SetupBattle(Encounter);
        else SetupTrial();

        _camera = new Camera2D { Position = Field / 2 };
        AddChild(_camera);
        _camera.MakeCurrent();

        var hudLayer = new CanvasLayer { Layer = 10 };
        AddChild(hudLayer);
        hudLayer.AddChild(new ArenaHud(this));

        var pauseLayer = new CanvasLayer { Layer = 20 };
        AddChild(pauseLayer);
        _pause = new PauseOverlay(this) { Visible = false };
        pauseLayer.AddChild(_pause);
    }

    /// <summary>Before Luyện Khí 5 the ultimate is a plain 360° cleave fuelled by killing intent.</summary>
    private static SkillDef KillingIntentCleave() => new()
    {
        Id = "sat_y_tram", Name = "Sát Ý Trảm", NameEn = "Killing-Intent Cleave", Glyph = "殺",
        Type = "attack", Damage = "physical", DamageMultiplier = 2.6, Cooldown = 1,
        Cast = new CastDef { Shape = "melee_arc", Range = 150, Arc = 360 },
    };

    private void SetupBattle(Encounter enc)
    {
        var content = E.Content;
        NonLethal = enc.NonLethal;
        var list = E.BuildEnemies(enc);
        for (var i = 0; i < list.Count; i++)
        {
            var inst = list[i];
            var def = inst.Template;
            var spread = list.Count == 1 ? 0 : (i / (float)(list.Count - 1) - 0.5f) * 360;
            var f = new Fighter
            {
                Id = inst.InstanceId, Enemy = inst, Name = T(inst.Name, inst.NameEn), Glyph = def.Glyph,
                Archetype = def.Archetype, Element = inst.Element,
                Pos = new Vector2(Field.X - 260 - (i % 2) * 90, Field.Y / 2 + spread),
                Radius = (float)def.Radius, Speed = (float)inst.Speed,
                Hp = inst.HpMax, HpMax = inst.HpMax, Stats = inst.ToCombatant(),
                Skill = content.Skill(def.Skills.FirstOrDefault()),
                AttackCd = 0.9f + (float)Rng.NextDouble() * 0.8f,
                SkillCd = 1.2f + (float)Rng.NextDouble() * 1.2f,
                MeleeCd = 0.4f,
                Strafe = Rng.Chance(0.5) ? 1 : -1,
            };
            f.Facing = Vector2.Left;
            Enemies.Add(f);
        }

        var groups = list.GroupBy(x => T(x.Name, x.NameEn)).Select(g => g.Count() > 1 ? $"{g.Key} ×{g.Count()}" : g.Key);
        Title = string.Join(", ", groups);
        var zone = content.Area(enc.Zone);
        var where = zone != null ? T(zone.Name, zone.NameEn) : enc.Source == "dungeon" ? T("Bí cảnh", "Secret realm") : "";
        Subtitle = enc.Source switch
        {
            "trial" => T("Khảo hạch nhập môn — tỉ thí tới 15% khí huyết", "Entrance trial — a spar to 15% health"),
            "spar" => T("Luận bàn — tỉ thí tới 15% khí huyết", "Spar — to 15% health"),
            "ambush" => T("Phục kích!", "Ambush!") + (where.Length > 0 ? " · " + where : ""),
            "npc" => T("Sinh tử quyết đấu", "A fight to the death"),
            _ => where,
        };
        FloorTint = enc.Zone switch
        {
            "verdant_forest" => new Color("#e6e3c2"),
            "spirit_herb_garden" => new Color("#e9e6c6"),
            "ancient_tree_hollow" => new Color("#ddd6bb"),
            _ => enc.Source == "dungeon" ? new Color("#e3dccd") : Ink.Paper,
        };
        ShowBanner(NonLethal ? T("Tỉ thí!", "Spar!") : T("Chiến!", "Fight!"), Title, Ink.CinnabarDeep, 1.3f);
    }

    private void SetupTrial()
    {
        var p = E.Player;
        Trial = new QiTrial(this);
        Title = T($"Đột phá: {Names.Display(p.Realm + 1, Locale.Vi)}", $"Breakthrough: {Names.Display(p.Realm + 1, Locale.En)}");
        Subtitle = p.Realm == Realm.PhamNhan
            ? T("Dẫn khí nhập thể — thu linh khí, tránh tâm ma", "Draw qi into the body — gather qi, avoid heart demons")
            : T("Xung kích bình cảnh — thu linh khí, tránh tâm ma", "Storm the bottleneck — gather qi, avoid heart demons");
        FloorTint = new Color("#e8e4d2");
        ShowBanner(T("Tĩnh tâm…", "Still the mind…"), Subtitle, Ink.JadeDeep, 1.6f);
    }

    internal void ShowBanner(string text, string sub, Color color, float seconds)
    {
        Banner = text;
        BannerSub = sub;
        BannerColor = color;
        BannerTime = seconds;
    }

    // ================================================================ loop

    public override void _Process(double delta)
    {
        var dt = Mathf.Min((float)delta, 1f / 30f);
        BannerTime = Mathf.Max(0, BannerTime - dt);
        UpdateVisuals(dt);
        QueueRedraw();

        if (_ended)
        {
            _endTimer -= dt;
            if (_endTimer <= 0 && _finish != null)
            {
                var finish = _finish;
                _finish = null;
                finish();
            }
            return;
        }
        if (_hitstop > 0)
        {
            _hitstop -= dt;
            return;
        }

        Clock += dt;
        UpdatePlayer(dt);
        if (Trial != null)
        {
            Trial.Update(dt);
        }
        else
        {
            foreach (var enemy in Enemies) EnemyAi.Update(this, enemy, dt);
        }
        UpdateProjectiles(dt);
        UpdateTelegraphs(dt);
        CheckEnd();
    }

    public override void _UnhandledInput(InputEvent e)
    {
        if (!e.IsActionPressed("pause") || _ended) return;
        GetViewport().SetInputAsHandled();
        SetPaused(true);
    }

    internal void SetPaused(bool paused)
    {
        GetTree().Paused = paused;
        _pause.Visible = paused;
    }

    public override void _ExitTree()
    {
        if (IsInsideTree() && GetTree().Paused) GetTree().Paused = false;
    }

    private void UpdateVisuals(float dt)
    {
        for (var i = Floaters.Count - 1; i >= 0; i--)
        {
            var f = Floaters[i];
            f.Life -= dt;
            f.Pos += f.Vel * dt;
            f.Vel *= 0.94f;
            if (f.Life <= 0) Floaters.RemoveAt(i);
        }
        for (var i = Swooshes.Count - 1; i >= 0; i--)
        {
            Swooshes[i].Life -= dt;
            if (Swooshes[i].Life <= 0) Swooshes.RemoveAt(i);
        }
        for (var i = Trail.Count - 1; i >= 0; i--)
        {
            var t = Trail[i];
            t.Life -= dt;
            if (t.Life <= 0) Trail.RemoveAt(i);
            else Trail[i] = t;
        }
        _shake = Mathf.Max(0, _shake - dt * 40);
        if (_camera != null)
            _camera.Offset = _shake > 0 ? new Vector2(GD.Randf() - 0.5f, GD.Randf() - 0.5f) * _shake : Vector2.Zero;
    }

    public override void _Draw() => ArenaPainter.Draw(this);

    // ================================================================ the player

    internal SkillDef? SlotSkill(int slot)
    {
        var slots = E.Player.SkillSlots;
        return slot < slots.Count ? E.Content.Skill(slots[slot]) : null;
    }

    internal float CooldownLeft(string id) => Cooldowns.TryGetValue(id, out var cd) ? Mathf.Max(0, cd) : 0;

    internal int QiCost(SkillDef skill) => skill == Ultimate ? 0 : CombatRules.QiCost(skill, E.Player.Root.Elements);

    /// <summary>The first pill in the bag that heals, and how many are left after this fight's use.</summary>
    internal (string? Id, int Count) Pill()
    {
        foreach (var stack in E.Player.Items)
        {
            var def = E.Content.Item(stack.Id);
            if (def?.Effects == null || !def.Effects.ContainsKey("hp_restore")) continue;
            var left = stack.Qty - (ItemsUsed.TryGetValue(stack.Id, out var used) ? used : 0);
            if (left > 0) return (stack.Id, left);
        }
        return (null, 0);
    }

    private void UpdatePlayer(float dt)
    {
        var p = Player;
        TickStatus(p, dt);
        if (QiMax > 0) Qi = Mathf.Min(QiMax, Qi + dt);
        StaminaDelay -= dt;
        if (StaminaDelay <= 0) Stamina = Mathf.Min(StaminaMax, Stamina + 34 * dt);
        foreach (var key in Cooldowns.Keys.ToList()) Cooldowns[key] -= dt;
        DashCd -= dt;
        PillCd -= dt;
        CastLock -= dt;
        _warnCd -= dt;

        Vector2 move, aim;
        bool attack, dash, ult, pill;
        int slot;
        if (Autopilot)
        {
            ArenaAutopilot.Think(this, out move, out aim, out attack, out dash, out slot, out ult, out pill);
            AimPoint = p.Pos + aim * 120;
        }
        else
        {
            move = Input.GetVector("move_left", "move_right", "move_up", "move_down");
            var stick = Input.GetVector("aim_left", "aim_right", "aim_up", "aim_down");
            AimPoint = stick.LengthSquared() > 0.09f ? p.Pos + stick.Normalized() * 160 : GetGlobalMousePosition();
            aim = AimPoint - p.Pos;
            attack = Input.IsActionPressed("attack");
            dash = Input.IsActionJustPressed("dash");
            ult = Input.IsActionJustPressed("ultimate");
            pill = Input.IsActionJustPressed("pill");
            slot = Input.IsActionJustPressed("skill_1") ? 0
                : Input.IsActionJustPressed("skill_2") ? 1
                : Input.IsActionJustPressed("skill_3") ? 2
                : Input.IsActionJustPressed("skill_4") ? 3
                : -1;
        }
        if (aim.LengthSquared() > 1) p.Facing = aim.Normalized();

        if (DashTime > 0)
        {
            DashTime -= dt;
            p.Pos += DashDir * DashSpeed * dt;
            ClampToField(p);
            p.Invuln = Mathf.Max(p.Invuln, 0.06f);
            Trail.Add((p.Pos, 0.22f));
            if (DashSkill != null)
            {
                foreach (var enemy in Enemies.Where(x => x.Active && !DashHits.Contains(x)))
                {
                    if (enemy.Pos.DistanceTo(p.Pos) > enemy.Radius + (float)DashSkill.Cast.Radius) continue;
                    DashHits.Add(enemy);
                    HitEnemy(enemy, DashSkill, DashMult, DashSkill.Damage == "physical" ? DamageKind.Physical : DamageKind.Spirit, DashSkill.Element, p.Pos - DashDir * 20);
                }
            }
            return;
        }
        if (p.Stun > 0) return;

        var speed = p.Speed * p.SpeedFactor * (CastLock > 0 ? 0.4f : 1f);
        if (move.LengthSquared() > 1) move = move.Normalized();
        p.Pos += move * speed * dt;
        ClampToField(p);

        if (dash) TryDash(move.LengthSquared() > 0.04f ? move.Normalized() : p.Facing);
        else if (ult) TryUltimate();
        else if (slot >= 0) TrySlot(slot);
        else if (pill) TryPill();
        else if (attack && CastLock <= 0) Cast(Basic);
    }

    private void TryDash(Vector2 dir)
    {
        if (DashCd > 0 || Player.Rooted > 0) return;
        if (Stamina < DashCost)
        {
            Warn(T("Thể lực không đủ", "Out of stamina"));
            return;
        }
        Stamina -= DashCost;
        StaminaDelay = 0.6f;
        DashCd = 0.35f;
        StartDash(dir, 210, 0.16f, null, 0);
    }

    private void StartDash(Vector2 dir, float distance, float seconds, SkillDef? skill, float mult)
    {
        DashDir = dir;
        DashTime = seconds;
        DashSpeed = distance / seconds;
        DashSkill = skill;
        DashMult = mult;
        DashHits.Clear();
        Player.Invuln = seconds + 0.08f;
    }

    private void TryUltimate()
    {
        if (Intent < 100)
        {
            Warn(T("Sát ý chưa đầy", "Killing intent isn't full"));
            return;
        }
        if (Cast(Ultimate))
        {
            Intent = 0;
            _shake = 10;
            ShowBanner(T(Ultimate.Name, Ultimate.NameEn), "", Ink.Violet, 0.8f);
        }
    }

    private void TrySlot(int slot)
    {
        var skill = SlotSkill(slot);
        if (skill == null)
        {
            Warn(E.Player.Skills.Count == 0
                ? T("Chưa có linh kỹ — cần đột phá Luyện Khí", "No spirit arts yet — reach Qi Condensation")
                : T("Ô trống — gán linh kỹ ở bảng Nhân vật (C)", "Empty slot — assign an art in Character (C)"));
            return;
        }
        Cast(skill);
    }

    private void TryPill()
    {
        if (PillCd > 0) return;
        var (id, _) = Pill();
        var def = E.Content.Item(id);
        if (id == null || def?.Effects == null)
        {
            Warn(T("Không còn đan dược", "No pills left"));
            return;
        }
        ItemsUsed[id] = (ItemsUsed.TryGetValue(id, out var n) ? n : 0) + 1;
        var heal = (float)def.Effects["hp_restore"];
        Player.Hp = Mathf.Min(Player.HpMax, Player.Hp + heal);
        PillCd = 5;
        Say(Player.Pos + new Vector2(0, -40), $"+{heal:0}", Ink.Jade, 22);
        Swooshes.Add(new Swoosh { Pos = Player.Pos, Ring = true, Radius = 40, Color = Ink.Jade, Life = 0.35f, MaxLife = 0.35f });
    }

    private void Warn(string text)
    {
        if (_warnCd > 0) return;
        _warnCd = 0.8f;
        Say(Player.Pos + new Vector2(0, -48), text, Ink.InkMute, 16);
    }

    /// <summary>Use an art: pay its Qi, start its cooldown, and create its hit shape.</summary>
    internal bool Cast(SkillDef skill)
    {
        var p = Player;
        if (CooldownLeft(skill.Id) > 0) return false;
        var cost = QiCost(skill);
        if (cost > Qi)
        {
            Warn(T("Linh lực không đủ", "Not enough Qi"));
            return false;
        }
        Qi -= cost;
        Cooldowns[skill.Id] = (float)skill.Cooldown;
        SkillUses[skill.Id] = (SkillUses.TryGetValue(skill.Id, out var n) ? n : 0) + 1;

        var mult = (float)(skill.DamageMultiplier * Skills.LevelMultiplier(E.Player, skill.Id));
        var kind = skill.Damage == "physical" ? DamageKind.Physical : DamageKind.Spirit;
        var c = skill.Cast;
        var color = skill.Element != null ? Ink.Element(skill.Element.Value) : Ink.InkColor;
        CastLock = (float)c.Windup + 0.1f;

        switch (c.Shape)
        {
            case "melee_arc":
                Melee(p.Pos, p.Facing, (float)c.Arc, (float)c.Range, skill, mult, kind, color);
                break;
            case "projectile":
                for (var i = 0; i < Math.Max(1, c.Count); i++)
                {
                    var offset = (float)c.Spread * (i - (c.Count - 1) / 2f);
                    Shoot(p, skill, p.Facing.Rotated(Mathf.DegToRad(offset)), mult, kind, color);
                }
                break;
            case "nova":
                for (var i = 0; i < Math.Max(1, c.Count); i++)
                    Shoot(p, skill, Vector2.Right.Rotated(Mathf.Tau * i / Math.Max(1, c.Count)), mult, kind, color);
                Swooshes.Add(new Swoosh { Pos = p.Pos, Ring = true, Radius = 70, Color = color, Life = 0.3f, MaxLife = 0.3f });
                break;
            case "aoe_circle":
            {
                var reach = Mathf.Min((float)c.Range, (AimPoint - p.Pos).Length());
                var target = p.Pos + p.Facing * reach;
                var radius = (float)c.Radius;
                Telegraphs.Add(new Telegraph
                {
                    Shape = Telegraph.Shapes.Circle, Pos = target, Radius = radius, Duration = (float)Math.Max(0.1, c.Windup),
                    FromPlayer = true, Owner = p,
                    Fire = () =>
                    {
                        Swooshes.Add(new Swoosh { Pos = target, Ring = true, Radius = radius, Color = color, Life = 0.3f, MaxLife = 0.3f });
                        foreach (var enemy in Enemies.Where(x => x.Active && x.Pos.DistanceTo(target) <= radius + x.Radius * 0.5f).ToList())
                            HitEnemy(enemy, skill, mult, kind, skill.Element, target);
                        Trial?.Blast(target, radius);
                    },
                });
                break;
            }
            case "dash_strike":
                StartDash(p.Facing, (float)c.Range, 0.18f, skill, mult);
                Swooshes.Add(new Swoosh { Pos = p.Pos, Angle = ArenaMath.Angle(p.Facing), Arc = 40, Radius = 60, Color = color, Life = 0.25f, MaxLife = 0.25f });
                break;
            case "self_buff":
                p.Shield = (float)((skill.Effects?.Shield ?? 30) * Skills.LevelMultiplier(E.Player, skill.Id));
                p.ShieldTime = (float)Math.Max(1, c.Duration);
                Say(p.Pos + new Vector2(0, -44), T(skill.Name, skill.NameEn), Ink.Jade, 18);
                break;
            case "heal":
            {
                var heal = p.HpMax * (float)(skill.Effects?.HealPercent ?? 0.2);
                p.Hp = Mathf.Min(p.HpMax, p.Hp + heal);
                Say(p.Pos + new Vector2(0, -44), $"+{heal:0}", Ink.Jade, 22);
                Swooshes.Add(new Swoosh { Pos = p.Pos, Ring = true, Radius = 46, Color = Ink.Jade, Life = 0.4f, MaxLife = 0.4f });
                break;
            }
        }
        return true;
    }

    private void Melee(Vector2 origin, Vector2 facing, float arc, float range, SkillDef skill, float mult, DamageKind kind, Color color)
    {
        Swooshes.Add(new Swoosh { Pos = origin, Angle = ArenaMath.Angle(facing), Arc = arc, Radius = range, Color = color, Life = 0.16f, MaxLife = 0.16f });
        foreach (var enemy in Enemies.Where(x => x.Active && ArenaMath.InArc(origin, facing, arc, range, x.Pos, x.Radius)).ToList())
            HitEnemy(enemy, skill, mult, kind, skill.Element, origin);
        Trial?.Slash(origin, facing, arc, range);
    }

    private void Shoot(Fighter owner, SkillDef skill, Vector2 dir, float mult, DamageKind kind, Color color)
    {
        var c = skill.Cast;
        Projectiles.Add(new Projectile
        {
            Pos = owner.Pos + dir * (owner.Radius + 6), Vel = dir * (float)c.Speed, Radius = (float)c.Radius, Range = (float)c.Range,
            Owner = owner, Skill = skill, Mult = mult, Kind = kind, Element = skill.Element, Burst = (float)c.Burst, Color = color,
        });
    }

    /// <summary>An enemy fires its art along <paramref name="dir"/>.</summary>
    internal void EnemyShoot(Fighter owner, SkillDef skill, Vector2 dir)
    {
        var color = skill.Element != null ? Ink.Element(skill.Element.Value).Darkened(0.15f) : Ink.CinnabarDeep;
        Shoot(owner, skill, dir, (float)skill.DamageMultiplier * (owner.Enraged ? 1.15f : 1f),
            skill.Damage == "physical" ? DamageKind.Physical : DamageKind.Spirit, color);
    }

    // ================================================================ hits

    /// <summary>The player's hit on an enemy: damage, then the Ngũ Hành mark or reaction, then the art's own effects.</summary>
    internal void HitEnemy(Fighter target, SkillDef? skill, float mult, DamageKind kind, Element? element, Vector2 from)
    {
        if (!target.Active) return;
        // Every creature carries its own phase: with no applied mark, it reacts to its own element (on a cooldown).
        var innate = target.Mark == null && target.InnateCd <= 0 ? target.Element : null;
        var mark = target.Mark ?? innate;
        var attacker = Player.Stats;
        var r = CombatRules.Compute(kind, mult, element, in attacker, target.Defending(), mark, Rng);

        Damage(target, r.Amount, r.Crit, from);
        if (r.Reaction != Reaction.None)
        {
            if (target.Mark == null) target.InnateCd = 5;
            else target.Mark = null;
            React(target, r.Reaction, r.Amount);
        }
        else if (r.AppliesMark && element != null)
        {
            target.Mark = element;
            target.MarkTime = 6;
        }

        var fx = skill?.Effects;
        if (fx?.StunChance is { } stun && Rng.Chance(stun)) Status(target, ref target.Stun, 0.8f, "暈");
        if (fx?.BleedDamage is { } bleed)
        {
            target.BleedDps = Mathf.Max(target.BleedDps, (float)bleed * 1.5f);
            target.BleedTime = 3;
        }
        if (fx?.DefenseBreak != null) target.DefBreak = 4;
        Intent = Mathf.Min(100, Intent + (r.Crit ? 5 : 2.5f));
    }

    /// <summary>An enemy's hit on the player (dodged during a dash; the shield soaks first).</summary>
    internal void HitPlayer(Fighter source, float mult, DamageKind kind, Element? element, SkillDef? skill)
    {
        if (_ended || !source.Active) return;
        var p = Player;
        if (p.Invuln > 0)
        {
            Say(p.Pos + new Vector2(0, -40), T("Né!", "Dodge!"), Ink.Jade, 18);
            return;
        }
        if (source.Blind > 0 && Rng.Chance(0.5))
        {
            Say(p.Pos + new Vector2(0, -40), T("Trượt", "Miss"), Ink.InkMute, 16);
            return;
        }
        var attacker = source.Stats;
        var r = CombatRules.Compute(kind, mult, element, in attacker, p.Stats, null, Rng);
        float amount = r.Amount;
        if (p.Shield > 0)
        {
            var soaked = Mathf.Min(p.Shield, amount);
            p.Shield -= soaked;
            amount -= soaked;
            if (soaked > 0) Say(p.Pos + new Vector2(22, -30), $"({soaked:0})", Ink.JadeSoft, 15);
        }
        if (amount > 0) Damage(p, (int)Mathf.Round(amount), r.Crit, source.Pos);
        _shake = r.Crit ? 11 : 6;
        Intent = Mathf.Min(100, Intent + amount / p.HpMax * 90);

        var fx = skill?.Effects;
        if (fx?.BleedDamage is { } bleed)
        {
            p.BleedDps = Mathf.Max(p.BleedDps, (float)bleed);
            p.BleedTime = 3;
        }
        if (fx?.StunChance is { } stun && Rng.Chance(stun)) Status(p, ref p.Stun, 0.5f, "暈");
    }

    private void Damage(Fighter target, int amount, bool crit, Vector2 from)
    {
        target.Hp -= amount;
        target.HitFlash = 0.12f;
        var color = target.IsPlayer ? Ink.Cinnabar : crit ? Ink.Gold : Ink.InkColor;
        var jitter = new Vector2(GD.Randf() * 24 - 12, 0);
        Say(target.Pos + new Vector2(0, -target.Radius - 12) + jitter, crit ? amount + "!" : amount.ToString(), color, crit ? 30 : 21);
        if (!target.IsPlayer && target.Speed > 0 && target.Stun <= 0)
        {
            var knock = target.Archetype is "tank" or "boss" ? 5f : 16f;
            target.Pos += (target.Pos - from).Normalized() * knock;
            ClampToField(target);
        }
        if (crit) _hitstop = Mathf.Max(_hitstop, 0.045f);
        CheckDown(target);
    }

    /// <summary>Damage over time (bleed, burn, bursts): no crit, no knockback.</summary>
    internal void DotDamage(Fighter target, float amount)
    {
        if (!target.Active || amount <= 0) return;
        target.Hp -= amount;
        CheckDown(target);
    }

    private void CheckDown(Fighter target)
    {
        if (target.IsPlayer || !target.Active) return;
        if (NonLethal && target.Hp <= target.HpMax * NonLethalFloor)
        {
            target.Yielded = true;
            target.Hp = Mathf.Max(1, target.Hp);
            _defeated.Add(target.Def.Id);
            Say(target.Pos + new Vector2(0, -target.Radius - 30), T("Chịu thua!", "Yields!"), Ink.JadeDeep, 22);
            Telegraphs.RemoveAll(t => t.Owner == target);
        }
        else if (target.Hp <= 0)
        {
            target.Alive = false;
            target.DeathFade = 0.6f;
            _defeated.Add(target.Def.Id);
            Intent = Mathf.Min(100, Intent + 10);
            _hitstop = Mathf.Max(_hitstop, 0.07f);
            Swooshes.Add(new Swoosh { Pos = target.Pos, Ring = true, Radius = target.Radius * 2.2f, Color = Ink.InkColor, Life = 0.4f, MaxLife = 0.4f });
            Telegraphs.RemoveAll(t => t.Owner == target);
        }
    }

    private void React(Fighter t, Reaction reaction, int amount)
    {
        var info = Elements.Info(reaction);
        if (info == null) return;
        var color = info.Kind == ReactionKind.Shatter ? Ink.CinnabarDeep : Ink.GoldDeep;
        Say(t.Pos + new Vector2(0, -t.Radius - 40), T(info.Name, info.NameEn) + "!", color, 24, 1.3f);
        var duration = (float)info.Duration;
        switch (info.Effect)
        {
            case "bleed":
                t.BleedDps = Mathf.Max(t.BleedDps, amount * 0.1f);
                t.BleedTime = duration;
                break;
            case "def_break":
                t.DefBreak = duration;
                break;
            case "root":
                t.Rooted = duration;
                break;
            case "blind_burst":
                t.Blind = duration;
                Swooshes.Add(new Swoosh { Pos = t.Pos, Ring = true, Radius = 100, Color = Ink.WaterBlue, Life = 0.4f, MaxLife = 0.4f });
                foreach (var o in Enemies.Where(x => x != t && x.Active && x.Pos.DistanceTo(t.Pos) < 100).ToList()) DotDamage(o, amount * 0.4f);
                break;
            case "res_break":
                t.ResBreak = duration;
                break;
            case "spread_burn":
                Swooshes.Add(new Swoosh { Pos = t.Pos, Ring = true, Radius = 120, Color = Ink.Cinnabar, Life = 0.4f, MaxLife = 0.4f });
                foreach (var o in Enemies.Where(x => x.Active && x.Pos.DistanceTo(t.Pos) < 120))
                {
                    o.BurnDps = Mathf.Max(o.BurnDps, amount * 0.1f);
                    o.BurnTime = duration;
                }
                break;
            case "lifesteal":
                var heal = amount * 0.1f;
                Player.Hp = Mathf.Min(Player.HpMax, Player.Hp + heal);
                Say(Player.Pos + new Vector2(0, -40), $"+{heal:0}", Ink.Jade, 18);
                break;
            case "stun":
                t.Stun = Mathf.Max(t.Stun, duration);
                break;
            case "slow":
                t.Slow = duration;
                break;
        }
    }

    /// <summary>Apply a status and show its glyph once.</summary>
    internal void Status(Fighter f, ref float timer, float seconds, string glyph)
    {
        if (timer <= 0) Say(f.Pos + new Vector2(0, -f.Radius - 24), glyph, Ink.GoldDeep, 18);
        timer = Mathf.Max(timer, seconds);
    }

    internal void TickStatus(Fighter f, float dt)
    {
        f.Stun -= dt;
        f.Rooted -= dt;
        f.Slow -= dt;
        f.Blind -= dt;
        f.DefBreak -= dt;
        f.ResBreak -= dt;
        f.Invuln -= dt;
        f.HitFlash -= dt;
        f.InnateCd -= dt;
        if (f.Mark != null && (f.MarkTime -= dt) <= 0) f.Mark = null;
        if (f.Shield > 0 && (f.ShieldTime -= dt) <= 0) f.Shield = 0;

        var dps = (f.BleedTime > 0 ? f.BleedDps : 0) + (f.BurnTime > 0 ? f.BurnDps : 0);
        f.BleedTime -= dt;
        f.BurnTime -= dt;
        if (f.BleedTime <= 0) f.BleedDps = 0;
        if (f.BurnTime <= 0) f.BurnDps = 0;
        if (dps <= 0 || (!f.IsPlayer && !f.Active)) return;
        f.DotAcc += dps * dt;
        f.DotTick -= dt;
        if (f.DotTick > 0) return;
        f.DotTick = 0.5f;
        var amount = f.DotAcc;
        f.DotAcc = 0;
        if (f.IsPlayer)
        {
            f.Hp -= amount;
            Say(f.Pos + new Vector2(14, -f.Radius), $"{amount:0}", Ink.CinnabarSoft, 15);
        }
        else
        {
            Say(f.Pos + new Vector2(14, -f.Radius), $"{amount:0}", f.BurnTime > 0 ? Ink.Cinnabar : Ink.CinnabarSoft, 15);
            DotDamage(f, amount);
        }
    }

    // ================================================================ projectiles & telegraphs

    private void UpdateProjectiles(float dt)
    {
        foreach (var proj in Projectiles)
        {
            if (proj.Dead) continue;
            var step = proj.Vel * dt;
            proj.Pos += step;
            proj.Traveled += step.Length();
            var outside = proj.Pos.X < 0 || proj.Pos.Y < 0 || proj.Pos.X > Field.X || proj.Pos.Y > Field.Y;
            if (outside || proj.Traveled > proj.Range)
            {
                if (proj.FromPlayer && proj.Burst > 0 && !outside) Explode(proj, null);
                proj.Dead = true;
                continue;
            }
            if (proj.FromPlayer)
            {
                var hit = Enemies.FirstOrDefault(x => x.Active && x.Pos.DistanceTo(proj.Pos) <= x.Radius + proj.Radius);
                if (hit != null)
                {
                    HitEnemy(hit, proj.Skill, proj.Mult, proj.Kind, proj.Element, proj.Pos - proj.Vel.Normalized() * 12);
                    if (proj.Burst > 0) Explode(proj, hit);
                    proj.Dead = true;
                }
                else if (Trial != null && Trial.Shoot(proj.Pos, proj.Radius))
                {
                    proj.Dead = true;
                }
            }
            else if (proj.Pos.DistanceTo(Player.Pos) <= Player.Radius + proj.Radius)
            {
                HitPlayer(proj.Owner, proj.Mult, proj.Kind, proj.Element, proj.Skill);
                proj.Dead = true;
            }
        }
        Projectiles.RemoveAll(x => x.Dead);
    }

    private void Explode(Projectile proj, Fighter? direct)
    {
        Swooshes.Add(new Swoosh { Pos = proj.Pos, Ring = true, Radius = proj.Burst, Color = proj.Color, Life = 0.35f, MaxLife = 0.35f });
        foreach (var enemy in Enemies.Where(x => x != direct && x.Active && x.Pos.DistanceTo(proj.Pos) <= proj.Burst + x.Radius).ToList())
            HitEnemy(enemy, proj.Skill, proj.Mult * 0.6f, proj.Kind, proj.Element, proj.Pos);
    }

    internal void AddTelegraph(Telegraph t) => Telegraphs.Add(t);

    private void UpdateTelegraphs(float dt)
    {
        foreach (var t in Telegraphs.ToList())
        {
            if (t.Dead) continue;
            // Stunning a caster mid-windup interrupts the attack.
            if (!t.FromPlayer && t.Owner != null && (!t.Owner.Active || t.Owner.Stun > 0))
            {
                if (t.Owner.Active) Say(t.Owner.Pos + new Vector2(0, -t.Owner.Radius - 28), T("Gián đoạn!", "Interrupted!"), Ink.JadeDeep, 18);
                t.Dead = true;
                continue;
            }
            t.Time += dt;
            if (t.Time < t.Duration) continue;
            t.Dead = true;
            t.Fire?.Invoke();
        }
        Telegraphs.RemoveAll(x => x.Dead);
    }

    // ================================================================ helpers for brains

    internal void ClampToField(Fighter f)
    {
        f.Pos = new Vector2(Mathf.Clamp(f.Pos.X, f.Radius + 6, Field.X - f.Radius - 6), Mathf.Clamp(f.Pos.Y, f.Radius + 6, Field.Y - f.Radius - 6));
    }

    internal void Say(Vector2 pos, string text, Color color, int size = 20, float life = 0.9f) =>
        Floaters.Add(new Floater { Pos = pos, Text = text, Color = color, Size = size, Life = life, MaxLife = life });

    internal void Slash(Vector2 origin, Vector2 dir, float arc, float radius, Color color) =>
        Swooshes.Add(new Swoosh { Pos = origin, Angle = ArenaMath.Angle(dir), Arc = arc, Radius = radius, Color = color, Life = 0.16f, MaxLife = 0.16f });

    internal void Ring(Vector2 pos, float radius, Color color) =>
        Swooshes.Add(new Swoosh { Pos = pos, Ring = true, Radius = radius, Color = color, Life = 0.35f, MaxLife = 0.35f });

    internal void Shake(float amount) => _shake = Mathf.Max(_shake, amount);

    // ================================================================ the end

    private void CheckEnd()
    {
        if (_ended || Mode != ArenaMode.Battle) return;
        var floor = NonLethal ? Player.HpMax * NonLethalFloor : 0;
        if (Player.Hp <= floor)
        {
            Player.Hp = Mathf.Max(0, Player.Hp);
            End(victory: false, fled: false);
        }
        else if (Enemies.All(x => !x.Active))
        {
            End(victory: true, fled: false);
        }
    }

    internal void Flee()
    {
        SetPaused(false);
        if (_ended) return;
        if (Mode == ArenaMode.QiTrial) EndTrial(0);
        else End(victory: false, fled: true);
    }

    private void End(bool victory, bool fled)
    {
        _ended = true;
        var hp = victory || fled || NonLethal ? Math.Max(1, (int)Mathf.Ceil(Player.Hp)) : 0;
        var outcome = new CombatOutcome
        {
            EncounterId = Encounter?.Id ?? "",
            Victory = victory,
            Fled = fled,
            HpLeft = hp,
            QiLeft = (int)Qi,
            Defeated = _defeated.ToList(),
            SkillUses = new Dictionary<string, int>(SkillUses),
            ItemsUsed = new Dictionary<string, int>(ItemsUsed),
            Seconds = Clock,
        };
        if (victory) ShowBanner(T("Thắng!", "Victory!"), Title, Ink.JadeDeep, 2);
        else if (fled) ShowBanner(T("Độn thuật!", "Escaped!"), "", Ink.InkSoft, 1);
        else ShowBanner(NonLethal ? T("Chịu thua", "You yield") : T("Gục ngã…", "Defeated…"), "", Ink.CinnabarDeep, 2);
        _endTimer = fled ? 0.8f : 1.7f;
        _finish = () => Finished?.Invoke(outcome);
    }

    internal void EndTrial(double performance)
    {
        if (_ended) return;
        _ended = true;
        var threshold = Cultivation.MajorBreakthroughThreshold(E.Player);
        ShowBanner(performance >= threshold ? T("Linh khí quy nguyên!", "The qi settles!") : T("Linh khí tán loạn…", "The qi scatters…"),
            T($"Thành tích {performance * 100:0}% · cần {threshold * 100:0}%", $"Performance {performance * 100:0}% · needed {threshold * 100:0}%"),
            performance >= threshold ? Ink.JadeDeep : Ink.CinnabarDeep, 2.2f);
        _endTimer = 2.2f;
        _finish = () => TrialFinished?.Invoke(performance);
    }
}
