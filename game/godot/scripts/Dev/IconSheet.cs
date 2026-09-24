using System;
using Godot;
using TuTienLuc.Art;
using TuTienLuc.Ui;

namespace TuTienLuc.Dev;

/// <summary>Every icon on one sheet, large and small, ink on paper and paper on cinnabar (the smoke test's picture of them).</summary>
public partial class IconSheet : Control
{
    public override void _Ready()
    {
        SetAnchorsAndOffsetsPreset(LayoutPreset.FullRect);
        MouseFilter = MouseFilterEnum.Ignore;
    }

    public override void _Draw()
    {
        DrawRect(new Rect2(Vector2.Zero, Size), Ink.Paper);
        var kinds = Enum.GetValues<IconKind>();
        const int columns = 10;
        const float cellW = 156, cellH = 92;
        for (var i = 1; i < kinds.Length; i++)
        {
            var col = (i - 1) % columns;
            var row = (i - 1) / columns;
            var at = new Vector2(20 + col * cellW, 20 + row * cellH);
            Icons.Draw(this, kinds[i], at + new Vector2(28, 30), 48, Ink.InkColor);
            DrawRect(new Rect2(at + new Vector2(62, 10), new Vector2(40, 40)), Ink.Cinnabar);
            Icons.Draw(this, kinds[i], at + new Vector2(82, 30), 26, Ink.Card);
            Icons.Draw(this, kinds[i], at + new Vector2(124, 30), 16, Ink.JadeDeep);
            DrawString(Ink.UiFont, at + new Vector2(4, 74), kinds[i].ToString(), HorizontalAlignment.Left, -1, 13, Ink.InkSoft);
        }
    }
}
