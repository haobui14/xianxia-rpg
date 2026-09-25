using Godot;

namespace TuTienLuc.Dev;

/// <summary>
/// Diagnostic: let the game start as usual, then save what its own viewport shows after a moment and quit.
/// Run with a real window: <c>godot --path game/godot -- --capture out.png [frames]</c>.
/// </summary>
public partial class Capture : Node
{
    private readonly string _path;
    private int _frames;

    public Capture(string path, int frames)
    {
        _path = path;
        _frames = frames;
    }

    public override void _Process(double delta)
    {
        if (--_frames > 0) return;
        SetProcess(false);
        using var image = GetViewport().GetTexture().GetImage();
        image.SavePng(_path);
        GD.Print("[capture] saved " + _path);
        Game.Instance.Quit();
    }
}
