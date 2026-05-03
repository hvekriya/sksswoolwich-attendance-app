import { startOfDay, endOfDay } from 'date-fns';

/** UK academic year label e.g. 2025 for "2025/26" starting Sep 2025 */
export type AcademicYearStart = number;

export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * England-style academic year: 1 September (startYear) → 31 August (startYear + 1).
 */
export function getAcademicYearRange(startYear: AcademicYearStart): DateRange {
  const start = startOfDay(new Date(startYear, 8, 1)); // month 8 = September
  const end = endOfDay(new Date(startYear + 1, 7, 31)); // month 7 = August
  return { start, end };
}

export type UkTermFilter = 'full' | 'autumn' | 'spring' | 'summer';

/**
 * Approximate UK state-school terms (England). Easter varies; spring ends ~week before Easter Monday — we use a fixed early-April boundary that fits most years.
 * - Autumn: Sep–Dec
 * - Spring: Jan–early Apr (before summer term)
 * - Summer: early Apr–Aug (end of academic year)
 */
export function getTermRange(
  academicStartYear: AcademicYearStart,
  term: UkTermFilter
): DateRange {
  const { start: yearStart, end: yearEnd } = getAcademicYearRange(academicStartYear);

  if (term === 'full') {
    return { start: yearStart, end: yearEnd };
  }

  if (term === 'autumn') {
    const end = endOfDay(new Date(academicStartYear, 11, 31)); // Dec 31
    return { start: yearStart, end };
  }

  // Spring: Jan 1 – Apr 5 (inclusive) of calendar year (startYear + 1 for Jan-Aug portion... careful)
  // Academic year Sep 2024–Aug 2025: Spring is Jan 1 2025 – Apr 5 2025
  const janNext = startOfDay(new Date(academicStartYear + 1, 0, 1));
  const springEnd = endOfDay(new Date(academicStartYear + 1, 3, 5)); // Apr 5

  if (term === 'spring') {
    return { start: janNext, end: springEnd };
  }

  // Summer: day after spring – Aug 31 (end of academic year)
  const summerStart = startOfDay(new Date(academicStartYear + 1, 3, 6)); // Apr 6
  return { start: summerStart, end: yearEnd };
}

/** List recent academic year start years for dropdowns (current + prior years). */
export function recentAcademicYearOptions(count = 6): AcademicYearStart[] {
  const now = new Date();
  const currentStart =
    now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return Array.from({ length: count }, (_, i) => currentStart - i);
}

export function formatAcademicYearLabel(startYear: AcademicYearStart): string {
  const shortNext = (startYear + 1) % 100;
  return `${startYear}/${shortNext.toString().padStart(2, '0')}`;
}
