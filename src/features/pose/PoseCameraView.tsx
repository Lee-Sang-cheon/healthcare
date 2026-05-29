import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import type { PoseFrame } from './keypoints';
import { usePoseDetection } from './usePoseDetection';

interface Props {
  active: boolean;
  onPose: (pose: PoseFrame) => void;
}

export function PoseCameraView({ active, onPose }: Props) {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const { frameProcessor, modelState } = usePoseDetection(onPose);
  const theme = useTheme();

  useEffect(() => {
    if (!hasPermission) void requestPermission();
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="body">카메라 권한이 필요합니다.</ThemedText>
        <Pressable
          onPress={() => requestPermission()}
          style={[styles.button, { backgroundColor: theme.accent }]}
        >
          <ThemedText type="bodyEmphasis" themeColor="background">권한 허용</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundElement }]}>
        <ActivityIndicator color={theme.accent} />
        <ThemedText type="small" themeColor="textSecondary">카메라 준비중...</ThemedText>
      </View>
    );
  }

  if (modelState === 'error') {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="body">자세 인식 모델을 불러오지 못했습니다.</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          assets/models/movenet_lightning_fp16.tflite 파일을 확인하세요.
        </ThemedText>
      </View>
    );
  }

  return (
    <>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={active}
        frameProcessor={frameProcessor}
        pixelFormat="rgb"
      />
      {modelState === 'loading' && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <View style={[styles.loadingPill, { backgroundColor: theme.background + 'D9' }]}>
            <ActivityIndicator color={theme.accent} size="small" />
            <ThemedText type="small" themeColor="textSecondary">
              자세 인식 모델 로딩중...
            </ThemedText>
          </View>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  button: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
  },
  loadingOverlay: {
    position: 'absolute',
    top: Spacing.four,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  loadingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
});
