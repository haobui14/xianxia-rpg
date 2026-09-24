using System;
using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Combat;
using TuTien.Core.Content;
using TuTien.Core.Rules;
using TuTien.Core.State;
using TuTienLuc.Art;
using TuTienLuc.Audio;
using TuTienLuc.Ui;

namespace TuTienLuc.Field;

/// <summary>
/// A fight happening on the field, right where it started (design §7.3). Every hit goes through the
/// core's <see cref="CombatRules.Compute"/>; the battle only reports a <see cref="CombatOutcome"/> and the
/// engine decides loot and consequences. Walls, trunks and cliffs block movement and projectiles.
/// </summary>
public sealed class Battle
{
    public const float NonLethalFloor = 0.15f;
    /// <summary>Get this far from every foe and stay there to escape.</summary>
    public const float FleeDistance = 640;

    public FieldScreen F { get; }
    public Encounter Encounter { get; }
    public PlayerController Pc { get; }
    public Fighter Player => Pc.Body;
    public readonly List<Fighter> Enemies = new();
    public readonly List<Projectile> Projectiles = new();
    public readonly List<Telegraph> Telegraphs = new();
    public readonly Dictionary<string, int> SkillUses = new();
    public readonly Dictionary<string, int> ItemsUsed = new();
    public Pcg32 Rng { get; }
    public bool NonLethal { get; }
    public float Clock;
    public bool Over;
    public CombatOutcome? Outcome;
    public string Title = "";
    public float FleeProgress;

    private readonly List<string> _defeated = new();
    private GameEngine E => Game.Instance.Engine!;
    private Fx Fx => F.Fx;
    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    public Battle(FieldScreen field, Encounter encounter, PlayerController pc)
    {
        F = field;
        Encounter = encounter;
        Pc = pc;
        NonLethal = encounter.NonLethal;
        Rng = Seeds.Stream(E.State.Seed, "battle:" + encounter.Id, E.State.Calendar.MonthIndex);
    }

    public void AddEnemy(Fighter body, EnemyInstance inst)
    {
        var def = inst.Template;
        body.Enemy = inst;
        body.Stats = inst.ToCombatant();
        body.Element = inst.Element;
        body.Hp = body.HpMax = inst.HpMax;
        body.Speed = (float)inst.Speed;
        body.Archetype = def.Archetype;
        body.Skill = E.Content.Skill(def.Skills.FirstOrDefault());
        body.Name = T(inst.Name, inst.NameEn);
        body.InBattle = true;
        body.Alive = true;
        body.Yielded = false;
        body.Gone = false;
        body.State = "approach";
        body.AttackCd = 0.9f + (float)Rng.NextDouble() * 0.8f;
        body.SkillCd = 1.2f + (float)Rng.NextDouble() * 1.2f;
        body.MeleeCd = 0.5f;
        body.Strafe = Rng.Chance(0.5) ? 1 : -1;
        body.Enraged = false;
        Enemies.Add(body);
    }

    // ================================================================ loop

    public void Update(float dt)
    {
        if (Over) return;
        Clock += dt;
        TickStatus(Player, dt);
        foreach (var enemy in Enemies) EnemyAi.Update(this, enemy, dt);
        UpdateProjectiles(dt);
        UpdateTelegraphs(dt);
        CheckEnd(dt);
    }

    private void CheckEnd(float dt)
    {
        if (Over) return;
        var floor = NonLethal ? Player.HpMax * NonLethalFloor : 0;
        if (Player.Hp <= floor)
        {
            Player.Hp = Mathf.Max(0, Player.Hp);
            End(victory: false, fled: false);
            return;
        }
        var active = Enemies.Where(x => x.Active).ToList();
        if (active.Count == 0)
        {
            End(victory: true, fled: false);
            return;
        }
        var nearest = active.Min(x => x.Pos.DistanceTo(Player.Pos));
        if (nearest > FleeDistance)
        {
            FleeProgress += dt / 1.4f;
            if (FleeProgress >= 1) End(victory: false, fled: true);
        }
        else
        {
            FleeProgress = Mathf.Max(0, FleeProgress - dt);
        }
    }

