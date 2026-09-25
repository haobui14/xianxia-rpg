using Godot;
using TuTien.Core;
using TuTien.Core.State;

namespace TuTienLuc.Art;

public enum HairStyle
{
    Bun,
    Topknot,
    Long,
    Ponytail,
    TwinBuns,
    Bald,
    Elder,
}

public enum Headwear
{
    None,
    Headband,
    StrawHat,
    Guan,
}

public enum Weapon
{
    None,
    Sword,
    Saber,
    Staff,
}

/// <summary>How a person looks: robe colours, hair, hat and weapon. Sects dress their disciples alike.</summary>
public sealed class Look
{
    public Color Robe = new("#ece6d6");
    public Color Trim = new("#9b2a26");
    public Color Sash = new("#9b2a26");
    public Color Hair = new("#211d22");
    public Color Skin = new("#f0d2b2");
    public Color Pants = new("#3a3e49");
    public Color Shoes = new("#26262b");
    public Color HatColor = new("#c9a868");
    public Color WeaponColor = new("#5b3d2b");
    public HairStyle HairStyle = HairStyle.Topknot;
    public Headwear Hat = Headwear.None;
    public Weapon Weapon = Weapon.Sword;
    public bool Female;
    public bool Beard;
    public float Height = 1;
    public float Bulk = 1;

    private static readonly Color[] Skins = { new("#f2d6b8"), new("#ecc9a4"), new("#e3bb93"), new("#d7a983") };
    private static readonly Color[] Hairs = { new("#1f1b20"), new("#2b2220"), new("#3a2a22"), new("#1c1f26") };
    private static readonly Color[] Earth = { new("#8c7a62"), new("#6f7d6a"), new("#7b6f86"), new("#9a8a6e"), new("#5f6f7f"), new("#86705a"), new("#6c7a82") };
    private static readonly Color[] Soft = { new("#d9c9d6"), new("#c9d6cf"), new("#e0d2b8"), new("#cfd3e3"), new("#e3cfc6") };

    /// <summary>The player: white robe with cinnabar trim and a sword on the back.</summary>
    public static Look Player() => new()
    {
        Robe = new Color("#f1ece0"), Trim = new Color("#9b2a26"), Sash = new Color("#9b2a26"),
        HairStyle = HairStyle.Topknot, Weapon = Weapon.Sword,
    };

    // A stable hash (string.GetHashCode is randomized per run), so a person looks the same every session.
    private static float H(string id, int salt) => Paint.Hash((int)(Seeds.Hash(id) & 0x7fffffff), salt);
    private static T Pick<T>(T[] items, string id, int salt) => items[(int)(H(id, salt) * items.Length) % items.Length];

