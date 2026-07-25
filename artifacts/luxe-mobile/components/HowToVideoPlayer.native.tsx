import { WebView } from "react-native-webview";

/**
 * Native how-to player: an embedded YouTube-nocookie player inside a WebView.
 *
 * YouTube rejects embeds that arrive without an HTTP Referer ("Error 153 —
 * video player configuration error"). A bare `source={{ uri }}` WebView load
 * sends no referer, so we instead load a minimal HTML wrapper with `baseUrl`
 * set to the app's public domain — the inner iframe request then carries a
 * proper Referer/origin and YouTube serves the player.
 */
const EMBED_REFERER = "https://luxewellnessapp.com";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function HowToVideoPlayer({
  videoId,
  title,
}: {
  videoId: string;
  title: string;
}) {
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&playsinline=1`;
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
      iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <iframe
      src="${src}"
      title="${escapeHtml(title)}"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    ></iframe>
  </body>
</html>`;

  return (
    <WebView
      source={{ html, baseUrl: EMBED_REFERER }}
      originWhitelist={["*"]}
      style={{ flex: 1, backgroundColor: "#000" }}
      allowsFullscreenVideo
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction
      setSupportMultipleWindows={false}
    />
  );
}
