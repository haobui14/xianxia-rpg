using System;
using System.Collections.Generic;
using System.Linq;

namespace TuTienLuc.Audio;

/// <summary>
/// Generative music in the pentatonic modes of Chinese music, played on the synthesized guzheng, dizi,
/// drums, bells and gong. Each piece is composed from a seed (so it's the same every run), rendered
/// once, and loops seamlessly: continuous voices complete whole cycles over the loop and ringing
/// tails fold back onto the start.
/// </summary>
public static class Composer
{
    // Modes as semitones above D.
    private static readonly int[] Gong = { 0, 2, 4, 7, 9 };   // cung: D E F# A B — open, bright
    private static readonly int[] Shang = { 0, 2, 5, 7, 10 }; // thương: D E G A C — suspended, searching
    private static readonly int[] Yu = { 0, 3, 5, 7, 10 };    // vũ: D F G A C — minor, tense

    private const int D = 62; // D4

    public static float[] Explore() => Melodic(seed: 11, bpm: 72, bars: 16, mode: Gong, low: 62, high: 86, density: 0.55f, flute: true, bells: 0.3f);
    public static float[] Title() => Melodic(seed: 23, bpm: 64, bars: 12, mode: Gong, low: 64, high: 86, density: 0.4f, flute: true, bells: 0.5f);
    public static float[] Realm() => Melodic(seed: 37, bpm: 60, bars: 16, mode: Shang, low: 57, high: 81, density: 0.38f, flute: true, bells: 0.9f);

    private static List<int> Scale(int[] mode, int low, int high)
    {
        var notes = new List<int>();
        for (var m = low; m <= high; m++)
            if (mode.Contains(((m - D) % 12 + 12) % 12)) notes.Add(m);
        return notes;
    }

    /// <summary>A continuous frequency adjusted to complete whole cycles over the loop (no click at the seam).</summary>
    private static float Cyclic(float freq, float seconds) => MathF.Max(1, MathF.Round(freq * seconds)) / seconds;

    private static void Drone(float[] buf, float seconds, float[] midis, float amp, float breathePeriod)
    {
        var length = Synth.Samples(seconds);
        var voices = new List<(float f, float a)>();
        foreach (var m in midis)
        {
            var f = Synth.Midi(m);
            voices.Add((Cyclic(f, seconds), amp));
            // A second voice a hair apart for a slow chorus.
            voices.Add(((MathF.Round(f * seconds) + MathF.Max(1, MathF.Round(0.25f * seconds))) / seconds, amp * 0.6f));
        }
        var lfo = Cyclic(1 / breathePeriod, seconds);
        for (var i = 0; i < length; i++)
        {
            var t = i / (float)Synth.Rate;
            var breathe = 0.75f + 0.25f * MathF.Sin(MathF.Tau * lfo * t);
            var v = 0f;
            foreach (var (f, a) in voices) v += MathF.Sin(MathF.Tau * f * t) * a;
            buf[i] += v * breathe;
        }
    }

    // ================================================================ melodic pieces (explore, title, realm)

    private static readonly float[][] Rhythms =
    {
        new[] { 1f, 0.5f, 0.5f, 1f, 1f, 2f, -2f },
        new[] { 1.5f, 0.5f, 1f, 1f, 3f, -1f },
        new[] { 0.5f, 0.5f, 1f, 2f, 0.5f, 0.5f, 1f, -2f },
        new[] { 2f, 1f, 1f, 2f, -2f },
        new[] { 1f, 1f, 0.5f, 0.5f, 0.5f, 0.5f, 3f, -1f },
        new[] { 3f, 1f, 2f, -2f },
        new[] { 1f, -1f, 1f, 1f, 4f },
    };

