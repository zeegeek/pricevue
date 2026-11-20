"use server";

import { removeWatchlistItem, upsertWatchlistItem } from "@pricevue/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth, signInUrl } from "@/auth";
import { db } from "@/lib/db";

async function requireUserId(callbackUrl: string) {
  const id = (await auth())?.user?.id;
  if (!id) redirect(signInUrl(callbackUrl));
  return id;
}

export async function trackPrice(variantId: number, targetPaise: number | null, returnTo: string, emailAlerts = true) {
  const userId = await requireUserId(returnTo);
  const target = targetPaise && Number.isInteger(targetPaise) && targetPaise > 0 ? targetPaise : null;
  await upsertWatchlistItem(await db(), userId, variantId, target, emailAlerts);
  revalidatePath("/watchlist");
}

export async function removeFromWatchlist(variantId: number) {
  const userId = await requireUserId("/watchlist");
  await removeWatchlistItem(await db(), userId, variantId);
  revalidatePath("/watchlist");
}
