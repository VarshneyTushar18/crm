# Bright Balustrading CRM
## Daily Implementation Update — 6 July 2026

| Field | Detail |
|-------|--------|
| **Project** | Bright Balustrading CRM |
| **Base platform** | IDURAR ERP/CRM (customized) |
| **Developer** | Tech2Globe |
| **Update date** | 6 July 2026 |
| **Update type** | Daily progress + post-implementation fixes |

**Live environments**

| Layer | URL |
|-------|-----|
| Frontend | https://crm-front-dun.vercel.app |
| Backend | https://crm-six-lake.vercel.app |

---

## 1. Executive summary

Today's session focused on closing remaining Site Engineer workflow gaps from the recent development cycle, fixing issues found during production testing on Vercel, and confirming phase enhancements are stable in code.

| Category | Count | Status |
|----------|------:|--------|
| Phase enhancements (earlier this cycle) | 13 | ✅ Completed |
| Work completed today (6 July) | 7 | ✅ Completed (code pushed) |
| Post-implementation fixes (from testing) | 7 | ✅ Fixed in code |
| Pending verification / assigned | 4 | ⚠️ After client redeploy |

**One-line summary for management:**  
Fixed production login/API routing, Site Engineer timeline sync, scheduling-to-SE workflow, and Vercel file uploads; improved job context pinning across modules; all changes pushed to `main` — pending live redeploy and UAT on production.

---

## 2. Section A — Work requested and completed (in scope)

### A1. Phase enhancements (completed earlier in this development cycle)

| # | Feature | Status | Location / evidence |
|---|---------|--------|---------------------|
| 1 | QC fabrication gate — block QC until fabrication complete + SE approved | ✅ Completed | `backend/src/controllers/qc.controller.js` |
| 2 | NCR (Non-Conformance Report) + re-inspection workflow | ✅ Completed | `ncr.controller.js`, QC UI |
| 3 | Installation sequence enforcement | ✅ Completed | `installationSequence.js`, Installation UI |
| 4 | Installer job cards + execution parameters | ✅ Completed | `JobCard.js`, Worker/Installation UI |
| 5 | Per-worker hours on installation activities + productivity rollup | ✅ Completed | `productivityRollup.js`, `/admin/productivity` |
| 6 | Manual progress % UI on Job View (20/40/60/80/100) | ✅ Completed | `frontend/src/pages/Jobs/JobView.jsx` |
| 7 | Strict Site Engineer gate per workflow stage | ✅ Completed | `workflowGates.js`, `moduleSiteEngineerGate.js` |
| 8 | Schedule priority field on assignments + Scheduling UI | ✅ Completed | `ScheduleAssignment` model, `Scheduling/index.jsx` |
| 9 | Worker daily schedule view with maps links on worker dashboard | ✅ Completed | Worker dashboard |
| 10 | Admin notification read-receipt view | ✅ Completed | Admin notifications module |
| 11 | Site Engineer assigned-jobs filter on jobs list | ✅ Completed | Jobs list (SE view) |
| 12 | Attendance worker self-service | ✅ Completed | Attendance module |
| 13 | Productivity CSV export | ✅ Completed | `/admin/productivity` |

### A2. Work completed on 6 July 2026

| # | Feature | Status | Location / evidence |
|---|---------|--------|---------------------|
| 1 | **Job context pinning** — opening a job from the timeline keeps workflow modules (Planning, Drafting, Site Measurement, etc.) pinned to that job via `?jobId=` | ✅ Completed | `JobContext.jsx` (`pinJob`), `WorkflowJobSelector.jsx`, `workflowJobScope.js`, `NavigationContainer.jsx` |
| 2 | **Planning module fix** — removed incorrect requirement that Site Measurement must complete before Planning can start | ✅ Completed | Planning module |
| 3 | **Site Engineer approval → job timeline sync** — after SE approves a module, timeline shows **Approved** instead of stuck on **SE Review Pending** | ✅ Completed | `siteEngineer.controller.js`, `syncModuleReviewWorkflow.js`, `workflowConfig.js`, `JobView.jsx` — commit `3e14247` |
| 4 | **Mark Scheduling Complete** — explicit button + API to send Scheduling to SE Approvals (same pattern as Planning) | ✅ Completed | `scheduling.controller.js` (`completeForJob`), `scheduling.routes.js`, `extensionApi.js`, `Scheduling/index.jsx` — commit `b22978c` |
| 5 | **SE approval module guide** — documented how all 12 SE-gated modules reach Site Engineer Approvals | ✅ Completed | Session documentation (see Section 6) |
| 6 | **Production deployment fixes** — Vercel CORS + API routing so `/api/auth/login` and subpaths reach Express | ✅ Completed | `vercel.json`, `corsOrigins.js`, `api/index.js` — commits `5fdb10e`, `b741f32`, `393c12d` |
| 7 | **File upload fix for Vercel** — uploads failing/hanging because serverless cannot write to disk; fixed with memory upload + MongoDB GridFS + signed URLs | ✅ Completed | `persistUpload.js`, `createMemoryUpload.js`, `fileDownload.controller.js` — commit `09a55e1` |

---

## 3. Section B — Post-implementation fixes

Issues found during testing after features were built, and fixes applied.

