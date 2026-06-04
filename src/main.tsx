
import { createRoot } from "react-dom/client";
import { PostHogProvider } from "posthog-js/react";
import App from "./app/App.tsx";
import { initPostHog, isPostHogEnabled, posthog } from "./lib/posthog.ts";
import "./styles/index.css";

initPostHog();

const app = <App />;

createRoot(document.getElementById("root")!).render(
  isPostHogEnabled() ? (
    <PostHogProvider client={posthog}>{app}</PostHogProvider>
  ) : (
    app
  ),
);
