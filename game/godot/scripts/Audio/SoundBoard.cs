using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Godot;
using TuTien.Core;

namespace TuTienLuc.Audio;

/// <summary>
/// Plays the game's synthesized sound: effects (positional in the world, flat for the interface) and
/// music that crossfades between moods. Lives under the <c>Game</c> autoload, so it survives screen
/// changes. Everything is rendered from code on background threads; nothing is loaded from disk.
/// </summary>
public partial class SoundBoard : Node
{
    public static SoundBoard? I { get; private set; }

    public const string MusicBus = "Music";
    public const string SfxBus = "SFX";

    private readonly ConcurrentDictionary<string, float[]> _pcm = new();
    private readonly Dictionary<string, AudioStreamWav> _streams = new();
    private readonly Dictionary<string, ulong> _lastPlayed = new();
    private readonly List<AudioStreamPlayer> _flat = new();
    private readonly List<AudioStreamPlayer2D> _spatial = new();
    private int _flatNext, _spatialNext;

    private readonly ConcurrentDictionary<string, float[]> _musicPcm = new();
    private readonly Dictionary<string, AudioStreamWav> _music = new();
    private readonly HashSet<string> _rendering = new();
    private AudioStreamPlayer _musicA = null!, _musicB = null!;
    private bool _aPlaying;
    private string _mood = "";

    public string Mood => _mood;

    public override void _EnterTree() => I = this;

    public override void _Ready()
    {
        ProcessMode = ProcessModeEnum.Always;
        SetupBuses();
        for (var i = 0; i < 6; i++)
        {
            var p = new AudioStreamPlayer { Bus = SfxBus };
            AddChild(p);
            _flat.Add(p);
        }
        for (var i = 0; i < 20; i++)
        {
            var p = new AudioStreamPlayer2D { Bus = SfxBus, MaxDistance = 1500, Attenuation = 1.3f, PanningStrength = 0.7f };
            AddChild(p);
            _spatial.Add(p);
        }
        _musicA = new AudioStreamPlayer { Bus = MusicBus, VolumeDb = -60 };
        _musicB = new AudioStreamPlayer { Bus = MusicBus, VolumeDb = -60 };
        AddChild(_musicA);
        AddChild(_musicB);

        // Render every effect off the main thread now, so the first swing never hitches.
        Task.Run(() =>
        {
            foreach (var (name, recipe) in SfxLibrary.Recipes)
            {
                try
                {
                    _pcm[name] = recipe();
                }
                catch (Exception ex)
                {
                    GD.PushError($"[audio] could not render {name}: {ex.Message}");
                }
            }
        });
        ApplyVolumes();
    }

    public override void _ExitTree()
    {
        if (I == this) I = null;
        Silence();
        foreach (var s in _streams.Values.Concat(_music.Values)) s.Dispose();
        _streams.Clear();
        _music.Clear();
    }

    /// <summary>
    /// Stop every sound and let go of its stream (leaving the game: the audio thread needs a few frames
    /// to drop the playbacks, or the engine reports them as leaked at exit).
    /// </summary>
    public void Silence()
    {
        _mood = "";
        foreach (var p in new[] { _musicA, _musicB }.Concat(_flat))
        {
            p.Stop();
            p.Stream = null;
        }
        foreach (var p in _spatial)
        {
            p.Stop();
            p.Stream = null;
        }
    }

