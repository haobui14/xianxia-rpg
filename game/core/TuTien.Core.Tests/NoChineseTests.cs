namespace TuTien.Core.Tests;

/// <summary>
/// The game shows no Chinese characters: every sign and name is Vietnamese (or English), and every badge
/// is an icon drawn in code. This keeps the content, the scripts, the rules and the app icon that way.
/// </summary>
public class NoChineseTests
{
    private static bool IsChinese(char c) =>
        c is >= '⺀' and <= '⿟' // radicals
            or >= '　' and <= '〿' // CJK punctuation, 「」 and friends
            or >= '㐀' and <= '䶿' // extension A
            or >= '一' and <= '鿿' // unified ideographs
            or >= '豈' and <= '﫿' // compatibility ideographs
            or >= '＀' and <= '￯' // full-width forms
            or >= '\uD840' and <= '\uD87F'; // high surrogates of extensions B and beyond

    [Fact]
    public void No_Chinese_characters_anywhere_in_the_game()
    {
        var godot = Directory.GetParent(TestContent.ContentRoot)!.FullName;
        var core = Path.Combine(Directory.GetParent(godot)!.FullName, "core", "TuTien.Core");
        static bool Source(string path) =>
            !path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}")
            && !path.Contains($"{Path.DirectorySeparatorChar}bin{Path.DirectorySeparatorChar}");
        var files = Directory.EnumerateFiles(Path.Combine(godot, "content"), "*.json", SearchOption.AllDirectories)
            .Concat(Directory.EnumerateFiles(Path.Combine(godot, "scripts"), "*.cs", SearchOption.AllDirectories))
            .Concat(Directory.EnumerateFiles(core, "*.cs", SearchOption.AllDirectories).Where(Source))
            .Append(Path.Combine(godot, "icon.svg"))
            .Append(Path.Combine(godot, "project.godot"))
            .ToList();
        Assert.True(files.Count > 50, $"only {files.Count} files found under {godot}");

        var found = new List<string>();
        foreach (var file in files)
        {
            var lines = File.ReadAllLines(file);
            for (var i = 0; i < lines.Length; i++)
                if (lines[i].Any(IsChinese)) found.Add($"{Path.GetRelativePath(godot, file)}:{i + 1}");
        }
        Assert.True(found.Count == 0, "Chinese characters in: " + string.Join(", ", found.Take(20)));
    }
}
