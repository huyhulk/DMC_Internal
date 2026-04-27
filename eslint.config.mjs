import coreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...coreWebVitals,
  {
    // react-hooks/set-state-in-effect and incompatible-library are React Compiler rules
    // designed for React 19. This project targets React 18, where calling setState
    // inside useEffect is valid and the standard data-fetching pattern.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
];

export default config;
