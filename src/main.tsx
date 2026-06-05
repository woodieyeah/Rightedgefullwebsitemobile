
import { createRoot } from "react-dom/client";
import { PostHogProvider } from "posthog-js/react";
import App from "./app/App.tsx";
import { initLinkedInInsight } from "./lib/linkedin.ts";
import { initPostHog, isPostHogEnabled, posthog } from "./lib/posthog.ts";
import "./styles/index.css";

initPostHog();
initLinkedInInsight();

const app = <App />;

createRoot(document.getElementById("root")!).render(
  isPostHogEnabled() ? (
    <PostHogProvider client={posthog}>{app}</PostHogProvider>
  ) : (
    app
  ),
);
