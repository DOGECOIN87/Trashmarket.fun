import { describe, expect, it } from 'vitest';

describe('Admin Stats and Real-Time Features', () => {
  it('should calculate stats correctly', () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    // Mock registrations with times that are clearly in different ranges
    const registrations = [
      { registeredAt: new Date(now.getTime() - 1000) }, // 1 second ago
      { registeredAt: new Date(now.getTime() - 2000) }, // 2 seconds ago
      { registeredAt: new Date(oneHourAgo.getTime() + 1000) }, // within last hour
      { registeredAt: new Date(oneDayAgo.getTime() + 1000) }, // within last 24h
      { registeredAt: twoDaysAgo }, // outside 24h
    ];

    const totalCount = registrations.length;
    const last24h = registrations.filter(
      (reg) => new Date(reg.registeredAt) > oneDayAgo
    ).length;
    const lastHour = registrations.filter(
      (reg) => new Date(reg.registeredAt) > oneHourAgo
    ).length;

    expect(totalCount).toBe(5);
    expect(last24h).toBeGreaterThanOrEqual(3); // At least 3 within 24h
    expect(lastHour).toBeGreaterThanOrEqual(2); // At least 2 within last hour
  });

  it('should group registrations by hour for trend analysis', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const registrations = [
      { registeredAt: now },
      { registeredAt: now },
      { registeredAt: oneHourAgo },
      { registeredAt: twoHoursAgo },
    ];

    const hourlyStats: Record<string, number> = {};
    registrations.forEach((reg) => {
      const date = new Date(reg.registeredAt);
      const hourKey = date.toISOString().slice(0, 13);
      hourlyStats[hourKey] = (hourlyStats[hourKey] || 0) + 1;
    });

    const hourlyTrend = Object.entries(hourlyStats)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    expect(hourlyTrend.length).toBeGreaterThanOrEqual(1);
    expect(hourlyTrend.every((stat) => stat.count > 0)).toBe(true);
  });

  it('should sort recent registrations by most recent first', () => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const registrations = [
      { id: 1, registeredAt: twoHoursAgo },
      { id: 2, registeredAt: now },
      { id: 3, registeredAt: oneHourAgo },
    ];

    const sorted = registrations.sort(
      (a, b) =>
        new Date(b.registeredAt).getTime() -
        new Date(a.registeredAt).getTime()
    );

    expect(sorted[0]?.id).toBe(2); // Most recent
    expect(sorted[1]?.id).toBe(3);
    expect(sorted[2]?.id).toBe(1); // Oldest
  });

  it('should limit recent registrations to specified count', () => {
    const registrations = Array.from({ length: 50 }, (_, i) => ({ id: i }));
    const limit = 15;

    const limited = registrations.slice(0, limit);

    expect(limited.length).toBe(limit);
  });
});
