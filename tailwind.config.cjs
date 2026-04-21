/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#e8eddc",
        card: "#f4f5f7",
        region: "#eef2e1",
        text: "#333845",
        muted: "#6d7381",
        accent: "#7eb83e",
        line: "#dfe2e6"
      }
    }
  },
  plugins: []
};
