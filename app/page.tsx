import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SupabaseSetupNotice } from "@/components/crawler/SupabaseSetupNotice";

export default function RootPage() {
  if (!isSupabaseConfigured) {
    return <SupabaseSetupNotice />;
  }
  redirect("/clients");
}
