/**
 * LUXE Wellness & Aesthetics design tokens.
 * Synced from artifacts/luxe-wellness/src/index.css (HSL -> hex).
 * Monochrome black & white palette matching the LUXE logo.
 */

const colors = {
  light: {
    // Legacy aliases
    text: "#111111",
    tint: "#111111",

    background: "#FAFAFA",
    foreground: "#111111",

    card: "#FFFFFF",
    cardForeground: "#111111",

    primary: "#111111",
    primaryForeground: "#FFFFFF",

    secondary: "#F0F0F0",
    secondaryForeground: "#111111",

    muted: "#F0F0F0",
    mutedForeground: "#6B6B6B",

    accent: "#111111",
    accentForeground: "#FFFFFF",

    destructive: "#EF4444",
    destructiveForeground: "#FFFFFF",

    border: "#E6E6E6",
    input: "#E6E6E6",

    success: "#16A34A",
  },

  dark: {
    text: "#FAFAFA",
    tint: "#FFFFFF",

    background: "#0A0A0A",
    foreground: "#FAFAFA",

    card: "#161616",
    cardForeground: "#FAFAFA",

    primary: "#FAFAFA",
    primaryForeground: "#0A0A0A",

    secondary: "#262626",
    secondaryForeground: "#FAFAFA",

    muted: "#262626",
    mutedForeground: "#A3A3A3",

    accent: "#FFFFFF",
    accentForeground: "#0A0A0A",

    destructive: "#DC2626",
    destructiveForeground: "#FAFAFA",

    border: "#262626",
    input: "#262626",

    success: "#4ADE80",
  },

  radius: 16,
};

export default colors;
