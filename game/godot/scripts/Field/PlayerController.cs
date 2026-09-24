using System;
using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTienLuc.Art;
using TuTienLuc.Ui;

namespace TuTienLuc.Field;

/// <summary>One frame of intent, from the keyboard/mouse/pad or from the autopilot.</summary>
public struct Controls
{
    public Vector2 Move;
    /// <summary>Where the player aims, as a direction (zero = keep facing).</summary>
    public Vector2 Aim;
    public bool Attack, Dash, Ultimate, Pill;
    public int Slot;

    public static Controls None => new() { Slot = -1 };
}

/// <summary>
/// The player's body and kit on the field (design §7.3): WASD, a martial art on left click, four
/// spirit-art slots, a dash with i-frames, an ultimate charged by killing intent (sát ý), and pills.
/// The same controls explore and fight: striking a beast starts the fight right where you stand.
/// </summary>
public sealed class PlayerController
{
    public const float DashCost = 25;

    public FieldScreen F { get; }
    public Fighter Body { get; }
    public float Qi, QiMax, Stamina, StaminaMax;
    /// <summary>Sát ý: fills from landing and taking hits; at 100 the ultimate is ready.</summary>
    public float Intent;
    public readonly Dictionary<string, float> Cooldowns = new();
    public float DashTime, DashCd, StaminaDelay, PillCd, CastLock;
    public Vector2 AimPoint;
    public SkillDef Basic = null!;
    public SkillDef Ultimate = null!;
    /// <summary>Let <see cref="Autopilot"/> play (the smoke test).</summary>
    public bool Autopilot;
    /// <summary>Waypoints to walk (travel from the map, the smoke test); manual movement cancels them.</summary>
    public readonly Queue<Vector2> Route = new();
    /// <summary>Set by the screen from unhandled mouse input, so clicks on the HUD never swing the sword.</summary>
    public bool MouseAttack;
    public bool MouseSkill;

    private Vector2 _dashDir;
    private float _dashSpeed;
    private SkillDef? _dashSkill;
    private float _dashMult;
    private readonly HashSet<Fighter> _dashHits = new();
    private float _warnCd;
    private float _dustCd;

    public PlayerController(FieldScreen field, Vector2 pos)
    {
        F = field;
        Body = new Fighter
        {
            Id = "player", IsPlayer = true, Kind = "human", Look = Look.Player(), Radius = 14, Pos = pos, Home = pos,
            Facing = Vector2.Down,
        };
        RefreshKit();
        SyncFromEngine();
        Stamina = StaminaMax;
    }

    private static GameEngine E => Game.Instance.Engine!;
    private Battle? Battle => F.Battle;
    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    public bool Dashing => DashTime > 0;
    public bool InBattle => Battle != null;

    // ================================================================ state

    /// <summary>Read health, Qi, stats and speed from the engine (outside fights the engine is the truth).</summary>
    public void SyncFromEngine()
    {
        var p = E.Player;
        Body.Name = p.Name;
        Body.HpMax = p.HpMax;
        Body.Hp = Math.Max(0, p.Hp);
        Body.Stats = CombatRules.PlayerCombatant(E.Content, p);
        Body.Speed = (float)CombatRules.PlayerMoveSpeed(E.Content, p);
        Qi = p.Qi;
        QiMax = p.QiMax;
        StaminaMax = p.StaminaMax;
        Stamina = Mathf.Min(Stamina, StaminaMax);
    }

    /// <summary>The martial art on left click and the ultimate depend on what the player knows.</summary>
    public void RefreshKit()
    {
        var content = E.Content;
        var p = E.Player;
        Basic = content.Skill("vo_ky_kiem") ?? new SkillDef
        {
            Id = "vo_ky_kiem", Name = "Quyền cước", NameEn = "Fists", Glyph = "武", Damage = "physical", DamageMultiplier = 1, Cooldown = 0.45,
            Cast = new CastDef { Shape = "melee_arc", Range = 70, Arc = 110 },
        };
        Ultimate = p.Realm > Realm.LuyenKhi || (p.Realm == Realm.LuyenKhi && p.Stage >= 5)
            ? content.Skill("thanh_van_kiem_vu") ?? Cleave()
            : Cleave();
    }

    /// <summary>Before Luyện Khí 5 the ultimate is a plain 360° cleave fuelled by killing intent.</summary>
    private static SkillDef Cleave() => new()
    {
        Id = "sat_y_tram", Name = "Sát Ý Trảm", NameEn = "Killing-Intent Cleave", Glyph = "殺",
        Type = "attack", Damage = "physical", DamageMultiplier = 2.6, Cooldown = 1,
        Cast = new CastDef { Shape = "melee_arc", Range = 150, Arc = 360 },
    };

