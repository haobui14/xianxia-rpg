using System;
using System.Collections.Generic;
using System.Text;

namespace TuTien.Core
{
    /// <summary>
    /// PCG32 (XSH-RR). Small, fast, and — unlike System.Random — guaranteed to produce
    /// the same sequence on every runtime, which keeps seeded worlds and replays stable.
    /// </summary>
    public sealed class Pcg32
    {
        private ulong _state;
        private readonly ulong _inc;

        public Pcg32(ulong seed, ulong stream = 0xDA3E39CB94B95BDBUL)
        {
            _state = 0;
            _inc = (stream << 1) | 1UL;
            NextUInt();
            _state = unchecked(_state + seed);
            NextUInt();
        }

        public uint NextUInt()
        {
            var old = _state;
            _state = unchecked(old * 6364136223846793005UL + _inc);
            var xorShifted = (uint)(((old >> 18) ^ old) >> 27);
            var rot = (int)(old >> 59);
            return (xorShifted >> rot) | (xorShifted << ((-rot) & 31));
        }

        /// <summary>Uniform double in [0, 1).</summary>
        public double NextDouble() => NextUInt() * (1.0 / 4294967296.0);

        /// <summary>Uniform integer in [min, max], both inclusive.</summary>
        public int Range(int minInclusive, int maxInclusive)
        {
            if (maxInclusive < minInclusive) (minInclusive, maxInclusive) = (maxInclusive, minInclusive);
            var span = (uint)(maxInclusive - minInclusive) + 1u;
            if (span == 0) return minInclusive + (int)NextUInt(); // full 32-bit range
            var threshold = (uint)(-span) % span; // rejection sampling removes modulo bias
            while (true)
            {
                var r = NextUInt();
                if (r >= threshold) return minInclusive + (int)(r % span);
            }
        }

        public double Range(double min, double max) => min + NextDouble() * (max - min);

        public bool Chance(double probability) => NextDouble() < probability;

        public T Pick<T>(IReadOnlyList<T> items)
        {
            if (items.Count == 0) throw new InvalidOperationException("Cannot pick from an empty list");
            return items[Range(0, items.Count - 1)];
        }

        /// <summary>Index chosen proportionally to non-negative weights; -1 when all weights are zero.</summary>
        public int WeightedIndex(IReadOnlyList<double> weights)
        {
            double total = 0;
            foreach (var w in weights) total += Math.Max(0, w);
            if (total <= 0) return -1;
            var roll = NextDouble() * total;
            for (var i = 0; i < weights.Count; i++)
            {
                roll -= Math.Max(0, weights[i]);
                if (roll < 0) return i;
            }
            return weights.Count - 1;
        }

        public void Shuffle<T>(IList<T> list)
        {
            for (var i = list.Count - 1; i > 0; i--)
            {
                var j = Range(0, i);
                (list[i], list[j]) = (list[j], list[i]);
            }
        }
    }

    public static class Seeds
    {
        /// <summary>FNV-1a 64-bit over UTF-8 — stable across platforms and runtimes.</summary>
        public static ulong Hash(string text)
        {
            const ulong offset = 14695981039346656037UL;
            const ulong prime = 1099511628211UL;
            var hash = offset;
            foreach (var b in Encoding.UTF8.GetBytes(text))
            {
                hash ^= b;
                hash = unchecked(hash * prime);
            }
            return hash;
        }

        /// <summary>
        /// Independent RNG stream for one purpose ("npc-tick", "loot:enc_12", …) in one month,
        /// so adding a roll in one system never shifts the rolls of another.
        /// </summary>
        public static Pcg32 Stream(ulong worldSeed, string purpose, long salt = 0)
        {
            var seed = worldSeed ^ Hash(purpose) ^ unchecked((ulong)salt * 0x9E3779B97F4A7C15UL);
            return new Pcg32(seed, Hash(purpose + "#stream"));
        }
    }
}
