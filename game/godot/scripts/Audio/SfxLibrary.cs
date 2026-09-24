using System;
using System.Collections.Generic;

namespace TuTienLuc.Audio;

/// <summary>
/// Every sound effect, as a recipe over <see cref="Synth"/> voices. Rendered once on first use and cached.
/// Pentatonic pitches (D gong mode) keep the chimes and plucks in the same key as the music.
/// </summary>
public static class SfxLibrary
{
    private static float[] Buf(float seconds) => new float[Synth.Samples(seconds)];
    private static int At(float seconds) => Synth.Samples(seconds);
    private static float M(float midi) => Synth.Midi(midi);

    // D gong pentatonic around D5: D E F# A B.
    private const float D4 = 62, Fs4 = 66, A4 = 69, B4 = 71, D5 = 74, E5 = 76, Fs5 = 78, A5 = 81, B5 = 83, D6 = 86;

    public static readonly IReadOnlyDictionary<string, Func<float[]>> Recipes = new Dictionary<string, Func<float[]>>
    {
        // ---------------------------------------------------------------- combat
        ["swing"] = () =>
        {
            var b = Buf(0.22f);
            Synth.Whoosh(b, 0, 0.2f, 0.9f, 2600, 700, 1.4f, 11, 0.2f);
            return Synth.Master(b, 0.55f);
        },
        ["swing_big"] = () =>
        {
            var b = Buf(0.5f);
            Synth.Whoosh(b, 0, 0.45f, 0.9f, 1800, 260, 1.1f, 12, 0.3f);
            Synth.Tone(b, 0, 95, 0.5f, 0.35f, 0.01f, 0.12f, 45);
            return Synth.Master(b, 0.7f);
        },
        ["hit"] = () =>
        {
            var b = Buf(0.18f);
            Synth.Tone(b, 0, 190, 0.8f, 0.14f, 0.001f, 0.045f, 70);
            Synth.Hit(b, 0, 0.04f, 0.5f, 2600, 21);
            return Synth.Master(b, 0.6f);
        },
        ["crit"] = () =>
        {
            var b = Buf(0.45f);
            Synth.Tone(b, 0, 220, 0.8f, 0.16f, 0.001f, 0.05f, 70);
            Synth.Hit(b, 0, 0.05f, 0.6f, 4200, 22);
            Synth.Bell(b, At(0.01f), M(B5), 0.25f, 0.4f);
            return Synth.Master(b, 0.72f);
        },
        ["hurt"] = () =>
        {
            var b = Buf(0.25f);
            Synth.Tone(b, 0, 130, 0.9f, 0.2f, 0.001f, 0.07f, 50);
            Synth.Hit(b, 0, 0.08f, 0.6f, 900, 23);
            return Synth.Master(b, 0.7f);
        },
        ["dodge"] = () =>
        {
            var b = Buf(0.16f);
            Synth.Whoosh(b, 0, 0.15f, 0.8f, 2400, 5200, 1.2f, 13, 0.3f);
            return Synth.Master(b, 0.35f);
        },
        ["dash"] = () =>
        {
            var b = Buf(0.28f);
            Synth.Whoosh(b, 0, 0.26f, 0.9f, 700, 3600, 0.9f, 14, 0.15f);
            return Synth.Master(b, 0.5f);
        },
        ["cast"] = () =>
        {
            var b = Buf(0.5f);
            float[] notes = { A5, B5, D6 };
            for (var i = 0; i < notes.Length; i++) Synth.Tone(b, At(i * 0.045f), M(notes[i]), 0.3f, 0.3f, 0.003f, 0.12f);
            Synth.Whoosh(b, 0, 0.35f, 0.25f, 3000, 7000, 2f, 15, 0.4f);
            return Synth.Master(b, 0.5f);
        },
        ["fire"] = () =>
        {
            var b = Buf(0.5f);
            Synth.Whoosh(b, 0, 0.45f, 0.8f, 500, 1400, 0.8f, 16, 0.15f);
            var n = new Synth.Noise(17);
            for (var i = 0; i < 14; i++) Synth.Hit(b, At(0.02f + (n.Next() + 1) * 0.18f), 0.012f, 0.35f, 5000, (uint)(30 + i));
            return Synth.Master(b, 0.55f);
        },
        ["explode"] = () =>
        {
            var b = Buf(0.8f);
            Synth.Whoosh(b, 0, 0.7f, 1f, 1600, 160, 0.7f, 18, 0.03f);
            Synth.Tone(b, 0, 75, 0.9f, 0.6f, 0.002f, 0.2f, 34);
            return Synth.Master(b, 0.8f);
        },
        ["shoot"] = () =>
        {
            var b = Buf(0.16f);
            Synth.Tone(b, 0, 880, 0.4f, 0.12f, 0.002f, 0.05f, 420);
            Synth.Hit(b, 0, 0.02f, 0.25f, 3000, 24);
            return Synth.Master(b, 0.32f);
        },
        ["slam"] = () =>
        {
            var b = Buf(0.6f);
            Synth.Drum(b, 0, 85, 38, 1f, 0.5f, 0.5f, 25);
            Synth.Hit(b, At(0.01f), 0.25f, 0.5f, 500, 26);
            return Synth.Master(b, 0.85f);
        },
        ["kill"] = () =>
        {
            var b = Buf(0.9f);
            Synth.Tone(b, 0, 150, 0.8f, 0.3f, 0.001f, 0.09f, 48);
            Synth.Hit(b, 0, 0.1f, 0.45f, 1200, 27);
            Synth.Pluck(b, At(0.05f), M(D6), 0.35f, 0.8f, 0.8f, 0.4f, 28);
            return Synth.Master(b, 0.7f);
        },
        ["reaction"] = () =>
        {
            var b = Buf(1.1f);
            foreach (var (note, i) in new[] { (D5, 0), (A5, 1), (D6, 2) }) Synth.Pluck(b, At(i * 0.012f), M(note), 0.4f, 1f, 0.9f, 0.5f, (uint)(40 + i));
            Synth.Bell(b, 0, M(Fs5), 0.25f, 0.9f);
            return Synth.Master(b, 0.7f);
        },
        ["shield"] = () =>
        {
            var b = Buf(0.6f);
            Synth.Tone(b, 0, M(A5), 0.3f, 0.55f, 0.12f, 0.25f, 0, 0.01f);
            Synth.Tone(b, 0, M(D6), 0.2f, 0.55f, 0.15f, 0.25f, 0, 0.012f);
            return Synth.Master(b, 0.45f);
        },
        ["heal"] = () =>
        {
            var b = Buf(0.8f);
            Synth.Tone(b, 0, 520, 0.3f, 0.5f, 0.05f, 0.3f, 1040);
            Synth.Bell(b, At(0.25f), M(A5), 0.25f, 0.5f);
            return Synth.Master(b, 0.45f);
        },
        ["notice"] = () =>
        {
            var b = Buf(0.2f);
            Synth.Tone(b, 0, 2100, 0.5f, 0.03f, 0.001f, 0.012f);
            Synth.Tone(b, At(0.075f), 2400, 0.5f, 0.03f, 0.001f, 0.012f);
            return Synth.Master(b, 0.4f);
        },
        ["battle"] = () =>
        {
            var b = Buf(1.0f);
            Synth.Drum(b, 0, 95, 42, 1f, 0.7f, 0.5f, 29);
            Synth.Drum(b, At(0.22f), 170, 90, 0.5f, 0.2f, 0.6f, 30);
            Synth.Drum(b, At(0.33f), 95, 42, 0.8f, 0.6f, 0.5f, 31);
            return Synth.Master(b, 0.8f);
        },

        // ---------------------------------------------------------------- the world
        ["gather"] = () =>
        {
            var b = Buf(0.9f);
            Synth.Pluck(b, 0, M(A5), 0.5f, 0.8f, 0.7f, 0.5f, 50);
            Synth.Pluck(b, At(0.09f), M(D6), 0.5f, 0.8f, 0.7f, 0.5f, 51);
            return Synth.Master(b, 0.5f);
        },
        ["coin"] = () =>
        {
            var b = Buf(0.5f);
            Synth.Bell(b, 0, 2100, 0.4f, 0.35f);
            Synth.Bell(b, At(0.07f), 2500, 0.3f, 0.35f);
            return Synth.Master(b, 0.4f);
        },
        ["chest"] = () =>
        {
            var b = Buf(0.9f);
            Synth.Whoosh(b, 0, 0.3f, 0.6f, 380, 520, 6f, 52, 0.4f);
            Synth.Bell(b, At(0.3f), 2100, 0.35f, 0.4f);
            Synth.Bell(b, At(0.38f), 2600, 0.3f, 0.4f);
            Synth.Tone(b, At(0.3f), M(D6), 0.2f, 0.5f, 0.01f, 0.25f);
            return Synth.Master(b, 0.55f);
        },
        ["portal"] = () =>
        {
            var b = Buf(1.1f);
            Synth.Whoosh(b, 0, 1f, 0.8f, 260, 2400, 1.5f, 53, 0.5f);
            Synth.Tone(b, At(0.3f), M(D6), 0.2f, 0.7f, 0.2f, 0.3f, 0, 0.01f);
            return Synth.Master(b, 0.55f);
        },
        ["pulse"] = () =>
        {
            var b = Buf(1.4f);
            Synth.Tone(b, 0, 110, 0.6f, 1.2f, 0.05f, 0.5f, 90);
            Synth.Tone(b, At(0.1f), M(A5), 0.2f, 1.1f, 0.3f, 0.4f, M(D6), 0.008f);
            return Synth.Master(b, 0.5f);
        },
        ["step"] = () =>
        {
            var b = Buf(0.06f);
            Synth.Hit(b, 0, 0.05f, 0.5f, 420, 54);
            return Synth.Master(b, 0.18f);
        },
        ["month"] = () =>
        {
            var b = Buf(3.2f);
            Synth.Gong(b, 0, 118, 0.9f, 3.1f, 55);
            Synth.Bell(b, At(0.05f), M(A5), 0.12f, 1.6f);
            return Synth.Master(b, 0.55f);
        },
        ["gong"] = () =>
        {
            var b = Buf(4.0f);
            Synth.Gong(b, 0, 92, 1f, 3.9f, 56);
            return Synth.Master(b, 0.75f);
        },
        ["breakthrough"] = () =>
        {
            var b = Buf(3.6f);
            Synth.Gong(b, 0, 96, 0.8f, 3.4f, 57);
            float[] chord = { D5, Fs5, A5, D6 };
            for (var i = 0; i < chord.Length; i++) Synth.Bell(b, At(0.2f + i * 0.09f), M(chord[i]), 0.3f, 2.4f);
            Synth.Tone(b, At(0.4f), M(A4), 0.15f, 2.6f, 0.8f, 1.2f, M(D5));
            return Synth.Master(b, 0.8f);
        },
        ["victory"] = () =>
        {
            var b = Buf(1.6f);
            float[] notes = { D4, Fs4, A4, D5, Fs5 };
            for (var i = 0; i < notes.Length; i++) Synth.Pluck(b, At(i * 0.085f), M(notes[i]), 0.45f, 1.4f, 0.75f, 0.6f, (uint)(60 + i));
            Synth.Bell(b, At(0.42f), M(A5), 0.18f, 1.1f);
            return Synth.Master(b, 0.65f);
        },
        ["defeat"] = () =>
        {
            var b = Buf(2.6f);
            Synth.Gong(b, 0, 64, 0.8f, 2.5f, 58);
            float[] notes = { A4, Fs4, D4 };
            for (var i = 0; i < notes.Length; i++) Synth.Pluck(b, At(0.3f + i * 0.22f), M(notes[i] - 12), 0.4f, 1.6f, 0.4f, 0.7f, (uint)(65 + i));
            return Synth.Master(b, 0.7f);
        },
        ["escape"] = () =>
        {
            var b = Buf(0.8f);
            Synth.Whoosh(b, 0, 0.4f, 0.8f, 900, 4200, 1f, 59, 0.2f);
            Synth.Pluck(b, At(0.15f), M(A5), 0.35f, 0.6f, 0.7f, 0.4f, 70);
            Synth.Pluck(b, At(0.27f), M(E5), 0.35f, 0.6f, 0.7f, 0.4f, 71);
            return Synth.Master(b, 0.5f);
        },

        // ---------------------------------------------------------------- the breakthrough trial
        ["mote"] = () =>
        {
            var b = Buf(0.6f);
            Synth.Bell(b, 0, M(A5), 0.5f, 0.5f);
            return Synth.Master(b, 0.45f);
        },
        ["demon"] = () =>
        {
            var b = Buf(0.6f);
            Synth.Tone(b, 0, 55, 0.7f, 0.55f, 0.02f, 0.25f, 44);
            Synth.Tone(b, 0, 58.5f, 0.6f, 0.55f, 0.02f, 0.25f, 46);
            Synth.Whoosh(b, 0, 0.5f, 0.6f, 240, 120, 2f, 72, 0.2f);
            return Synth.Master(b, 0.7f);
        },

        // ---------------------------------------------------------------- interface
        ["click"] = () =>
        {
            var b = Buf(0.06f);
            Synth.Tone(b, 0, 1750, 0.5f, 0.04f, 0.001f, 0.01f);
            Synth.Hit(b, 0, 0.015f, 0.3f, 4000, 73);
            return Synth.Master(b, 0.3f);
        },
        ["open"] = () =>
        {
            var b = Buf(0.7f);
            Synth.Pluck(b, 0, M(A4), 0.4f, 0.6f, 0.5f, 0.35f, 74);
            Synth.Pluck(b, At(0.06f), M(E5), 0.3f, 0.6f, 0.5f, 0.35f, 75);
            return Synth.Master(b, 0.35f);
        },
        ["close"] = () =>
        {
            var b = Buf(0.5f);
            Synth.Pluck(b, 0, M(E5), 0.3f, 0.45f, 0.4f, 0.3f, 76);
            Synth.Pluck(b, At(0.05f), M(A4), 0.3f, 0.45f, 0.4f, 0.3f, 77);
            return Synth.Master(b, 0.28f);
        },
        ["chime"] = () =>
        {
            var b = Buf(1.2f);
            Synth.Bell(b, 0, M(D6), 0.4f, 1.1f);
            Synth.Bell(b, At(0.12f), M(A5), 0.3f, 1f);
            return Synth.Master(b, 0.5f);
        },
        ["warn"] = () =>
        {
            var b = Buf(0.9f);
            Synth.Pluck(b, 0, M(B4 - 12), 0.5f, 0.8f, 0.4f, 0.5f, 78);
            Synth.Pluck(b, At(0.14f), M(Fs4 - 12), 0.5f, 0.8f, 0.4f, 0.5f, 79);
            return Synth.Master(b, 0.45f);
        },
    };
}
