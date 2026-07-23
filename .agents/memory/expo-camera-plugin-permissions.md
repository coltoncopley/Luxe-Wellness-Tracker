---
name: Expo config-plugin permission strings
description: expo-camera injects mic permissions by default; later plugins overwrite earlier iOS purpose strings.
---

Two Apple-review traps with Expo config plugins in app.json:

1. **expo-camera silently adds microphone permissions.** With default options it injects a generic `NSMicrophoneUsageDescription` ("Allow $(PRODUCT_NAME) to access your microphone") and Android `RECORD_AUDIO`. Apple 5.1.1 rejects generic/unused purpose strings.
   **How to apply:** if the app never records audio, set `"microphonePermission": false, "recordAudioAndroid": false` on the expo-camera plugin entry.

2. **Plugin order decides which purpose string ships.** Config plugins apply in array order; a later plugin that sets the same Info.plist key (e.g. expo-image-picker's `cameraPermission` vs expo-camera's) overwrites the earlier one.
   **How to apply:** whichever plugin is listed last must carry the complete purpose string covering ALL camera uses (photos + label scans + barcode scanning, etc.).

**Why:** discovered during barcode-scanner review 2026-07 by reading `expo-camera/plugin/build/withCamera.js` — the shipped NSCameraUsageDescription was the image-picker one, and an unwanted mic permission would have been injected.
