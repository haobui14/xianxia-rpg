using System.Text.Json;

namespace TuTien.Core.Tests;

/// <summary>
/// English is the game's own language and Vietnamese a full translation: a screen shows one of them, never a mix.
/// (The smoke test reads the screens themselves; these pin the rules and the content behind them.)
/// </summary>
public class LanguageTests
{
    [Fact]
    public void English_writes_names_inside_it_plain()
    {
        Assert.Equal("Lam Ba died by your hand.", Names.Pick(Locale.En, "Lâm Bá đã chết.", "Lâm Bá died by your hand."));
        Assert.Equal("Âu Dương Vũ Lạc", Names.Person("Âu Dương Vũ Lạc", Locale.Vi));
        Assert.Equal("Au Duong Vu Lac", Names.Person("Âu Dương Vũ Lạc", Locale.En));
        Assert.Equal("Duong", Names.Plain("Đường"));
    }

    [Fact]
    public void Plain_keeps_the_symbols_english_text_uses()
    {
        const string text = "Seclusion ×1.6 — qi +10% · 3 days… (≥ 50%) “Azure Cloud”";
        Assert.False(Names.HasVietnamese(text));
        Assert.Same(text, Names.Plain(text));
    }

    [Fact]
    public void Missing_english_falls_back_to_vietnamese_so_the_gap_shows()
    {
        Assert.Equal("Khách điếm", Names.Pick(Locale.En, "Khách điếm", ""));
        Assert.True(Names.HasVietnamese(Names.Pick(Locale.En, "Khách điếm", null)));
    }

    [Fact]
    public void A_new_life_starts_in_english()
    {
        Assert.Equal(Locale.En, new State.GameState().Locale);
        Assert.Equal(Locale.En, TestContent.NewEngine().State.Locale);
    }

    [Fact]
    public void Display_names_exist_in_both_languages()
    {
        foreach (var realm in Enum.GetValues<Realm>())
            Assert.False(Names.HasVietnamese(Names.Display(realm, Locale.En)), realm.ToString());
        foreach (var body in Enum.GetValues<BodyRealm>())
            Assert.False(Names.HasVietnamese(Names.Display(body, Locale.En)), body.ToString());
        foreach (var element in Enum.GetValues<Element>())
            Assert.False(Names.HasVietnamese(Names.Display(element, Locale.En)), element.ToString());
        foreach (var grade in Enum.GetValues<RootGrade>())
            Assert.False(Names.HasVietnamese(Names.Display(grade, Locale.En)), grade.ToString());
    }

    /// <summary>Content keys that are identifiers or lists no screen shows, not words for the player.</summary>
    private static readonly HashSet<string> NotShown = new()
    {
        "$source", "realm", "element", "elements", "unlock_realm", "recommended_realm", "realm_requirement", "type",
        "sect_types", "unique_resources", "surnames", "given_male", "given_female", "denylist",
    };

    [Fact]
    public void Every_word_of_content_has_an_english_twin()
    {
        var gaps = new List<string>();
        foreach (var file in Directory.EnumerateFiles(TestContent.ContentRoot, "*.json", SearchOption.AllDirectories))
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(file));
            Walk(doc.RootElement, Path.GetFileName(file), gaps);
        }
        Assert.True(gaps.Count == 0, "Vietnamese with no clean English twin:\n" + string.Join("\n", gaps.Take(40)));
    }

    private static void Walk(JsonElement node, string where, List<string> gaps)
    {
        if (node.ValueKind == JsonValueKind.Array)
        {
            var i = 0;
            foreach (var item in node.EnumerateArray()) Walk(item, $"{where}[{i++}]", gaps);
            return;
        }
        if (node.ValueKind != JsonValueKind.Object) return;
        foreach (var prop in node.EnumerateObject())
        {
            var key = prop.Name;
            var value = prop.Value;
            if (NotShown.Contains(key)) continue;
            if (key.EndsWith("_en"))
            {
                if (value.ValueKind == JsonValueKind.String && Names.HasVietnamese(value.GetString()!))
                    gaps.Add($"{where}.{key} is not English: {value.GetString()}");
                continue;
            }
            if (value.ValueKind == JsonValueKind.String)
            {
                var text = value.GetString()!;
                if (!Names.HasVietnamese(text)) continue;
                if (!node.TryGetProperty(key + "_en", out var twin) || twin.ValueKind != JsonValueKind.String || twin.GetString()!.Trim().Length == 0)
                    gaps.Add($"{where}.{key} has no English: {text}");
            }
            else if (value.ValueKind == JsonValueKind.Array && value.EnumerateArray().Any(v => v.ValueKind == JsonValueKind.String && Names.HasVietnamese(v.GetString()!)))
            {
                if (!node.TryGetProperty(key + "_en", out var twin) || twin.ValueKind != JsonValueKind.Array)
                    gaps.Add($"{where}.{key}[] has no English list");
            }
            else Walk(value, $"{where}.{key}", gaps);
        }
    }
}
