import { useEffect, useMemo, useState } from "react";
import { Tag, Typography } from "antd";
import { getMyWorkerTasks } from "@/api/workerTaskApi";

const { Text } = Typography;

const formatElapsed = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

/**
 * Live timer for the worker's active (In Progress) task — shown in navbar.
 */
export default function WorkerTaskTimerBar({ pollMs = 15000 }) {
  const [activeTask, setActiveTask] = useState(null);
  const [now, setNow] = useState(Date.now());

  const load = async () => {
    try {
      const list = await getMyWorkerTasks();
      const inProgress = (Array.isArray(list) ? list : []).find(
        (t) => t.status === "In Progress"
      );
      setActiveTask(inProgress || null);
    } catch {
      setActiveTask(null);
    }
  };

  useEffect(() => {
    load();
    const onFocus = () => load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    // Refresh when worker starts/completes a task elsewhere on the page
    const onTaskChanged = () => load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("worker-task-changed", onTaskChanged);
    const poll = setInterval(load, pollMs);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("worker-task-changed", onTaskChanged);
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [pollMs]);

  const elapsedLabel = useMemo(() => {
    if (!activeTask?.startedAt) return "00:00:00";
    return formatElapsed(now - new Date(activeTask.startedAt).getTime());
  }, [activeTask, now]);

  const expectedMins = Number(activeTask?.expectedDurationMinutes || 0);
  const overExpected = useMemo(() => {
    if (!activeTask?.startedAt || !expectedMins) return false;
    const elapsedMins = (now - new Date(activeTask.startedAt).getTime()) / 60000;
    return elapsedMins > expectedMins;
  }, [activeTask, expectedMins, now]);

  if (!activeTask) {
    return (
      <Text type="secondary" style={{ fontSize: 13 }}>
        No active task
      </Text>
    );
  }

  const title =
    String(activeTask.title || "Task").length > 22
      ? `${String(activeTask.title).slice(0, 22)}…`
      : activeTask.title;

  return (
    <Tag
      color={overExpected ? "orange" : "processing"}
      style={{
        margin: 0,
        padding: "4px 10px",
        fontSize: 13,
        lineHeight: "22px",
        maxWidth: 320,
      }}
    >
      Task · {title} · {elapsedLabel}
      {expectedMins ? ` / ${expectedMins}m` : ""}
    </Tag>
  );
}
