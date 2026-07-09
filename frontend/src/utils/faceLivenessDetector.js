/**
 * Browser-side liveness using MediaPipe Face Landmarker + blendshapes.
 * Detects blinks and head turns automatically from the camera feed.
 */

const WASM_CDN =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise = null;

const getBlend = (blendshapes, name) => {
  const item = blendshapes?.find((b) => b.categoryName === name);
  return Number(item?.score || 0);
};

const landmarkCenterX = (landmarks) => {
  if (!landmarks?.length) return 0.5;
  let min = 1;
  let max = 0;
  landmarks.forEach((p) => {
    min = Math.min(min, p.x);
    max = Math.max(max, p.x);
  });
  return (min + max) / 2;
};

const noseOffsetRatio = (landmarks) => {
  if (!landmarks?.length) return 0;
  const center = landmarkCenterX(landmarks);
  const nose = landmarks[1];
  if (!nose) return 0;
  let min = 1;
  let max = 0;
  landmarks.forEach((p) => {
    min = Math.min(min, p.x);
    max = Math.max(max, p.x);
  });
  const width = Math.max(0.05, max - min);
  return (nose.x - center) / width;
};

export async function createFaceLivenessDetector() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import(
        "@mediapipe/tasks-vision"
      );
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);
      try {
        return await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      } catch {
        return FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
        });
      }
    })();
  }
  const landmarker = await landmarkerPromise;
  return landmarker;
}

/**
 * Stateful auto liveness tracker for a single check-in session.
 */
export function createLivenessTracker() {
  const state = {
    stepIndex: 0,
    completed: [],
    faceSeen: false,
    blinkCount: 0,
    eyesWereOpen: true,
    sawLeft: false,
    sawRight: false,
    lastBlinkAt: 0,
  };

  const STEPS = ["blink", "turn_head"];

  const resetBlink = () => {
    state.blinkCount = 0;
    state.eyesWereOpen = true;
    state.lastBlinkAt = 0;
  };

  const resetTurn = () => {
    state.sawLeft = false;
    state.sawRight = false;
  };

  const advanceIfDone = () => {
    const key = STEPS[state.stepIndex];
    if (key === "blink" && state.blinkCount >= 2) {
      state.completed.push("blink");
      state.stepIndex = 1;
      resetTurn();
      return true;
    }
    if (key === "turn_head" && state.sawLeft && state.sawRight) {
      state.completed.push("turn_head");
      state.stepIndex = 2;
      return true;
    }
    return false;
  };

  /**
   * @param {import("@mediapipe/tasks-vision").FaceLandmarkerResult} result
   * @returns {{ stepIndex: number, completed: string[], faceSeen: boolean, blinkCount: number, sawLeft: boolean, sawRight: boolean, done: boolean }}
   */
  const update = (result) => {
    const landmarks = result?.faceLandmarks?.[0];
    const blends = result?.faceBlendshapes?.[0]?.categories;

    if (!landmarks) {
      state.faceSeen = false;
      return snapshot();
    }

    state.faceSeen = true;
    const now = Date.now();

    if (state.stepIndex === 0) {
      const blinkL = getBlend(blends, "eyeBlinkLeft");
      const blinkR = getBlend(blends, "eyeBlinkRight");
      const blinkScore = (blinkL + blinkR) / 2;
      const eyesClosed = blinkScore > 0.45;

      if (eyesClosed && state.eyesWereOpen && now - state.lastBlinkAt > 250) {
        state.blinkCount += 1;
        state.lastBlinkAt = now;
        state.eyesWereOpen = false;
        advanceIfDone();
      }
      if (!eyesClosed && blinkScore < 0.25) {
        state.eyesWereOpen = true;
      }
    }

    if (state.stepIndex === 1) {
      // Mirrored selfie preview: user's left turn increases nose offset
      const offset = noseOffsetRatio(landmarks);
      if (offset < -0.1) state.sawLeft = true;
      if (offset > 0.1) state.sawRight = true;
      if (state.sawLeft && state.sawRight) {
        advanceIfDone();
      }
    }

    return snapshot();
  };

  const snapshot = () => ({
    stepIndex: state.stepIndex,
    completed: [...state.completed],
    faceSeen: state.faceSeen,
    blinkCount: state.blinkCount,
    sawLeft: state.sawLeft,
    sawRight: state.sawRight,
    done: state.stepIndex >= STEPS.length,
  });

  const reset = () => {
    state.stepIndex = 0;
    state.completed = [];
    state.faceSeen = false;
    resetBlink();
    resetTurn();
  };

  return { update, reset, snapshot };
}

export function captureVideoFrame(video, quality = 0.7) {
  if (!video?.videoWidth) return "";
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}
