using System;
using Godot;

namespace TuTienLuc.Audio;

/// <summary>
/// A tiny offline synthesizer: every sound in the game is rendered from code into a float buffer
/// (mono, <see cref="Rate"/> Hz) and wrapped in an <see cref="AudioStreamWav"/>. The voices are chosen
/// for the setting: a plucked string (Karplus–Strong, guzheng/pipa-like), bells and gongs from
/// inharmonic partials, a breathy bamboo flute, drums with a falling pitch, and filtered-noise whooshes.
/// Everything is deterministic (seeded noise), so a sound is the same on every run.
/// </summary>
public static class Synth
{
    public const int Rate = 22050;
    private const float Tau = MathF.PI * 2;

    public static int Samples(float seconds) => (int)(seconds * Rate);
    public static float Midi(float note) => 440f * MathF.Pow(2, (note - 69) / 12f);

    /// <summary>Wrap a buffer as a 16-bit mono stream (optionally looping over its whole length).</summary>
    public static AudioStreamWav ToStream(float[] samples, bool loop = false)
    {
        var bytes = new byte[samples.Length * 2];
        for (var i = 0; i < samples.Length; i++)
        {
            var v = (short)Math.Clamp((int)(samples[i] * 32767f), short.MinValue, short.MaxValue);
            bytes[i * 2] = (byte)(v & 0xff);
            bytes[i * 2 + 1] = (byte)((v >> 8) & 0xff);
        }
        var stream = new AudioStreamWav { Format = AudioStreamWav.FormatEnum.Format16Bits, MixRate = Rate, Stereo = false, Data = bytes };
        if (loop)
        {
            stream.LoopMode = AudioStreamWav.LoopModeEnum.Forward;
            stream.LoopBegin = 0;
            stream.LoopEnd = samples.Length;
        }
        return stream;
    }

    /// <summary>Deterministic white noise in [-1, 1] (xorshift).</summary>
    public sealed class Noise
    {
        private uint _s;
        public Noise(uint seed) => _s = seed * 2654435761u | 1;

        public float Next()
        {
            _s ^= _s << 13;
            _s ^= _s >> 17;
            _s ^= _s << 5;
            return _s / (float)uint.MaxValue * 2 - 1;
        }
    }

    private static void Add(float[] buf, int i, float v)
    {
        if (i >= 0 && i < buf.Length) buf[i] += v;
    }

    // ================================================================ voices

    /// <summary>
    /// Karplus–Strong plucked string with fractional-delay tuning. <paramref name="brightness"/> 0..1 shapes
    /// the pick (a soft finger or a sharp nail); <paramref name="sustain"/> 0..1 sets how long it rings.
    /// </summary>
    public static void Pluck(float[] buf, int start, float freq, float amp, float seconds, float brightness = 0.6f, float sustain = 0.6f, uint seed = 1)
    {
        // Loop: delay line → one-zero low-pass y = (1−S)x + S·x[n−1] (delay ≈ S) → all-pass for the
        // fractional part of the period, so every note is in tune.
        const float stretch = 0.3f;
        var total = Rate / freq - stretch;
        var n = (int)MathF.Floor(total);
        var frac = total - n;
        if (frac < 0.1f && n > 2)
        {
            n -= 1;
            frac += 1;
        }
        if (n < 2) return;
        var c = (1 - frac) / (1 + frac);
        var line = new float[n];
        var noise = new Noise(seed);
        float prev = 0;
        for (var i = 0; i < n; i++)
        {
            // A softer pick is a low-passed excitation.
            var x = noise.Next();
            prev += (x - prev) * (0.25f + 0.75f * brightness);
            line[i] = prev;
        }
        // Ring time (to −60 dB): long for low strings, shorter up high; the low-pass also takes its share.
        var t60 = MathF.Max(0.5f, 4.2f - MathF.Log2(MathF.Max(freq, 50) / 100f) * 0.9f) * (0.5f + sustain);
        var w = Tau * freq / Rate;
        var lowpass = MathF.Sqrt((1 - stretch) * (1 - stretch) + stretch * stretch + 2 * stretch * (1 - stretch) * MathF.Cos(w));
        var decay = MathF.Min(0.99995f, MathF.Pow(0.001f, 1f / (freq * t60)) / lowpass);
        var length = Math.Min(Samples(seconds), buf.Length - start);
        float lastIn = 0, apX = 0, apY = 0;
        var p = 0;
        for (var i = 0; i < length; i++)
        {
            var s = line[p];
            var avg = ((1 - stretch) * s + stretch * lastIn) * decay;
            lastIn = s;
            var ap = c * avg + apX - c * apY;
            apX = avg;
            apY = ap;
            line[p] = ap;
            p = p + 1 == n ? 0 : p + 1;
            // A short fade at the end so a note never clicks off.
            var tail = length - i < 400 ? (length - i) / 400f : 1f;
            Add(buf, start + i, s * amp * tail);
        }
    }

