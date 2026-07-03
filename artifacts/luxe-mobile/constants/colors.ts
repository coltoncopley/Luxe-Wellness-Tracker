/**
 * LUXE Wellness & Aesthetics design tokens.
 * Synced from artifacts/luxe-wellness/src/index.css (HSL -> hex).
 * Warm cream light mode, deep navy dark mode, gold accent.
 */

const gold = "#E6C566";

const colors = {
  light: {
    // Legacy aliases
    text: "#0F1729",
    tint: "#B98E2F",

    background: "#FAF8F4",
    foreground: "#0F1729",

    card: "#FFFFFF",
    cardForeground: "#0F1729",

    primary: "#0F1729",
    primaryForeground: "#FFFFFF",

    secondary: "#EFEBE1",
    secondaryForeground: "#0F1729",

    muted: "#EFEBE1",
    mutedForeground: "#64748B",

    accent: gold,
    accentForeground: "#5C4708",

    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",

    border: "#E9E5DD",
    input: "#E9E5DD",

    success: "#16A34A",
  },

  dark: {
    text: "#FAF8F4",
    tint: gold,

    background: "#0F1729",
    foreground: "#FAF8F4",

    card: "#152032",
    cardForeground: "#FAF8F4",

    primary: "#FAF8F4",
    primaryForeground: "#0F1729",

    secondary: "#242F42",
    secondaryForeground: "#FAF8F4",

    muted: "#242F42",
    mutedForeground: "#94A3B8",

    accent: gold,
    accentForeground: "#0F1729",

    destructive: "#DC2626",
    destructiveForeground: "#FAF8F4",

    border: "#242F42",
    input: "#242F42",

    success: "#4ADE80",
  },

  radius: 16,
};

export default colors;