    private static void SetupBuses()
    {
        int Ensure(string name)
        {
            var index = AudioServer.GetBusIndex(name);
            if (index >= 0) return index;
            AudioServer.AddBus();
            index = AudioServer.BusCount - 1;
            AudioServer.SetBusName(index, name);
            AudioServer.SetBusSend(index, "Master");
            return index;
        }
        var music = Ensure(MusicBus);
        var sfx = Ensure(SfxBus);
        if (AudioServer.GetBusEffectCount(music) == 0)
            AudioServer.AddBusEffect(music, new AudioEffectReverb { RoomSize = 0.78f, Damping = 0.45f, Wet = 0.3f, Dry = 0.85f, Spread = 0.8f });
        if (AudioServer.GetBusEffectCount(sfx) == 0)
            AudioServer.AddBusEffect(sfx, new AudioEffectReverb { RoomSize = 0.35f, Damping = 0.6f, Wet = 0.12f, Dry = 1f });
        if (AudioServer.GetBusEffectCount(0) == 0)
            AudioServer.AddBusEffect(0, new AudioEffectHardLimiter { CeilingDb = -0.8f });
    }

    /// <summary>Apply the volumes from the settings (0..1 each).</summary>
    public void ApplyVolumes()
    {
        var g = Game.Instance;
        static float Db(float v) => v <= 0.001f ? -80 : Mathf.LinearToDb(v);
        AudioServer.SetBusVolumeDb(0, Db(g.MasterVolume));
        AudioServer.SetBusVolumeDb(AudioServer.GetBusIndex(MusicBus), Db(g.MusicVolume));
        AudioServer.SetBusVolumeDb(AudioServer.GetBusIndex(SfxBus), Db(g.SfxVolume));
    }

    // ================================================================ effects

    private AudioStreamWav? Stream(string name)
    {
        if (_streams.TryGetValue(name, out var s)) return s;
        if (!_pcm.TryGetValue(name, out var pcm))
        {
            // Not rendered yet (or asked for very early): render it now.
            if (!SfxLibrary.Recipes.TryGetValue(name, out var recipe)) return null;
            pcm = recipe();
            _pcm[name] = pcm;
        }
        s = Synth.ToStream(pcm);
        _streams[name] = s;
        return s;
    }

    /// <summary>Skip a sound fired again within a few milliseconds (ten hits in one frame are one hit).</summary>
    private bool Throttled(string name, int minMs)
    {
        var now = Time.GetTicksMsec();
        if (_lastPlayed.TryGetValue(name, out var last) && now - last < (ulong)minMs) return true;
        _lastPlayed[name] = now;
        return false;
    }

    private static float Jitter(float amount) => 1 + (GD.Randf() * 2 - 1) * amount;

    /// <summary>A sound with no place: the interface, a stinger.</summary>
    public static void Play(string name, float volumeDb = 0, float pitch = 1, float jitter = 0.03f, int throttleMs = 30)
    {
        var board = I;
        if (board == null || board.Throttled(name, throttleMs)) return;
        var stream = board.Stream(name);
        if (stream == null) return;
        var player = board._flat[board._flatNext++ % board._flat.Count];
        player.Stream = stream;
        player.VolumeDb = volumeDb;
        player.PitchScale = pitch * Jitter(jitter);
        player.Play();
    }

    /// <summary>A sound from somewhere in the world: quieter and panned with distance from the camera.</summary>
    public static void PlayAt(string name, Vector2 worldPos, float volumeDb = 0, float pitch = 1, float jitter = 0.06f, int throttleMs = 30)
    {
        var board = I;
        if (board == null || board.Throttled(name, throttleMs)) return;
        var stream = board.Stream(name);
        if (stream == null) return;
        var player = board._spatial[board._spatialNext++ % board._spatial.Count];
        player.Stream = stream;
        player.GlobalPosition = worldPos;
        player.VolumeDb = volumeDb;
        player.PitchScale = pitch * Jitter(jitter);
        player.Play();
    }

