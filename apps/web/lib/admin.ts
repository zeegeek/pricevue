import "server-only";
import { notFound } from "next/navigation";
import { auth } from "@/auth";

const adminEmails = () =>
  new Set((process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));

/** Returns the signed-in admin's user id; anyone else (including signed-out visitors) gets a 404. */
export async function requireAdmin(): Promise<string> {
  const user = (await auth())?.user;
  if (!user?.id || !user.email || !adminEmails().has(user.email.toLowerCase())) notFound();
  return user.id;
}
