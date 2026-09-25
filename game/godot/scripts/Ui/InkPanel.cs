using System;
using Godot;
using TuTienLuc.Art;

namespace TuTienLuc.Ui;

/// <summary>
/// Base for every modal panel: seal + title header, close button, scrollable body.
/// Subclasses fill <see cref="Body"/> in <see cref="Build"/>; it re-runs whenever the game state changes.
/// </summary>
public abstract partial class InkPanel : PanelContainer
{
    protected VBoxContainer Body { get; private set; } = null!;
    public event Action? Closed;

    /// <summary>The picture on the panel's seal.</summary>
    protected abstract IconKind Emblem { get; }
    protected abstract string TitleText { get; }
    protected virtual Vector2 PanelSize => new(760, 620);
    protected virtual bool Closable => true;

    private Label _title = null!;
    private Button _close = null!;
    private bool _refreshQueued;

    public override void _Ready()
    {
        Refit();
        GetViewport().SizeChanged += Refit;
        AddThemeStyleboxOverride("panel", Ink.Box(Ink.Card, Ink.InkColor, 1, 4, 18));

        var root = new VBoxContainer();
        root.AddThemeConstantOverride("separation", 10);
        AddChild(root);

        var header = new HBoxContainer();
        header.AddThemeConstantOverride("separation", 12);
        header.AddChild(UiKit.Seal(Emblem, 38));
        _title = UiKit.Label(TitleText, 26, Ink.InkColor);
        _title.VerticalAlignment = VerticalAlignment.Center;
        header.AddChild(_title);
        header.AddChild(UiKit.Spacer(0, expand: true));
        _close = UiKit.Button("✕", Close);
        _close.Visible = Closable;
        header.AddChild(_close);
        root.AddChild(header);
        root.AddChild(UiKit.Rule());

        // A finger has to travel a little before it scrolls: with no dead zone every tap that wobbles a
        // pixel would turn into a scroll and cancel the button under it.
        var scroll = new ScrollContainer
        {
            SizeFlagsVertical = SizeFlags.ExpandFill,
            HorizontalScrollMode = ScrollContainer.ScrollMode.Disabled,
            ScrollDeadzone = 14,
        };
        root.AddChild(scroll);
        Body = new VBoxContainer { SizeFlagsHorizontal = SizeFlags.ExpandFill };
        Body.AddThemeConstantOverride("separation", 10);
        scroll.AddChild(Body);

        Game.Instance.StateChanged += RequestRefresh;
        Game.Instance.LocaleChanged += RequestRefresh;
        CrashLog.Note($"open {GetType().Name}");
        Build();
        LetDragsScroll(Body);
    }

    public override void _ExitTree()
    {
        GetViewport().SizeChanged -= Refit;
        Game.Instance.StateChanged -= RequestRefresh;
        Game.Instance.LocaleChanged -= RequestRefresh;
    }

    /// <summary>
    /// The panel's size, shrunk to leave a margin when the screen has less room (a phone, a bigger interface);
    /// the body scrolls.
    /// </summary>
    private void Refit()
    {
        var room = GetViewportRect().Size - new Vector2(24, 24);
        // (A headless run may report no screen at all: then the panel keeps its own size.)
        CustomMinimumSize = room.X < 300 || room.Y < 300 ? PanelSize : new Vector2(Mathf.Min(PanelSize.X, room.X), Mathf.Min(PanelSize.Y, room.Y));
    }

    protected abstract void Build();

    /// <summary>Rebuild after the current signal finishes, so a button is never freed mid-press.</summary>
    public void RequestRefresh()
    {
        if (_refreshQueued || !IsInsideTree()) return;
        _refreshQueued = true;
        Callable.From(DoRefresh).CallDeferred();
    }

    private void DoRefresh()
    {
        _refreshQueued = false;
        if (!IsInsideTree()) return;
        _title.Text = TitleText;
        _close.Visible = Closable;
        UiKit.Clear(Body);
        Build();
        LetDragsScroll(Body);
    }