    private static float[] Melodic(int seed, float bpm, int bars, int[] mode, int low, int high, float density, bool flute, float bells)
    {
        var rng = new Random(seed);
        var beat = 60f / bpm;
        var seconds = bars * 4 * beat;
        var loop = Synth.Samples(seconds);
        var buf = new float[loop + Synth.Samples(6)];
        var notes = Scale(mode, low, high);
        var stable = notes.Where(n => ((n - D) % 12 + 12) % 12 is 0 or 7).ToList();
        uint voice = (uint)seed * 1000;

        Drone(buf, seconds, new[] { D - 24f, D - 17f, D - 12f }, 0.026f, 4 * 4 * beat);

        // Bass: the root of each bar, plucked low, sometimes answered by its fifth.
        int[] roots = mode == Gong ? new[] { 0, 0, 7, 7, 9, 9, 7, 7, 0, 0, 7, 7, 2, 2, 7, 0 } : new[] { 0, 0, 7, 7, 5, 5, 7, 7, 0, 0, 10, 10, 5, 5, 7, 0 };
        for (var bar = 0; bar < bars; bar++)
        {
            var r = roots[bar % roots.Length];
            var bass = D - 12 + r - (r > 5 ? 12 : 0);
            Synth.Pluck(buf, Synth.Samples(bar * 4 * beat), Synth.Midi(bass), 0.3f, 4 * beat + 1.5f, 0.45f, 0.75f, voice++);
            if (rng.NextDouble() < 0.5)
                Synth.Pluck(buf, Synth.Samples((bar * 4 + 2) * beat), Synth.Midi(bass + 7), 0.16f, 2 * beat + 1f, 0.4f, 0.6f, voice++);
        }

        // Melody: two-bar phrases walking the scale, resting on stable tones, with guzheng ornaments.
        var index = notes.IndexOf(stable.OrderBy(n => Math.Abs(n - (low + high) / 2)).First());
        for (var phrase = 0; phrase < bars / 2; phrase++)
        {
            var sectionB = phrase >= bars / 4;
            var center = notes.Count / 2 + (sectionB ? 3 : 0);
            var pool = density > 0.5f ? Rhythms : Rhythms.Where(r => r.Length <= 6).ToArray();
            var rhythm = pool[rng.Next(pool.Length)];
            var t = phrase * 8 * beat;
            // A sweep up the strings (quát tấu) opens each section.
            if (phrase % 4 == 0)
            {
                var target = notes[Math.Clamp(index, 0, notes.Count - 1)];
                var run = notes.Where(n => n < target).TakeLast(9).ToList();
                for (var k = 0; k < run.Count; k++)
                    Synth.Pluck(buf, Synth.Samples(t - (run.Count - k) * 0.035f + beat * 0.5f), Synth.Midi(run[k]), 0.07f + k * 0.012f, 1.2f, 0.8f, 0.3f, voice++);
                t += beat * 0.5f;
            }
            var lastIndex = rhythm.Length - 1;
            while (lastIndex >= 0 && rhythm[lastIndex] < 0) lastIndex--;
            for (var i = 0; i < rhythm.Length; i++)
            {
                var len = rhythm[i];
                if (len < 0)
                {
                    t += -len * beat;
                    continue;
                }
                var step = rng.Next(9) switch { 0 => -2, 1 or 2 or 3 => -1, 4 => 0, 5 or 6 or 7 => 1, _ => 2 };
                // Drift back toward the middle of the range.
                if (index > center + 3) step = Math.Min(step, 0);
                if (index < center - 3) step = Math.Max(step, 0);
                index = Math.Clamp(index + step, 0, notes.Count - 1);
                if (i == lastIndex)
                {
                    // Phrases come to rest on D or A.
                    var here = notes[index];
                    index = notes.IndexOf(stable.OrderBy(n => Math.Abs(n - here)).First());
                }
                var note = notes[index];
                var amp = 0.3f + (float)rng.NextDouble() * 0.08f + (Math.Abs(t / beat % 4) < 0.01f ? 0.05f : 0);
                var start = Synth.Samples(t);
                // Grace note from the string above (ỷ âm).
                if (len >= 1 && rng.NextDouble() < 0.25 && index + 1 < notes.Count)
                    Synth.Pluck(buf, start - Synth.Samples(0.07f), Synth.Midi(notes[index + 1]), amp * 0.45f, 0.6f, 0.7f, 0.3f, voice++);
                Synth.Pluck(buf, start, Synth.Midi(note), amp, Math.Min(len * beat + 1.6f, 4.5f), 0.72f, 0.55f, voice++);
                // Tremolo (dao chỉ) on a long note.
                if (len >= 2 && rng.NextDouble() < 0.3)
                {
                    var step8 = beat / 4;
                    for (var k = 1; k < (int)(len * 4 * 0.75f); k++)
                        Synth.Pluck(buf, start + Synth.Samples(k * step8), Synth.Midi(note), amp * (0.42f - k * 0.01f), 0.5f, 0.6f, 0.3f, voice++);
                }
                t += len * beat;
            }
        }

        // A bamboo flute answers in the second half.
        if (flute)
        {
            for (var bar = bars / 2; bar < bars - 2; bar += 2)
            {
                if (rng.NextDouble() > 0.8) continue;
                var note = stable[rng.Next(stable.Count)];
                while (note > 76) note -= 12;
                var len = (3 + rng.Next(3)) * beat;
                Synth.Flute(buf, Synth.Samples((bar * 4 + 1) * beat), Synth.Midi(note), 0.075f, len, (uint)(voice++));
            }
        }

        // Temple bells, far away.
        for (var bar = 0; bar < bars; bar += 4)
        {
            if (rng.NextDouble() > bells) continue;
            var note = rng.NextDouble() < 0.5 ? D + 24 : D + 19;
            Synth.Bell(buf, Synth.Samples((bar * 4 + rng.Next(4)) * beat), Synth.Midi(note), 0.06f, 3.5f);
        }

        return Synth.Master(Synth.Wrap(buf, loop), 0.8f);
    }

    // ================================================================ battle

