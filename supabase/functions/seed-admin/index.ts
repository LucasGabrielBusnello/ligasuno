// Seeds the admin master user. Idempotent.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "lucassgabrielbusnello@gmail.com";
const ADMIN_PASSWORD = "@Lucas27270602";
const ADMIN_USERNAME = "lucas";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Try to find existing user
    const { data: list } = await supabase.auth.admin.listUsers();
    let user = list?.users?.find((u) => u.email === ADMIN_EMAIL);

    if (!user) {
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: { username: ADMIN_USERNAME, full_name: "Lucas Busnello" },
      });
      if (error) throw error;
      user = created.user!;
    } else {
      // Ensure password is correct
      await supabase.auth.admin.updateUserById(user.id, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
    }

    // Ensure profile exists
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        username: ADMIN_USERNAME,
        email: ADMIN_EMAIL,
        full_name: "Lucas Busnello",
      },
      { onConflict: "id" },
    );

    // Ensure admin_master role
    await supabase.from("user_roles").upsert(
      { user_id: user.id, role: "admin_master" },
      { onConflict: "user_id,role" },
    );

    return new Response(JSON.stringify({ ok: true, user_id: user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
