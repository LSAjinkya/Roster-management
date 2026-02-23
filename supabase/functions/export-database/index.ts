import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TABLES = [
  "app_settings",
  "datacenters",
  "dc_role_shift_availability",
  "dc_staff_transfers",
  "departments",
  "impersonation_logs",
  "infra_team_settings",
  "leave_balances",
  "leave_requests",
  "member_rotation_state",
  "otp_rate_limits",
  "pending_2fa_verification",
  "permission_requests",
  "profiles",
  "public_holidays",
  "roster_versions",
  "rotation_config",
  "shift_assignments",
  "shift_composition_rules",
  "shift_history",
  "status_history",
  "swap_requests",
  "team_members",
  "user_2fa_settings",
  "user_roles",
  "work_locations",
];

function escapeSQL(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object") return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user is admin using their token
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build SQL dump
    const lines: string[] = [];
    lines.push("-- Database Export");
    lines.push(`-- Generated at: ${new Date().toISOString()}`);
    lines.push(`-- Exported by: ${user.email}`);
    lines.push("");

    // Get schema info via information_schema
    const { data: columns } = await adminClient
      .from("information_schema.columns" as any)
      .select("table_name, column_name, data_type, is_nullable, column_default, ordinal_position")
      .eq("table_schema", "public")
      .in("table_name", TABLES)
      .order("ordinal_position", { ascending: true });

    // This won't work via PostgREST, so we'll just dump data with column names
    // and add CREATE TABLE as comments from known schema

    for (const tableName of TABLES) {
      lines.push(`-- ============================================`);
      lines.push(`-- Table: ${tableName}`);
      lines.push(`-- ============================================`);
      lines.push("");

      // Fetch ALL rows using range pagination (no 1000 limit)
      let allRows: Record<string, unknown>[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await adminClient
          .from(tableName)
          .select("*")
          .range(from, from + pageSize - 1);

        if (error) {
          lines.push(`-- Error fetching ${tableName}: ${error.message}`);
          break;
        }

        if (data && data.length > 0) {
          allRows = allRows.concat(data);
          from += pageSize;
          hasMore = data.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      lines.push(`-- Row count: ${allRows.length}`);

      if (allRows.length > 0) {
        const columnNames = Object.keys(allRows[0]);
        const colList = columnNames.map((c) => `"${c}"`).join(", ");

        for (const row of allRows) {
          const values = columnNames.map((col) => escapeSQL(row[col])).join(", ");
          lines.push(`INSERT INTO public."${tableName}" (${colList}) VALUES (${values});`);
        }
      }

      lines.push("");
    }

    const sqlContent = lines.join("\n");

    return new Response(sqlContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/sql",
        "Content-Disposition": `attachment; filename="database_export_${new Date().toISOString().split("T")[0]}.sql"`,
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
