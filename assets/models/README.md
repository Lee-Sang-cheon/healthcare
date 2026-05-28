# Pose models

이 폴더에 `.tflite` 모델 파일을 직접 넣어주세요. 빌드 시 앱 번들에 포함됩니다.

## MVP: MoveNet Lightning (권장)

가장 빠르고 작은 단일 인체 자세 추정 모델 — 약 3MB, 모바일에서 30fps 가능.

**다운로드 (singlepose-lightning, FP16):**

https://www.kaggle.com/models/google/movenet/tfLite/singlepose-lightning-tflite-float16

또는 TensorFlow Hub:
https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/float16/4

받은 파일을 다음 경로에 저장:

```
assets/models/movenet_lightning_fp16.tflite
```

## (선택) BlazePose 33 keypoint

V2에서 운동 종목을 늘릴 때 더 풍부한 키포인트가 필요하면 BlazePose로 교체. fast-tflite는 `.tflite`만 읽으므로 MediaPipe `.task` 컨테이너는 `.tflite`로 추출 필요.

Hugging Face 변환본 예시:
- https://huggingface.co/qualcomm/MediaPipe-Pose-Estimation

이 경우 `src/features/pose/movenet-adapter.ts` 대신 BlazePose 어댑터(33 → 우리 13개 joint)를 추가하세요.
