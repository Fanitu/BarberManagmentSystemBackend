/**
 * Returns { start, end } Date objects for the given period, anchored to
 * `referenceDate` (defaults to now). Weeks run Monday -> Sunday.
 */

const ADDIS_OFFSET_MS = 3 * 60 * 60 * 1000;
const getDateRange = (period, referenceDate = new Date()) => {
  const ref = new Date(referenceDate);

  if (period === "daily") {
    const start = new Date(ref);
    start.setHours(0, 0, 0, 0);
    const end = new Date(ref);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  if (period === "weekly") {
    const start = new Date(ref);
    const day = start.getDay(); // 0 = Sunday ... 6 = Saturday
    // Days since Monday (treat Sunday as end of week, not start)
    const diffToMonday = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
  }

  if (period === "monthly") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
    return { start, end };
  }

  throw new Error(`Unknown period: ${period}`);
};


const toAddisWallClock = (date = new Date()) => new Date(date.getTime() + ADDIS_OFFSET_MS);
/**
 * Returns the real (UTC) instant corresponding to 00:00:00 Addis Ababa
 * time on the 1st of the Addis-Ababa calendar month that `date` falls in.
 */
const startOfAddisMonth = (date = new Date()) => {
  const wall = toAddisWallClock(date);
  const y = wall.getUTCFullYear();
  const m = wall.getUTCMonth();
  return new Date(Date.UTC(y, m, 1, 0, 0, 0, 0) - ADDIS_OFFSET_MS);
};

module.exports = { getDateRange, startOfAddisMonth ,toAddisWallClock};