    /// <summary>One sound for what a command reported, the most significant one.</summary>
    public static void ForEvents(IEnumerable<GameEvent> events)
    {
        string? best = null;
        var rank = -1;
        foreach (var e in events)
        {
            var (sound, r) = e.Kind switch
            {
                "realm_up" or "body_up" or "sect_promotion" => ("breakthrough", 9),
                "death" => ("defeat", 9),
                "sect_join" or "realm_clear" or "bounty_done" or "mission_done" => ("victory", 8),
                "breakthrough_failed" or "defeated" => ("defeat", 8),
                "skill_learned" or "technique_learned" or "qi_awakened" => ("cast", 7),
                "stage_up" or "skill_level" or "breakthrough_ready" or "mission_ready" => ("chime", 6),
                "mission_failed" or "mission_abandoned" => ("warn", 6),
                "item_gained" => ("gather", 5),
                "bought" or "sold" or "silver" or "treasury" or "stipend" => ("coin", 5),
                "rested" or "healed" or "item_used" => ("heal", 5),
                "gift" or "gratitude" => ("open", 4),
                "fled" => ("escape", 4),
                "equipped" or "bounty_taken" or "mission_taken" => ("click", 3),
                _ => e.Level switch
                {
                    EventLevel.Major => ("chime", 2),
                    EventLevel.Warning => ("warn", 2),
                    _ => ((string?)null, -1),
                },
            };
            if (sound != null && r > rank)
            {
                best = sound;
                rank = r;
            }
        }
        if (best != null) Play(best);
    }

    // ================================================================ music

    /// <summary>Crossfade to a mood: "title", "explore", "battle", "trial" or "realm" ("" for silence).</summary>
    public static void Music(string mood)
    {
        var board = I;
        if (board == null || board._mood == mood) return;
        board._mood = mood;
        if (mood.Length == 0)
        {
            board.FadeOutMusic();
            return;
        }
        if (board.MusicStream(mood) is { } stream) board.Crossfade(stream);
    }

    private AudioStreamWav? MusicStream(string mood)
    {
        if (_music.TryGetValue(mood, out var s)) return s;
        if (_musicPcm.TryGetValue(mood, out var pcm))
        {
            s = Synth.ToStream(pcm, loop: true);
            _music[mood] = s;
            return s;
        }
        if (_rendering.Add(mood))
        {
            Task.Run(() =>
            {
                try
                {
                    _musicPcm[mood] = mood switch
                    {
                        "battle" => Composer.Battle(),
                        "trial" => Composer.Trial(),
                        "realm" => Composer.Realm(),
                        "title" => Composer.Title(),
                        _ => Composer.Explore(),
                    };
                }
                catch (Exception ex)
                {
                    GD.PushError($"[audio] could not compose {mood}: {ex.Message}");
                    return;
                }
                Callable.From(() => OnComposed(mood)).CallDeferred();
            });
        }
        return null;
    }

    private void OnComposed(string mood)
    {
        if (!IsInsideTree() || _mood != mood) return;
        if (MusicStream(mood) is { } stream) Crossfade(stream);
    }

    /// <summary>Compose the other moods in the background so a fight never starts in silence.</summary>
    public static void Prepare(params string[] moods)
    {
        var board = I;
        if (board == null) return;
        foreach (var mood in moods) board.MusicStream(mood);
    }

    private void Crossfade(AudioStreamWav stream)
    {
        var incoming = _aPlaying ? _musicB : _musicA;
        var outgoing = _aPlaying ? _musicA : _musicB;
        _aPlaying = !_aPlaying;
        incoming.Stream = stream;
        incoming.VolumeDb = -40;
        incoming.Play();
        var tween = CreateTween().SetParallel();
        tween.TweenProperty(incoming, "volume_db", 0f, 1.6f);
        if (outgoing.Playing) tween.TweenProperty(outgoing, "volume_db", -60f, 1.6f);
        tween.Chain().TweenCallback(Callable.From(() =>
        {
            if (outgoing.VolumeDb <= -59) outgoing.Stop();
        }));
    }

    private void FadeOutMusic()
    {
        var playing = new[] { _musicA, _musicB }.Where(p => p.Playing).ToList();
        if (playing.Count == 0) return;
        var tween = CreateTween().SetParallel();
        foreach (var p in playing) tween.TweenProperty(p, "volume_db", -60f, 1.2f);
    }
}
