import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are an AI Roster Assistant for LeapSwitch Networks' shift management system. You help administrators set up, optimize, and troubleshoot monthly rosters.

## Your Knowledge

### Shift System
- **Rotation Order**: Afternoon (13:00-22:00) → Morning (07:00-16:00) → Night (21:00-07:00)
- **Cycle**: 14 days per shift type — 5 Work → 2 OFF → 5 Work → 2 OFF → Rotate
- **General Shift**: 10:00-19:00 (for TLs, Managers, HR, Admin)

### Role Eligibility
- **Admin/Manager/TL/HR**: General shift only (non-rotating)
- **L1/L2/L3**: Full rotation (Morning/Afternoon/Night)
- **Trainee**: Morning & Afternoon only (no night shifts)

### Departments
- **Rotating**: Support, Monitoring, CloudPe, Network, AW, Infra
- **Fixed (General)**: HR, Vendor Coordinator

### Week-Off Patterns
- **Staggered**: Members get offs on different days (ensures 24/7 coverage)
- **Fixed**: Everyone gets specific days off (e.g., weekends)
- Each member gets 1-2 week-off days per cycle (configurable)

### Key Rules
1. Maximum 7 consecutive work days (hard limit)
2. Minimum 1 rest day before transitioning to night shift
3. Week-offs must not split (2 consecutive days)
4. Shift composition rules define minimum staff per shift/department/datacenter
5. Public holidays give everyone a day off
6. Leave requests (casual, sick) are respected during generation

### Cross-Month Continuity
- The system tracks 14 cycle states to maintain patterns across month boundaries
- States: Day 1-5 (Block 1 work), OFF 1st/2nd (Block 1 off), Day 6-10 (Block 2 work), OFF 3rd/4th (Block 2 off, then rotate)

## What You Can Help With

1. **Roster Setup**: Guide users through selecting departments, months, rotation settings
2. **Optimization**: Suggest better configurations for coverage, fairness, and compliance
3. **Troubleshooting**: Diagnose shortages, continuity issues, or rule violations
4. **Explanations**: Explain how the algorithm works, why certain assignments were made
5. **Best Practices**: Recommend staffing levels, rotation patterns, week-off distribution

## Response Style
- Be concise and actionable
- Use tables or bullet lists for structured data
- When suggesting roster changes, be specific (member name, date, shift)
- Flag potential issues proactively
- Use shift abbreviations: M (Morning), A (Afternoon), N (Night), G (General), OFF (Week-off), PO (Public Off)

## Context Provided
You may receive context about the current roster state including:
- Team members with their roles, departments, and current rotation states
- Current month's assignments
- Composition rules and staffing requirements
- Public holidays and leave requests
- Department configurations

Use this context to provide informed, specific recommendations.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Build context message if provided
    let contextMessage = "";
    if (context) {
      const parts: string[] = [];

      if (context.month) {
        parts.push(`**Target Month**: ${context.month}`);
      }
      if (context.departments?.length) {
        parts.push(`**Selected Departments**: ${context.departments.join(", ")}`);
      }
      if (context.teamMembers?.length) {
        const summary = context.teamMembers.map(
          (m: any) => `${m.name} (${m.role}, ${m.department})`
        );
        parts.push(`**Team Members** (${context.teamMembers.length}):\n${summary.join("\n")}`);
      }
      if (context.rotationStates?.length) {
        const states = context.rotationStates.map(
          (s: any) => `${s.member_id}: ${s.current_shift_type} (cycle start: ${s.cycle_start_date})`
        );
        parts.push(`**Current Rotation States**:\n${states.join("\n")}`);
      }
      if (context.compositionRules?.length) {
        const rules = context.compositionRules.map(
          (r: any) => `${r.department} - ${r.shift_type}: min ${r.min_count} staff`
        );
        parts.push(`**Staffing Rules**:\n${rules.join("\n")}`);
      }
      if (context.publicHolidays?.length) {
        parts.push(`**Public Holidays**: ${context.publicHolidays.join(", ")}`);
      }
      if (context.weeklyOffPolicy) {
        parts.push(`**Week-Off Policy**: ${context.weeklyOffPolicy.weekOffPattern} pattern, ${context.weeklyOffPolicy.defaultOffDays} off days`);
      }
      if (context.currentAssignments) {
        parts.push(`**Current Assignments**: ${context.currentAssignments} total`);
      }

      if (parts.length > 0) {
        contextMessage = "\n\n---\n**Current Roster Context:**\n" + parts.join("\n\n");
      }
    }

    const systemWithContext = SYSTEM_PROMPT + contextMessage;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: systemWithContext },
            ...messages,
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-roster-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
