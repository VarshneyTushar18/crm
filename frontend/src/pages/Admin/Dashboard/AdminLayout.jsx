import { useEffect, useState } from "react";
import { Layout, Button, Typography } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Navigation from "../../../apps/Navigation/NavigationContainer";
import BrandLogo from "@/components/BrandLogo";
import NotificationBell from "@/components/NotificationBell";
import useResponsive from "@/hooks/useResponsive";
import {
  isSiteEngineerBlockedPath,
  SITE_ENGINEER_HOME,
} from "@/config/siteEngineerAccess";

const { Header, Content } = Layout;
const { Text } = Typography;

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useResponsive();
  const [menuOpen, setMenuOpen] = useState(false);

  const logout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    if (user?.role !== "siteEngineer") return;
    if (isSiteEngineerBlockedPath(location.pathname)) {
      navigate(SITE_ENGINEER_HOME, { replace: true });
    }
  }, [location.pathname, user?.role, navigate]);

  return (
    <Layout className="admin-shell">
      <Navigation
        basePath="/admin"
        isMobile={isMobile}
        mobileOpen={menuOpen}
        onMobileOpenChange={setMenuOpen}
      />

      <Layout
        className={`admin-main ${isMobile ? "admin-main--mobile" : "admin-main--desktop"}`}
      >
        <Header
          className={`admin-header ${isMobile ? "admin-header--mobile" : "admin-header--desktop"}`}
        >
          {isMobile && (
            <Button
              type="text"
              aria-label="Open menu"
              icon={<MenuOutlined style={{ fontSize: 18 }} />}
              onClick={() => setMenuOpen(true)}
            />
          )}

          {isMobile ? (
            <BrandLogo variant="compact" style={{ marginLeft: 4 }} />
          ) : null}

          <Text className="admin-header__title">
            {user?.role === "siteEngineer" ? "Site Engineer Panel" : "Admin Panel"}
            {user?.name ? ` — ${user.name}` : ""}
          </Text>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
            <NotificationBell />
            <Button danger size={isMobile ? "small" : "middle"} onClick={logout}>
              Logout
            </Button>
          </div>
        </Header>

        <Content
          className={`admin-content ${isMobile ? "admin-content--mobile" : "admin-content--desktop"}`}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
