import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";

export default async function Home() {
  const { user } = await requireUser();
  redirect(user ? "/campanhas" : "/login");
}
