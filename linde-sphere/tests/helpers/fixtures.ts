/** Minimal valid records for schema tests. Override fields per test. */

export const localized = (es = "Texto", en = "Text") => ({ es, en });

export const persona = () => ({
  id: "executive",
  label: localized("Alta gerencia", "Executive leadership"),
  description: localized("Estrategia", "Strategy"),
  icon: "executive",
  sortOrder: 10,
  suggestedChallengeIds: ["supply-continuity"],
  validationStatus: "assumed",
});

export const challenge = () => ({
  id: "supply-continuity",
  label: localized("Continuidad", "Continuity"),
  description: localized("Descripción", "Description"),
  icon: "continuity",
  sortOrder: 10,
  validationStatus: "assumed",
});

export const facilityType = () => ({
  id: "acute-hospital",
  label: localized("Hospital", "Hospital general"),
  description: localized("Descripción", "Description"),
  sortOrder: 10,
  validationStatus: "assumed",
});

export const layer = (depth = 0) => ({
  src: "/scenes/placeholder/icu-background.svg",
  alt: localized("Ilustración", "Illustration"),
  depth,
  assetStatus: "placeholder",
});

const hotspotBase = () => ({
  x: 50,
  y: 50,
  label: localized("Etiqueta", "Label"),
  accessibleLabel: localized("Etiqueta accesible", "Accessible label"),
  visualImportance: "primary",
  recommendationSignals: { challengeIds: [], solutionIds: [] },
  validationStatus: "assumed",
});

export const navigationHotspot = () => ({
  ...hotspotBase(),
  id: "icu-to-lab",
  type: "navigation",
  targetSceneId: "laboratory",
});

export const solutionHotspot = () => ({
  ...hotspotBase(),
  id: "icu-gases",
  type: "solution",
  targetSolutionIds: ["clinical-gases"],
});

export const informationHotspot = () => ({
  ...hotspotBase(),
  id: "icu-info",
  type: "information",
  panel: { title: localized("Título", "Title"), body: localized("Cuerpo", "Body"), bullets: [] },
});

export const scene = () => ({
  id: "icu",
  slug: "icu",
  title: localized("Cuidado intensivo", "Intensive care"),
  description: localized("Descripción", "Description"),
  background: layer(0),
  foregroundLayers: [],
  hotspots: [informationHotspot()],
  parentSceneId: "campus",
  breadcrumb: ["campus", "icu"],
  validationStatus: "assumed",
  sortOrder: 20,
});

export const assumedGovernance = () => ({
  validationStatus: "assumed",
  market: "global-reference",
  internalNotes: "Demonstrative assumption",
  lastReviewedAt: null,
  reviewedBy: null,
  sourceLabel: "Seed content",
  requiresSalesValidation: true,
});

export const validatedGovernance = () => ({
  validationStatus: "validated",
  market: "puerto-rico",
  internalNotes: "",
  lastReviewedAt: "2026-10-15",
  reviewedBy: "Sales PR",
  sourceLabel: "PR catalog",
  requiresSalesValidation: false,
});

export const solution = () => ({
  id: "clinical-gases",
  slug: "clinical-gases",
  title: localized("Gases clínicos", "Clinical gases"),
  summary: localized("Resumen", "Summary"),
  nextStep: localized("Siguiente paso", "Next step"),
  relatedChallengeIds: ["supply-continuity"],
  relatedSceneIds: ["icu"],
  digitalAssetIds: [],
  isFallback: false,
  ...assumedGovernance(),
});

export const digitalAsset = () => ({
  id: "asset-overview",
  title: localized("Resumen", "Overview"),
  description: localized("Descripción", "Description"),
  type: "brochure",
  access: { kind: "url", url: "https://example.com/linde-sphere/placeholder/overview" },
  languages: ["es", "en"],
  ...assumedGovernance(),
  validationStatus: "placeholder",
  market: "unknown",
});

export const emptyWeights = () => ({
  personas: {},
  challenges: {},
  facilityTypes: {},
  scenes: {},
  hotspots: {},
  explicitInterests: {},
});

export const rule = () => ({
  id: "rule-clinical-gases",
  solutionId: "clinical-gases",
  weights: { ...emptyWeights(), challenges: { "supply-continuity": 5 }, personas: { executive: 2 } },
  minimumScore: 5,
  exclusions: [],
  explanationTemplate: localized("Porque eligió {challenges}.", "Because you chose {challenges}."),
  fallbackExplanation: localized("Relacionado con sus prioridades.", "Related to your priorities."),
  priority: 50,
  validationStatus: "assumed",
  internalNotes: "",
});

export const SESSION_ID = "5b0c6a8e-7a53-4a5e-9f3d-2f4b8a6d9c11";
export const IDEMPOTENCY_KEY = "0f8e2f52-8f0c-4d8a-a1b2-3c4d5e6f7a8b";

export const signals = () => ({
  personaId: "executive",
  challengeIds: ["supply-continuity"],
  facilityTypeId: null,
  visitedSceneIds: ["campus", "icu"],
  openedHotspotIds: ["icu-info"],
  engagedHotspotIds: ["icu-info"],
  explicitInterestIds: [],
});
