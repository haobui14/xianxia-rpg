namespace TuTien.Core
{
    public enum EventLevel
    {
        Info,
        Major,
        Warning,
    }

    /// <summary>
    /// Something that happened, in both languages. The UI shows these as toasts and logs;
    /// the storyteller turns a month's worth into the chronicle.
    /// </summary>
    public sealed class GameEvent
    {
        public string Kind { get; }
        public string Text { get; }
        public string TextEn { get; }
        public EventLevel Level { get; }

        public GameEvent(string kind, string text, string textEn, EventLevel level)
        {
            Kind = kind;
            Text = text;
            TextEn = textEn;
            Level = level;
        }

        public string Localized(Locale locale) => Names.Pick(locale, Text, TextEn);

        public static GameEvent Info(string kind, string vi, string en) => new GameEvent(kind, vi, en, EventLevel.Info);
        public static GameEvent Major(string kind, string vi, string en) => new GameEvent(kind, vi, en, EventLevel.Major);
        public static GameEvent Warn(string kind, string vi, string en) => new GameEvent(kind, vi, en, EventLevel.Warning);

        public override string ToString() => $"[{Kind}] {TextEn}";
    }
}
