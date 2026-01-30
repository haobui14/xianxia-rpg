"use client";

import { useState } from "react";

export default function DebugInventory() {
  const [inventory, setInventory] = useState<any>(null);
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
    <div className="fixed bottom-4 left-4 z-50">
      <button
        onClick={fetchInventory}
        disabled={loading}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg shadow-lg font-semibold"
      >
        {loading ? "Loading..." : "🔍 Debug Inventory"}
      </button>

      {inventory && (
        <div className="mt-2 bg-gray-900 border border-purple-500 rounded-lg p-4 max-w-2xl max-h-96 overflow-auto">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-purple-400 font-bold">Debug: Current State</h3>
            <button onClick={() => setInventory(null)} className="text-gray-400 hover:text-white">
              ✕
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="text-yellow-400">
              💰 Silver: {inventory.silver} | Spirit Stones: {inventory.spirit_stones}
            </div>

            <div>
              <div className="text-green-400 font-semibold">Items ({inventory.items.length}):</div>
              {inventory.items.length === 0 ? (
                <div className="text-gray-500 ml-2">No items</div>
              ) : (
                <div className="ml-2 space-y-1">
                  {inventory.items.map((item: any, i: number) => (
                    <div key={i} className="text-gray-300">
                      • {item.name} x{item.quantity} [{item.type}] [{item.rarity}]
                      {item.equipment_slot && ` [${item.equipment_slot}]`}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-purple-400 font-semibold">
                Techniques ({inventory.techniques.length}):
              </div>
              {inventory.techniques.length === 0 ? (
                <div className="text-gray-500 ml-2">No techniques</div>
              ) : (
                <div className="ml-2 space-y-1">
                  {inventory.techniques.map((tech: any, i: number) => (
                    <div key={i} className="text-gray-300">
                      • {tech.name} [{tech.grade}] +{tech.cultivation_speed_bonus}%
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-orange-400 font-semibold">
                Skills ({inventory.skills.length}):
              </div>
              {inventory.skills.length === 0 ? (
                <div className="text-gray-500 ml-2">No skills</div>
              ) : (
                <div className="ml-2 space-y-1">
                  {inventory.skills.map((skill: any, i: number) => (
                    <div key={i} className="text-gray-300">
                      • {skill.name} Lv.{skill.level}/{skill.max_level} [{skill.type}]
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="text-blue-400 font-semibold">Equipped:</div>
              {Object.keys(inventory.equipped_items).length === 0 ? (
                <div className="text-gray-500 ml-2">Nothing equipped</div>
              ) : (
                <div className="ml-2 space-y-1">
                  {Object.entries(inventory.equipped_items).map(
                    ([slot, item]: [string, any]) =>
                      item && (
                        <div key={slot} className="text-gray-300">
                          • {slot}: {item.name} [{item.rarity}]
                        </div>
                      )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
