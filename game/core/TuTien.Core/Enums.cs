namespace TuTien.Core
{
    public enum Locale
    {
        Vi,
        En,
    }

    /// <summary>Qi cultivation realms in order. The numeric value is the realm index used by suppression.</summary>
    public enum Realm
    {
        PhamNhan = 0,
        LuyenKhi = 1,
        TrucCo = 2,
        KetDan = 3,
        NguyenAnh = 4,
    }

    public enum BodyRealm
    {
        PhamThe = 0,
        LuyenCot = 1,
        DongCan = 2,
        KimCuong = 3,
        ThaiCo = 4,
    }

    /// <summary>Ngũ Hành — the five phases.</summary>
    public enum Element
    {
        Kim,
        Moc,
        Thuy,
        Hoa,
        Tho,
    }

    /// <summary>
    /// The foundation laid at Trúc Cơ (design §7.5): Hạ / Trung / Thượng / Thiên phẩm, from how well the
    /// meridian storm went. None before Trúc Cơ.
    /// </summary>
    public enum FoundationGrade
    {
        None = 0,
        Ha = 1,
        Trung = 2,
        Thuong = 3,
        Thien = 4,
    }

    public enum RootGrade
    {
        PhoThong,
        Kha,
        Hiem,
        ThienPham,
    }

    /// <summary>Qi (khí tu), Body (thể tu) or both at once (kiêm tu).</summary>
    public enum CultivationPath
    {
        Qi,
        Body,
        Kiem,
    }

    public enum Season
    {
        Spring,
        Summer,
        Autumn,
        Winter,
    }
}
