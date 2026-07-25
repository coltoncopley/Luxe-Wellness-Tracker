import React from "react";

/**
 * Web / Expo-web how-to player: a plain YouTube-nocookie iframe.
 *
 * react-native-webview has no web build, so on web we render a real DOM
 * iframe instead. Metro picks `HowToVideoPlayer.native.tsx` on device.
 */
const Iframe = "iframe" as unknown as React.ComponentType<{
  src: string;
  title: string;
  style: React.CSSProperties;
  allow: string;
  allowFullScreen: boolean;
}>;

export function HowToVideoPlayer({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  return (
    <Iframe
      src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`}
      title={title}
      style={{ width: "100%", height: "100%", border: 0 }}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
    />
  );
}
