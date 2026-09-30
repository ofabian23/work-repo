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
  ui: {
    close: "Cerrar",
    selected: "Seleccionado",
    required: "Obligatorio",
    optional: "Opcional",
    stepOf: "Paso {current} de {total}",
    progressLabel: "Progreso",
    selectionLimit: "Puede elegir hasta {max}. Quite una opción para elegir otra.",
    breadcrumbLabel: "Ubicación en el hospital",
    hotspotVisited: "Visitado",
    recommendationRank: "Recomendación {rank}",
    whyThisAppeared: "Por qué aparece",
    relevance: "Cuándo puede ser relevante",
    nextStep: "Siguiente paso",
    relatedAreas: "Áreas relacionadas",
    pendingValidation: "Contenido pendiente de validación local",
    addToInterests: "Añadir a mis intereses",
    addedToInterests: "Añadido a mis intereses",
    actions: "Acciones",
    emptyTitle: "Todavía no hay nada que mostrar",
  },
  inactivity: {
    title: "¿Sigue ahí?",
    body: "Por su privacidad, la experiencia se reiniciará en {seconds} segundos.",
    continue: "Continuar",
    startOver: "Empezar de nuevo",
  },
  reset: {
    button: "Empezar de nuevo",
    confirmTitle: "¿Desea empezar de nuevo?",
    confirmBody: "Se borrarán sus selecciones y la experiencia volverá al inicio.",
    confirm: "Sí, empezar de nuevo",
    cancel: "No, continuar",
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
