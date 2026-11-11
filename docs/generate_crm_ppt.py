"""Generate Tech2Globe CRM full presentation (single PPTX)."""
from pathlib import Path

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt

OUTPUT = Path(__file__).resolve().parent / "Tech2Globe_CRM_Complete_Guide.pptx"

NAVY = RGBColor(0x1A, 0x36, 0x5D)
BLUE = RGBColor(0x25, 0x63, 0xEB)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
GRAY = RGBColor(0x64, 0x74, 0x8B)
DARK = RGBColor(0x1E, 0x29, 0x3B)


def set_slide_bg(slide, color):
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def add_title_slide(prs, title, subtitle=""):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide, NAVY)
    box = slide.shapes.add_textbox(Inches(0.6), Inches(2.2), Inches(8.8), Inches(1.2))
    tf = box.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(40)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.CENTER
    if subtitle:
        box2 = slide.shapes.add_textbox(Inches(0.6), Inches(3.5), Inches(8.8), Inches(1))
        tf2 = box2.text_frame
        p2 = tf2.paragraphs[0]
        p2.text = subtitle
        p2.font.size = Pt(20)
        p2.font.color.rgb = RGBColor(0xCB, 0xD5, 0xE1)
        p2.alignment = PP_ALIGN.CENTER


def add_section_slide(prs, title):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    set_slide_bg(slide, BLUE)
    box = slide.shapes.add_textbox(Inches(0.6), Inches(3), Inches(8.8), Inches(1))
    tf = box.text_frame
    p = tf.paragraphs[0]
    p.text = title
    p.font.size = Pt(36)
    p.font.bold = True
    p.font.color.rgb = WHITE
    p.alignment = PP_ALIGN.CENTER


def add_bullet_slide(prs, title, bullets, subtitle=None):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    # Title bar
    bar = slide.shapes.add_shape(1, Inches(0), Inches(0), Inches(10), Inches(0.9))
    bar.fill.solid()
    bar.fill.fore_color.rgb = NAVY
    bar.line.fill.background()
    tb = slide.shapes.add_textbox(Inches(0.5), Inches(0.15), Inches(9), Inches(0.7))
    tp = tb.text_frame.paragraphs[0]
    tp.text = title
    tp.font.size = Pt(28)
    tp.font.bold = True
    tp.font.color.rgb = WHITE

    y = 1.15
    if subtitle:
        sb = slide.shapes.add_textbox(Inches(0.55), Inches(y), Inches(8.9), Inches(0.4))
        sp = sb.text_frame.paragraphs[0]
        sp.text = subtitle
        sp.font.size = Pt(14)
        sp.font.color.rgb = GRAY
        y += 0.45

    body = slide.shapes.add_textbox(Inches(0.55), Inches(y), Inches(8.9), Inches(6.2 - y))
    tf = body.text_frame
    tf.word_wrap = True
    for i, item in enumerate(bullets):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        if isinstance(item, tuple):
            p.text = item[0]
            p.level = item[1]
        else:
            p.text = item
            p.level = 0
        p.font.size = Pt(16 if p.level == 0 else 14)
        p.font.color.rgb = DARK
        p.space_after = Pt(6)
    return slide


def add_table_slide(prs, title, headers, rows):
    slide = prs.slides.add_slide(prs.slide_layouts[6])
    bar = slide.shapes.add_shape(1, Inches(0), Inches(0), Inches(10), Inches(0.9))
    bar.fill.solid()
    bar.fill.fore_color.rgb = NAVY
    bar.line.fill.background()
    tb = slide.shapes.add_textbox(Inches(0.5), Inches(0.15), Inches(9), Inches(0.7))
    tp = tb.text_frame.paragraphs[0]
    tp.text = title
    tp.font.size = Pt(26)
    tp.font.bold = True
    tp.font.color.rgb = WHITE

    cols = len(headers)
    table = slide.shapes.add_table(
        len(rows) + 1, cols, Inches(0.4), Inches(1.1), Inches(9.2), Inches(0.35 * (len(rows) + 2))
    ).table

    for c, h in enumerate(headers):
        cell = table.cell(0, c)
        cell.text = h
        cell.fill.solid()
        cell.fill.fore_color.rgb = BLUE
        for p in cell.text_frame.paragraphs:
            p.font.bold = True
            p.font.size = Pt(11)
            p.font.color.rgb = WHITE

    for r, row in enumerate(rows, start=1):
        for c, val in enumerate(row):
            cell = table.cell(r, c)
            cell.text = str(val)
            for p in cell.text_frame.paragraphs:
                p.font.size = Pt(10)
                p.font.color.rgb = DARK


