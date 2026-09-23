using TuTien.Core;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Tests;

/// <summary>Loads the real game content (game/godot/content) once for all tests.</summary>
public static class TestContent
{
    private static readonly Lazy<ContentDb> Db = new(() => ContentDb.Load(file =>
    {
        var path = Path.Combine(ContentRoot, file);
        return File.Exists(path) ? File.ReadAllText(path) : null;
    }));

    public static ContentDb Content => Db.Value;

    public static string ContentRoot
    {
        get
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                var candidate = Path.Combine(dir.FullName, "godot", "content");
                if (File.Exists(Path.Combine(candidate, "regions.json"))) return candidate;
                candidate = Path.Combine(dir.FullName, "game", "godot", "content");
                if (File.Exists(Path.Combine(candidate, "regions.json"))) return candidate;
                dir = dir.Parent;
            }
            throw new DirectoryNotFoundException("Could not find game/godot/content from " + AppContext.BaseDirectory);
        }
    }

    public static SpiritRootState Root(RootGrade grade = RootGrade.PhoThong, params Element[] elements) => new()
    {
        Grade = grade,
        Elements = elements.Length == 0 ? new List<Element> { Element.Moc } : elements.ToList(),
    };

    public static GameEngine NewEngine(ulong seed = 42, CultivationPath path = CultivationPath.Qi) =>
        GameEngine.NewGame(Content, seed, "Lâm Vân", 16, Root(), path);
}
