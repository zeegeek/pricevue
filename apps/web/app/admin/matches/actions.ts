"use server";

import { approvePendingMatch, rejectPendingMatch } from "@pricevue/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

export async function approveMatch(id: number) {
  const userId = await requireAdmin();
  await approvePendingMatch(await db(), id, userId);
  revalidatePath("/admin/matches");
}

export async function rejectMatch(id: number) {
  const userId = await requireAdmin();
  await rejectPendingMatch(await db(), id, userId);
  revalidatePath("/admin/matches");
}