    public void End(bool victory, bool fled)
    {
        if (Over) return;
        Over = true;
        var hp = victory || fled || NonLethal ? Math.Max(1, (int)Mathf.Ceil(Player.Hp)) : 0;
        Outcome = new CombatOutcome
        {
            EncounterId = Encounter.Id,
            Victory = victory,
            Fled = fled,
            HpLeft = hp,
            QiLeft = (int)Pc.Qi,
            Defeated = _defeated.ToList(),
            SkillUses = new Dictionary<string, int>(SkillUses),
            ItemsUsed = new Dictionary<string, int>(ItemsUsed),
            Seconds = Clock,
        };
        Telegraphs.Clear();
        Projectiles.Clear();
    }

    /// <summary>The first healing pill in the bag, and how many are left after this fight's use.</summary>
    public (string? Id, int Count) Pill()
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

    // ================================================================ hits

    /// <summary>The player's hit on an enemy: damage, then the Ngũ Hành mark or reaction, then the art's own effects.</summary>
    public void HitEnemy(Fighter target, SkillDef? skill, float mult, DamageKind kind, Element? element, Vector2 from)
    {
        if (!target.Active || !target.InBattle) return;
        // Every creature carries its own phase: with no applied mark it reacts to its own element (on a cooldown).
        var innate = target.Mark == null && target.InnateCd <= 0 ? target.Element : null;
        var mark = target.Mark ?? innate;
        var attacker = Player.Stats;
        var r = CombatRules.Compute(kind, mult, element, in attacker, target.Defending(), mark, Rng);

        Damage(target, r.Amount, r.Crit, from);
        SoundBoard.PlayAt(r.Crit ? "crit" : "hit", target.Pos);
        if (r.Reaction != Reaction.None)
        {
            if (target.Mark == null) target.InnateCd = 5;
            else target.Mark = null;
            React(target, r.Reaction, r.Amount);
            SoundBoard.PlayAt("reaction", target.Pos, 2);
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
        Pc.Intent = Mathf.Min(100, Pc.Intent + (r.Crit ? 5 : 2.5f));
    }

    /// <summary>An enemy's hit on the player (dodged during a dash; the shield soaks first).</summary>
    public void HitPlayer(Fighter source, float mult, DamageKind kind, Element? element, SkillDef? skill)
    {
        if (Over || !source.Active) return;
        var p = Player;
        if (p.Invuln > 0)
        {
            Fx.Say(p.Pos + new Vector2(0, -76), T("Né!", "Dodge!"), Ink.Jade, 18);
            SoundBoard.Play("dodge", -4);
            return;
        }
        if (source.Blind > 0 && Rng.Chance(0.5))
        {
            Fx.Say(p.Pos + new Vector2(0, -76), T("Trượt", "Miss"), Ink.InkMute, 16);
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
            if (soaked > 0) Fx.Say(p.Pos + new Vector2(24, -66), $"({soaked:0})", Ink.JadeSoft, 15);
        }
        if (amount > 0) Damage(p, (int)Mathf.Round(amount), r.Crit, source.Pos);
        SoundBoard.Play(amount > 0 ? "hurt" : "shield", amount > 0 ? 0 : -6);
        F.Shake(r.Crit ? 11 : 6);
        Pc.Intent = Mathf.Min(100, Pc.Intent + amount / p.HpMax * 90);

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
        var head = Figures.HeightOf(target.Kind) * target.Scale;
        Fx.Say(target.Pos + new Vector2(GD.Randf() * 24 - 12, -head - 4), crit ? amount + "!" : amount.ToString(), color, crit ? 30 : 21);
        Fx.Ink(target.Pos + new Vector2(0, -head * 0.45f), target.Pos - from, crit ? 9 : 5);
        if (!target.IsPlayer && target.Speed > 0 && target.Stun <= 0)
        {
            var knock = target.Archetype is "tank" or "boss" ? 5f : 16f;
            target.Pos = F.Walls.Move(target.Pos, target.Radius, (target.Pos - from).Normalized() * knock);
        }
        if (crit) F.Hitstop(0.045f);
        CheckDown(target);
    }

    /// <summary>Damage over time (bleed, burn, bursts): no crit, no knockback.</summary>
    public void DotDamage(Fighter target, float amount)
    {
        if (!target.Active || amount <= 0) return;
        target.Hp -= amount;
        CheckDown(target);
    }

    private void CheckDown(Fighter target)
    {
        if (target.IsPlayer || !target.Active) return;
        var head = Figures.HeightOf(target.Kind) * target.Scale;
        if (NonLethal && target.Hp <= target.HpMax * NonLethalFloor)
        {
            target.Yielded = true;
            target.Hp = Mathf.Max(1, target.Hp);
            _defeated.Add(target.Def.Id);
            SoundBoard.PlayAt("chime", target.Pos, -2);
            Fx.Say(target.Pos + new Vector2(0, -head - 26), T("Chịu thua!", "Yields!"), Ink.JadeDeep, 22);
            Telegraphs.RemoveAll(t => t.Owner == target);
        }
        else if (target.Hp <= 0)
        {
            target.Alive = false;
            target.DeathFade = 0.8f;
            _defeated.Add(target.Def.Id);
            SoundBoard.PlayAt("kill", target.Pos, 1);
            Pc.Intent = Mathf.Min(100, Pc.Intent + 10);
            F.Hitstop(0.07f);
            Fx.Ring(target.Pos + new Vector2(0, -head * 0.4f), target.Radius * 2.2f, Ink.InkColor, 0.4f);
            Fx.Ink(target.Pos + new Vector2(0, -head * 0.4f), Vector2.Up, 12);
            Telegraphs.RemoveAll(t => t.Owner == target);
        }
    }

    private void React(Fighter t, Reaction reaction, int amount)
    {
        var info = Elements.Info(reaction);
        if (info == null) return;
        var head = Figures.HeightOf(t.Kind) * t.Scale;
        var color = info.Kind == ReactionKind.Shatter ? Ink.CinnabarDeep : Ink.GoldDeep;
        Fx.Say(t.Pos + new Vector2(0, -head - 30), T(info.Name, info.NameEn) + "!", color, 24, 1.3f);
        var duration = (float)info.Duration;
        var at = t.Pos + new Vector2(0, -head * 0.4f);
        switch (info.Effect)
        {
            case "bleed":
                t.BleedDps = Mathf.Max(t.BleedDps, amount * 0.1f);
                t.BleedTime = duration;
                break;
            case "def_break":
                t.DefBreak = duration;
                Fx.Burst(at, Ink.Ochre, 10);
                break;
            case "root":
                t.Rooted = duration;
                Fx.Burst(at, Ink.WaterBlue, 10);
                break;
            case "blind_burst":
                t.Blind = duration;
                Fx.Ring(t.Pos, 100, Ink.WaterBlue, 0.4f);
                Fx.Burst(at, new Color(0.9f, 0.95f, 1f), 16, 220, ParticleKind.Mist, 6);
                foreach (var o in Enemies.Where(x => x != t && x.Active && x.Pos.DistanceTo(t.Pos) < 100).ToList()) DotDamage(o, amount * 0.4f);
                break;
            case "res_break":
                t.ResBreak = duration;
                Fx.Burst(at, Ink.Gold, 10);
                break;
            case "spread_burn":
                Fx.Ring(t.Pos, 120, Ink.Cinnabar, 0.4f);
                Fx.Burst(at, new Color("#f08a3a"), 18, 200, ParticleKind.Ember, 3);
                foreach (var o in Enemies.Where(x => x.Active && x.Pos.DistanceTo(t.Pos) < 120))
                {
                    o.BurnDps = Mathf.Max(o.BurnDps, amount * 0.1f);
                    o.BurnTime = duration;
                }
                break;
            case "lifesteal":
                var heal = amount * 0.1f;
                Player.Hp = Mathf.Min(Player.HpMax, Player.Hp + heal);
                Fx.Say(Player.Pos + new Vector2(0, -76), $"+{heal:0}", Ink.Jade, 18);
                Fx.Burst(at, Ink.Jade, 8, 120, ParticleKind.Spark);
                break;
            case "stun":
                t.Stun = Mathf.Max(t.Stun, duration);
                break;
            case "slow":
                t.Slow = duration;
                Fx.Burst(at, new Color("#a8d0e8"), 10);
                break;
        }
    }

    /// <summary>Apply a status and show its glyph once.</summary>
    public void Status(Fighter f, ref float timer, float seconds, string glyph)
    {
        if (timer <= 0) Fx.Say(f.Pos + new Vector2(0, -Figures.HeightOf(f.Kind) * f.Scale - 20), glyph, Ink.GoldDeep, 18);
        timer = Mathf.Max(timer, seconds);
    }

    public void TickStatus(Fighter f, float dt)
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
        var at = f.Pos + new Vector2(14, -Figures.HeightOf(f.Kind) * f.Scale * 0.8f);
        if (f.IsPlayer)
        {
            f.Hp -= amount;
            Fx.Say(at, $"{amount:0}", Ink.CinnabarSoft, 15);
        }
        else
        {
            Fx.Say(at, $"{amount:0}", f.BurnTime > 0 ? Ink.Cinnabar : Ink.CinnabarSoft, 15);
            if (f.BurnTime > 0) Fx.Burst(at, new Color("#f08a3a"), 2, 60, ParticleKind.Ember, 2);
            DotDamage(f, amount);
        }
    }

