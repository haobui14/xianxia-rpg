using Godot;
using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.Events;

namespace TuTienLuc.Ui.Panels;

/// <summary>
/// Kỳ ngộ: an authored event with choices (design §7.12). Map adventures are consumed when
/// answered; direct events (a seclusion interruption, a fight's aftermath) pass no adventure id.
/// </summary>
public partial class EventPanel : InkPanel
{
    private readonly string? _adventureId;
    private readonly EventDef? _event;
    private OutcomeResult? _result;

    public EventPanel(string? adventureId, string? eventId)
    {
        _adventureId = adventureId;
        _event = adventureId != null
            ? E.EventFor(adventureId)
            : eventId != null && E.Content.Events.TryGetValue(eventId, out var ev) ? ev : null;
    }

    protected override string Glyph => "奇";
    protected override string TitleText => _event != null ? T(_event.Name, _event.NameEn) : T("Kỳ ngộ", "Encounter");
    protected override Vector2 PanelSize => new(760, 600);
    protected override bool Closable => _result == null;

    protected override void Build()
    {
        if (_event == null)
        {
            Para(T("Cơ duyên đã tan biến như sương sớm.", "The chance has vanished like morning mist."));
            Buttons(UiKit.Button(T("Rời đi", "Leave"), Close));
            return;
        }

        if (_result == null)
        {
            Para(T(_event.Narrative, _event.NarrativeEn), 18, Ink.InkColor);
            Body.AddChild(UiKit.Spacer(6));
            foreach (var view in E.Choices(_event))
            {
                if (view.Hidden) continue;
                var choiceId = view.Choice.Id;
                var button = UiKit.Button(T(view.Choice.Text, view.Choice.TextEn), () => Choose(choiceId), enabled: view.Available,
                    tooltip: view.Available ? null : T(view.Reason, view.ReasonEn));
                button.Alignment = HorizontalAlignment.Left;
                button.SizeFlagsHorizontal = SizeFlags.ExpandFill;
                button.AutowrapMode = TextServer.AutowrapMode.WordSmart;
                Body.AddChild(button);
                if (!view.Available) Para("    " + T(view.Reason, view.ReasonEn), 13, Ink.CinnabarSoft);
            }
            Body.AddChild(UiKit.Spacer(6));
            Buttons(UiKit.Button(T("Bỏ qua, rời đi", "Leave it be"), Close));
            return;
        }

        Para(T(_result.Outcome.Narrative, _result.Outcome.NarrativeEn), 18, Ink.InkColor);
        foreach (var e in _result.Events)
        {
            var color = e.Level == EventLevel.Major ? Ink.JadeDeep : e.Level == EventLevel.Warning ? Ink.CinnabarDeep : Ink.InkSoft;
            Para("· " + e.Localized(Game.Instance.Locale), 16, color);
        }
        Body.AddChild(UiKit.Spacer(8));
        if (E.ActiveEncounter is { } fight)
            Buttons(UiKit.Danger(T("Nghênh chiến!", "Fight!"), () => FightHere(fight)));
        else
            Buttons(UiKit.Button(T("Tiếp tục", "Continue"), Close, primary: true));
    }

    private void Choose(string choiceId)
    {
        if (_event == null || _result != null) return;
        _result = E.ResolveEvent(_event.Id, choiceId, _adventureId);
        Game.Instance.SaveGame();
        Game.Instance.Remember(_result.Events);
        RequestRefresh();
    }
}
