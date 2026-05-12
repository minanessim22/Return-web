#!/usr/bin/env python3
import base64
import json
import os
import sys
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

PUBLIC_DIR = os.path.join(os.getcwd(), 'public')
CASCADE_PATH = os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml')
FACE_CASCADE = cv2.CascadeClassifier(CASCADE_PATH)


def _safe_realpath(file_path: str) -> Optional[str]:
    normalized = os.path.normpath(file_path).lstrip('/\\')
    resolved = os.path.realpath(os.path.join(PUBLIC_DIR, normalized))
    public_root = os.path.realpath(PUBLIC_DIR)
    if not resolved.startswith(public_root):
        return None
    return resolved


def _decode_image(source: str) -> Tuple[Optional[np.ndarray], Optional[str]]:
    value = (source or '').strip()
    if not value:
        return None, 'Empty image source.'

    if value.startswith('data:image/'):
        marker = ';base64,'
        pos = value.find(marker)
        if pos == -1:
            return None, 'Unsupported image data URL.'
        payload = value[pos + len(marker):]
        try:
            image_bytes = base64.b64decode(payload, validate=False)
        except Exception:
            return None, 'Invalid base64 image.'
        buffer = np.frombuffer(image_bytes, dtype=np.uint8)
        image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
        return image, None if image is not None else 'Unable to decode image bytes.'

    if value.startswith('http://') or value.startswith('https://'):
        try:
            with urllib.request.urlopen(value, timeout=8) as response:
                image_bytes = response.read()
            buffer = np.frombuffer(image_bytes, dtype=np.uint8)
            image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
            return image, None if image is not None else 'Unable to decode remote image.'
        except Exception:
            return None, 'Unable to load remote image.'

    file_path = _safe_realpath(value)
    if not file_path or not os.path.exists(file_path):
        return None, 'Image file was not found.'
    image = cv2.imread(file_path, cv2.IMREAD_COLOR)
    return image, None if image is not None else 'Unable to read image file.'


def _dedupe_faces(faces: List[Tuple[int, int, int, int]]) -> List[Tuple[int, int, int, int]]:
    if not faces:
        return []
    faces = sorted(faces, key=lambda item: item[2] * item[3], reverse=True)
    selected: List[Tuple[int, int, int, int]] = []
    for face in faces:
        x, y, w, h = face
        keep = True
        for sx, sy, sw, sh in selected:
            inter_x1 = max(x, sx)
            inter_y1 = max(y, sy)
            inter_x2 = min(x + w, sx + sw)
            inter_y2 = min(y + h, sy + sh)
            inter_w = max(0, inter_x2 - inter_x1)
            inter_h = max(0, inter_y2 - inter_y1)
            intersection = inter_w * inter_h
            union = (w * h) + (sw * sh) - intersection
            iou = (intersection / union) if union > 0 else 0.0
            if iou >= 0.35:
                keep = False
                break
        if keep:
            selected.append(face)
    return selected


def _detect_faces(image: np.ndarray) -> List[Tuple[int, int, int, int]]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    equalized = cv2.equalizeHist(gray)
    faces = FACE_CASCADE.detectMultiScale(equalized, scaleFactor=1.1, minNeighbors=6, minSize=(48, 48))
    if faces is None or len(faces) == 0:
        faces = FACE_CASCADE.detectMultiScale(equalized, scaleFactor=1.08, minNeighbors=5, minSize=(40, 40))
    if faces is None:
        return []
    return _dedupe_faces([tuple(int(v) for v in face) for face in faces])


def _clip_box(x: int, y: int, w: int, h: int, width: int, height: int) -> Tuple[int, int, int, int]:
    margin_x = int(w * 0.18)
    margin_y = int(h * 0.22)
    x1 = max(0, x - margin_x)
    y1 = max(0, y - margin_y)
    x2 = min(width, x + w + margin_x)
    y2 = min(height, y + h + margin_y)
    return x1, y1, x2, y2


def _lbp_histogram(gray: np.ndarray, bins: int = 16) -> np.ndarray:
    center = gray[1:-1, 1:-1]
    code = np.zeros_like(center, dtype=np.uint8)
    neighbors = [
        gray[:-2, :-2], gray[:-2, 1:-1], gray[:-2, 2:], gray[1:-1, 2:],
        gray[2:, 2:], gray[2:, 1:-1], gray[2:, :-2], gray[1:-1, :-2]
    ]
    for idx, neighbor in enumerate(neighbors):
        code |= ((neighbor >= center) << idx).astype(np.uint8)
    hist, _ = np.histogram(code.ravel(), bins=bins, range=(0, 256))
    hist = hist.astype(np.float32)
    total = float(hist.sum())
    return hist / total if total > 0 else hist


