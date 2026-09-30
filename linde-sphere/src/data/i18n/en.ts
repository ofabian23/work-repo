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
  ui: {
    close: "Close",
    selected: "Selected",
    required: "Required",
    optional: "Optional",
    stepOf: "Step {current} of {total}",
    progressLabel: "Progress",
    selectionLimit: "You can choose up to {max}. Remove one to choose another.",
    breadcrumbLabel: "Location in the hospital",
    hotspotVisited: "Visited",
    recommendationRank: "Recommendation {rank}",
    whyThisAppeared: "Why this appeared",
    relevance: "When it may be relevant",
    nextStep: "Next step",
    relatedAreas: "Related areas",
    pendingValidation: "Content pending local validation",
    addToInterests: "Add to my interests",
    addedToInterests: "Added to my interests",
    actions: "Actions",
    emptyTitle: "Nothing to show yet",
  },
  inactivity: {
    title: "Are you still there?",
    body: "For your privacy, the experience will restart in {seconds} seconds.",
    continue: "Continue",
    startOver: "Start over",
  },
  reset: {
    button: "Start over",
    confirmTitle: "Do you want to start over?",
    confirmBody: "Your selections will be cleared and the experience will return to the start.",
    confirm: "Yes, start over",
    cancel: "No, continue",
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