    /// <summary>A sine with an attack, an exponential decay and an optional glide toward <paramref name="freqEnd"/>.</summary>
    public static void Tone(float[] buf, int start, float freq, float amp, float seconds, float attack = 0.005f, float decay = 0.3f, float freqEnd = 0, float vibrato = 0)
    {
        var length = Samples(seconds);
        float phase = 0;
        var end = freqEnd <= 0 ? freq : freqEnd;
        for (var i = 0; i < length; i++)
        {
            var t = i / (float)Rate;
            var k = t / seconds;
            var f = freq * MathF.Pow(end / freq, k) * (1 + vibrato * MathF.Sin(Tau * 5.2f * t) * MathF.Min(1, t * 3));
            phase += Tau * f / Rate;
            var env = t < attack ? t / attack : MathF.Exp(-(t - attack) / decay);
            var tail = length - i < 200 ? (length - i) / 200f : 1f;
            Add(buf, start + i, MathF.Sin(phase) * amp * env * tail);
        }
    }

    /// <summary>A struck bell or chime: inharmonic partials, each ringing for its own time.</summary>
    public static void Bell(float[] buf, int start, float freq, float amp, float seconds)
    {
        float[] ratios = { 1f, 2.76f, 5.40f, 8.93f, 0.5f };
        float[] levels = { 1f, 0.45f, 0.25f, 0.12f, 0.2f };
        float[] decays = { 1f, 0.55f, 0.3f, 0.18f, 1.4f };
        for (var p = 0; p < ratios.Length; p++)
        {
            var f = freq * ratios[p];
            if (f > Rate / 2.2f) continue;
            Tone(buf, start, f, amp * levels[p], seconds, 0.002f, seconds * 0.35f * decays[p]);
        }
    }

    /// <summary>A gong: low inharmonic partials with a slow shimmer and a long, breathing decay.</summary>
    public static void Gong(float[] buf, int start, float freq, float amp, float seconds, uint seed = 7)
    {
        float[] ratios = { 1f, 1.52f, 2.03f, 2.71f, 3.44f, 4.16f, 5.33f };
        float[] levels = { 1f, 0.7f, 0.55f, 0.4f, 0.3f, 0.2f, 0.12f };
        var length = Samples(seconds);
        var noise = new Noise(seed);
        for (var p = 0; p < ratios.Length; p++)
        {
            var f = freq * ratios[p];
            float phase = noise.Next() * Tau;
            var decay = seconds * (0.5f - p * 0.05f);
            for (var i = 0; i < length; i++)
            {
                var t = i / (float)Rate;
                // The pitch sags a little after the strike, like a real tam-tam.
                var ff = f * (1 + 0.012f * MathF.Exp(-t * 3));
                phase += Tau * ff / Rate;
                var swell = 1 + 0.25f * MathF.Sin(Tau * (0.6f + p * 0.37f) * t);
                var env = MathF.Min(1, t / 0.01f) * MathF.Exp(-t / decay);
                var tail = length - i < 400 ? (length - i) / 400f : 1f;
                Add(buf, start + i, MathF.Sin(phase) * amp * levels[p] * env * swell * tail * 0.4f);
            }
        }
        // The mallet.
        Hit(buf, start, 0.05f, amp * 0.3f, 900, seed);
    }

    /// <summary>A drum: a sine falling from <paramref name="f0"/> to <paramref name="f1"/>, plus a skin slap.</summary>
    public static void Drum(float[] buf, int start, float f0, float f1, float amp, float seconds, float slap = 0.3f, uint seed = 3)
    {
        Tone(buf, start, f0, amp, seconds, 0.002f, seconds * 0.35f, f1);
        Hit(buf, start, 0.04f, amp * slap, 1800, seed);
    }