def _orientation_histogram(gray: np.ndarray, bins: int = 16) -> np.ndarray:
    gx = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    magnitude, angle = cv2.cartToPolar(gx, gy, angleInDegrees=True)
    hist = np.zeros((bins,), dtype=np.float32)
    bin_width = 360.0 / bins
    flat_angles = angle.reshape(-1)
    flat_magnitude = magnitude.reshape(-1)
    for ang, mag in zip(flat_angles, flat_magnitude):
        index = int(ang // bin_width) % bins
        hist[index] += float(mag)
    total = float(hist.sum())
    return hist / total if total > 0 else hist


def _descriptor_from_face(face_crop: np.ndarray) -> Tuple[List[float], float, float]:
    gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (112, 112), interpolation=cv2.INTER_AREA)
    normalized = cv2.equalizeHist(resized)

    hist = cv2.calcHist([normalized], [0], None, [32], [0, 256]).flatten().astype(np.float32)
    hist = hist / max(float(hist.sum()), 1.0)

    lbp = _lbp_histogram(normalized, 16)
    orient = _orientation_histogram(normalized, 16)
    patch = cv2.resize(normalized, (8, 8), interpolation=cv2.INTER_AREA).flatten().astype(np.float32) / 255.0

    descriptor = np.concatenate([hist, orient, lbp, patch]).astype(np.float32)
    norm = float(np.linalg.norm(descriptor))
    if norm > 0:
        descriptor /= norm

    blur = float(cv2.Laplacian(normalized, cv2.CV_32F).var())
    quality = max(0.0, min(1.0, blur / 220.0))
    brightness = float(normalized.mean()) / 255.0
    brightness_penalty = 1.0 - min(abs(brightness - 0.5) * 1.5, 0.45)
    confidence = max(0.0, min(1.0, (quality * 0.75) + (brightness_penalty * 0.25)))
    return descriptor.round(6).tolist(), round(confidence, 4), round(quality, 4)


def analyze_image(source: str) -> Dict[str, Any]:
    image, error = _decode_image(source)
    if image is None:
        return {
            'ok': False,
            'issue': 'UNSUPPORTED_IMAGE',
            'message': error or 'Unable to load image.'
        }

    faces = _detect_faces(image)
    if len(faces) == 0:
        return {
            'ok': False,
            'issue': 'NO_FACE_DETECTED',
            'message': 'No face detected.'
        }
    if len(faces) > 1:
        return {
            'ok': False,
            'issue': 'MULTIPLE_FACES',
            'message': 'Multiple faces detected. Please use a photo with exactly one face.',
            'faceCount': len(faces)
        }

    height, width = image.shape[:2]
    x, y, w, h = faces[0]
    x1, y1, x2, y2 = _clip_box(x, y, w, h, width, height)
    crop = image[y1:y2, x1:x2]
    if crop.size == 0:
        return {
            'ok': False,
            'issue': 'NO_FACE_DETECTED',
            'message': 'No face detected.'
        }

    descriptor, confidence, quality = _descriptor_from_face(crop)
    return {
        'ok': True,
        'faceCount': 1,
        'confidence': confidence,
        'quality': quality,
        'descriptor': descriptor
    }


def main() -> int:
    raw = sys.stdin.read()
    payload = json.loads(raw or '{}')

    if os.environ.get('RETURN_FACE_AI_MOCK') == '1':
        op = payload.get('operation')
        images = payload.get('images') or []
        if op == 'analyze':
            results = []
            for item in images:
                value = (item or '').strip()
                if 'NOFACE' in value:
                    results.append({'ok': False, 'issue': 'NO_FACE_DETECTED', 'message': 'No face detected.'})
                elif 'MULTIFACE' in value:
                    results.append({'ok': False, 'issue': 'MULTIPLE_FACES', 'message': 'Multiple faces detected. Please use a photo with exactly one face.', 'faceCount': 2})
                elif 'CAR' in value:
                    results.append({'ok': False, 'issue': 'NO_FACE_DETECTED', 'message': 'No face detected.'})
                else:
                    base = 0.9 if 'FACE_A' in value else 0.7 if 'FACE_B' in value else 0.5
                    descriptor = [round(base + ((i % 7) * 0.001), 6) for i in range(128)]
                    results.append({'ok': True, 'faceCount': 1, 'confidence': 0.92, 'quality': 0.88, 'descriptor': descriptor})
            sys.stdout.write(json.dumps({'ok': True, 'results': results}))
            return 0

    images = payload.get('images') or []
    results = [analyze_image(str(item)) for item in images]
    sys.stdout.write(json.dumps({'ok': True, 'results': results}))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
