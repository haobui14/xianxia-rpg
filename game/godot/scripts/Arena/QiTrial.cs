using System.Collections.Generic;
using System.Linq;
using Godot;
using TuTien.Core;
using TuTien.Core.Rules;
using TuTienLuc.Ui;

namespace TuTienLuc.Arena;

/// <summary>
/// The major-breakthrough set piece (design §7.5). For 25 seconds qi motes pour into the arena:
/// gather them (your root's element is worth 3, others 1) while heart demons (tâm ma) hunt you.
/// A demon's touch costs 4; cutting one down or dashing through it is worth 1.
/// Performance = score / target, compared against the preparation-dependent threshold.
/// </summary>
internal sealed class QiTrial
{
    public const float Duration = 25f;
    public const float Target = 60f;

    private readonly ArenaScreen _a;
    private readonly HashSet<Element> _root;
    private readonly int _realm;
    private float _moteTimer;
    private float _demonTimer = 2.5f;

    public readonly List<Mote> Motes = new();
    public readonly List<Demon> Demons = new();
    public float Time;
    public float Score;
    public int Gathered;
    public int Hits;
    public float Threshold { get; }

    public QiTrial(ArenaScreen a)
    {
        _a = a;
        var p = a.E.Player;
        _root = new HashSet<Element>(p.Root.Elements);
        _realm = (int)p.Realm;
        Threshold = (float)Cultivation.MajorBreakthroughThreshold(p);
    }

    public double Performance => Mathf.Clamp(Score / Target, 0, 1);
    public float TimeLeft => Mathf.Max(0, Duration - Time);
    public bool IsRoot(Element e) => _root.Contains(e);

    public void Update(float dt)
    {
        Time += dt;
        var rng = _a.Rng;
        var field = ArenaScreen.Field;
        var center = field / 2;

        _moteTimer -= dt;
        if (_moteTimer <= 0)
        {
            _moteTimer = 0.32f;
            var element = rng.Chance(0.4) && _root.Count > 0 ? rng.Pick(_root.ToList()) : rng.Pick(Elements.All);
            Vector2 pos;
            var guard = 0;
            do
            {
                pos = new Vector2(60 + (float)rng.NextDouble() * (field.X - 120), 60 + (float)rng.NextDouble() * (field.Y - 120));
            } while (pos.DistanceTo(_a.Player.Pos) < 140 && ++guard < 8);
            Motes.Add(new Mote { Pos = pos, Element = element, Vel = new Vector2((float)rng.NextDouble() - 0.5f, (float)rng.NextDouble() - 0.5f) * 40 });
        }

        _demonTimer -= dt;
        if (_demonTimer <= 0)
        {
            _demonTimer = Mathf.Max(0.9f, 2.3f - 0.3f * _realm);
            var side = rng.Range(0, 3);
            var t = (float)rng.NextDouble();
            var pos = side switch
            {
                0 => new Vector2(t * field.X, 10),
                1 => new Vector2(field.X - 10, t * field.Y),
                2 => new Vector2(t * field.X, field.Y - 10),
                _ => new Vector2(10, t * field.Y),
            };
            Demons.Add(new Demon { Pos = pos, Speed = 110 + 25 * _realm + Time * 2, Wobble = (float)rng.NextDouble() * Mathf.Tau });
        }

        var p = _a.Player;
        foreach (var m in Motes)
        {
            m.Life -= dt;
            // A slow vortex draws the motes around the center.
            var toCenter = center - m.Pos;
            m.Vel += (toCenter.Normalized().Rotated(1.2f) * 14) * dt;
            m.Pos += m.Vel * dt;
            if (m.Life <= 0)
            {
                m.Dead = true;
                continue;
            }
            if (m.Pos.DistanceTo(p.Pos) > p.Radius + 14) continue;
            m.Dead = true;
            var gain = _root.Contains(m.Element) ? 3 : 1;
            Score += gain;
            Gathered += 1;
            _a.Say(m.Pos + new Vector2(0, -16), "+" + gain, Ink.Element(m.Element), gain > 1 ? 22 : 17, 0.7f);
        }

        foreach (var d in Demons)
        {
            d.Wobble += dt * 4;
            var dir = (p.Pos - d.Pos).Normalized();
            d.Pos += (dir + new Vector2(-dir.Y, dir.X) * Mathf.Sin(d.Wobble) * 0.5f).Normalized() * d.Speed * dt;
            if (d.Pos.DistanceTo(p.Pos) > p.Radius + 14) continue;
            d.Dead = true;
            if (p.Invuln > 0)
            {
                Score += 1;
                _a.Say(d.Pos, T("Trảm!", "Cut!"), Ink.JadeDeep, 20);
            }
            else
            {
                Score = Mathf.Max(0, Score - 4);
                Hits += 1;
                p.Stun = Mathf.Max(p.Stun, 0.35f);
                p.HitFlash = 0.15f;
                _a.Shake(9);
                _a.Say(p.Pos + new Vector2(0, -44), T("−4 tâm ma", "−4 heart demon"), Ink.Cinnabar, 22);
            }
        }

        Motes.RemoveAll(m => m.Dead);
        Demons.RemoveAll(d => d.Dead);
        if (Time >= Duration) _a.EndTrial(Performance);
    }

    private static string T(string vi, string en) => Game.Instance.T(vi, en);

    private void Cut(Demon d)
    {
        d.Dead = true;
        Score += 1;
        _a.Say(d.Pos, T("Trảm!", "Cut!"), Ink.JadeDeep, 20);
        _a.Ring(d.Pos, 26, Ink.Violet);
    }

    /// <summary>A melee art cuts down the heart demons in its arc.</summary>
    public void Slash(Vector2 origin, Vector2 facing, float arc, float reach)
    {
        foreach (var d in Demons.Where(d => !d.Dead && ArenaMath.InArc(origin, facing, arc, reach, d.Pos, 12)).ToList()) Cut(d);
    }

    public void Blast(Vector2 pos, float radius)
    {
        foreach (var d in Demons.Where(d => !d.Dead && d.Pos.DistanceTo(pos) <= radius + 12).ToList()) Cut(d);
    }

    /// <summary>A projectile hits a demon; true if it was stopped.</summary>
    public bool Shoot(Vector2 pos, float radius)
    {
        var d = Demons.FirstOrDefault(x => !x.Dead && x.Pos.DistanceTo(pos) <= radius + 12);
        if (d == null) return false;
        Cut(d);
        return true;
    }
}
