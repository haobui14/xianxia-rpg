using System;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace TuTien.Core
{
    /// <summary>
    /// One JSON configuration for content files and saves: snake_case properties (matching
    /// the web game's content), Vietnamese realm/element spellings, readable Unicode output.
    /// </summary>
    public static class GameJson
    {
        public static readonly JsonSerializerOptions Options = Create(indented: false);
        public static readonly JsonSerializerOptions Indented = Create(indented: true);

        private static JsonSerializerOptions Create(bool indented)
        {
            var options = new JsonSerializerOptions
            {
                PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
                DictionaryKeyPolicy = null,
                PropertyNameCaseInsensitive = true,
                ReadCommentHandling = JsonCommentHandling.Skip,
                AllowTrailingCommas = true,
                WriteIndented = indented,
                DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
                NumberHandling = JsonNumberHandling.AllowReadingFromString,
                Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
            };
            options.Converters.Add(new RealmConverter());
            options.Converters.Add(new BodyRealmConverter());
            options.Converters.Add(new ElementConverter());
            options.Converters.Add(new RootGradeConverter());
            options.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower));
            return options;
        }

        /// <summary>Reads the <c>data</c> member of a content envelope <c>{ "$source": …, "data": … }</c>.</summary>
        public static T ReadEnvelope<T>(string json, string fileName)
        {
            try
            {
                using var doc = JsonDocument.Parse(json, new JsonDocumentOptions
                {
                    CommentHandling = JsonCommentHandling.Skip,
                    AllowTrailingCommas = true,
                });
                var root = doc.RootElement;
                var data = root.ValueKind == JsonValueKind.Object && root.TryGetProperty("data", out var d) ? d : root;
                var value = data.Deserialize<T>(Options);
                if (value == null) throw new FormatException("content is null");
                return value;
            }
            catch (Exception ex)
            {
                throw new FormatException($"{fileName}: {ex.Message}", ex);
            }
        }

        private sealed class RealmConverter : JsonConverter<Realm>
        {
            public override Realm Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
                Names.ParseRealm(reader.GetString() ?? "");
            public override void Write(Utf8JsonWriter writer, Realm value, JsonSerializerOptions options) =>
                writer.WriteStringValue(Names.Id(value));
        }

        private sealed class BodyRealmConverter : JsonConverter<BodyRealm>
        {
            public override BodyRealm Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
                Names.ParseBodyRealm(reader.GetString() ?? "");
            public override void Write(Utf8JsonWriter writer, BodyRealm value, JsonSerializerOptions options) =>
                writer.WriteStringValue(Names.Id(value));
        }

        private sealed class ElementConverter : JsonConverter<Element>
        {
            public override Element Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
                Names.ParseElement(reader.GetString() ?? "");
            public override void Write(Utf8JsonWriter writer, Element value, JsonSerializerOptions options) =>
                writer.WriteStringValue(Names.Id(value));
        }

        private sealed class RootGradeConverter : JsonConverter<RootGrade>
        {
            public override RootGrade Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
                Names.ParseGrade(reader.GetString() ?? "");
            public override void Write(Utf8JsonWriter writer, RootGrade value, JsonSerializerOptions options) =>
                writer.WriteStringValue(Names.Id(value));
        }
    }
}