    public void BeginBattle()
    {
        Body.InBattle = true;
        Intent = 0;
        Stamina = StaminaMax;
    }

    public void EndBattle()
    {
        Body.InBattle = false;
        Body.Stun = Body.Rooted = Body.Slow = Body.Blind = 0;
        Body.BleedDps = Body.BleedTime = Body.BurnDps = Body.BurnTime = Body.DotAcc = 0;
        Body.Shield = 0;
        Intent = 0;
        DashTime = 0;
        CastLock = 0;
    }

    public SkillDef? SlotSkill(int slot)
    {
        var slots = E.Player.SkillSlots;
        return slot >= 0 && slot < slots.Count ? E.Content.Skill(slots[slot]) : null;
    }

    public float CooldownLeft(string id) => Cooldowns.TryGetValue(id, out var cd) ? Mathf.Max(0, cd) : 0;

    public int QiCost(SkillDef skill) => skill == Ultimate || skill == Basic ? 0 : CombatRules.QiCost(skill, E.Player.Root.Elements);

    /// <summary>The first healing pill in the bag: in a fight counting what this fight already used.</summary>
    public (string? Id, int Count) Pill()
    {
        if (Battle != null) return Battle.Pill();
        foreach (var stack in E.Player.Items)
        {
            var def = E.Content.Item(stack.Id);
            if (def?.Effects != null && def.Effects.ContainsKey("hp_restore") && stack.Qty > 0) return (stack.Id, stack.Qty);
        }
        return (null, 0);
    }

    // ================================================================ the frame

    public Controls ReadInput(bool enabled)
    {
        var c = Controls.None;
        if (!enabled)
        {
            MouseAttack = MouseSkill = false;
            return c;
        }
        c.Move = Input.GetVector("move_left", "move_right", "move_up", "move_down");
        var stick = Input.GetVector("aim_left", "aim_right", "aim_up", "aim_down");
        AimPoint = stick.LengthSquared() > 0.09f ? Body.Pos + new Vector2(0, -30) + stick.Normalized() * 160 : F.MouseWorld;
        c.Aim = AimPoint - (Body.Pos + new Vector2(0, -30));
        if (!Input.IsMouseButtonPressed(MouseButton.Left)) MouseAttack = false;
        c.Attack = MouseAttack || Input.GetJoyAxis(0, JoyAxis.TriggerRight) > 0.5f;
        c.Dash = Input.IsActionJustPressed("dash");
        c.Ultimate = Input.IsActionJustPressed("ultimate");
        c.Pill = Input.IsActionJustPressed("pill");
        c.Slot = MouseSkill || Input.IsActionJustPressed("skill_1") ? 0
            : Input.IsActionJustPressed("skill_2") ? 1
            : Input.IsActionJustPressed("skill_3") ? 2
            : Input.IsActionJustPressed("skill_4") ? 3
            : -1;
        MouseSkill = false;
        return c;
    }

