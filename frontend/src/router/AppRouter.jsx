import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";

// ✅ Customer Profile ✅
import CustomerProfile from "../pages/CustomerPortal/Profile";

// ✅ Public Auth pages
import Login from "../pages/Auth/Login";
import Register from "../pages/Auth/Register";
import ForgotPassword from "../pages/Auth/ForgotPassword";
import ResetPassword from "../pages/Auth/ResetPassword";

// ✅ Admin Layout
import AdminLayout from "../pages/Admin/Dashboard/AdminLayout";

// ✅ Your completed pages
import Lead from "../pages/Lead";
import LeadView from "../pages/Lead/LeadView";
import Jobs from "../pages/Jobs";
import JobView from "../pages/Jobs/JobView";
import Kanban from "../pages/Kanban";
import Planning from "../pages/planning";
import SiteMeasurement from "../pages/SiteMeasurement";
import Drafting from "../pages/Drafting";
import MaterialPurchase from "../pages/MaterialPurchase";

// ✅ Your other pages
import Fabrication from "../pages/Fabrication";
import QC from "../pages/QC";
import Installation from "../pages/Installation";
import Attendance from "../pages/Attendance";

import Customer from "../pages/Customer";

// ✅ Worker
import WorkerDashboard from "../pages/Worker/WorkerDashboard";

// ✅ Customer Portal Layout + Pages
import CustomerLayout from "../apps/Navigation/CustomerLayout";
import CustomerLogin from "../pages/CustomerPortal/Login";
import CustomerDashboard from "../pages/CustomerPortal/Dashboard";
import CustomerProjects from "../pages/CustomerPortal/Projects";
import CustomerProjectDetails from "../pages/CustomerPortal/ProjectDetails";
import CustomerInvoices from "../pages/CustomerPortal/Invoices";
import CustomerPayments from "../pages/CustomerPortal/Payments";
import ContactUs from "../pages/CustomerPortal/ContactUs";
import ContactRequests from "../pages/Admin/ContactRequests";
import About from "../pages/About";

// ✅ Idurar modules
import DashboardModule from "../modules/DashboardModule";
import ErpPanelModule from "../modules/ErpPanelModule";

// ==============================
// ✅ INVOICE MODULE (split)
// ==============================
import InvoiceDataTableModule from "../modules/InvoiceModule/InvoiceDataTableModule";
import CreateInvoiceModule from "../modules/InvoiceModule/CreateInvoiceModule";
import ReadInvoiceModule from "../modules/InvoiceModule/ReadInvoiceModule";
import UpdateInvoiceModule from "../modules/InvoiceModule/UpdateInvoiceModule";
import RecordPaymentModule from "../modules/InvoiceModule/RecordPaymentModule";

// ==============================
// ✅ PAYMENT MODULE (split)
// ==============================
import PaymentDataTableModule from "../modules/PaymentModule/PaymentDataTableModule";
import ReadPaymentModule from "../modules/PaymentModule/ReadPaymentModule";
import UpdatePaymentModule from "../modules/PaymentModule/UpdatePaymentModule";

// ==============================
// ✅ QUOTE MODULE (split)
// ==============================
import QuoteDataTableModule from "../modules/QuoteModule/QuoteDataTableModule";
import CreateQuoteModule from "../modules/QuoteModule/CreateQuoteModule";
import ReadQuoteModule from "../modules/QuoteModule/ReadQuoteModule";
import UpdateQuoteModule from "../modules/QuoteModule/UpdateQuoteModule";

// ==============================
// ✅ SETTING MODULE (split submodules only)
// ==============================
import CompanySettingsModule from "../modules/SettingModule/CompanySettingsModule";
import CompanyLogoSettingsModule from "../modules/SettingModule/CompanyLogoSettingsModule";
import FinanceSettingsModule from "../modules/SettingModule/FinanceSettingsModule";
import GeneralSettingsModule from "../modules/SettingModule/GeneralSettingsModule";
import MoneyFormatSettingsModule from "../modules/SettingModule/MoneyFormatSettingsModule";
import Employee from "@/pages/Employee";

