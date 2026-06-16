import { useState } from "react";
import { Layout, Button, Typography } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { Outlet, useNavigate } from "react-router-dom";
import Navigation from "../../../apps/Navigation/NavigationContainer";
import useResponsive from "@/hooks/useResponsive";

const { Header, Content } = Layout;
const { Text } = Typography;

export default function AdminLayout() {
  const navigate = useNavigate();
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

          <Text className="admin-header__title">
            Admin Panel{user?.name ? ` — ${user.name}` : ""}
          </Text>

          <Button danger size={isMobile ? "small" : "middle"} onClick={logout}>
            Logout
          </Button>
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
