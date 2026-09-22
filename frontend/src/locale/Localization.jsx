import { ConfigProvider } from 'antd';

export default function Localization({ children }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#339393',
          colorLink: '#0d5c5c',
          colorInfo: '#339393',
          colorBgLayout: '#eef1f6',
          colorBgContainer: '#ffffff',
          colorText: '#0f172a',
          colorTextSecondary: '#64748b',
          colorBorder: '#e2e8f0',
          borderRadius: 10,
          fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
          controlHeight: 40,
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)',
        },
        components: {
          Layout: {
            siderBg: '#ffffff',
            headerBg: '#ffffff',
            bodyBg: '#eef1f6',
          },
          Menu: {
            itemBg: '#ffffff',
            subMenuItemBg: '#f8fafc',
            itemSelectedBg: 'rgba(51, 157, 157, 0.12)',
            itemSelectedColor: '#0d5c5c',
            itemHoverBg: '#f1f5f9',
            itemActiveBg: 'rgba(51, 157, 157, 0.08)',
          },
          Card: {
            borderRadiusLG: 12,
            paddingLG: 20,
          },
          Table: {
            headerBg: '#f8fafc',
            headerColor: '#475569',
            borderColor: '#e2e8f0',
            rowHoverBg: '#f1f5f9',
          },
          Button: {
            borderRadius: 10,
            primaryShadow: '0 2px 8px rgba(51, 157, 157, 0.3)',
          },
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}