def build():
    prs = Presentation()
    prs.slide_width = Inches(10)
    prs.slide_height = Inches(7.5)

    add_title_slide(
        prs,
        "Tech2Globe CRM / ERP",
        "Complete System Guide — All Modules, Workflows & Data Connections",
    )

    add_bullet_slide(
        prs,
        "Agenda",
        [
            "1. System Overview & Architecture",
            "2. User Roles & Login Credentials",
            "3. Sales Pipeline: Lead → Quote → Job",
            "4. Planning Modules (Site Measurement, Planning, Drafting)",
            "5. Production Modules (Kanban, Materials, Fabrication, QC)",
            "6. Execution (Installation) & Job Completion",
            "7. Business: Customers, Invoices, Payments",
            "8. HR: Employees & Attendance",
            "9. Customer Portal",
            "10. Data Model — How Everything Connects",
            "11. Demo / Seed Data",
            "12. Deployment & Environment",
        ],
    )

    add_section_slide(prs, "1. System Overview")

    add_bullet_slide(
        prs,
        "What Is This System?",
        [
            "End-to-end CRM + ERP for glass / fitout / construction projects",
            "Admin panel for sales, production, finance, and HR",
            "Customer portal for projects, invoices, and payments",
            "Worker access for attendance and field updates",
            "Tech stack: React (Vite) frontend + Node/Express + MongoDB backend",
            "Deployed: Frontend on Vercel | Backend API on Vercel serverless",
        ],
    )

    add_bullet_slide(
        prs,
        "High-Level Architecture",
        [
            "Frontend (React)  →  REST API (/api/*)  →  MongoDB Atlas",
            "Authentication: JWT token stored in browser after login",
            "Job document is the CENTRAL HUB — all workflow modules link via jobId",
            "Finance chain: Job → Invoice → Payment",
            "Portal chain: User → Customer → Jobs → Invoices → Payments",
            "Seed scripts auto-load demo data when backend starts",
        ],
    )

    add_table_slide(
        prs,
        "Admin Sidebar — All Modules",
        ["Group", "Module", "Route", "Purpose"],
        [
            ["—", "Dashboard", "/admin", "KPIs, charts, overview"],
            ["Sales", "Leads", "/admin/lead", "Capture & qualify opportunities"],
            ["Sales", "Quotes", "/admin/quotes", "Pricing proposals from leads"],
            ["Sales", "Jobs", "/admin/jobs", "Active projects (from accepted quotes)"],
            ["Planning", "Site Measurement", "/admin/site-measurement", "Field measurements"],
            ["Planning", "Planning", "/admin/planning", "Schedule & tasks"],
            ["Planning", "Drafting", "/admin/drafting", "Drawings & IFC approval"],
            ["Production", "Job Scheduling", "/admin/kanban", "Kanban task board"],
            ["Production", "Material Purchase", "/admin/material-purchase", "BOM & purchasing"],
            ["Production", "Fabrication", "/admin/fabrication", "Shop floor work"],
            ["Production", "Quality Control", "/admin/qc", "QC inspections"],
            ["Execution", "Installation", "/admin/installation", "On-site install"],
            ["Business", "Customers", "/admin/customer", "Customer records"],
            ["Business", "Contact Requests", "/admin/contact-requests", "Support tickets"],
            ["Business", "Invoices", "/admin/invoice", "Billing"],
            ["Business", "Payments", "/admin/payment", "Payment records"],
            ["HR", "Employee", "/admin/employee", "Staff records"],
            ["HR", "Attendance", "/admin/attendance", "Time tracking"],
            ["System", "Settings", "/admin/settings", "Company, tax, finance"],
        ],
    )

    add_section_slide(prs, "2. User Roles & Access")

    add_table_slide(
        prs,
        "Login Credentials (Seeded)",
        ["Role", "Login", "Password", "Access"],
        [
            ["Admin", "admin@crm.com", "Admin@123", "Full admin panel"],
            ["Worker", "W-1001 (or worker@crm.com)", "Worker@123", "Worker dashboard, attendance"],
            ["Worker", "W-1002 / installer@crm.com", "Worker@123", "Installation team"],
            ["Worker", "W-1003 / qc@crm.com", "Worker@123", "QC team"],
            ["Worker", "W-1004 / planner@crm.com", "Worker@123", "Planning team"],
            ["Customer", "customer@crm.com", "Customer@123", "Customer portal only"],
        ],
    )

    add_bullet_slide(
        prs,
        "Three Portals",
        [
            "Admin Portal  →  /admin  (admin role)",
            "Worker Portal  →  /worker  (worker role)",
            "Customer Portal  →  /portal  (customer role)",
            "Each role gets a JWT token on login — API checks role for protected routes",
            "Customer portal only shows data where Job.customerId matches their Customer record",
        ],
    )

    add_section_slide(prs, "3. Sales Pipeline")

    add_bullet_slide(
        prs,
        "Sales Flow — The Core Business Path",
        [
            "STEP 1: Create LEAD (client, site, category, salesperson, follow-up)",
            "STEP 2: From Lead row → click 'Create Quote' (NOT from Quotes list)",
            "STEP 3: Fill quote (costs, scope, hours) → Save as Draft or Sent",
            "STEP 4: Open quote → 'Accept Quote → Create Job'",
            "STEP 5: Job appears in Jobs list with workflow timeline",
            "STEP 6: Run job through planning → production → execution",
            "STEP 7: Create Invoice on job → Record Payment on invoice",
        ],
        subtitle="Lead → Quote → Job → Workflow → Invoice → Payment",
    )

    add_table_slide(
        prs,
        "Sales Modules — Detail",
        ["Module", "Model", "Key Fields", "Links To"],
        [
            ["Lead", "Lead", "clientName, siteAddress, status, category", "→ Quote (leadId)"],
            ["Quote", "Quote", "quoteNumber, totalAmount, status", "leadId → Job on approve"],
            ["Job", "Job", "jobId, stage, lockedValue, workflowEvents", "customerId, leadId, quoteId"],
            ["Customer", "Customer", "name, email, phone", "User.customer (portal)"],
            ["Client", "Client", "Legacy ERP client", "Idurar compatibility"],
        ],
    )

    add_bullet_slide(
        prs,
        "Lead Module — How Records Are Added",
        [
            "Admin → Leads → Add New Lead form",
            "Fields: client name, contact, phone, email, site address, category, lead source",
            "Status: New → Contacted → Quoted → Converted / Lost",
            "Actions: View, Edit, Delete, Create Quote",
            "API: POST /api/lead/create",
            "No job or invoice created at lead stage — lead is standalone until quoted",
        ],
    )

    add_bullet_slide(
        prs,
        "Quote Module — How Records Are Added",
        [
            "MUST be created from Lead page (Create Quote button)",
            "Quote form pre-fills customer data from lead automatically",
            "Hidden field leadId links quote to lead in database",
            "Statuses: Draft | Sent | Accepted | Rejected",
            "On create: Lead status updates to 'Quoted'",
            "API: POST /api/quote/create",
            "Quotes list page has no 'Add New' — by design",
        ],
    )

    add_bullet_slide(
        prs,
        "Job Module — How Records Are Added",
        [
            "Jobs are NOT created manually from Jobs page in normal flow",
            "Created automatically when admin clicks 'Accept Quote → Create Job'",
            "API: POST /api/quote/approve/:id",
            "Backend creates: Customer (if needed), User (portal login), Job document",
            "Job stores: jobId (e.g. J-2024-001), customerId, leadId, quoteId, lockedValue",
            "Job also has workflowEvents object — tracks 8 production stages",
            "View Timeline button opens full stage progress for that job",
        ],
    )

    add_section_slide(prs, "4. Planning Modules")

    add_bullet_slide(
        prs,
        "Job Workflow — 8 Stages (on Job document)",
        [
            "1. Site Measurement — field visit, dimensions",
            "2. Planning — schedule, tasks, crew allocation",
            "3. Drafting — drawings, IFC approval",
            "4. Client Approval — sign-off before production",
            "5. Material Purchasing — BOM, supplier orders",
            "6. Fabrication — shop floor production",
            "7. Finishing / QC — quality inspections",
            "8. Installation — on-site fit-out & sign-off",
        ],
        subtitle="Each stage stored in Job.workflowEvents.{stageName}",
    )

    add_table_slide(
        prs,
        "Planning Modules",
        ["Module", "API Base", "Linked By", "Gate (must complete first)"],
        [
            ["Site Measurement", "/api/measurement", "jobId", "Job must exist"],
            ["Planning", "/api/planning", "jobId", "Site Measurement done"],
            ["Drafting", "/api/drafting", "jobId", "Planning done"],
        ],
    )

    add_bullet_slide(
        prs,
        "How Planning Modules Add Data",
        [
            "Each module: select job from dropdown (filtered by eligibility)",
            "Or deep-link: /admin/planning?jobId={mongoId}",
            "Create records → POST with jobId in payload",
            "Complete stage → PATCH job workflowEvents + update stage name",
            "Example: Complete Planning → sets planning.isCompleted=true, stage='Drafting'",
            "JobContext + localStorage remember active job across modules",
        ],
    )

    add_section_slide(prs, "5. Production Modules")

    add_table_slide(
        prs,
        "Production Modules",
        ["Module", "API Base", "What It Stores", "Next Stage"],
        [
            ["Job Scheduling (Kanban)", "/api/kanban", "Task cards by column", "Material Purchase"],
            ["Material Purchase", "/api/material-purchase", "Materials, qty, supplier", "Fabrication"],
            ["Fabrication", "/api/fabrication", "Fab items, hours, status", "QC"],
            ["Quality Control", "/api/qc", "Inspections, pass/fail", "Installation"],
        ],
    )

    add_bullet_slide(
        prs,
        "Production Flow Rules",
        [
            "All production modules require jobId — same MongoDB _id as Job document",
            "Fabrication needs: drafting done AND material purchasing done",
            "QC needs: fabrication completed",
            "Completing QC navigates to Installation with job pre-selected",
            "Kanban can be used during Job Scheduling / Material Purchase stages",
            "Each module has its own collection in MongoDB (separate from Job)",
        ],
    )

    add_section_slide(prs, "6. Execution & Completion")

    add_bullet_slide(
        prs,
        "Installation Module",
        [
            "Route: /admin/installation",
            "API: /api/installation (list, create, update, summary, finalize)",
            "Activities: install tasks with status, team, dates, photos",
            "Summary: scheduled date, assigned team, hours, customer sign-off",
            "Mark Complete → updates job workflowEvents.installation",
            "Finalize Job → sets job systemState to Completed",
            "Gate: QC / finishing stage must be completed first",
        ],
    )

    add_bullet_slide(
        prs,
        "Job Timeline View",
        [
            "Route: /admin/job/:id (View Timeline from Jobs list)",
            "Shows all 8 workflow stages with completion status",
            "Links to each module with ?jobId= pre-filled",
            "Link to create invoice: /admin/invoice/create?job={id}",
            "Financial summary: lockedValue, totalInvoiced, totalPaid on job",
        ],
    )

    add_section_slide(prs, "7. Business & Finance")

    add_table_slide(
        prs,
        "Finance Modules",
        ["Module", "Model Link", "Create Rule", "Updates"],
        [
            ["Invoice", "invoice.job → Job (required)", "Select job, type, amount/items", "Job.totalInvoiced"],
            ["Payment", "payment.invoice → Invoice", "Invoice must be Issued first", "Invoice.amountPaid, Job.totalPaid"],
            ["Taxes", "Settings", "GST % default", "Used in invoice totals"],
            ["Payment Mode", "Settings", "Bank Transfer etc.", "Used when recording payment"],
        ],
    )

    add_bullet_slide(
        prs,
        "Invoice Types & Flow",
        [
            "Progress Payment — % of contract value",
            "Variation — extra work beyond quote",
            "Retention — holdback amount",
            "Final Invoice — closing balance",
            "Status flow: Draft → Issued → (Partially) Paid / Overdue",
            "Customer portal shows Issued+ invoices for their jobs only",
            "Customer can notify admin of payment via portal",
        ],
    )

    add_bullet_slide(
        prs,
        "Customers & Contact Requests",
        [
            "Customers module: admin manages customer records",
            "Created automatically when quote is accepted (with portal user)",
            "Contact Requests: customer submits via portal → admin responds",
            "API: POST /api/contact/create (portal), GET /api/contact/list (admin)",
            "Links: customerId + projectId (job) on each contact ticket",
        ],
    )

    add_section_slide(prs, "8. HR Module")

    add_table_slide(
        prs,
        "HR Modules",
        ["Module", "Links", "Demo Data"],
        [
            ["Employee", "Worker login users (W-1001..1004)", "EMP123..EMP126"],
            ["Attendance", "workerEmail matches employee", "3 sample records"],
        ],
    )

    add_bullet_slide(
        prs,
        "Worker Access",
        [
            "Workers log in with employee ID (W-1001) or email",
            "Worker dashboard for field updates",
            "Attendance tracked by email + date",
            "Mobile API exists at /api/mobile/* (separate MobileJob model)",
        ],
    )

    add_section_slide(prs, "9. Customer Portal")

    add_table_slide(
        prs,
        "Customer Portal Pages",
        ["Page", "Route", "API", "Shows"],
        [
            ["Dashboard", "/portal/dashboard", "/customer/me, /projects", "Stats & updates"],
            ["My Projects", "/portal/projects", "/customer/projects", "Customer's jobs"],
            ["Project Details", "/portal/projects/:id", "/customer/projects/:id", "Timeline + status"],
            ["My Invoices", "/portal/invoices", "/customer/invoices", "All job invoices"],
            ["Payments", "/portal/payments", "/customer/payments/summary", "Payment history"],
            ["Contact Us", "/portal/contact-us", "/contact/create", "Support message"],
            ["Profile", "/portal/profile", "/user/me", "Account settings"],
        ],
    )

    add_bullet_slide(
        prs,
        "Why Portal Shows Data (or Not)",
        [
            "Requires: User.role = customer AND linked Customer record",
            "Link paths: user.customer OR Customer.portalEmail OR Customer.email",
            "Jobs filtered by: Job.customerId = Customer._id",
            "Invoices filtered by: Invoice.job in customer's job IDs",
            "Demo: customer@crm.com sees DEMO-J-001 + 4 invoices (INV-DEMO-C01..C04)",
            "If job has only customer name string but no customerId → invisible in portal",
        ],
    )

    add_section_slide(prs, "10. Data Model & Connections")

    add_bullet_slide(
        prs,
        "Entity Relationship Map",
        [
            "Lead ──leadId──► Quote ──quoteId──► Job",
            "Lead ──leadId──► Customer ◄──customerId── Job",
            "Job ──jobId──► SiteMeasurement, Planning, Drafting, Kanban,",
            ("         MaterialPurchase, Fabrication, QC, Installation", 1),
            "Job ──job (ref)──► Invoice ──invoice (ref)──► Payment",
            "User(customer) ──customer──► Customer",
            "Contact ──customerId + projectId──► Customer + Job",
        ],
    )

    add_table_slide(
        prs,
        "MongoDB Collections (Key Models)",
        ["Collection", "Primary Key Link", "Created When"],
        [
            ["leads", "standalone", "Admin creates lead"],
            ["quotes", "leadId", "Create Quote from lead"],
            ["jobs", "leadId, quoteId, customerId", "Accept quote"],
            ["customers", "leadId, user", "Quote approve or admin"],
            ["sitemeasurements", "jobId", "Site measurement form"],
            ["plannings", "jobId", "Planning tasks"],
            ["draftings", "jobId", "Drawing records"],
            ["kanbantasks", "jobId", "Kanban cards"],
            ["materialpurchases", "jobId", "Material lines"],
            ["fabrications", "jobId", "Fab records"],
            ["qcs", "jobId", "QC inspections"],
            ["installations", "jobId", "Install activities"],
            ["invoices", "job", "Admin invoice create"],
            ["payments", "invoice", "Record payment"],
        ],
    )

    add_section_slide(prs, "11. Demo / Seed Data")

    add_bullet_slide(
        prs,
        "How Mock Data Gets Added",
        [
            "Backend runs seed on startup when MongoDB connects",
            "seedUsers.js → admin, workers, customer logins + Employee records",
            "seedDemoData.js → skips if DEMO-J-001 already exists",
            "ensureCustomerPortalData() → always runs, fixes portal invoices",
            "Manual re-seed: npm run seed:users && npm run seed:demo (in backend/)",
            "Seed inserts full documents directly — does NOT use UI forms",
        ],
    )

    add_table_slide(
        prs,
        "Demo Jobs & Data",
        ["Job ID", "Customer", "Stage", "Portal?"],
        [
            ["DEMO-J-001", "Riverside / customer@crm.com", "Site Measurement", "Yes — 4 invoices"],
            ["DEMO-J-002", "City Tower Glass", "Job Scheduling", "No"],
            ["DEMO-J-003", "Skyline Offices", "Fabrication", "No"],
        ],
    )

    add_bullet_slide(
        prs,
        "Demo Quotes (Your Quotes Page)",
        [
            "DEMO-Q-001 — Metro Retail Fitout — Draft — $62,000",
            "DEMO-Q-002 — City Tower Glass — Sent — $85,000",
            "DEMO-Q-003 — Skyline Offices — Accepted — $120,000",
            "Your manually created lead/quote will have auto-generated numbers",
            "Demo data coexists with your real data in the same database",
        ],
    )

    add_section_slide(prs, "12. Deployment & Environment")

    add_table_slide(
        prs,
        "Deployment Setup",
        ["Component", "Location", "Env Variables"],
        [
            ["Backend API", "Vercel (crm-six-lake.vercel.app)", "DATABASE, JWT_SECRET"],
            ["Frontend", "Vercel (crm-front-dun.vercel.app)", "VITE_API_BASE_URL"],
            ["Database", "MongoDB Atlas", "Connection string in DATABASE"],
        ],
    )

    add_bullet_slide(
        prs,
        "Environment Files",
        [
            "backend/.env → DATABASE, JWT_SECRET, PORT",
            "frontend/.env → VITE_API_BASE_URL=https://your-api.vercel.app/api",
            "No trailing slash on API URL",
            "Both projects deploy from same Git repo (backend at root, frontend in /frontend)",
        ],
    )

    add_section_slide(prs, "Quick Reference")

    add_bullet_slide(
        prs,
        "Step-by-Step: From Zero to Invoice",
        [
            "1. Login as admin@crm.com",
            "2. Sales → Leads → Add lead",
            "3. Click Create Quote on that lead",
            "4. Save quote → open it → Accept Quote → Create Job",
            "5. Jobs → View Timeline → start Site Measurement",
            "6. Complete each stage: Planning → Drafting → Materials → Fab → QC → Install",
            "7. Business → Invoices → create invoice for that job",
            "8. Issue invoice → Business → Payments → record payment",
            "9. Customer logs in at /portal → sees project + invoices",
        ],
    )

    add_bullet_slide(
        prs,
        "Key Rules to Remember",
        [
            "Job is the hub — everything production/finance hangs off it",
            "Quotes only from Leads — never from Quotes list directly",
            "Jobs only from Accepted Quotes — not from Lead page",
            "Every workflow module needs jobId (MongoDB _id, not jobId string)",
            "Portal needs customerId on Job — not just customer name text",
            "Seed data ≠ UI flow — same models, different entry path",
        ],
    )

    add_title_slide(
        prs,
        "Thank You",
        "Tech2Globe CRM — Complete Module Guide",
    )

    prs.save(str(OUTPUT))
    print(f"Created: {OUTPUT}")


if __name__ == "__main__":
    build()
