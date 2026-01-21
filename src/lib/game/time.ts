/**
 * Time System for Xianxia Cultivation Simulator
 * Manages game time, seasons, and time-based bonuses
 */

import {
  GameState,
  GameTime,
  TimeSegment,
  Season,
  Element,
  Locale,
} from "@/types/game";

// =====================================================
// CONSTANTS
// =====================================================

export const TIME_SEGMENTS: TimeSegment[] = ["Sáng", "Chiều", "Tối", "Đêm"];
export const SEGMENTS_PER_DAY = 4;
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const SEGMENTS_PER_MONTH = SEGMENTS_PER_DAY * DAYS_PER_MONTH; // 120
export const SEGMENTS_PER_YEAR = SEGMENTS_PER_MONTH * MONTHS_PER_YEAR; // 1440

// Segment names in English
export const SEGMENT_NAMES_EN: Record<TimeSegment, string> = {
  Sáng: "Morning",
  Chiều: "Afternoon",
  Tối: "Evening",
  Đêm: "Night",
};

// Season definitions
export const SEASON_MONTHS: Record<Season, number[]> = {
  Spring: [1, 2, 3],
  Summer: [4, 5, 6],
  Autumn: [7, 8, 9],
  Winter: [10, 11, 12],
};

// Season names in Vietnamese
export const SEASON_NAMES_VI: Record<Season, string> = {
  Spring: "Xuân",
  Summer: "Hạ",
  Autumn: "Thu",
  Winter: "Đông",
};

// Element cultivation bonuses by season
export const SEASON_ELEMENT_BONUS: Record<
  Season,
  Partial<Record<Element, number>>
> = {
  Spring: { Mộc: 20, Thủy: 10, Hỏa: -10 },
  Summer: { Hỏa: 20, Mộc: 10, Thủy: -10 },
  Autumn: { Kim: 20, Thổ: 10, Mộc: -10 },
  Winter: { Thủy: 20, Kim: 10, Hỏa: -10 },
};

// Time segment cultivation bonuses
export const SEGMENT_CULTIVATION_BONUS: Record<TimeSegment, number> = {
  Sáng: 10, // Fresh morning qi
  Chiều: 0, // Neutral
  Tối: 5, // Twilight energy
  Đêm: 15, // Yin qi peak (best for cultivation)
};

// =====================================================
// TIME CREATION & MANIPULATION
// =====================================================

/**
 * Create a GameTime object from components
 */
export function createGameTime(
  day: number = 1,
  month: number = 1,
  year: number = 1,
  segment: TimeSegment = "Sáng",
): GameTime {
  return { day, month, year, segment };
}

/**
 * Create GameTime from existing GameState
 */
export function getGameTimeFromState(state: GameState): GameTime {
  return {
    day: state.time_day,
    month: state.time_month,
    year: state.time_year,
    segment: state.time_segment,
  };
}

/**
 * Apply GameTime to GameState
 */
export function applyGameTimeToState(
  state: GameState,
  time: GameTime,
): GameState {
  return {
    ...state,
    time_day: time.day,
    time_month: time.month,
    time_year: time.year,
    time_segment: time.segment,
  };
}

/**
 * Get the index of a time segment (0-3)
 */
export function getSegmentIndex(segment: TimeSegment): number {
  return TIME_SEGMENTS.indexOf(segment);
}

/**
 * Convert GameTime to total segments since year 1, day 1, morning
 */
export function gameTimeToTotalSegments(time: GameTime): number {
  const segmentIndex = getSegmentIndex(time.segment);
  return (
    (time.year - 1) * SEGMENTS_PER_YEAR +
    (time.month - 1) * SEGMENTS_PER_MONTH +
    (time.day - 1) * SEGMENTS_PER_DAY +
    segmentIndex
  );
}

/**
 * Convert total segments back to GameTime
 */
export function totalSegmentsToGameTime(totalSegments: number): GameTime {
  const year = Math.floor(totalSegments / SEGMENTS_PER_YEAR) + 1;
  let remaining = totalSegments % SEGMENTS_PER_YEAR;

  const month = Math.floor(remaining / SEGMENTS_PER_MONTH) + 1;
  remaining = remaining % SEGMENTS_PER_MONTH;

  const day = Math.floor(remaining / SEGMENTS_PER_DAY) + 1;
  const segmentIndex = remaining % SEGMENTS_PER_DAY;

  return {
    year,
    month,
    day,
    segment: TIME_SEGMENTS[segmentIndex],
  };
}

/**
 * Advance time by a number of segments
 */
export function advanceTime(time: GameTime, segments: number): GameTime {
  const totalSegments = gameTimeToTotalSegments(time);
  return totalSegmentsToGameTime(totalSegments + segments);
}

