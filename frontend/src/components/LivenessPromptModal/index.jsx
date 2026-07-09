import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Modal, Progress, Space, Tag, Typography, message } from "antd";
import {
  captureVideoFrame,
  createFaceLivenessDetector,
  createLivenessTracker,
} from "@/utils/faceLivenessDetector";

const { Text, Title } = Typography;

const STEPS = [
  {
    key: "blink",
    title: "Blink twice",
    hint: "Look at the camera — we will detect your blinks automatically.",
  },
  {
    key: "turn_head",
    title: "Turn head left, then right",
    hint: "Slowly turn your head left, then right. No button needed.",
  },
];

/**
 * Auto face liveness: MediaPipe detects blinks + head turns from the camera.
 */
export default function LivenessPromptModal({ open, onCancel, onPassed }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const landmarkerRef = useRef(null);
  const trackerRef = useRef(null);
  const finishingRef = useRef(false);

  const [stepIndex, setStepIndex] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [cameraError, setCameraError] = useState("");
  const [modelError, setModelError] = useState("");
  const [starting, setStarting] = useState(false);
  const [faceSeen, setFaceSeen] = useState(false);
  const [blinkCount, setBlinkCount] = useState(0);
  const [turnProgress, setTurnProgress] = useState({ left: false, right: false });
  const [statusText, setStatusText] = useState("Loading face detection…");

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const finishLiveness = useCallback(
    (nextCompleted) => {
      if (finishingRef.current) return;
      finishingRef.current = true;

      const video = videoRef.current;
      const photoDataUrl = captureVideoFrame(video);
      stopCamera();

      if (!photoDataUrl) {
        finishingRef.current = false;
        message.error("Could not capture selfie. Allow camera and try again.");
        return;
      }

      const score = Math.min(100, 70 + nextCompleted.length * 15);
      onPassed?.({
        livenessPassed: true,
        livenessSteps: nextCompleted,
        livenessScore: score,
        photoDataUrl,
      });
      message.success("Face verified — check-in photo captured");
    },
    [onPassed, stopCamera]
  );

  const runDetectionLoop = useCallback(() => {
    const landmarker = landmarkerRef.current;
    const video = videoRef.current;
    const tracker = trackerRef.current;
    if (!landmarker || !video || !tracker || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(runDetectionLoop);
      return;
    }

    const result = landmarker.detectForVideo(video, performance.now());
    const snap = tracker.update(result);

    setStepIndex(snap.stepIndex);
    setCompleted(snap.completed);
    setFaceSeen(snap.faceSeen);
    setBlinkCount(snap.blinkCount);
    setTurnProgress({ left: snap.sawLeft, right: snap.sawRight });

    if (!snap.faceSeen) {
      setStatusText("Position your face in the frame");
    } else if (snap.stepIndex === 0) {
      setStatusText(
        snap.blinkCount >= 2
          ? "Blinks detected ✓"
          : `Blink twice (${snap.blinkCount}/2 detected)`
      );
    } else if (snap.stepIndex === 1) {
      const parts = [];
      if (snap.sawLeft) parts.push("left ✓");
      if (snap.sawRight) parts.push("right ✓");
      setStatusText(
        parts.length
          ? `Head turn: ${parts.join(", ")}`
          : "Turn your head left, then right"
      );
    } else if (snap.done) {
      setStatusText("Face verified — capturing photo…");
      finishLiveness(snap.completed);
      return;
    }

    rafRef.current = requestAnimationFrame(runDetectionLoop);
  }, [finishLiveness]);

  const startSession = useCallback(async () => {
    setStarting(true);
    setCameraError("");
    setModelError("");
    finishingRef.current = false;
    trackerRef.current = createLivenessTracker();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera not supported in this browser");
      }

      const landmarker = await createFaceLivenessDetector();
      landmarkerRef.current = landmarker;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      setStatusText("Position your face in the frame");
      rafRef.current = requestAnimationFrame(runDetectionLoop);
    } catch (err) {
      const msg = err?.message || "Could not start face detection";
      if (String(msg).toLowerCase().includes("camera")) {
        setCameraError(msg);
      } else {
        setModelError(msg);
      }
    } finally {
      setStarting(false);
    }
  }, [runDetectionLoop]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      landmarkerRef.current = null;
      trackerRef.current = null;
      finishingRef.current = false;
      setStepIndex(0);
      setCompleted([]);
      setCameraError("");
      setModelError("");
      setFaceSeen(false);
      setBlinkCount(0);
      setTurnProgress({ left: false, right: false });
      setStatusText("Loading face detection…");
      return undefined;
    }
    startSession();
    return () => stopCamera();
  }, [open, startSession, stopCamera]);

  const progress = Math.min(
    100,
    Math.round(
      stepIndex === 0
        ? (Math.min(blinkCount, 2) / 2) * 50
        : 50 +
            ((turnProgress.left ? 1 : 0) + (turnProgress.right ? 1 : 0)) * 25
    )
  );
  const current = STEPS[Math.min(stepIndex, STEPS.length - 1)];

  return (
    <Modal
      title="Liveness check"
      open={open}
      onCancel={() => {
        stopCamera();
        onCancel?.();
      }}
      footer={null}
      destroyOnClose
      width={520}
    >
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        <Alert
          type="info"
          showIcon
          message="Auto face detection"
          description="Blink and turn your head — the camera verifies you automatically. No button taps needed."
        />

        <div
          style={{
            background: "#0b1020",
            borderRadius: 12,
            overflow: "hidden",
            aspectRatio: "4 / 3",
            position: "relative",
          }}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(-1)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              right: 10,
              display: "flex",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <Tag color={faceSeen ? "green" : "default"}>
              {faceSeen ? "Face detected" : "No face"}
            </Tag>
            {stepIndex === 0 ? (
              <Tag color={blinkCount >= 2 ? "green" : "blue"}>Blinks {blinkCount}/2</Tag>
            ) : null}
            {stepIndex === 1 ? (
              <Space size={4}>
                <Tag color={turnProgress.left ? "green" : "default"}>Left</Tag>
                <Tag color={turnProgress.right ? "green" : "default"}>Right</Tag>
              </Space>
            ) : null}
          </div>
          {(cameraError || modelError) && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                color: "#fff",
                padding: 16,
                textAlign: "center",
                background: "rgba(0,0,0,0.72)",
              }}
            >
              <div>
                <Text style={{ color: "#fff" }}>{cameraError || modelError}</Text>
                <div style={{ marginTop: 12 }}>
                  <Button loading={starting} onClick={startSession}>
                    Retry
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <Progress percent={Math.min(100, progress)} size="small" status="active" />

        <div>
          <Title level={5} style={{ marginBottom: 4 }}>
            Step {Math.min(stepIndex + 1, STEPS.length)}/{STEPS.length}: {current.title}
          </Title>
          <Text type="secondary">{current.hint}</Text>
          <div style={{ marginTop: 6 }}>
            <Text strong>{statusText}</Text>
          </div>
        </div>
      </Space>
    </Modal>
  );
}
