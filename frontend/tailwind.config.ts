import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#15171f",
        panel: "#f7f4ee",
        line: "#ded8cc",
        mint: "#0f766e",
        plum: "#6d3b64",
        amber: "#b7791f",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(21, 23, 31, 0.10)",
      },
    },
  },
  plugins: [],
} satisfies Config;