    // ================================================================ projectiles & telegraphs

    public void Shoot(Fighter owner, SkillDef skill, Vector2 dir, float mult, DamageKind kind, Color color)
    {
        var c = skill.Cast;
        var head = owner.IsPlayer ? 34f : Figures.HeightOf(owner.Kind) * owner.Scale * 0.55f;
        Projectiles.Add(new Projectile
        {
            Pos = owner.Pos + new Vector2(0, -head) + dir * (owner.Radius + 6), Vel = dir * (float)c.Speed, Radius = (float)c.Radius, Range = (float)c.Range,
            Owner = owner, Skill = skill, Mult = mult, Kind = kind, Element = skill.Element, Burst = (float)c.Burst, Color = color,
            Look = FxArt.ProjectileLook(skill.Id, skill.Element), Height = head,
        });
    }

    /// <summary>An enemy fires its art along <paramref name="dir"/>.</summary>
    public void EnemyShoot(Fighter owner, SkillDef skill, Vector2 dir)
    {
        var color = skill.Element != null ? Ink.Element(skill.Element.Value).Darkened(0.15f) : Ink.CinnabarDeep;
        owner.CastAnim = 1;
        owner.CastColor = color;
        SoundBoard.PlayAt("shoot", owner.Pos, -3);
        Shoot(owner, skill, dir, (float)skill.DamageMultiplier * (owner.Enraged ? 1.15f : 1f),
            skill.Damage == "physical" ? DamageKind.Physical : DamageKind.Spirit, color);
    }

