import { useState, useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Drawer, Layout, Menu } from "antd";

import { useAppContext } from "@/context/appContext";
import useLanguage from "@/locale/useLanguage";
import useResponsive from "@/hooks/useResponsive";

import BrandLogo from "@/components/BrandLogo";
import {
  SITE_ENGINEER_MENU_KEYS,
  SITE_ENGINEER_HOME,
} from "@/config/siteEngineerAccess";

import {
  SettingOutlined,
  CustomerServiceOutlined,
  ContainerOutlined,
  DashboardOutlined,
  TagOutlined,
  TagsOutlined,
  UserOutlined,
  CreditCardOutlined,
  FileOutlined,
  ShopOutlined,
  FilterOutlined,
  ReconciliationOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  FolderOpenOutlined,
  ToolOutlined,
  DeploymentUnitOutlined,
  TeamOutlined,
  BuildOutlined,
  MailOutlined,
  CalendarOutlined,
  AuditOutlined,
} from "@ant-design/icons";

const { Sider } = Layout;

const getStoredUserRole = () => {
  try {
    return JSON.parse(localStorage.getItem("user"))?.role || "admin";
  } catch {
    return "admin";
  }
};

const getSiteEngineerItems = (go) => [
  {
    key: "jobs",
    icon: <FileOutlined />,
    label: <Link to={go("/jobs")}>Assigned Jobs</Link>,
  },
  {
    key: "scheduling",
    icon: <CalendarOutlined />,
    label: <Link to={go("/scheduling")}>Scheduling</Link>,
  },
  {
    key: "fabrication",
    icon: <TagsOutlined />,
    label: <Link to={go("/fabrication")}>Fabrication</Link>,
  },
  {
    key: "qc",
    icon: <ContainerOutlined />,
    label: <Link to={go("/qc")}>Quality Check</Link>,
  },
  {
    key: "installation",
    icon: <ShopOutlined />,
    label: <Link to={go("/installation")}>Installation</Link>,
  },
  {
    key: "site-engineer",
    icon: <AuditOutlined />,
    label: <Link to={go("/site-engineer")}>Approvals</Link>,
  },
];

const filterMenuForRole = (items, role) => {
  if (role !== "siteEngineer") return items;

  return items
    .map((item) => {
      if (!item.children) {
        return SITE_ENGINEER_MENU_KEYS.has(item.key) ? item : null;
      }

      const children = item.children.filter((child) => SITE_ENGINEER_MENU_KEYS.has(child.key));
      if (!children.length) return null;

      return { ...item, children };
    })
    .filter(Boolean);
};

export default function Navigation({
  basePath = "",
  isMobile: isMobileProp,
  mobileOpen = false,
  onMobileOpenChange,
}) {
  const { isMobile: isMobileHook } = useResponsive();
  const isMobile = isMobileProp ?? isMobileHook;

  if (isMobile) {
    return (
      <Drawer
        placement="left"
        width={280}
        closable={false}
        onClose={() => onMobileOpenChange?.(false)}
        open={mobileOpen}
        styles={{ body: { padding: 0 } }}
      >
        <Sidebar
          collapsible={false}
          isMobile
          basePath={basePath}
          onNavigate={() => onMobileOpenChange?.(false)}
        />
      </Drawer>
    );
  }

  return <Sidebar collapsible={false} basePath={basePath} />;
}