    public void Update(float dt, bool inputEnabled)
    {
        var p = Body;
        if (Battle == null) Tick(p, dt);
        if (Battle != null && QiMax > 0) Qi = Mathf.Min(QiMax, Qi + dt);
        StaminaDelay -= dt;
        if (StaminaDelay <= 0) Stamina = Mathf.Min(StaminaMax, Stamina + 34 * dt);
        foreach (var key in Cooldowns.Keys.ToList()) Cooldowns[key] -= dt;
        DashCd -= dt;
        PillCd -= dt;
        CastLock -= dt;
        _warnCd -= dt;
        _dustCd -= dt;

        var c = Autopilot ? TuTienLuc.Field.Autopilot.Think(this) : ReadInput(inputEnabled);
        if (Autopilot) AimPoint = p.Pos + new Vector2(0, -30) + (c.Aim.LengthSquared() > 0.01f ? c.Aim.Normalized() : p.Facing) * 140;

        // Travel along a route unless the player takes the wheel.
        if (c.Move.LengthSquared() > 0.01f && !Autopilot) Route.Clear();
        if (c.Move.LengthSquared() <= 0.01f && Route.Count > 0 && Battle == null)
        {
            var to = Route.Peek() - p.Pos;
            if (to.Length() < 14) Route.Dequeue();
            else c.Move = to.Normalized();
        }

        // Facing: in a fight the body turns to the aim; exploring, it looks where it walks.
        if (Battle != null || F.FreeStrikes)
        {
            if (c.Aim.LengthSquared() > 1) p.Face(c.Aim);
        }
        else if (c.Move.LengthSquared() > 0.01f)
        {
            p.Face(c.Move);
        }

        if (DashTime > 0)
        {
            UpdateDash(dt);
            return;
        }
        if (p.Stun > 0) return;

        var speed = p.Speed * p.SpeedFactor * (CastLock > 0 ? 0.45f : 1f) * F.TerrainSpeed(p.Pos);
        if (c.Move.LengthSquared() > 1) c.Move = c.Move.Normalized();
        if (c.Move.LengthSquared() > 0.01f)
        {
            p.Pos = F.Walls.Move(p.Pos, p.Radius, c.Move * speed * dt);
            if (_dustCd <= 0 && Battle != null)
            {
                _dustCd = 0.22f;
                F.Fx.Dust(p.Pos, 2);
            }
        }

        if (c.Dash) TryDash(c.Move.LengthSquared() > 0.04f ? c.Move.Normalized() : p.Facing);
        else if (c.Ultimate) TryUltimate(c);
        else if (c.Slot >= 0) TrySlot(c.Slot, c);
        else if (c.Pill) TryPill();
        else if (c.Attack && CastLock <= 0) Cast(Basic, c);
    }

    /// <summary>Outside a fight the battle doesn't tick the player's timers; do the few that matter.</summary>
    private static void Tick(Fighter p, float dt)
    {
        p.Invuln -= dt;
        p.HitFlash -= dt;
        p.Stun = Mathf.Max(0, p.Stun - dt);
        p.Rooted = Mathf.Max(0, p.Rooted - dt);
        p.Slow = Mathf.Max(0, p.Slow - dt);
        if (p.Shield > 0 && (p.ShieldTime -= dt) <= 0) p.Shield = 0;
    }

    private void UpdateDash(float dt)
    {
        var p = Body;
        DashTime -= dt;
        var before = p.Pos;
        p.Pos = F.Walls.Move(p.Pos, p.Radius, _dashDir * _dashSpeed * dt);
        p.Invuln = Mathf.Max(p.Invuln, 0.06f);
        if (p.Pos.DistanceTo(before) > 2) F.Fx.Particles.Add(new Particle
        {
            Pos = p.Pos + new Vector2(0, -30), Vel = -_dashDir * 40, Life = 0.25f, MaxLife = 0.25f, Size = 9,
            Color = new Color(0.61f, 0.16f, 0.15f, 0.22f), Kind = ParticleKind.Mist, Drag = 4,
        });
        F.OnPlayerDash(p.Pos, p.Radius);
        if (_dashSkill == null || Battle == null) return;
        foreach (var enemy in Battle.Enemies.Where(x => x.Active && x.InBattle && !_dashHits.Contains(x)).ToList())
        {
            if (enemy.Pos.DistanceTo(p.Pos) > enemy.Radius + (float)_dashSkill.Cast.Radius) continue;
            _dashHits.Add(enemy);
            Battle.HitEnemy(enemy, _dashSkill, _dashMult, _dashSkill.Damage == "physical" ? DamageKind.Physical : DamageKind.Spirit,
                _dashSkill.Element, p.Pos - _dashDir * 20);
        }
    }

    // ================================================================ actions

    private void TryDash(Vector2 dir)
    {
        if (DashCd > 0 || Body.Rooted > 0) return;
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
        _dashDir = dir.Normalized();
        DashTime = seconds;
        _dashSpeed = distance / seconds;
        _dashSkill = skill;
        _dashMult = mult;
        _dashHits.Clear();
        Body.Invuln = seconds + 0.08f;
        F.Fx.Dust(Body.Pos, 4);
    }

    private void TryUltimate(in Controls c)
    {
        if (Intent < 100)
        {
            Warn(T("Sát ý chưa đầy", "Killing intent isn't full"));
            return;
        }
        if (!Cast(Ultimate, c)) return;
        Intent = 0;
        F.Shake(10);
        F.Hud.Banner(T(Ultimate.Name, Ultimate.NameEn), "", Ink.Violet, 0.8f);
    }

