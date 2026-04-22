# Roster Management — Logic & Rules Reference

> **Stack**: React + Vite + TypeScript · Supabase (PostgreSQL 16)  
> **App URL**: https://ls-calendar.leapswitch.com  
> **Last reviewed**: 2026-04-22

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Department Configuration](#2-department-configuration)
3. [Role Definitions & Shift Eligibility](#3-role-definitions--shift-eligibility)
4. [Shift Definitions](#4-shift-definitions)
5. [Rotation Algorithm](#5-rotation-algorithm)
6. [Week-Off Rules](#6-week-off-rules)
7. [Night Shift Safety Rules](#7-night-shift-safety-rules)
8. [Shift Stability Rule](#8-shift-stability-rule)
9. [Minimum Staffing Rules (Shift Composition)](#9-minimum-staffing-rules-shift-composition)
10. [Leave & Absence Handling](#10-leave--absence-handling)
11. [WFH Policy](#11-wfh-policy)
12. [Auto-Assignment Logic (Step by Step)](#12-auto-assignment-logic-step-by-step)
13. [Validation Rules & Violations](#13-validation-rules--violations)
14. [Roster Versioning & Audit](#14-roster-versioning--audit)
15. [Key Database Tables](#15-key-database-tables)
16. [Team Groups (Alpha / Beta / Gamma)](#16-team-groups-alpha--beta--gamma)
17. [DC (Datacenter) Transfer & Infra Team](#17-dc-datacenter-transfer--infra-team)

---

## 1. System Overview

The roster application manages shift scheduling for a 24/7 operations team. It handles rotating shifts (morning / afternoon / night) for operational departments and fixed general shifts for non-operational departments.

**Core data flow:**

```
Departments → Team Members → Rotation Config → Shift Assignments
```

**Roster creation steps:**
1. Configure departments (rotation on/off, work/off cycle)
2. Set role availability (which roles work which shifts)
3. Define staffing rules (minimum headcount per shift per dept)
4. Set rotation config (14-day cycle, shift sequence, constraints)
5. Track member rotation state (where each member is in cycle)
6. Generate assignments (apply rotation, check constraints, handle leaves)
7. Validate staffing (ensure minimum coverage met)
8. Publish roster (snapshot as a version)

---

## 2. Department Configuration

### Rotating Departments (24/7 shift rotation)

| Department | Rotation |
|---|---|
| Infra | Yes |
| Network | Yes |
| Support | Yes |
| Monitoring | Yes |
| AW | Yes |
| CloudPe | Yes |

### Non-Rotating Departments (Fixed General Shift)

| Department | Shift |
|---|---|
| Development | General (10:00–19:00) |
| Billing | General |
| Marketing | General |
| Sales | General |
| HR | General |
| Admin | General |
| Vendor Coordinator | General |

### Per-Department Settings (configurable in Roster Settings)

| Setting | Description | Default |
|---|---|---|
| `work_days_per_cycle` | Consecutive work days before off | 5 |
| `off_days_per_cycle` | Consecutive off days after work block | 2 |
| `rotation_enabled` | Whether the dept uses shift rotation | Varies |
| `week_off_pattern` | `fixed` or `staggered` | `staggered` |
| `fixed_off_days` | Days for fixed pattern (e.g., Sat/Sun) | Saturday, Sunday |

---

## 3. Role Definitions & Shift Eligibility

| Role | Eligible Shifts | Notes |
|---|---|---|
| L1 | Morning, Afternoon, Night | Fully rotating |
| L2 | Morning, Afternoon, Night | Fully rotating |
| L3 | Morning, Afternoon, Night | Fully rotating |
| TL | General only | Exempt from rotation |
| Manager | General only | Exempt from rotation |
| HR | General only | Exempt from rotation |
| Admin | General only | Exempt from rotation |
| Trainee | Morning, Afternoon only | No night shifts |

**Rule**: Even if a TL is in a rotating department (e.g., Infra), they are assigned the General shift, not a rotating shift.

---

## 4. Shift Definitions

| Shift | Code | Start | End | Description |
|---|---|---|---|---|
| Morning | `morning` | 07:00 | 16:00 | Early shift |
| Afternoon | `afternoon` | 13:00 | 22:00 | Mid shift |
| Night | `night` | 21:00 | 07:00 | Overnight |
| General | `general` | 10:00 | 19:00 | For non-rotating roles |
| Week Off | `week-off` | — | — | Scheduled rest day |
| Public Off | `public-off` | — | — | Public holiday |
| Paid Leave | `paid-leave` | — | — | Leave from balance |
| Comp Off | `comp-off` | — | — | Compensatory off |
| Leave | `leave` | — | — | Generic/sick leave |

---

## 5. Rotation Algorithm

### Cycle Structure

```
[5 Work Days] → [2 OFF Days] → [5 Work Days] → [2 OFF Days] → Rotate Shift
         ↑ One "block"                    ↑ One "block"
         Total: 14 calendar days per shift = 10 work + 4 off
```

| Constant | Value |
|---|---|
| Work days per block | 5 |
| Off days per block | 2 |
| Blocks per shift | 2 |
| Total work days per shift | 10 |
| Total off days per shift | 4 |
| Full cycle calendar days | 14 |

### Shift Rotation Order

```
Afternoon → Morning → Night → Afternoon → ...
```

After completing 10 work days on one shift, a member moves to the next shift in this fixed sequence. The rotation is circular and continuous.

### Rotation State Per Member

Each member has a `member_rotation_state` record that tracks:
- `current_shift_type` — which shift they are currently on
- `cycle_start_date` — when the current shift cycle began

This state persists across months and is used as the starting point when generating the next month's roster.

### Month Boundary Continuity

When generating a new month's roster, the previous month's assignments are passed in. The system:
1. Looks at the last assignments from the prior month
2. Counts consecutive work days carried over
3. Picks up the rotation exactly where it left off — no reset at month boundary

---

## 6. Week-Off Rules

### Two Patterns

**Fixed Pattern**
- All team members in the department get the same days off (e.g., Saturday & Sunday)
- Safety hard limit: if a member reaches 7 consecutive work days, a week-off is forced regardless

**Staggered Pattern** *(default for 24/7 operations)*
- Different members get their off days on different days of the week
- This ensures continuous coverage — not everyone is off at the same time
- Each member is assigned an `offset` (0–6) based on their index within the department
- The staggered threshold varies: 5, 6, or 7 consecutive work days based on the offset

### Week-Off Decision Priority (Staggered Mode)

| Priority | Rule | Trigger |
|---|---|---|
| 1 (Hard) | Max consecutive work days hit | After 7 consecutive work days |
| 2 | Night shift transition safety | Morning → Night requires rest |
| 3 | Staggered threshold reached | After 5–7 days (based on offset) |
| 4 | Rolling 7-day compliance | If skipping today would cause violation tomorrow |

### Rolling 7-Day Compliance

Within any rolling 7-day window, each member must have at least their entitled number of off days (1 or 2). The system looks ahead: if assigning a work day today would make the 7-day compliance impossible tomorrow, a week-off is inserted today.

### Per-Member Week-Off Entitlement

Members can have 1 or 2 off days per 7-day cycle (stored as `weekOffEntitlement` on the team member). The default is 2. This affects both assignment generation and validation checks.

---

## 7. Night Shift Safety Rules

Before assigning a member to a night shift, the system checks for mandatory rest.

| Scenario | Rule |
|---|---|
| Transitioning from Morning to Night | At least 1 rest day required (2 recommended) |
| Transitioning from Afternoon to Night | At least 1 rest day required |
| Max consecutive night shifts | 5 nights maximum |
| Night → Morning (next calendar day) | Flagged as insufficient rest violation |

**Constants:**
- `REST_DAYS_BEFORE_NIGHT` = 1 (minimum)
- `MAX_REST_DAYS_BEFORE_NIGHT` = 2 (recommended)
- `maxConsecutiveNights` = 5

During auto-assignment, if a member is due to transition to night shift and needs rest, the system automatically inserts a week-off day before the night block begins.

---

## 8. Shift Stability Rule

A member must stay on the **same shift for a minimum of 10 consecutive work days** before rotating.

- This spans 14 calendar days (10 work + 4 off)
- Violations of this rule are flagged as `severity: warning` (not error), because a shift cycle can span two calendar months
- Rotation order is always: **Afternoon → Morning → Night**

---

## 9. Minimum Staffing Rules (Shift Composition)

Stored in the `shift_composition_rules` table (28 active rules). The system validates that each shift has the required number of staff present.

### Staffing Requirements

| Department | Shift | Min Count | Role Filter |
|---|---|---|---|
| Infra | Morning | 2 | Any |
| Infra | Afternoon | 2 | Any |
| Infra | Night | 2 | Any |
| Support | Morning | 3 | L2 only |
| Support | Afternoon | 3 | L2 only |
| Support | Night | 2 | Any |
| Network | Morning | 1 | Any |
| Network | Afternoon | 1 | Any |
| Network | Night | 1 | Any |
| Monitoring | Morning | 1 | Any |
| Monitoring | Afternoon | 1 | Any |
| Monitoring | Night | 1 | Any |
| CloudPe | Morning | 1 | Any |
| CloudPe | Afternoon | 1 | Any |
| CloudPe | Night | 1 | Any |
| AW | Morning | 1 | Any |
| AW | Afternoon | 1 | Any |
| AW | Night | 1 | Any |

Rules can optionally be scoped to a specific `datacenter_id`. Rules with `is_active = false` are ignored.

### Shortage Violations

When a shift falls below the minimum count, a `ShiftViolation` of type `shortage` with `severity: error` is generated. These appear in the roster validation report and are also surfaced live during auto-assignment.

---

## 10. Leave & Absence Handling

### Leave Types

| Type | Code | Description |
|---|---|---|
| Paid Leave | `paid-leave` | Deducted from annual balance |
| Sick Leave | `leave` (sick) | Sick leave balance |
| Casual Leave | `casual` | Casual leave balance |
| Comp Off | `comp-off` | Earned compensatory rest |
| Week Off | `week-off` | Scheduled roster off day |
| Public Holiday | `public-off` | National/public holiday |

### Annual Leave Balances

| Leave Type | Annual Allowance |
|---|---|
| Casual Leave | 20 days |
| Sick Leave | 10 days |
| Public Holidays | 11 days |

### Leave Workflow

```
Requested → Approved → Reflected in Roster
```

- Approved leaves are loaded during roster generation
- On a leave day, no shift is assigned; instead the leave type is recorded as the shift assignment
- Leave days reset the consecutive work day counter (treated as rest)
- Leave days do NOT consume from the weekly off entitlement

### Priority During Auto-Assignment

1. **Leave** (approved) — assigned first, overrides all shift logic
2. **Public Holiday** — if enabled in config, assigned before shift logic
3. **Week-off** — assigned based on rotation state
4. **Work shift** — assigned last if none of the above apply

---

## 11. WFH Policy

Stored in `app_settings` under key `wfh_policy`.

| Setting | Default | Description |
|---|---|---|
| `enabled` | `true` | Master toggle for WFH policy |
| `defaultWfhDays` | 2 | Default WFH days per week |
| `maxWfhDays` | 3 | Maximum allowed WFH days per week |
| `minOfficeDays` | 2 | Minimum office days required per week |
| `nightShiftWfhAllowed` | `true` | Night shift workers can WFH |
| `requireApproval` | `false` | Whether WFH requires approval |
| `eligibleAfterDays` | 90 | Days of employment before WFH eligibility |

**Additional constraints from CLAUDE.md:**
- Max 1 WFH day per cycle (overriding the per-week default in practice)
- Min 4 office days required per cycle
- Night shifts can be WFH
- Requires approval
- Eligible after 90 days of employment

---

## 12. Auto-Assignment Logic (Step by Step)

The main function is `autoAssignShifts()` in `src/utils/shiftAutoAssigner.ts`.

### Inputs

- `startDate`, `endDate` — date range to generate
- `teamMembers` — full list of members
- `rules` — shift composition rules
- `leaveRequests` — approved leaves in the period
- `publicHolidays` — list of holiday dates
- `memberRotationStates` — current rotation state per member
- `previousMonthAssignments` — last month's assignments for continuity
- `weeklyOffPolicy` — fixed or staggered configuration

### Processing Order (per day, per member)

```
1. Is member on approved leave?
      → Assign leave type, reset work day counter, skip to next

2. Is it a public holiday (and config.respectPublicHolidays = true)?
      → Assign `public-off`, reset work day counter, skip to next

3. Should member get a week-off today?
      → Evaluate based on pattern (fixed/staggered) + all week-off rules
      → If yes: assign `week-off`, decrement offDaysRemaining
              After using all off days: reset offDaysRemaining + check if shift should rotate

4. Assign work shift:
      → TL / Manager / HR / Admin / General-dept member → assign `general`
      → Rotating member (L1/L2/L3 in rotating dept) → calculate shift from rotation state
              Use getMemberShiftTypeForDate() with cycleStartDate + current shift type

5. Update member state:
      → Increment consecutiveWorkDays and workDaysInCurrentShift
      → Record lastShiftType
```

### Post-Day Validation

After all members are assigned for a day, the system checks each active staffing rule against the day's assignments. Any shortfalls are recorded as `ShiftViolation` entries returned alongside the assignments.

### Member State Initialization

At the start of each generation run, each member's state is calculated from their previous month's assignments:
- Last work shift type → determines current shift
- Consecutive work days at end of month → carried forward
- `pendingNightTransition` flag → if last shift was Morning and next in sequence is Night

---

## 13. Validation Rules & Violations

All validation is in `src/utils/rosterValidation.ts` and `src/utils/shiftValidator.ts`.

### Validation Priority Order

```
1. Work cycle (5 Work + 2 OFF)     — HIGHEST PRIORITY (error)
2. Night shift rest rule            — (error)
3. Shift continuity (10 days)       — (warning)
4. Shift rotation order             — (warning)
5. Staffing shortages               — (error)
```

### Rule 1 — Work Cycle Compliance

| Check | Condition | Severity |
|---|---|---|
| Max consecutive work days | > 5 work days in a row | error |
| Off day blocks | Single isolated off day (must be 2 consecutive) | error |
| Weekly off count | < 2 off days in any full week | error |
| Minimum off days | 0 off days in the entire period | error |

### Rule 2 — Night Shift Transition Safety

| Check | Condition | Severity |
|---|---|---|
| Rest before night | < 1 rest day immediately before a night shift starts | error |

### Rule 3 — Shift Stability

| Check | Condition | Severity |
|---|---|---|
| Min days on shift | Shift changed after < 10 consecutive work days | warning |

### Rule 4 — Rotation Order

| Check | Condition | Severity |
|---|---|---|
| Rotation sequence | Next shift is not the expected one in Afternoon → Morning → Night | warning |

### Rule 5 — Staffing Composition

| Check | Condition | Severity |
|---|---|---|
| Min staff per shift | Actual count < min_count for any active rule | error |

### Auto-Fix

`autoFixRosterViolations()` can automatically insert week-off days to resolve consecutive work day violations. It iterates each rotating member and forces `week-off` after every 5 consecutive work days.

### Deduplication

Violations are deduplicated by `(memberId, date, type)` before being returned to avoid duplicate alerts for the same underlying issue.

---

## 14. Roster Versioning & Audit

| Table | Purpose |
|---|---|
| `roster_versions` | Snapshots of rosters — status: `draft` → `published` |
| `shift_history` | Full audit log of every create / update / swap action |
| `status_history` | Records every status change with timestamp and actor |

A published roster version is a frozen snapshot. Edits after publish create a new draft version.

---

## 15. Key Database Tables

| Table | Records (as of Feb 2026) | Purpose |
|---|---|---|
| `shift_assignments` | 6,268 | Individual shift per member per date |
| `team_members` | 112 | Employee master data |
| `departments` | 14 | Department config (rotation, cycle) |
| `rotation_config` | 1 | Global rotation rules |
| `shift_composition_rules` | 28 | Min staff requirements per shift/dept |
| `member_rotation_state` | 112 | Current rotation state per member |
| `leave_requests` | — | Leave request workflow |
| `leave_balances` | — | Annual leave entitlements |
| `shift_history` | 16 | Audit log of shift changes |
| `roster_versions` | — | Roster snapshots |
| `app_settings` | — | WFH policy, weekly off policy, etc. |
| `profiles` | 21 | User authentication profiles |
| `user_roles` | 22 | Role-based access control |
| `work_locations` | — | Office/datacenter/remote locations |
| `datacenters` | — | DC definitions (LNT, YOTTA, etc.) |

---

## 16. Team Groups (Alpha / Beta / Gamma)

The app supports grouping members into three teams for synchronized rotation.

| Cycle | Alpha | Beta | Gamma |
|---|---|---|---|
| 0 | Morning | Afternoon | Night |
| 1 | Afternoon | Night | Morning |
| 2 | Night | Morning | Afternoon |

- The cycle number increments after each complete shift rotation
- When Alpha is on Morning, Beta is always on Afternoon and Gamma is always on Night
- This ensures all three shifts are covered at any given time

**Functions:**
- `getTeamShiftForCycle(team, cycleNumber)` — returns the shift for a team at a given cycle
- `getAllTeamShiftsForCycle(cycleNumber)` — returns shifts for all three teams

---

## 17. DC (Datacenter) Transfer & Infra Team

The Infra department has additional configuration for datacenter assignment:

- Each Infra member can be assigned to a specific datacenter (`datacenterId`)
- Shift composition rules can be scoped to a specific datacenter (`datacenter_id` on the rule)
- The **DC Transfer** feature (`RosterDCTransferButton`, `DCStaffTransferDialog`) allows moving members between datacenters with a transfer history log
- Minimum staffing rules can differ per datacenter within the same department

---

## Summary: Constants Quick Reference

| Constant | Value | Source |
|---|---|---|
| Work days per block | 5 | `WORK_DAYS_PER_BLOCK` |
| Off days per block | 2 | `OFF_DAYS_PER_BLOCK` |
| Work blocks per shift | 2 | `WORK_BLOCKS_PER_SHIFT` |
| Total work days per shift | 10 | `TOTAL_WORK_DAYS_PER_SHIFT` |
| Full cycle (calendar days) | 14 | `FULL_SHIFT_CYCLE_DAYS` |
| Max consecutive work days | 7 | `MAX_CONSECUTIVE_WORK_DAYS` |
| Min consecutive work days | 3 | `MIN_CONSECUTIVE_WORK_DAYS` |
| Shift rotation order | Afternoon → Morning → Night | `SHIFT_ROTATION_ORDER` |
| Min rest before night shift | 1 day | `REST_DAYS_BEFORE_NIGHT` |
| Max consecutive nights | 5 | `maxConsecutiveNights` |
| Shift stability (work days) | 10 | `SHIFT_STABILITY_WORK_DAYS` |
| Min weekly offs | 2 | `MIN_WEEKLY_OFFS` |
| Casual leave (annual) | 20 days | — |
| Sick leave (annual) | 10 days | — |
| Public holidays (annual) | 11 days | — |
| WFH eligibility after | 90 days | `eligibleAfterDays` |
