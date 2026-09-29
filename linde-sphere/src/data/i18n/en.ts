import type { Messages } from "@/types/i18n";

/** English UI strings. Must mirror `es.ts` exactly (enforced by the `Messages` type). */
export const en: Messages = {
  meta: {
    description: "Interactive discovery experience for healthcare organizations",
  },
  language: {
    switcherLabel: "Language",
    es: "Español",
    en: "English",
    changedAnnouncement: "Language changed to English",
  },
  shell: {
    header: "Linde Sphere header",
    footerVersion: "Version {version}",
    demoMode: "Demo mode · content pending local validation",
  },
  home: {
    eyebrow: "Interactive experience for healthcare",
    intro:
      "Explore a hospital, identify your priorities and receive recommendations tailored to your organization.",
    pathsHeading: "Three ways to begin",
    paths: {
      role: {
        title: "I work in…",
        description: "Select your professional area.",
      },
      challenge: {
        title: "I need to…",
        description: "Choose the challenges you want to solve.",
      },
      explore: {
        title: "Explore the hospital",
        description: "Walk through the areas and discover opportunities.",
      },
    },
    status: "Experience in preparation",
  },
  status: {
    loading: "Loading…",
    errorTitle: "Something didn't go as expected",
    errorBody: "You can try again or go back to the start.",
    errorReference: "Reference: {digest}",
    retry: "Try again",
    backHome: "Back to start",
    notFoundTitle: "Page not found",
    notFoundBody: "The page you are looking for does not exist or has moved.",
  },
};
