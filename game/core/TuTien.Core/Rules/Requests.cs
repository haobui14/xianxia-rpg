using System.Collections.Generic;
using System.Linq;
using TuTien.Core.Content;
using TuTien.Core.State;

namespace TuTien.Core.Rules
{
    /// <summary>
    /// The villagers' requests on a town's bounty board (nhờ vả): three at a time, put up again every two months.
    /// Bring what one asks for and the giver pays in silver and karma, sometimes with something more.
    /// </summary>
    public static class Requests
    {
        public const int Shown = 3;
        public const int RefreshMonths = 2;

        /// <summary>The town's board, put up again when its time is over (or its requests no longer exist).</summary>
        public static RequestBoardState Board(GameState state, TownDef town, Pcg32 rng)
        {
            if (!state.World.Requests.TryGetValue(town.AreaId, out var board))
            {
                board = new RequestBoardState();
                state.World.Requests[town.AreaId] = board;
            }
            var month = state.Calendar.MonthIndex;
            var stale = board.Offers.Any(id => town.Requests.All(r => r.Id != id));
            if (board.RolledMonth < 0 || month >= board.RolledMonth + RefreshMonths || stale)
            {
                board.RolledMonth = month;
                board.Done.Clear();
                var pool = town.Requests.Select(r => r.Id).ToList();
                board.Offers = new List<string>();
                while (board.Offers.Count < Shown && pool.Count > 0)
                {
                    var pick = rng.Pick(pool);
                    pool.Remove(pick);
                    board.Offers.Add(pick);
                }
            }
            return board;
        }

        public static List<RequestDef> Offers(RequestBoardState board, TownDef town) =>
            board.Offers.Select(id => town.Requests.FirstOrDefault(r => r.Id == id)).Where(r => r != null).Select(r => r!).ToList();

        public static List<GameEvent> Fulfil(GameState state, ContentDb content, TownDef town, string requestId)
        {
            var events = new List<GameEvent>();
            var p = state.Player;
            if (!state.World.Requests.TryGetValue(town.AreaId, out var board) || !board.Offers.Contains(requestId) || board.Done.Contains(requestId))
                return events;
            var def = town.Requests.FirstOrDefault(r => r.Id == requestId);
            var item = def != null ? content.Item(def.Item) : null;
            if (def == null || item == null) return events;
            if (Inventory.Count(p, def.Item) < def.Qty)
            {
                events.Add(GameEvent.Info("request_short", $"Cần {def.Qty} {item.Name}.", $"That takes {def.Qty} {item.NameEn}."));
                return events;
            }
            Inventory.Remove(p, def.Item, def.Qty);
            p.Silver += def.Silver;
            if (def.Karma != 0) Karma.Add(p, def.Karma);
            var extra = def.RewardItem != null ? content.Item(def.RewardItem) : null;
            if (extra != null) Inventory.Add(p, Inventory.StackOf(extra, 1));
            board.Done.Add(requestId);
            p.Counters.RequestsDone += 1;
            var gift = extra != null ? $", {extra.Name}" : "";
            var giftEn = extra != null ? $", {extra.NameEn}" : "";
            events.Add(GameEvent.Major("request_done", $"{def.Giver}: “Đa tạ!” (+{def.Silver} bạc{gift}, nhân quả +{def.Karma})",
                $"{def.GiverEn}: “Thank you!” (+{def.Silver} silver{giftEn}, karma +{def.Karma})"));
            return events;
        }
    }
}
