# 📅 Roster Management System

> A comprehensive workforce roster and shift management application built for **LeapSwitch Networks**. Manage team schedules, shifts, leave requests, and organizational structure — all in one place.

![Built with React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-06B6D4?logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Backend-3ECF8E?logo=supabase&logoColor=white)
![License](https://img.shields.io/badge/License-Private-red)

---

## 🌟 Features

### Core Modules

| Module | Description |
|--------|-------------|
| **Dashboard** | Overview of team status, shift distribution, who's out today, WFH staff, and key metrics |
| **Roster Management** | Daily, weekly, bi-weekly, and monthly roster views with drag-and-drop support |
| **Shift Management** | Create, assign, and swap shifts with validation rules and auto-assignment |
| **Leave Management** | Submit, approve/reject leave requests with balance tracking and low-balance alerts |
| **Team Management** | Manage team members, roles, departments, reporting hierarchy, and ID cards |
| **Department Management** | Configure departments, off-day policies, rotation settings, and head assignments |

### Advanced Features

| Feature | Description |
|---------|-------------|
| **Rotation Engine** | Automated 2-week shift rotation: 5 Work → 2 OFF → 5 Work → 2 OFF → Rotate Shift |
| **Team Groups** | Alpha, Beta, Gamma team-based synchronized shift rotation |
| **Shift Composition Rules** | Minimum staffing requirements per shift type, department, and datacenter |
| **WFH & Hybrid Policies** | Work-from-home day tracking, hybrid schedule management with configurable patterns |
| **Datacenter Support** | Multi-location roster with DC-specific shift availability and staff transfers |
| **Org Chart** | Visual organizational hierarchy and reporting structure (tree + chart views) |
| **Role-Based Access Control** | Granular permissions for Admin, HR, Team Lead, Member, and Roster Manager roles |
| **Two-Factor Authentication** | TOTP and Email OTP-based 2FA with backup codes |
| **Shift Swap Requests** | Employee-initiated shift swap workflow with manager approval |
| **Public Holidays Calendar** | Holiday management integrated with leave tracking |
| **Roster Version History** | Snapshot and restore previous roster configurations |
| **Database Export** | Full SQL dump download for admins (bypasses 1000-row limit) |
| **AI Roster Assistant** | AI-powered roster suggestions, conflict resolution, and optimization |
| **Roster Import** | Bulk import roster data from spreadsheets |
| **Bulk Assignments** | Assign shifts and teams in bulk across multiple members |
| **Admin Impersonation** | Admins can impersonate other users for troubleshooting (with audit logging) |
| **Permission Requests** | Members can request elevated permissions with approval workflow |
| **Shift Validation** | Real-time validation warnings for staffing shortages, rest violations, and constraints |
| **Export Options** | Export rosters to Excel, PDF, and other formats |

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite |
| **Styling** | Tailwind CSS, shadcn/ui, Framer Motion |
| **State Management** | TanStack React Query |
| **Routing** | React Router v6 |
| **Drag & Drop** | @hello-pangea/dnd |
| **Backend** | Supabase (PostgreSQL, Auth, Edge Functions, Storage) |
| **Charts** | Recharts |
| **Forms** | React Hook Form + Zod validation |
| **2FA** | qrcode.react (TOTP), Email OTP |
| **Export** | html2canvas (PDF), native Excel export |

---

## 📁 Project Structure

```
src/
├── assets/                  # Static assets (logos, images)
├── components/              # Reusable UI components
│   ├── ui/                  # shadcn/ui base components (40+ components)
│   └── roster-settings/     # Roster settings sub-components
│       ├── DCStaffTransferDialog.tsx
│       ├── DCTransferHistory.tsx
│       ├── DepartmentRosterSettings.tsx
│       ├── InfraTeamSettings.tsx
│       ├── RoleAvailabilitySettings.tsx
│       ├── WeeklyOffPolicySettings.tsx
│       └── WfhPolicySettings.tsx
├── data/                    # Mock data for development
├── hooks/                   # Custom React hooks
│   ├── useAuth.tsx          # Authentication & role management
│   ├── use-mobile.tsx       # Responsive breakpoint detection
│   ├── use-toast.ts         # Toast notification hook
│   └── useInfraTeamSettings.ts  # Infra team configuration
├── integrations/            # External service integrations
│   ├── lovable/             # Lovable platform integration
│   └── supabase/            # Supabase client & auto-generated types
├── layouts/                 # Layout wrappers
│   └── DashboardLayout.tsx  # Main app layout with sidebar
├── lib/                     # Utility libraries
│   └── utils.ts             # cn() and shared utilities
├── pages/                   # Route-level page components
│   ├── Auth.tsx             # Login / Signup page
│   ├── Dashboard.tsx        # Main dashboard
│   ├── Departments.tsx      # Department management
│   ├── LeaveRequests.tsx    # Leave request management
│   ├── OrgChartPage.tsx     # Organizational chart
│   ├── PermissionsMatrix.tsx # Permission management
│   ├── RoleManagement.tsx   # Role configuration
│   ├── Roster.tsx           # Roster views (daily/weekly/monthly)
│   ├── RosterSettings.tsx   # Roster configuration
│   ├── SettingsPage.tsx     # Application settings
│   ├── Shifts.tsx           # Shift management
│   └── Team.tsx             # Team member management
├── types/                   # TypeScript type definitions
│   ├── roster.ts            # Core roster types & constants
│   └── shiftRules.ts        # Shift rules, rotation logic & validation
└── utils/                   # Utility functions
    ├── exportRoster.ts      # Roster export (Excel/PDF)
    ├── rosterValidation.ts  # Roster validation logic
    ├── shiftAutoAssigner.ts # Automatic shift assignment engine
    └── shiftValidator.ts    # Shift constraint validation

supabase/
└── functions/               # Edge Functions (auto-deployed)
    ├── admin-impersonate/   # Admin user impersonation
    ├── ai-roster-assistant/ # AI-powered roster suggestions
    ├── export-database/     # Full database SQL dump export
    ├── send-2fa-otp/        # Email OTP for 2FA
    ├── sync-razorpay/       # Razorpay payment sync
    └── verify-totp/         # TOTP verification
```

---

## 🗄️ Database Schema

### Core Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles linked to auth (name, email, avatar, department, status) |
| `team_members` | Employee records with department, role, team group, location, hybrid settings |
| `shift_assignments` | Daily shift assignments per member with work location |
| `shift_history` | Audit log of all shift changes, swaps, and modifications |
| `leave_requests` | Leave applications with approval workflow and reviewer notes |
| `leave_balances` | Annual leave quota tracking (casual, sick, public holidays) |
| `departments` | Department configuration, off-day policies, rotation settings |

### Rotation & Rules

| Table | Purpose |
|-------|---------|
| `rotation_config` | Shift rotation cycle settings (cycle days, sequence, constraints) |
| `member_rotation_state` | Current rotation position per member (shift type, cycle start) |
| `shift_composition_rules` | Minimum staffing rules per shift/department/datacenter |

### Location & Infrastructure

| Table | Purpose |
|-------|---------|
| `datacenters` | Datacenter/location definitions (name, code, active status) |
| `work_locations` | Office and site management with night shift policies |
| `dc_role_shift_availability` | Role-based shift availability per datacenter |
| `dc_staff_transfers` | Staff transfer records between datacenters |
| `infra_team_settings` | Infrastructure team-specific configuration |

### Access Control & Security

| Table | Purpose |
|-------|---------|
| `user_roles` | Role-based access control (admin, hr, tl, member, roster_manager) |
| `permission_requests` | Permission elevation request workflow |
| `user_2fa_settings` | Two-factor authentication configuration per user |
| `pending_2fa_verification` | Temporary OTP storage for 2FA verification |
| `otp_rate_limits` | Rate limiting for OTP requests |
| `impersonation_logs` | Audit trail for admin impersonation actions |
| `status_history` | User status change tracking |

### Other

| Table | Purpose |
|-------|---------|
| `swap_requests` | Shift swap request workflow with approval |
| `public_holidays` | Holiday calendar by year |
| `roster_versions` | Roster snapshot history for restore |
| `app_settings` | Application-wide key-value settings |

---

## 👥 Roles & Permissions

| Role | Access Level |
|------|-------------|
| **Admin** | Full system access, user management, database export, impersonation |
| **HR** | Team management, leave approvals, roster settings, department config |
| **Team Lead (TL)** | Team roster management, shift swaps, leave approvals for their team |
| **Roster Manager** | Roster creation, editing, bulk assignments, import/export |
| **Member** | View own schedule, request leaves, request shift swaps |

---

## 🔄 Shift Rotation System

The system uses a **2-week (14-day) shift cycle**:

```
Pattern: 5 Work → 2 OFF → 5 Work → 2 OFF → Rotate Shift
Total: 10 work days + 4 OFF days = 14 calendar days per shift
```

### Rotation Order
```
Afternoon → Morning → Night → Afternoon → ...
```

### Team Groups
Three teams rotate in sync so all shifts are always covered:

| Cycle | Alpha | Beta | Gamma |
|-------|-------|------|-------|
| 0 | Morning | Afternoon | Night |
| 1 | Afternoon | Night | Morning |
| 2 | Night | Morning | Afternoon |

### Safety Rules
- Minimum 1 day rest before transitioning to night shift
- Maximum 5 consecutive night shifts
- Minimum 12 hours rest between shifts
- 2 mandatory weekly offs per cycle

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** 18+ (or Bun)
- **npm**, **yarn**, or **bun** package manager

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

The app will be available at `http://localhost:5173`

### Environment Variables

Create a `.env` file in the root directory:

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key | ✅ |
| `VITE_SUPABASE_PROJECT_ID` | Supabase project ID | ✅ |

### Build for Production

```bash
# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```

The build output will be in the `dist/` directory.

---

## 🏗️ Self-Hosting

### Requirements

| Requirement | Details |
|-------------|---------|
| **OS** | Ubuntu 20.04+ or any Linux distro |
| **Node.js** | v18+ |
| **RAM** | Minimum 1GB, recommended 2GB+ |
| **Storage** | 5GB+ |
| **Database** | Self-hosted Supabase (Docker) or PostgreSQL |
| **Web Server** | Nginx or Caddy as reverse proxy |
| **SSL** | Let's Encrypt via Certbot |

### Deployment Steps

```bash
# 1. Build the application
npm run build

# 2. Copy dist/ to your server
scp -r dist/ user@your-server:/var/www/roster

# 3. Configure Nginx (example)
sudo nano /etc/nginx/sites-available/roster
```

**Nginx Configuration:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/roster;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# 4. Enable the site and get SSL
sudo ln -s /etc/nginx/sites-available/roster /etc/nginx/sites-enabled/
sudo certbot --nginx -d your-domain.com
sudo systemctl restart nginx
```

---

## 🔐 Authentication

The system supports:
- **Email/Password** authentication
- **Google OAuth** (configurable domain restriction)
- **Two-Factor Authentication**:
  - TOTP (Time-based One-Time Password) via authenticator apps
  - Email OTP verification
  - Backup codes for recovery

---

## 📊 Key Components

| Component | Purpose |
|-----------|---------|
| `DashboardLayout` | Main app layout with collapsible sidebar navigation |
| `AppSidebar` | Navigation sidebar with role-based menu items |
| `MonthlyRosterView` | Full month calendar roster with shift badges |
| `WeeklyRosterView` | Week-at-a-glance roster view |
| `BiWeeklyRosterView` | Two-week roster aligned with shift cycles |
| `DailyRosterView` | Single day detailed roster with staff counts |
| `TeamOverview` | Team statistics and member cards |
| `ShiftSwapDialog` | Shift swap request form with target selection |
| `LeaveBalanceTracker` | Leave balance display with usage tracking |
| `AIRosterAssistant` | AI chat interface for roster optimization |
| `OrgChart` | Interactive organizational hierarchy visualization |
| `RotationConfigManager` | Shift rotation configuration interface |
| `ShiftCompositionRulesManager` | Minimum staffing rules editor |
| `ProtectedRoute` | Route guard with role-based access control |

---

## 🤝 Contributing

This is a private project for LeapSwitch Networks. For internal contributions:

1. Create a feature branch from `main`
2. Make your changes following the existing code style
3. Test thoroughly across all roster views
4. Submit a pull request with a clear description

---

## 📄 License

**Private** — LeapSwitch Networks Internal Use Only

---

<p align="center">
  Built with ❤️ by <a href="https://leapswitch.com">LeapSwitch Networks</a>
</p>
