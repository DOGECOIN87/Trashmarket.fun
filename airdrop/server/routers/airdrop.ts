import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { ENV } from '../_core/env';
import {
  getRegistrationByUserId,
  createRegistration,
  updateRegistrationWallet,
  getAllRegistrations,
} from '../db';
import { isValidGorbaganaWallet } from '../../shared/constants';

export const airdropRouter = router({
  getRegistration: protectedProcedure.query(async ({ ctx }) => {
    return getRegistrationByUserId(ctx.user.id);
  }),

  register: protectedProcedure
    .input(
      z.object({
        gorbaganaWallet: z.string().min(32).max(44),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate wallet format
      if (!isValidGorbaganaWallet(input.gorbaganaWallet)) {
        throw new Error('Invalid Gorbagana wallet address format');
      }

      // Check if user already registered
      const existing = await getRegistrationByUserId(ctx.user.id);
      if (existing) {
        throw new Error('User already registered for airdrop');
      }

      // Create registration
      await createRegistration(
        ctx.user.id,
        ctx.user.name || 'Unknown',
        ctx.user.openId,
        input.gorbaganaWallet
      );

      return { success: true };
    }),

  updateWallet: protectedProcedure
    .input(
      z.object({
        gorbaganaWallet: z.string().min(32).max(44),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Validate wallet format
      if (!isValidGorbaganaWallet(input.gorbaganaWallet)) {
        throw new Error('Invalid Gorbagana wallet address format');
      }

      // Check if user is registered
      const existing = await getRegistrationByUserId(ctx.user.id);
      if (!existing) {
        throw new Error('User not registered for airdrop');
      }

      // Update wallet
      await updateRegistrationWallet(ctx.user.id, input.gorbaganaWallet);

      return { success: true };
    }),

  exportRegistrations: protectedProcedure.query(async ({ ctx }) => {
    // Only admins can export
    if (ctx.user.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    return getAllRegistrations();
  }),

  // New real-time admin procedures
  getStats: protectedProcedure.query(async ({ ctx }) => {
    // Only admins can view stats
    if (ctx.user.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    const registrations = await getAllRegistrations();
    const totalCount = registrations.length;

    // Calculate registrations in last 24 hours
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last24h = registrations.filter(
      (reg) => new Date(reg.registeredAt) > oneDayAgo
    ).length;

    // Calculate registrations in last hour
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const lastHour = registrations.filter(
      (reg) => new Date(reg.registeredAt) > oneHourAgo
    ).length;

    return {
      totalCount,
      last24h,
      lastHour,
      timestamp: now,
    };
  }),

  getRecentRegistrations: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).default(10),
      })
    )
    .query(async ({ ctx, input }) => {
      // Only admins can view registrations
      if (ctx.user.role !== 'admin') {
        throw new Error('Unauthorized');
      }

      const registrations = await getAllRegistrations();

      // Sort by most recent first and limit
      return registrations
        .sort(
          (a, b) =>
            new Date(b.registeredAt).getTime() -
            new Date(a.registeredAt).getTime()
        )
        .slice(0, input.limit);
    }),

  getRegistrationStats: protectedProcedure.query(async ({ ctx }) => {
    // Only admins can view stats
    if (ctx.user.role !== 'admin') {
      throw new Error('Unauthorized');
    }

    const registrations = await getAllRegistrations();

    // Group by hour for trend analysis
    const hourlyStats: Record<string, number> = {};
    registrations.forEach((reg) => {
      const date = new Date(reg.registeredAt);
      const hourKey = date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      hourlyStats[hourKey] = (hourlyStats[hourKey] || 0) + 1;
    });

    return {
      total: registrations.length,
      hourlyTrend: Object.entries(hourlyStats)
        .map(([hour, count]) => ({
          hour,
          count,
        }))
        .sort((a, b) => a.hour.localeCompare(b.hour)),
    };
  }),

  // Wallet-based admin access verification
  verifyAdminWallet: protectedProcedure
    .input(
      z.object({
        wallet: z.string().min(32).max(44),
      })
    )
    .mutation(async ({ input }) => {
      const adminWallet = ENV.adminWalletAddress;

      if (!adminWallet) {
        throw new Error('Admin wallet not configured');
      }

      const isAuthorized = input.wallet.trim() === adminWallet.trim();

      return {
        isAuthorized,
        message: isAuthorized
          ? 'Wallet verified for admin access'
          : 'Wallet not authorized for admin access',
      };
    }),
});