    public static Look ForNpc(NpcState npc)
    {
        var id = npc.Id;
        var look = new Look
        {
            Female = npc.Female,
            Skin = Pick(Skins, id, 1),
            Hair = npc.Age >= 70 ? new Color("#d8d4cc") : npc.Age >= 55 ? new Color("#8a8580") : Pick(Hairs, id, 2),
            HairStyle = npc.Female
                ? (H(id, 3) < 0.4f ? HairStyle.Long : H(id, 3) < 0.7f ? HairStyle.TwinBuns : HairStyle.Ponytail)
                : (H(id, 3) < 0.5f ? HairStyle.Bun : H(id, 3) < 0.8f ? HairStyle.Topknot : HairStyle.Ponytail),
            Weapon = H(id, 4) < 0.55f ? Weapon.Sword : H(id, 4) < 0.7f ? Weapon.Saber : H(id, 4) < 0.8f ? Weapon.Staff : Weapon.None,
            Height = 0.94f + H(id, 5) * 0.1f,
            Bulk = npc.Female ? 0.94f : 0.98f + H(id, 6) * 0.08f,
        };
        var robe = npc.Female ? Pick(Soft, id, 7) : Pick(Earth, id, 7);
        look.Robe = robe;
        look.Trim = robe.Darkened(0.35f);
        look.Sash = robe.Darkened(0.45f);

        switch (npc.SectId)
        {
            case "thanh_van_kiem":
                look.Robe = new Color("#dde8ee");
                look.Trim = new Color("#4a7fa6");
                look.Sash = new Color("#4a7fa6");
                look.Hat = Headwear.Headband;
                look.HatColor = new Color("#4a7fa6");
                look.Weapon = Weapon.Sword;
                break;
            case "huyet_sat_ma_tong":
                look.Robe = new Color("#2e2629");
                look.Trim = new Color("#8e1f1f");
                look.Sash = new Color("#8e1f1f");
                look.Weapon = Weapon.Saber;
                break;
            case "van_hoa_dan_mon":
                look.Robe = new Color("#efe2e9");
                look.Trim = new Color("#b0668a");
                look.Sash = new Color("#b0668a");
                look.Weapon = Weapon.None;
                break;
            case "tuyet_nguyet_phat_am":
                look.Robe = new Color("#d8b067");
                look.Trim = new Color("#8a5a2a");
                look.Sash = new Color("#8a5a2a");
                look.HairStyle = HairStyle.Bald;
                look.Weapon = Weapon.Staff;
                break;
            case "bach_thu_thuan_son":
                look.Robe = new Color("#8a7a55");
                look.Trim = new Color("#5e4a2a");
                look.Sash = new Color("#5e4a2a");
                break;
        }

        switch (npc.Id)
        {
            case "npc_elder":
                look.Robe = new Color("#7b6a55");
                look.Trim = new Color("#4d4033");
                look.Sash = new Color("#b08a4a");
                look.HairStyle = HairStyle.Elder;
                look.Hair = new Color("#e6e2da");
                look.Beard = true;
                look.Weapon = Weapon.Staff;
                look.Hat = Headwear.None;
                break;
            case "npc_deacon":
                look.Hat = Headwear.Guan;
                look.HatColor = new Color("#1f2430");
                look.Robe = new Color("#35506b");
                look.Trim = new Color("#dde8ee");
                look.Sash = new Color("#c9a54a");
                look.Beard = true;
                break;
            case "npc_rival":
                look.Robe = new Color("#2f4f45");
                look.Trim = new Color("#c9a54a");
                look.Sash = new Color("#c9a54a");
                look.HairStyle = HairStyle.Topknot;
                look.Weapon = Weapon.Sword;
                break;
        }
        if (npc.Age >= 90 && look.HairStyle != HairStyle.Bald) look.HairStyle = HairStyle.Elder;
        if (!npc.Female && npc.Age >= 45 && H(id, 8) < 0.5f) look.Beard = true;
        return look;
    }

    /// <summary>Human enemies from the catalog.</summary>
    public static Look ForEnemy(string enemyId, string? displaySeed = null) => enemyId switch
    {
        "bandit_leader" => new Look
        {
            Robe = new Color("#6b4f3a"), Trim = new Color("#3a2c22"), Sash = new Color("#8e2a22"), Hat = Headwear.Headband,
            HatColor = new Color("#8e2a22"), Weapon = Weapon.Saber, Beard = true, Bulk = 1.14f, Height = 1.04f, HairStyle = HairStyle.Topknot,
        },
        "sect_disciple" => new Look
        {
            Robe = new Color("#dde8ee"), Trim = new Color("#4a7fa6"), Sash = new Color("#4a7fa6"), Hat = Headwear.Headband,
            HatColor = new Color("#4a7fa6"), Weapon = Weapon.Sword, HairStyle = HairStyle.Bun,
        },
        "rogue_cultivator" => new Look
        {
            Robe = new Color("#5d5a66"), Trim = new Color("#8e3b2b"), Sash = new Color("#8e3b2b"), Hat = Headwear.StrawHat,
            Weapon = Weapon.Sword, HairStyle = HairStyle.Ponytail,
        },
        // Back for revenge: the robe you left them in, still stained.
        "wounded_cultivator_revenge" => new Look
        {
            Robe = new Color("#8d8a80"), Trim = new Color("#5a3a32"), Sash = new Color("#9b2a26"), Weapon = Weapon.Sword,
            HairStyle = HairStyle.Long,
        },
        // Dressed for the dark, a straw hat low over the eyes.
        "mysterious_assassin" => new Look
        {
            Robe = new Color("#23262e"), Trim = new Color("#3a3f48"), Sash = new Color("#6b1f1c"), Hat = Headwear.StrawHat,
            HatColor = new Color("#3a3326"), Weapon = Weapon.Saber, HairStyle = HairStyle.Ponytail, Bulk = 0.92f,
        },
        _ => new Look { Robe = new Color("#6f6a60"), Trim = new Color("#3f3a33"), Sash = new Color("#3f3a33"), Weapon = Weapon.Saber },
    };
}
