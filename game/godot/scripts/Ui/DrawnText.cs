using System.Collections.Generic;

namespace TuTienLuc.Ui;

/// <summary>
/// Words painted straight onto a canvas (signboards, name tags, the HUD) leave no node behind to read. While
/// the smoke test listens, each one is noted here so it can check that everything on screen is in the
/// interface language.
/// </summary>
public static class DrawnText
{
    /// <summary>Everything painted since the last check, or null when nobody is listening.</summary>
    public static HashSet<string>? Seen { get; set; }

    public static void Note(string text) => Seen?.Add(text);
}