function Sidebar({ collapsible, isMobile = false, basePath = "", onNavigate }) {
  const location = useLocation();
  const navigate = useNavigate();

  const { state: stateApp, appContextAction } = useAppContext();
  const { isNavMenuClose } = stateApp;
  const { navMenu } = appContextAction;

  const [currentPath, setCurrentPath] = useState("dashboard");
  const [openKeys, setOpenKeys] = useState([]);

  const translate = useLanguage();
  const userRole = getStoredUserRole();

  const go = (p) => `${basePath}${p}`;

  const items = useMemo(
    () => {
      if (userRole === "siteEngineer") {
        return getSiteEngineerItems(go);
      }
      return filterMenuForRole(
        [
      {
        key: "dashboard",
        icon: <DashboardOutlined />,
        label: <Link to={go("/")}>{translate("Dashboard") || "Dashboard"}</Link>,
      },
      {
        key: "sales-group",
        icon: <AppstoreOutlined />,
        label: "Sales",
        children: [
          {
            key: "lead",
            icon: <UserOutlined />,
            label: <Link to={go("/lead")}>Leads</Link>,
          },
          {
            key: "quotes",
            icon: <FileTextOutlined />,
            label: <Link to={go("/quotes")}>Quotes</Link>,
          },
          {
            key: "jobs",
            icon: <FileOutlined />,
            label: <Link to={go("/jobs")}>Jobs</Link>,
          },
        ],
      },
      {
        key: "planning-group",
        icon: <FolderOpenOutlined />,
        label: "Planning",
        children: [
          {
            key: "site-measurement",
            icon: <TagOutlined />,
            label: <Link to={go("/site-measurement")}>Site Measurement</Link>,
          },
          {
            key: "planning",
            icon: <TagOutlined />,
            label: <Link to={go("/planning")}>Planning</Link>,
          },
          {
            key: "scheduling",
            icon: <CalendarOutlined />,
            label: <Link to={go("/scheduling")}>Scheduling</Link>,
          },
          {
            key: "drafting",
            icon: <FileTextOutlined />,
            label: <Link to={go("/drafting")}>Drafting</Link>,
          },
          {
            key: "site-engineer",
            icon: <AuditOutlined />,
            label: <Link to={go("/site-engineer")}>SE Approvals</Link>,
          },
        ],
      },
      {
        key: "production-group",
        icon: <BuildOutlined />,
        label: "Production",
        children: [
          {
            key: "job-scheduling",
            icon: <FilterOutlined />,
            label: <Link to={go("/kanban")}>Job Scheduling</Link>,
          },
          {
            key: "material-purchase",
            icon: <ToolOutlined />,
            label: <Link to={go("/material-purchase")}>Material Purchase</Link>,
          },
          {
            key: "fabrication",
            icon: <TagsOutlined />,
            label: <Link to={go("/fabrication")}>Fabrication</Link>,
          },
          {
            key: "qc",
            icon: <ContainerOutlined />,
            label: <Link to={go("/qc")}>Quality Control</Link>,
          },
        ],
      },
      {
        key: "execution-group",
        icon: <DeploymentUnitOutlined />,
        label: "Execution",
        children: [
          {
            key: "installation",
            icon: <ShopOutlined />,
            label: <Link to={go("/installation")}>Installation</Link>,
          },
        ],
      },
      {
        key: "business-group",
        icon: <TeamOutlined />,
        label: "Business",
        children: [
          {
            key: "customer",
            icon: <CustomerServiceOutlined />,
            label: <Link to={go("/customer")}>Customers</Link>,
          },
          {
            key: "contact-requests",
            icon: <MailOutlined />,
            label: <Link to={go("/contact-requests")}>Contact Requests</Link>,
          },
          {
            key: "suppliers",
            icon: <ShopOutlined />,
            label: <Link to={go("/suppliers")}>Suppliers</Link>,
          },
          {
            key: "rfq",
            icon: <FileTextOutlined />,
            label: <Link to={go("/rfq")}>RFQ</Link>,
          },
          {
            key: "purchase-orders",
            icon: <ContainerOutlined />,
            label: <Link to={go("/purchase-orders")}>Purchase Orders</Link>,
          },
          {
            key: "sites",
            icon: <DeploymentUnitOutlined />,
            label: <Link to={go("/sites")}>Sites</Link>,
          },
          {
            key: "invoice",
            icon: <ContainerOutlined />,
            label: <Link to={go("/invoice")}>Invoices</Link>,
          },
          {
            key: "payment",
            icon: <CreditCardOutlined />,
            label: <Link to={go("/payment")}>Payments</Link>,
          },
        ],
      },
      {
        key: "hr-group",
        icon: <UserOutlined />,
        label: "HR",
        children: [
          {
            key: "employee",
            icon: <UserOutlined />,
            label: <Link to={go("/employee")}>Employee</Link>,
          },
          {
            key: "attendance",
            icon: <UserOutlined />,
            label: <Link to={go("/attendance")}>Attendance</Link>,
          },
          {
            key: "leave",
            icon: <CalendarOutlined />,
            label: <Link to={go("/leave")}>Leave</Link>,
          },
        ],
      },
      {
        key: "system-group",
        icon: <SettingOutlined />,
        label: "System",
        children: [
          {
            key: "settings",
            icon: <SettingOutlined />,
            label: <Link to={go("/settings/company")}>Settings</Link>,
          },
          {
            key: "about",
            icon: <ReconciliationOutlined />,
            label: <Link to={go("/about")}>About</Link>,
          },
        ],
      },
    ],
        userRole
      );
    },
    [basePath, translate, userRole]
  );

  const pathToGroupMap = {
    dashboard: "",
    lead: "sales-group",
    quotes: "sales-group",
    jobs: "sales-group",
    "site-measurement": "planning-group",
    planning: "planning-group",
    scheduling: "planning-group",
    drafting: "planning-group",
    "site-engineer": "planning-group",
    "job-scheduling": "production-group",
    "material-purchase": "production-group",
    fabrication: "production-group",
    qc: "production-group",
    installation: "execution-group",
    customer: "business-group",
    "contact-requests": "business-group",
    invoice: "business-group",
    payment: "business-group",
    employee: "hr-group",
    attendance: "hr-group",
    leave: "hr-group",
    settings: "system-group",
    about: "system-group",
  };

  useEffect(() => {
    if (!location) return;

    const path = location.pathname;
    const cleaned =
      basePath && path.startsWith(basePath) ? path.slice(basePath.length) : path;

    let normalized = cleaned.startsWith("/") ? cleaned.slice(1) : cleaned;

    if (!normalized || normalized === "") {
      normalized = "dashboard";
    } else {
      normalized = normalized.split("/")[0];
    }

    if (normalized === "settings") {
      setCurrentPath("settings");
      setOpenKeys(["system-group"]);
      return;
    }

    setCurrentPath(normalized);

    const parentGroup = pathToGroupMap[normalized];
    if (parentGroup) {
      setOpenKeys([parentGroup]);
    } else {
      setOpenKeys([]);
    }
  }, [location.pathname, basePath]);

  const onCollapse = () => navMenu.collapse();

  return (
    <Sider
      collapsible={collapsible}
      collapsed={collapsible ? isNavMenuClose : collapsible}
      onCollapse={onCollapse}
      className={`navigation ${isMobile ? "navigation--drawer" : ""}`}
      width={256}
      style={{
        overflow: "auto",
        height: isMobile ? "auto" : undefined,
      }}
      theme="light"
    >
      <div
        className="logo"
        onClick={() => {
          onNavigate?.();
          const role = getStoredUserRole();
          navigate(role === "siteEngineer" ? SITE_ENGINEER_HOME : go("/"));
        }}
        style={{ cursor: "pointer" }}
      >
        <BrandLogo
          variant={isNavMenuClose ? "sidebarCollapsed" : "sidebar"}
        />
      </div>
      <Menu
        items={items}
        mode="inline"
        theme="light"
        selectedKeys={[currentPath]}
        openKeys={openKeys}
        onOpenChange={setOpenKeys}
        onClick={() => onNavigate?.()}
        style={{ width: isMobile ? "100%" : 256 }}
      />
    </Sider>
  );
}
