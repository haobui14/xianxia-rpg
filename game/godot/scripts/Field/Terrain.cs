using System;
using System.Collections.Generic;
using Godot;
using TuTien.Core;

namespace TuTienLuc.Field;

/// <summary>Terrain ids as the shader reads them (TuTien.Core.World.Terrain order, plus the void beyond the map).</summary>
public static class TerrainId
{
    public const int Plains = 0, Road = 1, Forest = 2, Dense = 3, Hills = 4, Mountain = 5, Peak = 6, Water = 7, Bridge = 8, Swamp = 9, Town = 10, Sect = 11, Void = 12;

    public static bool IsWater(int t) => t == Water || t == Bridge;
}

/// <summary>
/// Builds the textures the ground and fog shaders read: terrain per tile (id + water depth), a fog
/// mask per tile, and a shared tileable noise texture.
/// </summary>
public static class TerrainTextures
{
    private static ImageTexture? _noise;

    /// <summary>256² tileable value noise, four octaves in four channels. Deterministic.</summary>
    public static ImageTexture Noise()
    {
        if (_noise != null) return _noise;
        const int size = 256;
        var rng = new Pcg32(20240917);
        var data = new byte[size * size * 4];
        var grids = new[] { 8, 16, 32, 64 };
        for (var ch = 0; ch < 4; ch++)
        {
            var layer = new float[size * size];
            float amp = 1, total = 0;
            for (var o = 0; o < 3; o++)
            {
                var g = grids[ch] << o;
                if (g > size) break;
                var lattice = new float[g * g];
                for (var i = 0; i < lattice.Length; i++) lattice[i] = (float)rng.NextDouble();
                var cell = size / (float)g;
                for (var y = 0; y < size; y++)
                {
                    for (var x = 0; x < size; x++)
                    {
                        var fx = x / cell;
                        var fy = y / cell;
                        var x0 = (int)fx % g;
                        var y0 = (int)fy % g;
                        var x1 = (x0 + 1) % g;
                        var y1 = (y0 + 1) % g;
                        var tx = Smooth(fx - Mathf.Floor(fx));
                        var ty = Smooth(fy - Mathf.Floor(fy));
                        var a = Mathf.Lerp(lattice[y0 * g + x0], lattice[y0 * g + x1], tx);
                        var b = Mathf.Lerp(lattice[y1 * g + x0], lattice[y1 * g + x1], tx);
                        layer[y * size + x] += Mathf.Lerp(a, b, ty) * amp;
                    }
                }
                total += amp;
                amp *= 0.5f;
            }
            for (var i = 0; i < layer.Length; i++)
                data[i * 4 + ch] = (byte)Mathf.Clamp((layer[i] / total - 0.5f) * 1.6f * 255 + 128, 0, 255);
        }
        var img = Image.CreateFromData(size, size, false, Image.Format.Rgba8, data);
        _noise = ImageTexture.CreateFromImage(img);
        return _noise;
    }

    private static float Smooth(float t) => t * t * (3 - 2 * t);

    /// <summary>R = terrain id, G = water depth (distance to land, 0..4 tiles) for the shader.</summary>
    public static ImageTexture Terrain(int w, int h, Func<int, int, int> typeAt)
    {
        var depth = new int[w * h];
        var queue = new Queue<(int x, int y)>();
        for (var y = 0; y < h; y++)
        {
            for (var x = 0; x < w; x++)
            {
                if (TerrainId.IsWater(typeAt(x, y))) depth[y * w + x] = int.MaxValue;
                else queue.Enqueue((x, y));
            }
        }
        while (queue.Count > 0)
        {
            var (x, y) = queue.Dequeue();
            var d = depth[y * w + x];
            foreach (var (dx, dy) in new[] { (1, 0), (-1, 0), (0, 1), (0, -1) })
            {
                var nx = x + dx;
                var ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= w || ny >= h || depth[ny * w + nx] <= d + 1) continue;
                depth[ny * w + nx] = d + 1;
                queue.Enqueue((nx, ny));
            }
        }
        var data = new byte[w * h * 4];
        for (var i = 0; i < w * h; i++)
        {
            var d = depth[i] == int.MaxValue ? 4 : Math.Min(4, depth[i]);
            data[i * 4] = (byte)typeAt(i % w, i / w);
            data[i * 4 + 1] = (byte)(Math.Max(0, d - 1) * 255 / 3);
            data[i * 4 + 3] = 255;
        }
        return ImageTexture.CreateFromImage(Image.CreateFromData(w, h, false, Image.Format.Rgba8, data));
    }

    public static Image FogImage(int w, int h) => Image.CreateEmpty(w, h, false, Image.Format.L8);
}

/// <summary>Draws one rectangle through a shader (the ground, the fog).</summary>
public partial class ShaderQuad : Node2D
{
    public Rect2 Area;

    public ShaderQuad(Rect2 area, ShaderMaterial material, int z)
    {
        Area = area;
        Material = material;
        ZIndex = z;
    }

    public override void _Draw() => DrawRect(Area, Colors.White);

    public static ShaderMaterial MakeMaterial(string path, Dictionary<string, Variant> parameters)
    {
        var mat = new ShaderMaterial { Shader = GD.Load<Shader>(path) };
        foreach (var kv in parameters) mat.SetShaderParameter(kv.Key, kv.Value);
        return mat;
    }
}
