export const fonts = {
  sans: [
    "Geist",
    "PingFang SC",
    "Hiragino Sans GB",
    "Microsoft YaHei",
    "Inter",
    "system-ui",
    "sans-serif"
  ].join(", "),
  mono: [
    "Geist Mono",
    "JetBrains Mono",
    "SFMono-Regular",
    "Menlo",
    "Consolas",
    "monospace"
  ].join(", ")
} as const;

type FontSizeValue = [string, { lineHeight: string }];

export const fontSize: Record<string, FontSizeValue> = {
  "2xs": ["10px", { lineHeight: "14px" }],
  xs: ["12px", { lineHeight: "16px" }],
  sm: ["13px", { lineHeight: "18px" }],
  base: ["14px", { lineHeight: "20px" }],
  md: ["15px", { lineHeight: "22px" }],
  lg: ["17px", { lineHeight: "24px" }],
  xl: ["19px", { lineHeight: "26px" }],
  "2xl": ["22px", { lineHeight: "28px" }],
  "3xl": ["26px", { lineHeight: "32px" }],
  "4xl": ["32px", { lineHeight: "38px" }],
  "5xl": ["40px", { lineHeight: "46px" }],
  "6xl": ["52px", { lineHeight: "58px" }]
};

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700"
} as const;

export const letterSpacing = {
  tight: "-0.015em",
  normal: "0em",
  wide: "0.025em",
  wider: "0.06em"
} as const;
