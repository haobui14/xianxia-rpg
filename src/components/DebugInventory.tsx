"use client";

import { useState } from "react";
import { Card, SmallHead } from "@/components/ui";

interface InventorySnapshot {
  silver: number;
  spirit_stones: number;
  items: any[];
  techniques: any[];
  skills: any[];
  equipped_items: Record<string, any>;
}

export default function DebugInventory() {
  const [inventory, setInventory] = useState<InventorySnapshot | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/get-character");
      const data = await response.json();
      if (data.run?.current_state) {
        const state = data.run.current_state;
        setInventory({
          silver: state.inventory.silver,
          spirit_stones: state.inventory.spirit_stones,
          items: state.inventory.items,
          techniques: state.techniques || [],
          skills: state.skills || [],
          equipped_items: state.equipped_items || {},
        });
      }
    } catch (error) {
      console.error("Error fetching inventory:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={fetchInventory}
        disabled={loading}
        className="ink-btn ghost sm"
        type="button"
      >
        <span className="t-han">檢</span>
        {loading ? "…" : "Debug"}
      </button>

      {inventory && (
        <div
          data-theme="night"
          style={{
            position: "fixed",
            left: "max(16px, env(safe-area-inset-left))",
            bottom: "max(80px, calc(env(safe-area-inset-bottom) + 70px))",
            zIndex: 60,
            maxWidth: 480,
            width: "calc(100vw - 32px)",
          }}
        >
          <Card padding={16} style={{ maxHeight: "70vh", overflow: "auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <SmallHead>Debug · Current State</SmallHead>
              <button
                onClick={() => setInventory(null)}
                aria-label="Close debug panel"
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--ink-mute)",
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 0,
                }}
              >
                ×
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 12 }}>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  fontFamily: "var(--font-ui), Inter, sans-serif",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                <span style={{ color: "var(--gold-deep)" }}>
                  <span className="t-han">銀</span> {inventory.silver}
                </span>
                <span style={{ color: "var(--jade-deep)" }}>
                  <span className="t-han">靈</span> {inventory.spirit_stones}
                </span>
              </div>

              <DebugList
                han="物"
                label={`Items (${inventory.items.length})`}
                empty="No items"
                items={inventory.items.map(
                  (item: any) =>
                    `${item.name} ×${item.quantity} [${item.type}/${item.rarity}]${item.equipment_slot ? ` [${item.equipment_slot}]` : ""}`
                )}
              />
              <DebugList
                han="法"
                label={`Techniques (${inventory.techniques.length})`}
                empty="No techniques"
                items={inventory.techniques.map(
                  (tech: any) =>
                    `${tech.name} [${tech.grade}] +${tech.cultivation_speed_bonus ?? 0}%`
                )}
              />
              <DebugList
                han="技"
                label={`Skills (${inventory.skills.length})`}
                empty="No skills"
                items={inventory.skills.map(
                  (skill: any) =>
                    `${skill.name} Lv.${skill.level}/${skill.max_level} [${skill.type}]`
                )}
              />
              <DebugList
                han="裝"
                label={`Equipped (${Object.values(inventory.equipped_items).filter(Boolean).length})`}
                empty="Nothing equipped"
                items={Object.entries(inventory.equipped_items)
                  .filter(([, v]) => v)
                  .map(([slot, item]: [string, any]) => `${slot}: ${item.name} [${item.rarity}]`)}
              />
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

function DebugList({
  han,
  label,
  items,
  empty,
}: {
  han: string;
  label: string;
  items: string[];
  empty: string;
}) {
  return (
    <div>
      <div
        className="label"
        style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}
      >
        <span className="t-han" style={{ color: "var(--cinnabar)" }}>
          {han}
        </span>
        {label}
      </div>
      {items.length === 0 ? (
        <div style={{ color: "var(--ink-faint)", fontStyle: "italic", marginLeft: 10 }}>
          {empty}
        </div>
      ) : (
        <ul
          style={{
            margin: 0,
            paddingLeft: 14,
            listStyle: "'· '",
            color: "var(--ink-soft)",
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {items.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
