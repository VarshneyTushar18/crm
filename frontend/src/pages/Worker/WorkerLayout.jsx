import { useState } from "react";
import { Layout, Button, Typography } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { Outlet, useNavigate, useSearchParams } from "react-router-dom";
import Navigation from "@/apps/Navigation/NavigationContainer";
import BrandLogo from "@/components/BrandLogo";
import NotificationBell from "@/components/NotificationBell";
import WorkerAttendanceBar from "@/components/WorkerAttendanceBar";
import WorkerTaskTimerBar from "@/components/WorkerTaskTimerBar";
import useResponsive from "@/hooks/useResponsive";

const { Header, Content } = Layout;
const { Text } = Typography;

export default function WorkerLayout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isMobile } = useResponsive();
  const [menuOpen, setMenuOpen] = useState(false);

  const jobId = searchParams.get("jobId") || "";

  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem("user"));
    } catch {
      return null;
    }
  })();

  const logout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  const onAttendanceChanged = () => {
    window.dispatchEvent(new Event("worker-attendance-changed"));
  };

  return (
    <Layout className="admin-shell">
      <Navigation
        basePath="/worker"
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

          {isMobile ? <BrandLogo variant="compact" style={{ marginLeft: 4 }} /> : null}

          <Text className="admin-header__title">
            Worker Panel{user?.name ? ` — ${user.name}` : ""}
          </Text>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <WorkerAttendanceBar jobId={jobId} onChanged={onAttendanceChanged} />
            <WorkerTaskTimerBar />
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
