import { Button, Space, Tag, Typography } from "antd";
import dayjs from "dayjs";
import LivenessPromptModal from "@/components/LivenessPromptModal";
import { useWorkerAttendance } from "@/pages/Worker/useWorkerAttendance";

const { Text } = Typography;

export default function WorkerAttendanceBar({ jobId = "", onChanged }) {
  const {
    loading,
    checkedIn,
    checkInAt,
    elapsedFriendly,
    livenessOpen,
    setLivenessOpen,
    completeCheckIn,
    confirmCheckOut,
  } = useWorkerAttendance({ jobId, onChanged });

  return (
    <>
      <Space size={8} wrap style={{ justifyContent: "flex-end" }}>
        {checkedIn ? (
          <Tag color="green" style={{ marginInlineEnd: 0, fontWeight: 600 }}>
            Clock in: {checkInAt ? dayjs(checkInAt).format("hh:mm A") : "—"}
            <Text type="secondary" style={{ marginLeft: 6, fontWeight: 400 }}>
              · {elapsedFriendly}
            </Text>
          </Tag>
        ) : (
          <Tag color="default" style={{ marginInlineEnd: 0 }}>
            Not clocked in
          </Tag>
        )}
        {!checkedIn ? (
          <Button type="primary" loading={loading} onClick={() => setLivenessOpen(true)}>
            Clock in
          </Button>
        ) : (
          <Button danger loading={loading} onClick={confirmCheckOut}>
            Clock out
          </Button>
        )}
      </Space>

      <LivenessPromptModal
        open={livenessOpen}
        onCancel={() => setLivenessOpen(false)}
        onPassed={completeCheckIn}
      />
    </>
  );
}