    public static float[] Battle()
    {
        const int bars = 16;
        const float bpm = 132;
        var rng = new Random(47);
        var beat = 60f / bpm;
        var eighth = beat / 2;
        var seconds = bars * 4 * beat;
        var loop = Synth.Samples(seconds);
        var buf = new float[loop + Synth.Samples(4)];
        uint voice = 47000;
        var notes = Scale(Yu, 62, 86);

        Drone(buf, seconds, new[] { D - 24f, D - 17f }, 0.03f, 2 * 4 * beat);

        int[] ostinato = { 50, 50, 57, 50, 53, 50, 57, 60 };
        for (var bar = 0; bar < bars; bar++)
        {
            var bar0 = bar * 4 * beat;
            var lift = bar is >= 8 and < 12 ? 5 : 0;
            for (var e = 0; e < 8; e++)
            {
                var at = Synth.Samples(bar0 + e * eighth);
                // Taiko: big drum on 1, the "and" of 2, and 3's "and"; the small drum answers.
                if (e is 0 or 3 or 5) Synth.Drum(buf, at, 100, 45, e == 0 ? 0.95f : 0.75f, 0.45f, 0.45f, voice++);
                if (e is 2 or 6) Synth.Drum(buf, at, 210, 125, 0.4f, 0.18f, 0.8f, voice++);
                if (e == 7 && rng.NextDouble() < 0.5) Synth.Drum(buf, at, 210, 125, 0.22f, 0.12f, 0.8f, voice++);
                if (e % 2 == 1) Synth.Tone(buf, at, 1900, 0.09f, 0.03f, 0.001f, 0.01f);
                // Palm-muted guzheng ostinato.
                Synth.Pluck(buf, at, Synth.Midi(ostinato[e] + lift), 0.2f, 0.45f, 0.85f, 0.15f, voice++);
            }
            // A drum roll leads into every fourth bar.
            if (bar % 4 == 3)
                for (var k = 0; k < 4; k++)
                    Synth.Drum(buf, Synth.Samples(bar0 + 3 * beat + k * eighth / 2), 190, 120, 0.25f + k * 0.08f, 0.12f, 0.8f, voice++);
        }

        // The fight's motif: short, clipped phrases up high, more restless in the second half.
        var index = notes.Count / 2;
        for (var phrase = 0; phrase < bars / 2; phrase++)
        {
            var t = phrase * 8 * beat + beat;
            var count = phrase >= bars / 4 ? 7 : 5;
            for (var i = 0; i < count; i++)
            {
                var step = rng.Next(5) - 2;
                index = Math.Clamp(index + step, 2, notes.Count - 1);
                var len = i == count - 1 ? 1.5f : rng.NextDouble() < 0.6 ? 0.5f : 0.25f;
                Synth.Pluck(buf, Synth.Samples(t), Synth.Midi(notes[index]), 0.28f, len * beat + 0.8f, 0.85f, 0.4f, voice++);
                t += len * beat;
            }
        }

        // Cymbal crashes where the sections turn.
        foreach (var bar in new[] { 0, 8 })
        {
            Synth.Whoosh(buf, Synth.Samples(bar * 4 * beat), 2.4f, 0.22f, 6500, 4200, 0.8f, (uint)(voice++), 0.01f);
            Synth.Gong(buf, Synth.Samples(bar * 4 * beat), 150, 0.25f, 2f, voice++);
        }

        return Synth.Master(Synth.Wrap(buf, loop), 0.85f);
    }

    // ================================================================ the breakthrough trial

    public static float[] Trial()
    {
        const int bars = 12;
        const float bpm = 60;
        var rng = new Random(59);
        var beat = 60f / bpm;
        var seconds = bars * 4 * beat;
        var loop = Synth.Samples(seconds);
        var buf = new float[loop + Synth.Samples(6)];
        uint voice = 59000;
        var bellNotes = Scale(Gong, 74, 90);

        Synth.Gong(buf, 0, 88, 0.7f, 5.5f, voice++);
        Drone(buf, seconds, new[] { D - 24f, D - 17f, D - 12f, D - 5f }, 0.03f, 16 * beat);

        // A heartbeat under everything: lub-dub, once a second.
        for (var b = 0; b < bars * 4; b++)
        {
            var at = b * beat;
            Synth.Drum(buf, Synth.Samples(at), 62, 44, 0.32f, 0.2f, 0.15f, voice++);
            Synth.Drum(buf, Synth.Samples(at + 0.28f), 58, 42, 0.22f, 0.18f, 0.1f, voice++);
        }

        // Bells drift in and out like motes of qi.
        var tb = 1.5f;
        while (tb < seconds - 1)
        {
            var note = bellNotes[rng.Next(bellNotes.Count)];
            Synth.Bell(buf, Synth.Samples(tb), Synth.Midi(note), 0.1f + (float)rng.NextDouble() * 0.06f, 3f);
            tb += 1.4f + (float)rng.NextDouble() * 1.8f;
        }

        // Slow breaths of wind.
        for (var k = 0; k < bars / 2; k++)
            Synth.Whoosh(buf, Synth.Samples(k * 8 * beat + 1), 6f, 0.05f, 260, 620, 3f, voice++, 0.5f);

        return Synth.Master(Synth.Wrap(buf, loop), 0.72f);
    }
}
