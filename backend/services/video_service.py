"""
Video processing service — frame extraction using O(1) timestamp seeks.

Uses cv2.CAP_PROP_POS_MSEC to seek directly to any timestamp in O(1)
(indexed video formats like MP4/MOV support this without scanning frames).
"""

import cv2
import base64


def extract_frames_at_timestamps(video_path: str, timestamps_ms: list, max_frames: int = 12) -> list:
    """
    Extract frames from a video at specific timestamps.

    Uses cv2.CAP_PROP_POS_MSEC for O(1) seeks — directly jumps to the
    timestamp without iterating through intermediate frames.

    Falls back to evenly-spaced frames when timestamps list is empty.

    Args:
        video_path:    Absolute path to the video file.
        timestamps_ms: List of timestamps in milliseconds to seek to.
        max_frames:    Maximum number of frames to return.

    Returns:
        List of data-URL strings ("data:image/jpeg;base64,…").
    """
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration_ms = (total_frames / fps) * 1000 if fps > 0 and total_frames > 0 else 30_000

    # Build ordered list of seek targets
    if timestamps_ms:
        targets = sorted(set(float(t) for t in timestamps_ms))
        # Always include a frame near the beginning for context
        if not targets or targets[0] > 1000:
            targets = [0.0] + targets
        # Trim to max_frames, keeping them spread across the timeline
        if len(targets) > max_frames:
            step = len(targets) / max_frames
            targets = [targets[int(i * step)] for i in range(max_frames)]
    else:
        # Evenly-spaced fallback: 8 frames spread across the video
        n = min(max_frames, 8)
        targets = [duration_ms * i / max(n - 1, 1) for i in range(n)]

    frames_b64 = []
    for ts in targets:
        # O(1) seek to millisecond position
        cap.set(cv2.CAP_PROP_POS_MSEC, ts)
        ret, frame = cap.read()
        if not ret:
            continue

        # Resize to max 640×480 to keep payload manageable
        h, w = frame.shape[:2]
        scale = min(640 / w, 480 / h, 1.0)
        if scale < 1.0:
            frame = cv2.resize(frame, (int(w * scale), int(h * scale)))

        ok, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
        if ok:
            b64 = base64.b64encode(buf.tobytes()).decode('utf-8')
            frames_b64.append(f"data:image/jpeg;base64,{b64}")

    cap.release()
    return frames_b64


def get_video_duration_ms(video_path: str) -> float:
    """Return the duration of a video file in milliseconds."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        return 0.0
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()
    return (total / fps) * 1000 if fps > 0 else 0.0
