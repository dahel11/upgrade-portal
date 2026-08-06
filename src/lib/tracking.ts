import { supabase } from "./supabase";


export function trackVisit(userId: string, path: string): void {
  supabase.functions.invoke("upgrade-tracking-visitor", { body: { user_id: userId, path } }).then(({ error }) => {
    if (error) console.error("[upgrade-tracking-visitor] failed:", error);
  });
}