/**
 * Advance time in GameState by segments
 */
export function advanceGameStateTime(
  state: GameState,
  segments: number,
): GameState {
  const currentTime = getGameTimeFromState(state);
  const newTime = advanceTime(currentTime, segments);

  // Check for age increase (every 12 months = 1 year)
  const oldYears = Math.floor(
    currentTime.year - 1 + (currentTime.month - 1) / 12,
  );
  const newYears = Math.floor(newTime.year - 1 + (newTime.month - 1) / 12);
  const ageIncrease = newYears - oldYears;

  return {
    ...applyGameTimeToState(state, newTime),
    age: state.age + ageIncrease,
  };
}

/**
 * Calculate the difference between two times in segments
 */
export function getTimeDifference(from: GameTime, to: GameTime): number {
  return gameTimeToTotalSegments(to) - gameTimeToTotalSegments(from);
}

/**
 * Check if time1 is before time2
 */
export function isTimeBefore(time1: GameTime, time2: GameTime): boolean {
  return gameTimeToTotalSegments(time1) < gameTimeToTotalSegments(time2);
}

/**
 * Check if time1 equals time2
 */
export function isTimeEqual(time1: GameTime, time2: GameTime): boolean {
  return gameTimeToTotalSegments(time1) === gameTimeToTotalSegments(time2);
}

/**
 * Check if time1 is after time2
 */
export function isTimeAfter(time1: GameTime, time2: GameTime): boolean {
  return gameTimeToTotalSegments(time1) > gameTimeToTotalSegments(time2);
}

// =====================================================
// SEASON & TIME QUERIES
// =====================================================

/**
 * Get season from month
 */
export function getSeasonFromMonth(month: number): Season {
  if (month >= 1 && month <= 3) return "Spring";
  if (month >= 4 && month <= 6) return "Summer";
  if (month >= 7 && month <= 9) return "Autumn";
  return "Winter";
}

/**
 * Get season from GameTime
 */
export function getSeason(time: GameTime): Season {
  return getSeasonFromMonth(time.month);
}

/**
 * Get season name in locale
 */
export function getSeasonName(season: Season, locale: Locale): string {
  return locale === "vi" ? SEASON_NAMES_VI[season] : season;
}

/**
 * Check if it's daytime (Sáng or Chiều)
 */
export function isDaytime(segment: TimeSegment): boolean {
  return segment === "Sáng" || segment === "Chiều";
}

/**
 * Check if it's nighttime (Tối or Đêm)
 */
export function isNighttime(segment: TimeSegment): boolean {
  return segment === "Tối" || segment === "Đêm";
}

// =====================================================
// CULTIVATION BONUSES
// =====================================================

/**
 * Get cultivation bonus for element based on season
 */
export function getSeasonElementBonus(
  season: Season,
  element: Element,
): number {
  return SEASON_ELEMENT_BONUS[season][element] || 0;
}

/**
 * Get cultivation bonus based on time segment
 */
export function getSegmentCultivationBonus(segment: TimeSegment): number {
  return SEGMENT_CULTIVATION_BONUS[segment];
}

/**
 * Calculate total time-based cultivation bonus
 */
export function calculateTimeCultivationBonus(
  time: GameTime,
  elements: Element[],
): number {
  const season = getSeason(time);
  const segmentBonus = getSegmentCultivationBonus(time.segment);

  // Get best element bonus for player's spirit root
  const elementBonuses = elements.map((el) =>
    getSeasonElementBonus(season, el),
  );
  const bestElementBonus = Math.max(...elementBonuses, 0);

  return segmentBonus + bestElementBonus;
}

// =====================================================
// DURATION HELPERS
// =====================================================

export interface DurationOption {
  id: string;
  segments: number;
  label_vi: string;
  label_en: string;
}

export const DURATION_OPTIONS: DurationOption[] = [
  {
    id: "1_segment",
    segments: 1,
    label_vi: "1 canh giờ (~3 giờ)",
    label_en: "1 segment (~3 hours)",
  },
  { id: "half_day", segments: 2, label_vi: "Nửa ngày", label_en: "Half day" },
  { id: "full_day", segments: 4, label_vi: "1 ngày", label_en: "1 day" },
  { id: "3_days", segments: 12, label_vi: "3 ngày", label_en: "3 days" },
  { id: "week", segments: 28, label_vi: "1 tuần", label_en: "1 week" },
  { id: "month", segments: 120, label_vi: "1 tháng", label_en: "1 month" },
];

/**
 * Get duration option by ID
 */
export function getDurationOption(id: string): DurationOption | undefined {
  return DURATION_OPTIONS.find((opt) => opt.id === id);
}

