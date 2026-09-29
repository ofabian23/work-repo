/**
 * Spanish UI strings — the source of truth (Spanish-first, formal "usted").
 * English (`en.ts`) must provide exactly the same keys; TypeScript enforces this.
 * Placeholders use `{name}` syntax. Content text (personas, scenes, solutions) lives in `content/`.
 */
export const es = {
  meta: {
    description: "Experiencia interactiva de descubrimiento para organizaciones de salud",
  },
  language: {
    switcherLabel: "Idioma",
    es: "Español",
    en: "English",
    changedAnnouncement: "Idioma cambiado a español",
  },
  shell: {
    header: "Encabezado de Linde Sphere",
    footerVersion: "Versión {version}",
    demoMode: "Modo demostración · contenido pendiente de validación local",
  },
  home: {
    eyebrow: "Experiencia interactiva para el sector salud",
    intro:
      "Explore un hospital, identifique sus prioridades y reciba recomendaciones pensadas para su organización.",
    pathsHeading: "Tres maneras de comenzar",
    paths: {
      role: {
        title: "Trabajo en…",
        description: "Seleccione su área profesional.",
      },
      challenge: {
        title: "Necesito…",
        description: "Elija los retos que quiere resolver.",
      },
      explore: {
        title: "Explorar el hospital",
        description: "Recorra las áreas y descubra oportunidades.",
      },
    },
    status: "Experiencia en preparación",
  },
  status: {
    loading: "Cargando…",
    errorTitle: "Algo no salió como esperábamos",
    errorBody: "Puede intentarlo de nuevo o volver al inicio.",
    errorReference: "Referencia: {digest}",
    retry: "Intentar de nuevo",
    backHome: "Volver al inicio",
    notFoundTitle: "Página no encontrada",
    notFoundBody: "La página que busca no existe o fue movida.",
  },
} as const;
