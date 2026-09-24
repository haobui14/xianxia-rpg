using System;
using System.Text;

namespace TuTien.Core
{
    /// <summary>
    /// Canonical spellings shared with the web game's content ("PhàmNhân", "Mộc", …)
    /// plus display names. Content strings are NFC-normalized before comparison.
    /// </summary>
    public static class Names
    {
        private static readonly string[] RealmIds = { "PhàmNhân", "LuyệnKhí", "TrúcCơ", "KếtĐan", "NguyênAnh" };
        private static readonly string[] RealmVi = { "Phàm Nhân", "Luyện Khí", "Trúc Cơ", "Kết Đan", "Nguyên Anh" };
        private static readonly string[] RealmEn =
        {
            "Mortal", "Qi Condensation", "Foundation Establishment", "Core Formation", "Nascent Soul",
        };

        private static readonly string[] BodyIds = { "PhàmThể", "LuyệnCốt", "ĐồngCân", "KimCương", "TháiCổ" };
        private static readonly string[] BodyVi = { "Phàm Thể", "Luyện Cốt", "Đồng Cân", "Kim Cương", "Thái Cổ" };
        private static readonly string[] BodyEn =
        {
            "Mortal Body", "Bone Forging", "Copper Tendon", "Diamond Body", "Primordial Body",
        };

        private static readonly string[] ElementIds = { "Kim", "Mộc", "Thủy", "Hỏa", "Thổ" };
        private static readonly string[] ElementEn = { "Metal", "Wood", "Water", "Fire", "Earth" };

        private static readonly string[] GradeIds = { "PhổThông", "Khá", "Hiếm", "ThiênPhẩm" };
        private static readonly string[] GradeVi = { "Phổ Thông", "Khá", "Hiếm", "Thiên Phẩm" };
        private static readonly string[] GradeEn = { "Common", "Uncommon", "Rare", "Heavenly" };

        /// <summary>
        /// The text for <paramref name="locale"/>. English never shows a Vietnamese letter: a name inside it is
        /// written plain ("Lâm Bá" → "Lam Ba"), the way English xianxia writes Chinese names without tones.
        /// A missing English text falls back to the Vietnamese one as it is, so the gap stays visible.
        /// </summary>
        public static string Pick(Locale locale, string vi, string? en) =>
            locale == Locale.En && !string.IsNullOrEmpty(en) ? Plain(en!) : vi;

        /// <summary>A person's name as shown in <paramref name="locale"/> (plain letters in English).</summary>
        public static string Person(string name, Locale locale) => locale == Locale.En ? Plain(name) : name;

        /// <summary>The text without Vietnamese marks, spaces kept ("Âu Dương" → "Au Duong").</summary>
        public static string Plain(string s)
        {
            if (!HasVietnamese(s)) return s;
            var decomposed = s.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(decomposed.Length);
            foreach (var ch in decomposed)
            {
                if (System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch) == System.Globalization.UnicodeCategory.NonSpacingMark) continue;
                sb.Append(ch == 'đ' ? 'd' : ch == 'Đ' ? 'D' : ch);
            }
            return sb.ToString().Normalize(NormalizationForm.FormC);
        }

        /// <summary>Whether the text holds an accented Latin letter (every Vietnamese diacritic, đ, ơ, ư).</summary>
        public static bool HasVietnamese(string s)
        {
            foreach (var ch in s)
            {
                if (ch < 'À') continue;
                if (ch <= 'ɏ' && ch != '×' && ch != '÷') return true; // Latin-1 letters and Latin Extended A/B, not × ÷
                if (ch >= '̀' && ch <= 'ͯ') return true;                   // combining marks
                if (ch >= 'Ḁ' && ch <= 'ỿ') return true;                   // Latin Extended Additional (ạ, ế, ữ …)
            }
            return false;
        }

        public static string Id(Realm realm) => RealmIds[(int)realm];
        public static string Display(Realm realm, Locale locale) =>
            locale == Locale.En ? RealmEn[(int)realm] : RealmVi[(int)realm];

        public static string Id(BodyRealm realm) => BodyIds[(int)realm];
        public static string Display(BodyRealm realm, Locale locale) =>
            locale == Locale.En ? BodyEn[(int)realm] : BodyVi[(int)realm];

        public static string Id(Element element) => ElementIds[(int)element];
        public static string Display(Element element, Locale locale) =>
            locale == Locale.En ? ElementEn[(int)element] : ElementIds[(int)element];

        public static string Id(RootGrade grade) => GradeIds[(int)grade];
        public static string Display(RootGrade grade, Locale locale) =>
            locale == Locale.En ? GradeEn[(int)grade] : GradeVi[(int)grade];

        public static Realm ParseRealm(string text) => (Realm)IndexOf(RealmIds, text, nameof(Realm));
        public static BodyRealm ParseBodyRealm(string text) => (BodyRealm)IndexOf(BodyIds, text, nameof(BodyRealm));
        public static Element ParseElement(string text) => (Element)IndexOf(ElementIds, text, nameof(Element));
        public static RootGrade ParseGrade(string text) => (RootGrade)IndexOf(GradeIds, text, nameof(RootGrade));

        public static bool TryParseElement(string? text, out Element element)
        {
            element = Element.Kim;
            if (string.IsNullOrEmpty(text)) return false;
            var i = Find(ElementIds, text!);
            if (i < 0) return false;
            element = (Element)i;
            return true;
        }

        private static int IndexOf(string[] ids, string text, string what)
        {
            var i = Find(ids, text);
            if (i < 0) throw new FormatException($"Unknown {what} '{text}'");
            return i;
        }

        private static int Find(string[] ids, string text)
        {
            var needle = Normalize(text);
            for (var i = 0; i < ids.Length; i++)
            {
                if (string.Equals(Normalize(ids[i]), needle, StringComparison.Ordinal)) return i;
            }
            // Also accept the enum spelling ("PhamNhan") so saves and tests can use plain ASCII.
            for (var i = 0; i < ids.Length; i++)
            {
                if (string.Equals(StripMarks(ids[i]), StripMarks(needle), StringComparison.OrdinalIgnoreCase)) return i;
            }
            return -1;
        }

        private static string Normalize(string s) => s.Normalize(NormalizationForm.FormC).Replace(" ", "");

        /// <summary>Removes Vietnamese diacritics ("Phàm Nhân" → "PhamNhan", "Đ" → "D").</summary>
        public static string StripMarks(string s)
        {
            var decomposed = s.Normalize(NormalizationForm.FormD);
            var sb = new StringBuilder(decomposed.Length);
            foreach (var ch in decomposed)
            {
                var cat = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(ch);
                if (cat == System.Globalization.UnicodeCategory.NonSpacingMark) continue;
                if (ch == ' ') continue;
                sb.Append(ch == 'đ' ? 'd' : ch == 'Đ' ? 'D' : ch);
            }
            return sb.ToString().Normalize(NormalizationForm.FormC);
        }
    }
}