/**
 * Convert segments to human-readable duration
 */
export function formatDuration(segments: number, locale: Locale): string {
  if (segments < SEGMENTS_PER_DAY) {
    const hours = segments * 3;
    return locale === "vi" ? `${hours} giờ` : `${hours} hours`;
  }

  if (segments < SEGMENTS_PER_MONTH) {
    const days = Math.floor(segments / SEGMENTS_PER_DAY);
    const remainingSegments = segments % SEGMENTS_PER_DAY;
    if (remainingSegments === 0) {
      return locale === "vi"
        ? `${days} ngày`
        : `${days} day${days > 1 ? "s" : ""}`;
    }
    const hours = remainingSegments * 3;
    return locale === "vi"
      ? `${days} ngày ${hours} giờ`
      : `${days} day${days > 1 ? "s" : ""} ${hours} hours`;
  }

  const months = Math.floor(segments / SEGMENTS_PER_MONTH);
  const remainingDays = Math.floor(
    (segments % SEGMENTS_PER_MONTH) / SEGMENTS_PER_DAY,
  );
  if (remainingDays === 0) {
    return locale === "vi"
      ? `${months} tháng`
      : `${months} month${months > 1 ? "s" : ""}`;
  }
  return locale === "vi"
    ? `${months} tháng ${remainingDays} ngày`
    : `${months} month${months > 1 ? "s" : ""} ${remainingDays} days`;
}

// =====================================================
// TIME FORMATTING
// =====================================================

/**
 * Format GameTime for display
 */
export function formatGameTime(time: GameTime, locale: Locale): string {
  const season = getSeason(time);
  const seasonName = getSeasonName(season, locale);
  const segmentName =
    locale === "vi" ? time.segment : SEGMENT_NAMES_EN[time.segment];

  if (locale === "vi") {
    return `Năm ${time.year}, Tháng ${time.month} (${seasonName}), Ngày ${time.day}, ${segmentName}`;
  }
  return `Year ${time.year}, Month ${time.month} (${seasonName}), Day ${time.day}, ${segmentName}`;
}

/**
 * Format GameTime short version
 */
export function formatGameTimeShort(time: GameTime, locale: Locale): string {
  const segmentName =
    locale === "vi" ? time.segment : SEGMENT_NAMES_EN[time.segment];

  if (locale === "vi") {
    return `Y${time.year} T${time.month} N${time.day} - ${segmentName}`;
  }
  return `Y${time.year} M${time.month} D${time.day} - ${segmentName}`;
}

/**
 * Get relative time description
 */
export function getRelativeTimeDescription(
  from: GameTime,
  to: GameTime,
  locale: Locale,
): string {
  const diffSegments = getTimeDifference(from, to);

  if (diffSegments === 0) {
    return locale === "vi" ? "ngay bây giờ" : "just now";
  }

  if (diffSegments < 0) {
    return (
      formatDuration(Math.abs(diffSegments), locale) +
      (locale === "vi" ? " trước" : " ago")
    );
  }

  return (
    formatDuration(diffSegments, locale) + (locale === "vi" ? " sau" : " later")
  );
}

// =====================================================
// SPECIAL TIME EVENTS
// =====================================================

/**
 * Check if current time is during a cultivation-favorable period
 */
export function isCultivationFavorable(time: GameTime): boolean {
  // Night time is always good
  if (isNighttime(time.segment)) return true;

  // First and last day of month have spiritual significance
  if (time.day === 1 || time.day === 30) return true;

  // Full moon equivalent (day 15)
  if (time.day === 15) return true;

  return false;
}

/**
 * Get special time bonuses
 */
export function getSpecialTimeBonus(time: GameTime): {
  bonus: number;
  reason_vi: string;
  reason_en: string;
} | null {
  if (time.day === 15 && time.segment === "Đêm") {
    return {
      bonus: 25,
      reason_vi: "Đêm trăng tròn - linh khí sung mãn",
      reason_en: "Full moon night - spiritual energy at peak",
    };
  }

  if (time.day === 1 && time.month === 1) {
    return {
      bonus: 30,
      reason_vi: "Ngày đầu năm mới - khởi đầu mới",
      reason_en: "New Year's Day - fresh beginnings",
    };
  }

  // Solstices (month 6 and 12, day 21)
  if ((time.month === 6 || time.month === 12) && time.day === 21) {
    return {
      bonus: 20,
      reason_vi:
        time.month === 6
          ? "Hạ chí - dương khí cực thịnh"
          : "Đông chí - âm khí cực thịnh",
      reason_en:
        time.month === 6
          ? "Summer solstice - yang energy peak"
          : "Winter solstice - yin energy peak",
    };
  }

  return null;
}
