# Roster Management System

A comprehensive workforce roster and shift management application built for LeapSwitch Networks. Manage team schedules, shifts, leave requests, and organizational structure — all in one place.

## Features

### Core Modules
- **Dashboard** — Overview of team status, shift distribution, and key metrics
- **Roster Management** — Daily, weekly, bi-weekly, and monthly roster views with drag-and-drop support
- **Shift Management** — Create, assign, and swap shifts with validation rules
- **Leave Management** — Submit, approve/reject leave requests with balance tracking
- **Team Management** — Manage team members, roles, departments, and reporting hierarchy

### Advanced Features
- **Rotation Engine** — Automated shift rotation with configurable cycles and sequences
- **Shift Composition Rules** — Minimum staffing requirements per shift type and department
- **WFH & Hybrid Policies** — Work-from-home day tracking and hybrid schedule management
- **Datacenter/Location Support** — Multi-location roster with DC-specific shift availability
- **Org Chart** — Visual organizational hierarchy and reporting structure
- **Role-Based Access Control** — Granular permissions for Admin, HR, Team Lead, Member, and Roster Manager roles
- **2FA Authentication** — TOTP and Email OTP-based two-factor authentication
- **Shift Swap Requests** — Employee-initiated shift swap workflow with manager approval
- **Public Holidays Calendar** — Holiday management integrated with leave tracking
- **Roster Version History** — Snapshot and restore previous roster configurations
- **Database Export** — Full SQL dump download for admins (bypasses 1000-row limit)
- **AI Roster Assistant** — AI-powered roster suggestions and conflict resolution

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| State Management | TanStack React Query |
| Routing | React Router v6 |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions, Storage) |
| Charts | Recharts |
| Animations | Framer Motion |

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/              # shadcn/ui base components
│   └── roster-settings/ # Roster settings sub-components
├── hooks/               # Custom React hooks (auth, mobile, toast)
├── pages/               # Route-level page components
├── layouts/             # Layout wrappers (DashboardLayout)
├── data/                # Mock data for development
├── types/               # TypeScript type definitions
├── utils/               # Utility functions (export, validation, auto-assign)
├── integrations/        # Supabase client & types
└── assets/              # Static assets (logos, images)

supabase/
└── functions/           # Edge Functions (auth, export, AI, sync)
```

## Database Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles linked to auth |
| `team_members` | Employee records with department, role, location |
| `shift_assignments` | Daily shift assignments per member |
| `shift_history` | Audit log of shift changes |
| `leave_requests` | Leave applications with approval workflow |
| `leave_balances` | Annual leave quota tracking |
| `departments` | Department configuration and off-day policies |
| `rotation_config` | Shift rotation cycle settings |
| `member_rotation_state` | Current rotation position per member |
| `swap_requests` | Shift swap request workflow |
| `datacenters` | Datacenter/location definitions |
| `work_locations` | Office and site management |
| `user_roles` | Role-based access control |
| `public_holidays` | Holiday calendar |
| `roster_versions` | Roster snapshot history |
| `shift_composition_rules` | Minimum staffing rules |
| `app_settings` | Application-wide settings |

## Roles & Permissions

| Role | Access Level |
|------|-------------|
| **Admin** | Full system access, user management, database export |
| **HR** | Team management, leave approvals, roster settings |
| **Team Lead** | Team roster management, shift swaps, leave approvals |
| **Roster Manager** | Roster creation and editing |
| **Member** | View own schedule, request leaves and swaps |

## Getting Started

### Prerequisites
- Node.js 18+ (or Bun)
- npm or bun package manager

### Local Development

```bash
# Clone the repository
git clone https://github.com/LSAjinkya/Roster-management.git

# Navigate to project directory
cd Roster-management

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Variables

The following environment variables are required:

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID |

### Self-Hosting Requirements

| Requirement | Details |
|-------------|---------|
| OS | Ubuntu 20.04+ or any Linux distro |
| Node.js | v18+ |
| RAM | Minimum 1GB, recommended 2GB+ |
| Storage | 5GB+ |
| Database | Self-hosted Supabase (Docker) or PostgreSQL |
| Web Server | Nginx or Caddy as reverse proxy |
| SSL | Let's Encrypt via Certbot |

```bash
# Build for production
npm run build

# Serve the dist/ folder via Nginx or any static file server
```

## License

Private — LeapSwitch Networks Internal Use