export default function AppRouter() {
  return (
    <Routes>
      {/* App open -> Login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* ✅ Public */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      {/* ✅ Customer Login PUBLIC */}
      <Route path="/portal/login" element={<CustomerLogin />} />

      {/* ✅ Admin (nested) */}
      <Route element={<ProtectedRoute allowRoles={["admin"]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardModule />} />

          <Route path="lead" element={<Lead />} />
          <Route path="lead/:id" element={<LeadView />} />
          <Route path="jobs" element={<Jobs />} />
          <Route path="job/:id" element={<JobView />} />

          {/* ✅ Planning group */}
          <Route path="site-measurement" element={<SiteMeasurement />} />
          <Route path="planning" element={<Planning />} />
          <Route path="drafting" element={<Drafting />} />

          {/* ✅ Production group */}
          <Route path="kanban" element={<Kanban />} />
          <Route path="material-purchase" element={<MaterialPurchase />} />
          <Route path="fabrication" element={<Fabrication />} />
          <Route path="qc" element={<QC />} />

          {/* ✅ Execution */}
          <Route path="installation" element={<Installation />} />

          {/* ✅ Other admin pages */}
          <Route path="attendance" element={<Attendance />} />
          <Route path="employee" element={<Employee />} />
          <Route path="customer" element={<Customer />} />

          <Route path="dashboard" element={<DashboardModule />} />
          <Route path="erp" element={<ErpPanelModule />} />

          {/* ✅ QUOTES */}
          <Route path="quotes" element={<QuoteDataTableModule />} />
          <Route path="quotes/create" element={<CreateQuoteModule />} />
          <Route path="quotes/read/:id" element={<ReadQuoteModule />} />
          <Route path="quotes/update/:id" element={<UpdateQuoteModule />} />

          {/* ✅ ALIAS */}
          <Route path="quote" element={<QuoteDataTableModule />} />
          <Route path="quote/create" element={<CreateQuoteModule />} />
          <Route path="quote/read/:id" element={<ReadQuoteModule />} />
          <Route path="quote/update/:id" element={<UpdateQuoteModule />} />

          {/* ✅ INVOICE */}
          <Route path="invoice" element={<InvoiceDataTableModule />} />
          <Route path="invoice/create" element={<CreateInvoiceModule />} />
          <Route path="invoice/read/:id" element={<ReadInvoiceModule />} />
          <Route path="invoice/update/:id" element={<UpdateInvoiceModule />} />
          <Route path="invoice/record-payment/:id" element={<RecordPaymentModule />} />

          {/* ✅ PAYMENT */}
          <Route path="payment" element={<PaymentDataTableModule />} />
          <Route path="contact-requests" element={<ContactRequests />} />
          <Route path="payment/read/:id" element={<ReadPaymentModule />} />
          <Route path="payment/update/:id" element={<UpdatePaymentModule />} />

          {/* ✅ SETTINGS */}
          <Route path="settings" element={<Outlet />}>
            <Route index element={<Navigate to="company" replace />} />
            <Route path="company" element={<CompanySettingsModule />} />
            <Route path="company-logo" element={<CompanyLogoSettingsModule />} />
            <Route path="finance" element={<FinanceSettingsModule />} />
            <Route path="general" element={<GeneralSettingsModule />} />
            <Route path="money-format" element={<MoneyFormatSettingsModule />} />
          </Route>

          <Route path="about" element={<About />} />

          <Route path="*" element={<div style={{ padding: 20 }}>Admin route not found</div>} />
        </Route>
      </Route>

      {/* ✅ Worker */}
      <Route element={<ProtectedRoute allowRoles={["worker"]} />}>
        <Route path="/worker" element={<WorkerDashboard />} />
      </Route>

      {/* ✅ Customer Portal (WITH SIDEBAR) */}
      <Route element={<ProtectedRoute allowRoles={["customer"]} />}>
        <Route path="/portal" element={<CustomerLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />

          <Route path="dashboard" element={<CustomerDashboard />} />
          <Route path="projects" element={<CustomerProjects />} />
          <Route path="projects/:id" element={<CustomerProjectDetails />} />

          <Route path="contact-us" element={<ContactUs />} />
          <Route path="invoices" element={<CustomerInvoices />} />
          <Route path="payments" element={<CustomerPayments />} />
          <Route path="enquiry" element={<div style={{ padding: 16 }}>Enquiry Page</div>} />

          {/* ✅ REAL PROFILE PAGE */}
          <Route path="profile" element={<CustomerProfile />} />

          <Route path="*" element={<div style={{ padding: 16 }}>Portal route not found</div>} />
        </Route>
      </Route>

      {/* fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
