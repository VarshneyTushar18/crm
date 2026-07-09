import { useEffect, useMemo, useState } from "react";
import { Button, Modal, Space, Tag, Typography, message } from "antd";
import LivenessPromptModal from "@/components/LivenessPromptModal";
import {
  checkInAttendance,
  checkOutAttendance,
  getAttendanceStatus,
} from "@/api/workerAttendanceApi";

const formatElapsed = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const s = String(totalSeconds % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const DEVICE_KEY = "crmDeviceId";

const ensureDeviceId = () => {
  const existing = localStorage.getItem(DEVICE_KEY);
  if (existing) return existing;
  const nativeCrypto = typeof window !== "undefined" ? window.crypto : null;
  const generated =
    (nativeCrypto?.randomUUID && nativeCrypto.randomUUID()) ||
    `device-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(DEVICE_KEY, generated);
  return generated;
};

const captureGps = () =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS not supported on this device/browser"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }),
      (err) =>
        reject(
          new Error(
            err?.message ||
              "GPS permission denied. Enable location access to mark attendance."
          )
        ),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });

const captureCameraPhoto = async () => {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
    audio: false,
  });
  try {
    const video = document.createElement("video");
    video.srcObject = stream;
    video.playsInline = true;
    video.muted = true;
    await video.play();
    await new Promise((r) => setTimeout(r, 350));
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.7);
  } finally {
    stream.getTracks().forEach((t) => t.stop());
  }
};

export default function WorkerAttendanceBar({ jobId = "", onChanged }) {
  const [loading, setLoading] = useState(false);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInAt, setCheckInAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [livenessOpen, setLivenessOpen] = useState(false);

  const elapsedLabel = useMemo(() => {
    if (!checkedIn || !checkInAt) return "00:00:00";
    return formatElapsed(now - new Date(checkInAt).getTime());
  }, [checkedIn, checkInAt, now]);

  const loadStatus = async () => {
    try {
      const status = await getAttendanceStatus();
      setCheckedIn(!!status?.isCheckedIn);
      setCheckInAt(status?.session?.checkInTime || null);
    } catch {
      setCheckedIn(false);
      setCheckInAt(null);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    if (!checkedIn) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [checkedIn]);

  const completeCheckIn = async (liveness) => {
    try {
      setLoading(true);
      setLivenessOpen(false);
      if (!liveness?.photoDataUrl) {
        message.error("Check-in photo missing. Try again.");
        return;
      }
      const gps = await captureGps();
      const res = await checkInAttendance({
        ...gps,
        ...liveness,
        jobId: jobId || undefined,
        deviceId: ensureDeviceId(),
      });
      setCheckedIn(true);
      setCheckInAt(res?.result?.session?.checkInTime || new Date().toISOString());
      setNow(Date.now());
      message.success("Checked in — photo saved on server, timer started");
      onChanged?.();
    } catch (err) {
      message.error(err?.response?.data?.message || err?.message || "Check-in failed");
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const onCheckOut = async () => {
    try {
      setLoading(true);
      message.loading({ content: "Capturing check-out photo…", key: "checkout", duration: 0 });
      let photoDataUrl = "";
      try {
        photoDataUrl = await captureCameraPhoto();
      } catch {
        photoDataUrl = "";
      }
      const gps = await captureGps();
      const res = await checkOutAttendance({
        ...gps,
        photoDataUrl: photoDataUrl || undefined,
      });
      message.destroy("checkout");
      setCheckedIn(false);
      setCheckInAt(null);
      message.success(
        `Checked out — total ${res?.result?.elapsedLabel || elapsedLabel}`
      );
      onChanged?.();
    } catch (err) {
      message.destroy("checkout");
      message.error(err?.response?.data?.message || err?.message || "Check-out failed");
      await loadStatus();
    } finally {
      setLoading(false);
    }
  };

  const confirmCheckOut = () => {
    Modal.confirm({
      title: "Check out?",
      content:
        "We will capture a quick photo and save check-out time to the server (admin timesheet).",
      okText: "Check Out",
      okButtonProps: { danger: true },
      onOk: onCheckOut,
    });
  };

  return (
    <>
      <Space size={8} wrap style={{ justifyContent: "flex-end" }}>
        {checkedIn ? (
          <Tag color="green" style={{ marginInlineEnd: 0, fontWeight: 600 }}>
            On shift · {elapsedLabel}
          </Tag>
        ) : (
          <Tag color="default" style={{ marginInlineEnd: 0 }}>
            Not checked in
          </Tag>
        )}
        {!checkedIn ? (
          <Button
            type="primary"
            loading={loading}
            onClick={() => setLivenessOpen(true)}
          >
            Check In
          </Button>
        ) : (
          <Button danger loading={loading} onClick={confirmCheckOut}>
            Check Out
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
