"use client";

import { useState, useEffect, useRef } from "react";
import { SpiritRoot, Character } from "@/types/game";
import { t, Locale } from "@/lib/i18n/translations";

interface CharacterCreationProps {
  onGameStart: (characterId: string, runId: string, locale: Locale) => void;
}

export default function CharacterCreation({
  onGameStart,
}: CharacterCreationProps) {
  const [locale, setLocale] = useState<Locale>("vi");
  const [name, setName] = useState("");
  const [age, setAge] = useState(20);
  const [loading, setLoading] = useState(true);
  const [spiritRoot, setSpiritRoot] = useState<SpiritRoot | null>(null);
  const [characterId, setCharacterId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [existingCharacter, setExistingCharacter] = useState<Character | null>(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    // Check if character already exists (only once on mount)
    if (checkedRef.current) return;
    checkedRef.current = true;

    const checkExistingCharacter = async () => {
      try {
        const response = await fetch('/api/get-character');
        
        if (!response.ok) {
          console.error('Failed to fetch character:', response.status, response.statusText);
          setLoading(false);
          return;
        }
        
        const data = await response.json();
        
        if (data.character && data.run) {
          // Character exists, load it
          const character = data.character;
          setExistingCharacter(character);
          setCharacterId(character.id);
          setName(character.name);
          setAge(character.age);
          setLoading(false);
          
          // Auto-start the game with the latest run
          onGameStart(character.id, data.run.id, locale);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error checking existing character:", err);
        setLoading(false);
      }
    };

    checkExistingCharacter();
  }, [onGameStart, locale]);

  const handleCreateCharacter = async () => {
    // Don't create if character already exists
    if (existingCharacter || characterId) {
      setError(
        locale === "vi"
          ? "Nhân vật đã được tạo"
          : "Character already exists"
      );
      return;
    }

    if (name.length < 2) {
      setError(
        locale === "vi"
          ? "Tên phải có ít nhất 2 ký tự"
          : "Name must be at least 2 characters"
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/create-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, age, locale }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create character");
      }

      const data = await response.json();
      setSpiritRoot(data.spirit_root);
      setCharacterId(data.character.id);
    } catch (err: any) {
      setError(
        locale === "vi" ? `Lỗi tạo nhân vật: ${err.message}` : `Error creating character: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateSpiritRoot = async () => {
    // Don't allow regeneration if character is already saved in database
    if (existingCharacter) {
      setError(
        locale === "vi"
          ? "Không thể tái tạo linh căn cho nhân vật đã lưu"
          : "Cannot regenerate spirit root for existing character"
      );
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/create-character", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, age, locale }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to regenerate spirit root");
      }

      const data = await response.json();
      setSpiritRoot(data.spirit_root);
      setCharacterId(data.character.id);
    } catch (err: any) {
      setError(
        locale === "vi" 
          ? `Lỗi tái tạo linh căn: ${err.message}` 
          : `Error regenerating spirit root: ${err.message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStartGame = async () => {
    if (!characterId || !spiritRoot) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/start-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId, spiritRoot, locale }),
      });

      if (!response.ok) {
        throw new Error("Failed to start run");
      }

      const data = await response.json();
      onGameStart(characterId, data.run.id, locale);
    } catch (err) {
      setError(
        locale === "vi" ? "Lỗi bắt đầu trò chơi" : "Error starting game"
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-xianxia-dark border border-xianxia-accent/30 rounded-lg p-8">
        {/* Show loading while checking for existing character */}
        {loading && !existingCharacter && !spiritRoot ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-xianxia-accent text-xl mb-4">
              {locale === "vi" ? "Đang tải..." : "Loading..."}
            </div>
          </div>
        ) : (
          <>
            {/* Language Toggle */}
            <div className="flex justify-end mb-6">
              <button
                onClick={() => setLocale(locale === "vi" ? "en" : "vi")}
            className="px-4 py-2 bg-xianxia-accent/20 hover:bg-xianxia-accent/30 rounded-lg text-sm transition-colors"
          >
            {locale === "vi" ? "EN" : "VN"}
          </button>
        </div>

        <h1 className="text-4xl font-bold text-center mb-8 text-xianxia-gold">
          {t(locale, "createCharacter")}
        </h1>

        {!spiritRoot ? (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">
                {t(locale, "characterName")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-xianxia-darker border border-xianxia-accent/30 rounded-lg focus:outline-none focus:border-xianxia-accent"
                placeholder={t(locale, "enterName")}
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                {t(locale, "age")}
              </label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(parseInt(e.target.value) || 20)}
                className="w-full px-4 py-3 bg-xianxia-darker border border-xianxia-accent/30 rounded-lg focus:outline-none focus:border-xianxia-accent"
                min="15"
                max="100"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200">
                {error}
              </div>
            )}

            <button
              onClick={handleCreateCharacter}
              disabled={loading || name.length < 2}
              className="w-full py-3 bg-xianxia-accent hover:bg-xianxia-accent/80 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              {loading ? t(locale, "loading") : t(locale, "createButton")}
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-6 bg-xianxia-darker rounded-lg border border-xianxia-gold/30">
              <h2 className="text-2xl font-bold mb-4 text-xianxia-gold">
                {t(locale, "spiritRoot")}
              </h2>

              <div className="space-y-3">
                <div>
                  <span className="text-gray-400">
                    {t(locale, "elements")}:{" "}
                  </span>
                  <span className="font-medium text-xianxia-accent">
                    {spiritRoot.elements.map((e) => t(locale, e)).join(" + ")}
                  </span>
                </div>

                <div>
                  <span className="text-gray-400">{t(locale, "grade")}: </span>
                  <span className="font-bold text-xianxia-gold">
                    {t(locale, spiritRoot.grade)}
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={handleRegenerateSpiritRoot}
                disabled={loading}
                className="flex-1 py-3 bg-xianxia-darker border border-xianxia-accent/50 hover:bg-xianxia-accent/20 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {locale === "vi"
                  ? "Tái tạo Linh Căn"
                  : "Regenerate Spirit Root"}
              </button>

              <button
                onClick={handleStartGame}
                disabled={loading}
                className="flex-1 py-3 bg-xianxia-gold hover:bg-xianxia-gold/80 text-xianxia-darker disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-bold transition-colors"
              >
                {loading ? t(locale, "loading") : t(locale, "startJourney")}
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}
