using System.Collections.Generic;
using Godot;
using TuTien.Core;
using TuTien.Core.Rules;
using TuTienLuc.Art;
using TuTienLuc.Audio;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.Field;

/// <summary>One step of a trial's guide: a picture, what it's called, and what to do about it.</summary>
public readonly record struct GuideStep(IconKind Icon, Color Color, string Title, string Text);

/// <summary>
/// What every major-breakthrough set piece shares (design §7.5): a guide before it starts and a count of
/// three, the difficulty the preparation leaves, strikes that land without a battle, aborting (which counts
/// as a failure), the verdict banner, and handing the performance to the engine before going back to the
/// world with the result. A practice run plays the same trial for nothing: no gain, no risk.
/// </summary>
public abstract partial class TrialBase : FieldScreen
{
    /// <summary>The performance this breakthrough needs, from the preparation (root, techniques, injuries).</summary>
    public float Threshold { get; private set; }
    public bool Ended { get; private set; }
    /// <summary>A rehearsal: the result is only shown, never handed to the engine.</summary>
    public bool Practice { get; }
    /// <summary>The guide is up, or the count of three is running: nothing has started yet.</summary>
    public bool Starting => !_begun || _countdown > 0;

    private float _endTimer;
    private bool _finished;
    private double _performance;
    private bool _begun;
    private float _countdown;
    private int _countShown;

    protected TrialBase(bool practice) => Practice = practice;

    public override bool FreeStrikes => true;
    protected override string MusicMood => "trial";
    public override string FleeLabel => Practice ? T("Dừng tập", "Stop practising") : T("Dừng đột phá (tính là thất bại)", "Abort (counts as a failure)");
    public override string FleeNote => Practice ? T("Tập luyện không mất gì cả.", "Practice costs nothing.") : T("Bỏ dở giữa chừng sẽ khiến linh khí phản phệ.", "Stopping midway makes the qi lash back.");

    /// <summary>How well it's going, 0..1; compared against <see cref="Threshold"/> at the end.</summary>
    public abstract double Performance { get; }

    /// <summary>The gauge drawn by the HUD in place of the skill bar.</summary>
    public abstract void DrawHud(FieldHud hud, Vector2 size);

    /// <summary>The guide shown before the trial: a line on what it is, then what happens and what to do.</summary>
    public abstract string GuideTitle { get; }
    public abstract string GuideIntro { get; }
    public abstract IReadOnlyList<GuideStep> GuideSteps { get; }

    /// <summary>The whole arena stays in view (on a phone the bigger interface would crop it otherwise).</summary>
    protected override Rect2 CameraBounds() => Walls.Bounds.Grow(4000);

    // The arena gets the screen: no date card or message log over it, and banners along the top edge.
    public override bool ShowCalendar => false;
    public override bool ShowLog => false;
    public override float BannerY(Vector2 size) => 86;

    /// <summary>
    /// A trial's gauge, in the left column under the cultivator's card, clear of the arena, the touch buttons
    /// and the banners: a title and the time left, the bar with the red line to pass (and any grade marks),
    /// and a line or two on what scores.
    /// </summary>
    protected void DrawGauge(FieldHud hud, string title, Color titleColor, string time, bool hurry, float score, float goal, Color fill,
        IEnumerable<(double At, string Name)> marks, string footer)
    {
        const float w = 330;
        var box = new Rect2(10, hud.CardBottom + 10, w + 14, 132);
        hud.DrawRect(box, new Color(Ink.Card, 0.9f));
        hud.Frame(box, Ink.LineStrong, 1);
        var x0 = box.Position.X + 7;
        var y = box.Position.Y + 24;
        DrawnText.Note(title);
        hud.DrawString(Ink.Serif, new Vector2(x0, y), title, HorizontalAlignment.Left, -1, 17, titleColor);
        var tw = Ink.UiFont.GetStringSize(time, HorizontalAlignment.Left, -1, 15).X;
        hud.DrawString(Ink.UiFont, new Vector2(x0 + w - tw, y), time, HorizontalAlignment.Left, -1, 15, hurry ? Ink.Cinnabar : Ink.InkSoft);

        // The line to pass, named above the bar; the grades below it.
        var need = T($"cần {Threshold * 100:0}%", $"need {Threshold * 100:0}%");
        DrawnText.Note(need);
        var tx = x0 + w * Threshold;
        var nw = Ink.UiFont.GetStringSize(need, HorizontalAlignment.Left, -1, 12).X;
        hud.DrawString(Ink.UiFont, new Vector2(Mathf.Clamp(tx - nw / 2, x0, x0 + w - nw), y + 18), need, HorizontalAlignment.Left, -1, 12, Ink.CinnabarDeep);
        var bar = new Vector2(x0, y + 24);
        hud.Bar(bar, w, 16, score, goal, fill, "");
        hud.DrawLine(new Vector2(tx, bar.Y - 4), new Vector2(tx, bar.Y + 20), Ink.CinnabarDeep, 3);
        foreach (var (at, name) in marks)
        {
            var gx = x0 + w * (float)at;
            hud.DrawLine(new Vector2(gx, bar.Y), new Vector2(gx, bar.Y + 16), new Color(Ink.GoldDeep, 0.9f), 2);
            DrawnText.Note(name);
            var gw = Ink.UiFont.GetStringSize(name, HorizontalAlignment.Left, -1, 12).X;
            hud.DrawString(Ink.UiFont, new Vector2(Mathf.Min(gx - gw / 2, x0 + w - gw), bar.Y + 30), name, HorizontalAlignment.Left, -1, 12, Ink.GoldDeep);
        }

        // What scores, wrapped to the gauge's width.
        var line = "";
        var ly = bar.Y + 50;
        foreach (var word in footer.Split(' '))
        {
            var next = line.Length == 0 ? word : line + " " + word;
            if (line.Length > 0 && Ink.UiFont.GetStringSize(next, HorizontalAlignment.Left, -1, 12).X > w)
            {
                DrawnText.Note(line);
                hud.DrawString(Ink.UiFont, new Vector2(x0, ly), line, HorizontalAlignment.Left, -1, 12, Ink.InkMute);
                ly += 15;
                line = word;
            }
            else
            {
                line = next;
            }
        }
        if (line.Length == 0) return;
        DrawnText.Note(line);
        hud.DrawString(Ink.UiFont, new Vector2(x0, ly), line, HorizontalAlignment.Left, -1, 12, Ink.InkMute);
    }

