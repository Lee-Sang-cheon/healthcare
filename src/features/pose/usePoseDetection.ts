import { useTensorflowModel } from 'react-native-fast-tflite';
import { useFrameProcessor } from 'react-native-vision-camera';
import { useRunOnJS } from 'react-native-worklets-core';
import { useResizePlugin } from 'vision-camera-resize-plugin';

import type { PoseFrame } from './keypoints';
import { MOVENET_LIGHTNING_INPUT, movenetToPose } from './movenet-adapter';

/**
 * Loads MoveNet Lightning and returns a frame processor that emits
 * a normalized PoseFrame on the JS thread via `onPose`.
 *
 * `onPose` should be stable (wrap in `useCallback` upstream). If the model is
 * still loading or has failed, the processor is a no-op.
 */
export function usePoseDetection(onPose: (pose: PoseFrame) => void) {
  // Model file must exist at this path — see assets/models/README.md.
  // `[]` selects the default CPU delegate; swap in 'core-ml' / 'android-gpu'
  // once the device matrix is settled.
  const model = useTensorflowModel(
    require('../../../assets/models/movenet_lightning_fp16.tflite'),
    [],
  );
  const { resize } = useResizePlugin();

  const dispatch = useRunOnJS(onPose, [onPose]);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';
      if (model.state !== 'loaded') return;

      const resized = resize(frame, {
        scale: { width: MOVENET_LIGHTNING_INPUT, height: MOVENET_LIGHTNING_INPUT },
        pixelFormat: 'rgb',
        dataType: 'uint8',
      });

      // fast-tflite expects ArrayBuffer[]; Uint8Array.buffer is ArrayBufferLike in newer TS.
      const outputs = model.model.runSync([resized.buffer as ArrayBuffer]);
      const raw = new Float32Array(outputs[0]);
      const pose = movenetToPose(raw);
      dispatch(pose);
    },
    [model, dispatch, resize],
  );

  return {
    frameProcessor: model.state === 'loaded' ? frameProcessor : undefined,
    modelState: model.state,
  };
}
