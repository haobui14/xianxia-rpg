import React from "react";

export type SlotRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface SlotItem {
  glyph?: React.ReactNode;
  rarity?: SlotRarity;
  name?: string;
  qty?: number;
  lvl?: number;
}

export interface ItemSlotProps {
  item?: SlotItem | null;
  onClick?: () => void;
  selected?: boolean;
  showQty?: boolean;
  showLvl?: boolean;
  className?: string;
  emptyGlyph?: React.ReactNode;
}

export function ItemSlot({
  item,
  onClick,
  selected = false,
  showQty = true,
  showLvl = true,
  className = "",
  emptyGlyph = "·",
}: ItemSlotProps) {
  if (!item) {
    return (
      <div className={`slot empty ${className}`} onClick={onClick} role="button">
        <span style={{ fontSize: 12 }}>{emptyGlyph}</span>
      </div>
    );
  }
  const rare = item.rarity || "common";
  const cls = [
    "slot",
    `rare-${rare}`,
    selected ? "selected" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} onClick={onClick} title={item.name} role="button">
      <div className="rarity-edge" />
      {item.glyph && <span className="glyph">{item.glyph}</span>}
      {showLvl && item.lvl ? <span className="lvl">+{item.lvl}</span> : null}
      {showQty && item.qty && item.qty > 1 ? <span className="qty">{item.qty}</span> : null}
    </div>
  );
}
