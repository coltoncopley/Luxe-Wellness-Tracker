import { WebView } from "react-native-webview";

import { apiUrl } from "@/lib/luxe";

/**
 * Native how-to player.
 *
 * YouTube rejects embedded-player requests that arrive without an HTTP
 * Referer ("Error 153 — video player configuration error"), and WebView
 * workarounds (loadHTMLString + baseUrl, custom Referer headers) are
 * unreliable on iOS. Instead we load a real hosted player page from our own
 * API server — a genuine HTTPS document whose inner YouTube iframe always
 * carries a proper Referer.
 */
export function HowToVideoPlayer({
  videoId,
}: {
  videoId: string;
  title: string;
}) {
  return (
    <WebView
      source={{ uri: apiUrl(`/embed/exercise-video/${encodeURIComponent(videoId)}`) }}
      style={{ flex: 1, backgroundColor: "#000" }}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      setSupportMultipleWindows={false}
    />
  );
}