    /// <summary>Where a projectile's body sits for collision (it flies at chest height).</summary>
    private static Vector2 Ground(Projectile p) => p.Ground;

    private void UpdateProjectiles(float dt)
    {
        foreach (var proj in Projectiles)
        {
            if (proj.Dead) continue;
            proj.Age += dt;
            var step = proj.Vel * dt;
            proj.Pos += step;
            proj.Traveled += step.Length();
            if (proj.Look == "fire" && GD.Randf() < 0.5f) Fx.Burst(proj.Pos, new Color("#f08a3a"), 1, 40, ParticleKind.Ember, 2);
            var ground = Ground(proj);
            if (F.Walls.BlocksShot(ground, proj.Radius) || proj.Traveled > proj.Range)
            {
                if (proj.FromPlayer && proj.Burst > 0) Explode(proj, null);
                else Fx.Burst(proj.Pos, proj.Color, 5, 90);
                proj.Dead = true;
                continue;
            }
            if (proj.FromPlayer)
            {
                var hit = Enemies.FirstOrDefault(x => x.Active && x.InBattle && x.Pos.DistanceTo(ground) <= x.Radius + proj.Radius);
                if (hit == null) continue;
                HitEnemy(hit, proj.Skill, proj.Mult, proj.Kind, proj.Element, proj.Pos - proj.Vel.Normalized() * 12);
                if (proj.Burst > 0) Explode(proj, hit);
                else Fx.Burst(proj.Pos, proj.Color, 6, 110);
                proj.Dead = true;
            }
            else if (ground.DistanceTo(Player.Pos) <= Player.Radius + proj.Radius)
            {
                HitPlayer(proj.Owner, proj.Mult, proj.Kind, proj.Element, proj.Skill);
                Fx.Burst(proj.Pos, proj.Color, 6, 110);
                proj.Dead = true;
            }
        }
        Projectiles.RemoveAll(x => x.Dead);
    }