| # | Issue | Root cause | Fix | Commit |
|---|-------|------------|-----|--------|
| 1 | Production login failed (CORS / 404) | Vercel rewrites did not pass `/api/*` subpaths to Express; CORS not applied early | Root `vercel.json` rewrite + early OPTIONS/CORS in `api/index.js` | `5fdb10e`, `b741f32` |
| 2 | Frontend Vercel build failed | Syntax error in `workflowConfig.js` — missing function | Restored `isStageWorkComplete` | `393c12d` |
| 3 | SE approved Planning but timeline still showed **SE Review Pending** | `updateStatus` approved review but did not sync `job.workflowEvents[stage].siteEngineerStatus` | `approveModuleReview` / `rejectModuleReview` on status update + backfill on job read | `3e14247` |
| 4 | Scheduling never appeared in SE Approvals for job **J-20260706-6444** | Scheduling only triggered when all assignments were Completed; no explicit send-to-SE action like Planning | **Mark Scheduling Complete** button + API | `b22978c` |
| 5 | File upload stuck on spinner (PDF on Site Measurement) | Multer disk storage to `/uploads/` fails on Vercel serverless | Memory upload + MongoDB GridFS + `/api/files/:id?sig=` | `09a55e1` |
| 6 | Opening job from timeline lost job selection in workflow modules | No job pinning across module navigation | `pinJob`, `WorkflowJobSelector`, `goWithJob()` in navigation | With job context work |
| 7 | Planning blocked incorrectly | Required site measurement complete before planning tasks | Requirement removed from planning eligibility | With planning fix |

---

## 4. Section C — Yet to do / assigned

Code is pushed to `main`. The following items require **client redeploy on Vercel** and **UAT on production**:

| # | Item | Owner | Status |
|---|------|-------|--------|
| 1 | Redeploy **frontend** (`crm-front-dun`) and **backend** (`crm-six-lake`) from latest `main` (`09a55e1`) | Client / DevOps | ⚠️ Pending |
| 2 | **UAT: Login** — confirm admin and SE login work on production after redeploy | Client | ⚠️ After redeploy |
| 3 | **UAT: File upload** — Site Measurement PDF upload completes and file appears in list | Client | ⚠️ After redeploy |
| 4 | **UAT: Scheduling → SE** — job `J-20260706-6444`: add assignments → **Mark Scheduling Complete** → SE Approvals → approve → verify timeline | Client | ⚠️ After redeploy |

**Note (clarification only — no code change today):**  
Job Scheduling / Kanban (`/admin/kanban`) only lists jobs at production stages (Job Scheduling and later). Real jobs still in Planning or Drafting (e.g. Parminder) will not appear until the job stage advances. Schedule assignments live on **Planning → Scheduling** (`/admin/scheduling`), not on the Kanban board.

---

## 5. Section D — Client clarifications documented

### 5.1 Two different “scheduling” pages

| Page | Route | Purpose |
|------|-------|---------|
| **Scheduling** | `/admin/scheduling` | Assign engineers, dates, times, priorities |
| **Job Scheduling / Kanban** | `/admin/kanban` | Production pipeline board (To Schedule → Fabrication → QC → etc.) |

Work done on **Scheduling** does **not** automatically appear on **Kanban**. They use separate data.

### 5.2 Site Engineer Approvals — Review Queue (0)

- **Review Queue (0)** means no **pending** reviews right now.
- **Approved** items still appear in the table below the queue.
- Filter by job (e.g. `J-20260706-6444`) to see all modules for that job.

### 5.3 All 12 modules requiring Site Engineer approval

| # | Module | Admin action to send to SE |
|---|--------|---------------------------|
| 1 | Site Measurement | Save measurement + photos → **Complete Site Measurement** |
| 2 | Planning | Add tasks → **Mark Planning Complete** |
| 3 | Scheduling | Add assignments → **Mark Scheduling Complete** |
| 4 | Drafting | **Mark IFC Approved** on drawing, or **Complete Drafting** |
| 5 | Material Purchasing | All items **Received** → **Mark Material Complete** |
| 6 | Fabrication | All items done + checklist + hours + photos → **Mark Fabrication Complete** |
| 7 | Fabrication QC | All Fabrication QC items **Pass** (automatic) |
| 8 | Powder Coating | **Mark Powder Coating Done** (batch ref required) |
| 9 | Powder Coating QC | All Powder Coating QC items **Pass** (automatic) |
| 10 | Finishing & QC | All QC items **Pass** → **Mark QC Complete** |
| 11 | Installation | All activities **Completed** + photos → **Confirm Installation Completion** |
| 12 | Job Completion | Completion form → **Finalize Job** |

---

## 6. Deployment notes

| Item | Detail |
|------|--------|
| **Frontend** | https://crm-front-dun.vercel.app |
| **Backend** | https://crm-six-lake.vercel.app |
| **Hosting** | Vercel — separate frontend and backend projects |
| **Database** | MongoDB |
| **Branch** | `main` |
| **Today's deploy-affecting commits** | `393c12d`, `3e14247`, `5fdb10e`, `b741f32`, `b22978c`, `09a55e1` |

### Required environment variables (production)

**Backend (`crm-six-lake`):**

- `DATABASE`
- `JWT_SECRET`
- `FRONTEND_URL=https://crm-front-dun.vercel.app`

**Frontend (`crm-front-dun`):**

- `VITE_API_BASE_URL=https://crm-six-lake.vercel.app/api`

---

## 7. Git commit reference

| Commit | Summary |
|--------|---------|
| `393c12d` | Fix `workflowConfig.js` syntax error (frontend Vercel build) |
| `3e14247` | Sync site engineer approval to job timeline after module review accepted |
| `5fdb10e` | Vercel rewrites + CORS routing fixes |
| `b741f32` | Root Vercel routing — send `/api/*` to Express handler |
| `b22978c` | Add Mark Scheduling Complete flow for SE approvals |
| `09a55e1` | Fix file uploads on Vercel (memory storage + MongoDB GridFS) |

---

*Document generated from development and testing session — Bright Balustrading CRM, 6 July 2026. Tech2Globe.*
