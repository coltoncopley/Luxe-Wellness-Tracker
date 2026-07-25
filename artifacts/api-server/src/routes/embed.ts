import { Router, type IRouter } from "express";

/**
 * Public HTML embed pages (not part of the JSON API contract).
 *
 * The mobile app plays exercise how-to videos inside a WebView. YouTube
 * rejects embedded-player requests that arrive without an HTTP Referer
 * ("Error 153 — video player configuration error"), and WebView tricks like
 * loadHTMLString + baseUrl are unreliable on iOS. Serving a real hosted page
 * guarantees the inner iframe carries a genuine Referer, so YouTube serves
 * the player.
 */
const router: IRouter = Router();

// YouTube video IDs are exactly 11 URL-safe base64 characters.
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

router.get("/embed/exercise-video/:videoId", (req, res) => {
  const { videoId } = req.params;
  if (!VIDEO_ID_RE.test(videoId)) {
    res.status(404).type("text/plain").send("Not found");
    return;
  }

  const src = `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1`;
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>How-to video</title>
    <style>
      html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden; }
      iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <iframe
      src="${src}"
      title="Exercise how-to video"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
    ></iframe>
  </body>
</html>`;

  res
    .status(200)
    .type("text/html")
    .setHeader("Cache-Control", "public, max-age=86400")
    .send(html);
});

export default router;