    private void TrySlot(int slot, in Controls c)
    {
        var skill = SlotSkill(slot);
        if (skill == null)
        {
            Warn(E.Player.Skills.Count == 0
                ? T("Chưa có linh kỹ — cần đột phá Luyện Khí", "No spirit arts yet — reach Qi Condensation")
                : T("Ô trống — gán linh kỹ ở bảng Nhân vật (C)", "Empty slot — assign an art in Character (C)"));
            return;
        }
        Cast(skill, c);
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
        var heal = (float)def.Effects["hp_restore"];
        if (Battle != null)
        {
            Battle.ItemsUsed[id] = (Battle.ItemsUsed.TryGetValue(id, out var n) ? n : 0) + 1;
            Body.Hp = Mathf.Min(Body.HpMax, Body.Hp + heal);
        }
        else
        {
            if (E.Player.Hp >= E.Player.HpMax)
            {
                Warn(T("Khí huyết đang đầy", "Already at full health"));
                return;
            }
            Game.Instance.Notify(E.UseItem(id));
            SyncFromEngine();
        }
        PillCd = 5;
        F.Fx.Say(Body.Pos + new Vector2(0, -80), $"+{heal:0}", Ink.Jade, 22);
        F.Fx.Ring(Body.Pos + new Vector2(0, -24), 40, Ink.Jade);
        F.Fx.Rise(Body.Pos, new Color("#88ad9b"), 8, 18);
    }

    public void Warn(string text)
    {
        if (_warnCd > 0) return;
        _warnCd = 0.8f;
        F.Fx.Say(Body.Pos + new Vector2(0, -86), text, Ink.InkMute, 16);
    }

    private Vector2 AimDir(in Controls c) => c.Aim.LengthSquared() > 1 ? c.Aim.Normalized() : Body.Facing;

    private static bool Offensive(SkillDef skill) => skill.Cast.Shape is not ("self_buff" or "heal");

    /// <summary>How far in front of the player an art can start a fight.</summary>
    private static float EngageReach(SkillDef skill) => skill.Cast.Shape switch
    {
        "melee_arc" => (float)skill.Cast.Range + 30,
        "dash_strike" => (float)skill.Cast.Range + 30,
        "aoe_circle" => (float)skill.Cast.Range + (float)skill.Cast.Radius,
        _ => Mathf.Min(520, (float)skill.Cast.Range),
    };