    /// <summary>
    /// On a touchscreen the body scrolls under a dragging finger, even one that lands on a button: buttons
    /// pass the press on to the scroll container, which cancels the button once the drag becomes a scroll.
    /// (Buttons stop the press by default, so a panel full of them could hardly be scrolled.)
    /// </summary>
    private static void LetDragsScroll(Node node)
    {
        foreach (var child in node.GetChildren())
        {
            if (child is BaseButton button) button.MouseFilter = MouseFilterEnum.Pass;
            LetDragsScroll(child);
        }
    }

    public virtual void Close()
    {
        Closed?.Invoke();
        QueueFree();
    }

    protected static string T(string vi, string en) => Game.Instance.T(vi, en);
    protected static TuTien.Core.GameEngine E => Game.Instance.Engine!;
    /// <summary>The field this panel was opened over (the world, a realm floor).</summary>
    protected static TuTienLuc.Field.FieldScreen? Field => Main.Instance.Field;

    /// <summary>Close this panel and open another in its place.</summary>
    protected static void Open(InkPanel next) => Field?.OpenPanel(next);

    /// <summary>Close this panel and fight <paramref name="encounter"/> right where the player stands.</summary>
    protected void FightHere(TuTien.Core.State.Encounter encounter,
        Action<TuTien.Core.Combat.CombatResolution, TuTien.Core.Combat.CombatOutcome>? after = null)
    {
        var field = Field;
        Close();
        if (field != null) field.Fight(encounter, after);
        else E.AbandonEncounter();
    }

    /// <summary>Show a command's events as toasts; they also refresh every open view.</summary>
    protected static void Say(System.Collections.Generic.IEnumerable<TuTien.Core.GameEvent> events) => Game.Instance.Notify(events);

    // ------------------------------------------------------------------ builders for Build()

    protected int Tab { get; set; }

    /// <summary>A row of tab buttons; switching rebuilds the body.</summary>
    protected void Tabs(params string[] names)
    {
        var row = new HBoxContainer();
        row.AddThemeConstantOverride("separation", 6);
        for (var i = 0; i < names.Length; i++)
        {
            var index = i;
            row.AddChild(UiKit.Button(names[i], () =>
            {
                if (Tab == index) return;
                Tab = index;
                CrashLog.Note($"{GetType().Name} tab {index}");
                RequestRefresh();
            }, primary: i == Tab));
        }
        Body.AddChild(row);
    }

    protected Label Para(string text, int size = 16, Color? color = null)
    {
        var l = UiKit.Label(text, size, color ?? Ink.InkSoft, wrap: true);
        Body.AddChild(l);
        return l;
    }

    protected void Section(string caption)
    {
        Body.AddChild(UiKit.Spacer(2));
        Body.AddChild(UiKit.Caption(caption));
    }

    protected HBoxContainer Buttons(params Control[] buttons)
    {
        var row = UiKit.Row(buttons);
        row.AddThemeConstantOverride("separation", 8);
        Body.AddChild(row);
        return row;
    }

    /// <summary>A line with a label on the left and controls on the right.</summary>
    protected HBoxContainer Row(Control left, params Control[] right)
    {
        var row = new HBoxContainer();
        left.SizeFlagsHorizontal = SizeFlags.ExpandFill;
        row.AddChild(left);
        foreach (var c in right) row.AddChild(c);
        Body.AddChild(row);
        return row;
    }

    /// <summary><see cref="Row"/> for a helper that builds rows into another panel.</summary>
    public HBoxContainer AddRow(Control left, params Control[] right) => Row(left, right);

    public override void _UnhandledInput(InputEvent e)
    {
        if (Closable && e.IsActionPressed("pause"))
        {
            GetViewport().SetInputAsHandled();
            Close();
        }
    }
}
