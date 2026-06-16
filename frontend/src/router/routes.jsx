import React from "react";
import { Navigate } from "react-router-dom";

import Login from "../pages/Auth/Login";
import AdminDashboard from "../pages/Admin/Dashboard";
import WorkerDashboard from "../pages/Worker/WorkerDashboard";

// ✅ Admin Pages
import Jobs from "../pages/Jobs";
import SiteMeasurement from "../pages/sitemeasurement";   // ✅ correct path

// ✅ Customer Portal Layout
import CustomerLayout from "../apps/Navigation/CustomerLayout";

// ✅ Customer Portal Pages
import CustomerDashboard from "../pages/CustomerPortal/Dashboard";
import CustomerLogin from "../pages/CustomerPortal/Login";
import CustomerProjects from "../pages/CustomerPortal/Projects";
import CustomerProjectDetails from "../pages/CustomerPortal/ProjectDetails";
import ContactUs from "../pages/CustomerPortal/ContactUs";
import CustomerPayments from "../pages/CustomerPortal/Payments";

import CustomerProtectedRoute from "./CustomerProtectedRoute";

const PlaceholderPage = ({ title }) => (
  <div style={{ padding: 16 }}>{title}</div>
);

const routes = {
  default: [
    { path: "/login", element: <Login /> },
    { path: "*", element: <div>Route not found</div> },
  ],

  admin: [
    { path: "/admin", element: <AdminDashboard /> },

    // ✅ Jobs
    { path: "/admin/jobs", element: <Jobs /> },

    // ✅ Planning
    { path: "/admin/site-measurement", element: <SiteMeasurement /> },

    {
      path: "/admin/planning",
      element: <PlaceholderPage title="Planning Page" />,
    },

    {
      path: "/admin/drafting",
      element: <PlaceholderPage title="Drafting Page" />,
    },

    // ✅ Production
    {
      path: "/admin/kanban",
      element: <PlaceholderPage title="Job Scheduling / Kanban Page" />,
    },

    {
      path: "/admin/material-purchase",
      element: <PlaceholderPage title="Material Purchase Page" />,
    },

    {
      path: "/admin/fabrication",
      element: <PlaceholderPage title="Fabrication Page" />,
    },

    {
      path: "/admin/qc",
      element: <PlaceholderPage title="Quality Control Page" />,
    },

    // ✅ Execution
    {
      path: "/admin/installation",
      element: <PlaceholderPage title="Installation Page" />,
    },
  ],

  worker: [{ path: "/worker", element: <WorkerDashboard /> }],

  customer: [
    { path: "/portal/login", element: <CustomerLogin /> },

    {
      path: "/portal",
      element: (
        <CustomerProtectedRoute>
          <CustomerLayout />
        </CustomerProtectedRoute>
      ),
      children: [
        { index: true, element: <Navigate to="dashboard" replace /> },

        { path: "dashboard", element: <CustomerDashboard /> },
        { path: "projects", element: <CustomerProjects /> },
        { path: "projects/:id", element: <CustomerProjectDetails /> },
        { path: "contact-us", element: <ContactUs /> },

        { path: "payments", element: <CustomerPayments /> },
        { path: "enquiry", element: <div style={{ padding: 16 }}>Enquiry Page</div> },
        { path: "profile", element: <div style={{ padding: 16 }}>Profile Page</div> },
      ],
    },
  ],
};

export default routes;