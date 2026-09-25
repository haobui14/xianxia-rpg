using Godot;
using TuTien.Core;
using TuTien.Core.Rules;
using TuTienLuc.Audio;
using TuTienLuc.Ui;
using TuTienLuc.Ui.Panels;

namespace TuTienLuc.Field;

/// <summary>
/// What every major-breakthrough set piece shares (design §7.5): the difficulty the preparation leaves,
/// strikes that land without a battle, aborting (which counts as a failure), the verdict banner, and
/// handing the performance to the engine before going back to the world with the result.
/// </summary>
public abstract partial class TrialBase : FieldScreen
{
    /// <summary>The performance this breakthrough needs, from the preparation (root, techniques, injuries).</summary>
    public float Threshold { get; private set; }
    public bool Ended { get; private set; }

    private float _endTimer;
    private bool _finished;
    private double _performance;

    public override bool FreeStrikes => true;
    protected override string MusicMood => "trial";
    public override string FleeLabel => T("Dừng đột phá (tính là thất bại)", "Abort (counts as a failure)");
    public override string FleeNote => T("Bỏ dở giữa chừng sẽ khiến linh khí phản phệ.", "Stopping midway makes the qi lash back.");

    /// <summary>How well it's going, 0..1; compared against <see cref="Threshold"/> at the end.</summary>
    public abstract double Performance { get; }

    /// <summary>The gauge drawn by the HUD in place of the skill bar.</summary>
    public abstract void DrawHud(FieldHud hud, Vector2 size);

    /// <summary>Where the gauge sits: at the bottom, or under the date when the touch buttons need the bottom corners.</summary>
    protected static float GaugeY(Vector2 size) => TouchUi.Active ? 150 : size.Y - 112;

    protected void ReadPreparation() => Threshold = (float)Cultivation.MajorBreakthroughThreshold(E.State);

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
        OnEnded(passed);
        SoundBoard.Play(passed ? "breakthrough" : "defeat");
        SoundBoard.Music("");
        Hud.Banner(passed ? PassedTitle : FailedTitle, Verdict(performance), passed ? Ink.JadeDeep : Ink.CinnabarDeep, 2.4f);
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

    private void Finish()
    {
        var performance = _performance;
        var events = E.CompleteBreakthrough(performance);
        Game.Instance.SaveGame();
        FadeThrough(() =>
        {
            var world = Main.Instance.ShowWorld();
            Game.Instance.Notify(events);
            world.OpenPanel(new BreakthroughResultPanel(events, performance));
        }, 0.4f);
    }
}
