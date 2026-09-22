import { useEffect, useMemo, useState } from "react";
import {
  Layout,
  Menu,
  Button,
  Avatar,
  Typography,
  Divider,
  Space,
  Dropdown,
  Drawer,
} from "antd";
import {
  DashboardOutlined,
  ProjectOutlined,
  DollarOutlined,
  MailOutlined,
  UserOutlined,
  LogoutOutlined,
  HistoryOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MenuOutlined,
  FolderOpenOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { API_BASE_URL } from '@/config/serverApiConfig';
import BrandLogo from "@/components/BrandLogo";
import useResponsive from "@/hooks/useResponsive";
import NotificationBell from "@/components/NotificationBell";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

const { Sider, Header, Content } = Layout;
const { Text } = Typography;

const API_BASE = API_BASE_URL;

export default function CustomerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const { logout } = useCustomerAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [customerName, setCustomerName] = useState("Customer");

  useEffect(() => {
    (async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const res = await axios.get(`${API_BASE}/customer/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const me = res.data?.result;
        setCustomerName(
          me?.name || me?.fullName || me?.customerName || "Customer"
        );
      } catch (e) {
        console.error("Failed to load customer profile:", e);
      }
    })();
  }, []);

  const selectedKey = useMemo(() => {
    if (
      location.pathname.startsWith("/portal/projects") ||
      location.pathname.startsWith("/portal/project/")
    )
      return "projects";
    if (location.pathname.startsWith("/portal/contact-us")) return "contact-us";
    if (location.pathname.startsWith("/portal/enquiry")) return "contact-us";
    if (location.pathname.startsWith("/portal/invoices")) return "invoices";
    if (location.pathname.startsWith("/portal/quotes")) return "quotes";
    if (location.pathname.startsWith("/portal/documents")) return "documents";
    if (location.pathname.startsWith("/portal/payments")) return "payments";
    if (location.pathname.startsWith("/portal/profile")) return "profile";
    if (
      location.pathname === "/portal" ||
      location.pathname.startsWith("/portal/dashboard")
    ) {
      return "dashboard";
    }
    return "dashboard";
  }, [location.pathname]);

  const onLogout = () => {
    logout();
    navigate("/portal/login", { replace: true });
  };

  const onProfileMenuClick = ({ key }) => {
    if (key === "logout") onLogout();
  };

  const menuItems = [
    {
      key: "dashboard",
      icon: <DashboardOutlined />,
      label: <Link to="/portal/dashboard">Dashboard</Link>,
    },
    {
      key: "projects",
      icon: <ProjectOutlined />,
      label: <Link to="/portal/projects">My Projects</Link>,
    },
    {
      key: "contact-us",
      icon: <MailOutlined />,
      label: <Link to="/portal/contact-us">Contact Us</Link>,
    },
    {
      key: "quotes",
      icon: <FileTextOutlined />,
      label: <Link to="/portal/quotes">My Quotes</Link>,
    },
    {
      key: "documents",
      icon: <FolderOpenOutlined />,
      label: <Link to="/portal/documents">Documents</Link>,
    },
    {
      key: "invoices",
      icon: <DollarOutlined />,
      label: <Link to="/portal/invoices">My Invoices</Link>,
    },
    {
      key: "payments",
      icon: <CheckCircleOutlined />,
      label: <Link to="/portal/payments">Payments</Link>,
    },
    {
      key: "profile",
      icon: <UserOutlined />,
      label: <Link to="/portal/profile">Profile</Link>,
    },
  ];

  const profileMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: <Link to="/portal/profile">Profile</Link>,
    },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Logout",
      danger: true,
    },
  ];

  const sidebarContent = (
    <>
      <div
        className="customer-sidebar-header"
        style={{
          padding: "14px 16px",
          minHeight: 72,
          cursor: "pointer",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed && !isMobile ? "center" : "flex-start",
          overflow: "hidden",
        }}
        onClick={() => {
          setDrawerOpen(false);
          navigate("/portal/dashboard");
        }}
      >
        <BrandLogo
          variant={collapsed && !isMobile ? "sidebarCollapsed" : "sidebar"}
        />
      </div>

      <div style={{ padding: "16px 16px 12px" }}>
        <div
          className="customer-sidebar-profile"
          style={{
            borderRadius: 12,
            padding: collapsed && !isMobile ? 10 : 12,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Avatar icon={<UserOutlined />} />
          {(!collapsed || isMobile) && (
            <div style={{ overflow: "hidden" }}>
              <Text
                style={{
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                strong
              >
                {customerName}
              </Text>
              <div className="customer-sidebar-role">Customer</div>
            </div>
          )}
        </div>
      </div>

      <Divider className="customer-sidebar-divider" style={{ margin: "8px 0 12px" }} />

      <Menu
        className="customer-sidebar-menu"
        theme="light"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        onClick={() => setDrawerOpen(false)}
        style={{ borderRight: 0, background: "#fff" }}
      />
    </>
  );

  return (
    <Layout className="customer-shell" style={{ minHeight: "100vh" }}>
      {!isMobile && (
        <Sider
          width={260}
          collapsible
          collapsed={collapsed}
          trigger={null}
          theme="light"
          className="customer-sider--desktop"
        >
          {sidebarContent}
        </Sider>
      )}

      {isMobile && (
        <Drawer
          placement="left"
          width={280}
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          styles={{ body: { padding: 0 } }}
        >
          {sidebarContent}
        </Drawer>
      )}

      <Layout className="customer-main">
        {isMobile ? (
          <div className="customer-mobile-header">
            <Button
              type="text"
              icon={<MenuOutlined style={{ fontSize: 18 }} />}
              onClick={() => setDrawerOpen(true)}
            />
            <BrandLogo variant="compact" />
            <Text strong style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {customerName}
            </Text>
            <Dropdown
              menu={{ items: profileMenuItems, onClick: onProfileMenuClick }}
              placement="bottomRight"
              trigger={["click"]}
            >
              <Button type="text" icon={<UserOutlined />} />
            </Dropdown>
            <NotificationBell />
          </div>
        ) : (
          <Header
            style={{
              background: "#fff",
              padding: "0 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((prev) => !prev)}
              style={{ fontSize: 16 }}
            />

            <Space size={12}>
              <NotificationBell />
              <Dropdown
                menu={{ items: profileMenuItems, onClick: onProfileMenuClick }}
                placement="bottomRight"
                trigger={["click"]}
              >
                <Button type="text">
                  <Space>
                    <Avatar size="small" icon={<UserOutlined />} />
                    <span>{customerName}</span>
                    <DownOutlined />
                  </Space>
                </Button>
              </Dropdown>
            </Space>
          </Header>
        )}

        <Content className="customer-content" style={{ background: "transparent", padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}