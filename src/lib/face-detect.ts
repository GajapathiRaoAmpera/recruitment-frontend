import type { FaceDetector } from "@mediapipe/tasks-vision";

let detector: Promise<FaceDetector> | undefined;

export interface FaceResult {
  count: number;
  /** Only set when exactly one face was found: "partial" = cut off / too small, "angled" = not facing the camera. */
  problem?: "partial" | "angled";
}

/** BlazeFace keypoints: 0 right eye, 1 left eye, 2 nose tip, 3 mouth, 4-5 ears. Needs a whole, frontal face. */
function judge(d: { boundingBox?: { originX: number; originY: number; width: number; height: number }; keypoints: { x: number; y: number }[] }, w: number, h: number): FaceResult["problem"] {
  const b = d.boundingBox;
  const m = 0.02;
  const inside = (x: number, y: number) => x > m && x < 1 - m && y > m && y < 1 - m;
  if (!b || d.keypoints.length < 4 || !d.keypoints.slice(0, 4).every((k) => inside(k.x, k.y))) return "partial";
  if (b.originX < m * w || b.originY < m * h || b.originX + b.width > (1 - m) * w || b.originY + b.height > (1 - m) * h || b.width < 0.15 * w) return "partial";
  const [re, le, nose] = d.keypoints as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
  const a = Math.abs(nose.x - Math.min(re.x, le.x));
  const c = Math.abs(Math.max(re.x, le.x) - nose.x);
  return Math.min(a, c) / Math.max(a, c, 1e-6) < 0.5 ? "angled" : undefined; // nose roughly centred between the eyes
}

/** Counts faces in a still image. Runs fully in the browser; the model and wasm are served from /mediapipe (same origin, nothing leaves the device). */
export async function countFaces(image: HTMLCanvasElement): Promise<FaceResult> {
  detector ??= import("@mediapipe/tasks-vision").then(async ({ FaceDetector, FilesetResolver }) => {
    const files = await FilesetResolver.forVisionTasks("/mediapipe");
    return FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: "/mediapipe/blaze_face_short_range.tflite" },
      runningMode: "IMAGE",
      minDetectionConfidence: 0.6,
    });
  });
  const d = await detector;
  // MediaPipe's wasm prints "INFO: Created TensorFlow Lite XNNPACK delegate" through console.error; it is not an
  // error, but Next's dev overlay shows it as one. Drop only that line while detecting.
  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("INFO:")) return;
    original.apply(console, args);
  };
  try {
    const found = d.detect(image).detections;
    return { count: found.length, problem: found.length === 1 ? judge(found[0]!, image.width, image.height) : undefined };
  } catch (e) {
    detector = undefined; // let the next attempt reload the model
    throw e;
  } finally {
    console.error = original;
  }
}