    private void Explode(Projectile proj, Fighter? direct)
    {
        Fx.Ring(proj.Pos, proj.Burst, proj.Color, 0.35f);
        Fx.Burst(proj.Pos, new Color("#f5a04a"), 16, 220, ParticleKind.Ember, 3);
        SoundBoard.PlayAt("explode", proj.Pos, -2);
        F.Shake(4);
        var ground = Ground(proj);
        foreach (var enemy in Enemies.Where(x => x != direct && x.Active && x.InBattle && x.Pos.DistanceTo(ground) <= proj.Burst + x.Radius).ToList())
            HitEnemy(enemy, proj.Skill, proj.Mult * 0.6f, proj.Kind, proj.Element, proj.Pos);
    }

    public void AddTelegraph(Telegraph t) => Telegraphs.Add(t);

    private void UpdateTelegraphs(float dt)
    {
        foreach (var t in Telegraphs.ToList())
        {
            if (t.Dead) continue;
            // Stunning a caster mid-windup interrupts the attack.
            if (!t.FromPlayer && t.Owner != null && (!t.Owner.Active || t.Owner.Stun > 0))
            {
                if (t.Owner.Active)
                    Fx.Say(t.Owner.Pos + new Vector2(0, -Figures.HeightOf(t.Owner.Kind) * t.Owner.Scale - 22), T("Gián đoạn!", "Interrupted!"), Ink.JadeDeep, 18);
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

    /// <summary>The player's area art lands on everyone inside it.</summary>
    public void AreaHit(Vector2 at, float radius, SkillDef skill, float mult, DamageKind kind)
    {
        foreach (var enemy in Enemies.Where(x => x.Active && x.InBattle && x.Pos.DistanceTo(at) <= radius + x.Radius * 0.5f).ToList())
            HitEnemy(enemy, skill, mult, kind, skill.Element, at);
    }

    public void MeleeHit(Vector2 origin, Vector2 dir, float arc, float range, SkillDef skill, float mult, DamageKind kind)
    {
        foreach (var enemy in Enemies.Where(x => x.Active && x.InBattle && FieldMath.InArc(origin, dir, arc, range, x.Pos, x.Radius)).ToList())
            HitEnemy(enemy, skill, mult, kind, skill.Element, origin);
    }
}