    protected void ReadPreparation() => Threshold = (float)Cultivation.MajorBreakthroughThreshold(E.State);

    /// <summary>Open the guide (subclasses call this from AfterReady); the trial waits until it's closed.</summary>
    protected void ShowGuide()
    {
        var guide = new TrialGuidePanel(this);
        guide.Closed += Begin;
        OpenPanel(guide);
    }

    /// <summary>Out of the trial before it starts (from the guide): nothing is lost, and the breakthrough still waits.</summary>
    public void Leave()
    {
        if (_begun || Ended) return;
        Ended = true;
        _finished = true;
        CrashLog.Note($"{GetType().Name}: left before it began");
        FadeThrough(() => Main.Instance.EnterWorld(() => true), 0.3f);
    }

    /// <summary>The guide was read: count three, then start.</summary>
    public void Begin()
    {
        if (_begun || Ended) return;
        _begun = true;
        _countdown = 3f;
        _countShown = 0;
        CrashLog.Note($"{GetType().Name}{(Practice ? " (practice)" : "")}: begins");
    }

    /// <summary>
    /// Call right after <see cref="UpdateVerdict"/>: true while the trial hasn't started (the guide is up or
    /// the count of three runs), when the player sits in meditation and nothing moves.
    /// </summary>
    protected bool UpdateCountdown(float dt)
    {
        if (!_begun) return true;
        if (_countdown <= 0) return false;
        _countdown -= dt;
        var n = Mathf.CeilToInt(_countdown);
        if (_countdown > 0 && n != _countShown && n >= 1)
        {
            _countShown = n;
            Hud.Banner(n.ToString(), T("Chuẩn bị…", "Get ready…"), Ink.InkSoft, 0.9f);
            SoundBoard.Play("click", -2, 1.2f);
        }
        if (_countdown > 0) return true;
        PlayerBody.Meditating = false;
        SoundBoard.Play("gong", -3);
        OnStart();
        return false;
    }

    /// <summary>The count of three is over: the trial proper begins.</summary>
    protected virtual void OnStart()
    {
    }

    public override void Flee()
    {
        SetPaused(false);
        EndTrial(0);
    }

    protected virtual string PassedTitle => T("Linh khí quy nguyên!", "The qi settles!");
    protected virtual string FailedTitle => T("Linh khí tán loạn…", "The qi scatters…");
    protected virtual string Verdict(double performance) =>
        T($"Thành tích {performance * 100:0}% · cần {Threshold * 100:0}%", $"Performance {performance * 100:0}% · needed {Threshold * 100:0}%");

    /// <summary>Stop the trial and show the verdict; the engine hears about it a moment later.</summary>
    protected void EndTrial(double performance)
    {
        if (Ended) return;
        Ended = true;
        _performance = performance;
        _endTimer = 2.4f;
        var passed = performance >= Threshold;
        CrashLog.Note($"{GetType().Name}: ends at {performance * 100:0}% (needed {Threshold * 100:0}%)");
        OnEnded(passed);
        SoundBoard.Play(passed ? "breakthrough" : "defeat");
        SoundBoard.Music("");
        Hud.Banner(Practice ? T("Hết buổi tập", "Practice over") : passed ? PassedTitle : FailedTitle, Verdict(performance),
            passed ? Ink.JadeDeep : Ink.CinnabarDeep, 2.4f);
        if (passed)
        {
            Fx.Ring(PlayerBody.Pos + new Vector2(0, -30), 240, Ink.Gold, 1.2f);
            Fx.Rise(PlayerBody.Pos, Ink.Gold, 30, 60);
        }
        PlayerBody.Meditating = true;
    }

    /// <summary>Clear the field when the trial stops (the verdict plays over a calm scene).</summary>
    protected virtual void OnEnded(bool passed)
    {
    }

    /// <summary>Call first thing in UpdateField: true while the verdict shows, when nothing else should move.</summary>
    protected bool UpdateVerdict(float dt)
    {
        if (!Ended) return false;
        _endTimer -= dt;
        if (_endTimer <= 0 && !_finished)
        {
            _finished = true;
            Finish();
        }
        return true;
    }

    /// <summary>
    /// Back to the world with the result, through the loading screen: the region is built a slice per frame
    /// there, so a phone never sits on one long frame while the trial is still being taken down.
    /// </summary>
    private void Finish()
    {
        var performance = _performance;
        var practice = Practice;
        var threshold = Threshold;
        var events = practice ? new List<GameEvent>() : E.CompleteBreakthrough(performance);
        if (!practice) Game.Instance.SaveGame();
        FadeThrough(() => Main.Instance.EnterWorld(() => true, entered: world =>
        {
            if (practice)
            {
                world.OpenPanel(new BreakthroughPanel(new PracticeResult(performance, threshold)));
                return;
            }
            Game.Instance.Notify(events);
            world.OpenPanel(new BreakthroughResultPanel(events, performance));
        }), 0.4f);
    }
}

/// <summary>How a practice run went, for the breakthrough panel to show.</summary>
public readonly record struct PracticeResult(double Performance, double Threshold);