    /// <summary>A short burst of low-passed noise: a click, a slap, a footstep.</summary>
    public static void Hit(float[] buf, int start, float seconds, float amp, float cutoff, uint seed = 5)
    {
        var length = Samples(seconds);
        var noise = new Noise(seed);
        var a = 1 - MathF.Exp(-Tau * cutoff / Rate);
        float y = 0;
        for (var i = 0; i < length; i++)
        {
            y += (noise.Next() - y) * a;
            var env = MathF.Exp(-i / (float)length * 5);
            Add(buf, start + i, y * amp * env * 2);
        }
    }

    /// <summary>A whoosh: noise through a band-pass whose centre sweeps from <paramref name="fc0"/> to <paramref name="fc1"/>.</summary>
    public static void Whoosh(float[] buf, int start, float seconds, float amp, float fc0, float fc1, float q = 1.2f, uint seed = 9, float attack = 0.25f)
    {
        var length = Samples(seconds);
        var noise = new Noise(seed);
        // Zero-delay-feedback state-variable filter (stable at any cutoff, unlike the classic Chamberlin).
        float ic1 = 0, ic2 = 0;
        var k = 1 / q;
        for (var i = 0; i < length; i++)
        {
            var pos = i / (float)length;
            var fc = MathF.Min(fc0 * MathF.Pow(fc1 / fc0, pos), Rate * 0.45f);
            var g = MathF.Tan(MathF.PI * fc / Rate);
            var a1 = 1 / (1 + g * (g + k));
            var a2 = g * a1;
            var a3 = g * a2;
            var v3 = noise.Next() - ic2;
            var v1 = a1 * ic1 + a2 * v3;
            var v2 = ic2 + a2 * ic1 + a3 * v3;
            ic1 = 2 * v1 - ic1;
            ic2 = 2 * v2 - ic2;
            var env = pos < attack ? pos / attack : MathF.Pow(1 - (pos - attack) / (1 - attack), 1.6f);
            // The band-pass output, scaled up a little: a narrow band carries less energy than the noise.
            Add(buf, start + i, v1 * k * amp * env * 1.6f);
        }
    }

    /// <summary>A bamboo flute (dizi): a breathy sine with a gentle vibrato that grows as the note is held.</summary>
    public static void Flute(float[] buf, int start, float freq, float amp, float seconds, uint seed = 11)
    {
        var length = Samples(seconds);
        var noise = new Noise(seed);
        float phase = 0, breath = 0;
        for (var i = 0; i < length; i++)
        {
            var t = i / (float)Rate;
            var vib = 1 + 0.006f * MathF.Sin(Tau * 5.4f * t) * MathF.Min(1, t * 1.5f);
            phase += Tau * freq * vib / Rate;
            breath += (noise.Next() - breath) * 0.08f;
            var env = MathF.Min(1, t / 0.12f) * MathF.Min(1, (seconds - t) / 0.35f);
            var v = MathF.Sin(phase) + 0.18f * MathF.Sin(2 * phase) + 0.05f * MathF.Sin(3 * phase) + breath * 0.25f;
            Add(buf, start + i, v * amp * MathF.Max(0, env));
        }
    }

    // ================================================================ finishing

    /// <summary>Soft-clip and scale so the loudest point sits at <paramref name="peak"/>.</summary>
    public static float[] Master(float[] buf, float peak = 0.85f)
    {
        var max = 0f;
        foreach (var v in buf) max = MathF.Max(max, MathF.Abs(v));
        if (max < 1e-6f) return buf;
        var gain = 1.4f / max;
        for (var i = 0; i < buf.Length; i++) buf[i] = MathF.Tanh(buf[i] * gain) / MathF.Tanh(1.4f) * peak;
        return buf;
    }

    /// <summary>Fold the tail past <paramref name="length"/> back onto the start, so a loop plays seamlessly.</summary>
    public static float[] Wrap(float[] buf, int length)
    {
        var result = new float[length];
        for (var i = 0; i < buf.Length; i++) result[i % length] += buf[i];
        return result;
    }
}