    /// <summary>Use an art: pay its Qi, start its cooldown, and create its hit shape.</summary>
    public bool Cast(SkillDef skill, in Controls c)
    {
        var p = Body;
        if (CooldownLeft(skill.Id) > 0) return false;
        var dir = AimDir(c);

        if (Battle == null)
        {
            if (F.FreeStrikes)
            {
                // The breakthrough trial: only the blade touches heart demons.
                if (skill.Cast.Shape != "melee_arc")
                {
                    Warn(T("Tâm ma chỉ sợ kiếm và thân pháp", "Only the blade and footwork touch heart demons"));
                    return false;
                }
                Cooldowns[skill.Id] = (float)skill.Cooldown;
                Swing(skill, dir, skill.Element != null ? Ink.Element(skill.Element.Value) : Ink.InkColor);
                F.OnPlayerSlash(p.Pos + new Vector2(0, -10), dir, (float)skill.Cast.Arc, (float)skill.Cast.Range + 10);
                return true;
            }
            if (!Offensive(skill))
            {
                Warn(T("Chỉ dùng được khi giao chiến", "Only usable in a fight"));
                return false;
            }
            var foe = F.FindEngageTarget(p.Pos, dir, EngageReach(skill));
            if (foe == null)
            {
                if (skill != Basic)
                {
                    Warn(T("Không có mục tiêu", "No target"));
                    return false;
                }
                // A swing at the air: no cost, just the motion.
                Cooldowns[skill.Id] = (float)skill.Cooldown;
                Swing(skill, dir, Ink.InkColor);
                F.OnPlayerSlash(p.Pos + new Vector2(0, -10), dir, (float)skill.Cast.Arc, (float)skill.Cast.Range + 10);
                return true;
            }
            // Striking first starts the fight where you stand.
            if (!F.Engage(foe) || Battle == null) return false;
        }

        var cost = QiCost(skill);
        if (cost > Qi)
        {
            Warn(T("Linh lực không đủ", "Not enough Qi"));
            return false;
        }
        var battle = Battle!;
        Qi -= cost;
        Cooldowns[skill.Id] = (float)skill.Cooldown;
        battle.SkillUses[skill.Id] = (battle.SkillUses.TryGetValue(skill.Id, out var n) ? n : 0) + 1;

        var mult = (float)(skill.DamageMultiplier * Skills.LevelMultiplier(E.Player, skill.Id));
        var kind = skill.Damage == "physical" ? DamageKind.Physical : DamageKind.Spirit;
        var cast = skill.Cast;
        var color = skill.Element != null ? Ink.Element(skill.Element.Value) : Ink.InkColor;
        CastLock = (float)cast.Windup + 0.1f;
        p.Face(dir);

        switch (cast.Shape)
        {
            case "melee_arc":
            {
                Swing(skill, dir, color);
                var origin = p.Pos + new Vector2(0, -10);
                battle.MeleeHit(origin, dir, (float)cast.Arc, (float)cast.Range + 10, skill, mult, kind);
                break;
            }
            case "projectile":
                p.CastAnim = 1;
                p.CastColor = color;
                for (var i = 0; i < Math.Max(1, cast.Count); i++)
                {
                    var offset = (float)cast.Spread * (i - (cast.Count - 1) / 2f);
                    battle.Shoot(p, skill, dir.Rotated(Mathf.DegToRad(offset)), mult, kind, color);
                }
                break;
            case "nova":
                p.CastAnim = 1;
                p.CastColor = color;
                for (var i = 0; i < Math.Max(1, cast.Count); i++)
                    battle.Shoot(p, skill, Vector2.Right.Rotated(Mathf.Tau * i / Math.Max(1, cast.Count)), mult, kind, color);
                F.Fx.Ring(p.Pos + new Vector2(0, -24), 70, color, 0.3f);
                break;
            case "aoe_circle":
            {
                p.CastAnim = 1;
                p.CastColor = color;
                var reach = Mathf.Min((float)cast.Range, (AimPoint - p.Pos).Length());
                var target = p.Pos + dir * reach;
                var radius = (float)cast.Radius;
                battle.AddTelegraph(new Telegraph
                {
                    Shape = Telegraph.Shapes.Circle, Pos = target, Radius = radius, Duration = (float)Math.Max(0.1, cast.Windup),
                    FromPlayer = true, Owner = p, Tint = color,
                    Fire = () =>
                    {
                        F.Fx.Ring(target, radius, color, 0.3f);
                        F.Fx.Burst(target, color, 14, 200, ParticleKind.Spark, 3);
                        battle.AreaHit(target, radius, skill, mult, kind);
                    },
                });
                break;
            }
            case "dash_strike":
                p.AttackAnim = 1;
                p.AttackDir = dir;
                StartDash(dir, (float)cast.Range, 0.18f, skill, mult);
                F.Fx.Slash(p.Pos + new Vector2(0, -24), dir, 40, 60, color, 0.25f);
                break;
            case "self_buff":
                p.CastAnim = 1;
                p.CastColor = Ink.Jade;
                p.Shield = (float)((skill.Effects?.Shield ?? 30) * Skills.LevelMultiplier(E.Player, skill.Id));
                p.ShieldTime = (float)Math.Max(1, cast.Duration);
                F.Fx.Say(p.Pos + new Vector2(0, -90), T(skill.Name, skill.NameEn), Ink.Jade, 18);
                break;
            case "heal":
            {
                p.CastAnim = 1;
                p.CastColor = Ink.Jade;
                var heal = p.HpMax * (float)(skill.Effects?.HealPercent ?? 0.2);
                p.Hp = Mathf.Min(p.HpMax, p.Hp + heal);
                F.Fx.Say(p.Pos + new Vector2(0, -86), $"+{heal:0}", Ink.Jade, 22);
                F.Fx.Ring(p.Pos + new Vector2(0, -24), 46, Ink.Jade, 0.4f);
                F.Fx.Rise(p.Pos, new Color("#88ad9b"), 10, 20);
                break;
            }
        }
        return true;
    }

    /// <summary>The visible swing: the arm moves and a brush crescent sweeps the arc.</summary>
    private void Swing(SkillDef skill, Vector2 dir, Color color)
    {
        var p = Body;
        p.AttackAnim = 1;
        p.AttackDir = dir;
        var arc = (float)skill.Cast.Arc;
        var range = (float)skill.Cast.Range + 10;
        F.Fx.Slash(p.Pos + new Vector2(0, -22), dir, Mathf.Min(arc, 300), range, arc >= 300 ? Ink.Violet : color, 0.2f, arc >= 300 ? 1.6f : 1);
        if (arc >= 300) F.Fx.Ring(p.Pos + new Vector2(0, -20), range, Ink.Violet, 0.35f);
    }
}
