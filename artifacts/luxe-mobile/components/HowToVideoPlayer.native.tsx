import { WebView } from "react-native-webview";

/** Native how-to player: an embedded YouTube-nocookie WebView. */
export function HowToVideoPlayer({
  videoId,
}: {
  videoId: string;
  title: string;
}) {
  return (
    <WebView
      source={{
        uri: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`,
      }}
      style={{ flex: 1, backgroundColor: "#000" }}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
    />
  );
}
