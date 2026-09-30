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
  attract: {
    touchToBegin: "Toque para comenzar",
    startLabel: "Comenzar la experiencia Linde Sphere",
    phrases: {
      explore: "Explore un hospital en minutos",
      discover: "Descubra oportunidades para sus prioridades",
      recommend: "Reciba recomendaciones personalizadas",
    },
  },
  welcome: {
    title: "¿Cómo desea comenzar?",
    subtitle: "Elija un camino. Al final verá recomendaciones personalizadas para su organización.",
    promises: {
      personalized: "Recomendaciones personalizadas",
      duration: "De 2 a 5 minutos",
      noContact: "No pedimos datos de contacto para explorar",
    },
    pathsLabel: "Caminos para comenzar",
    paths: {
      role: { title: "Trabajo en…", description: "Elija su área profesional y vea lo que suele importarle." },
      challenge: { title: "Necesito…", description: "Elija hasta tres retos que quiere resolver." },
      explore: { title: "Explorar el hospital", description: "Recorra las áreas y descubra oportunidades." },
    },
    privacyLink: "Privacidad",
  },
  pathScreen: {
    comingNext: "Esta parte de la experiencia se completa en la próxima fase de desarrollo.",
    backToWelcome: "Volver al inicio",
  },
  accessibility: {
    button: "Accesibilidad",
    title: "Opciones de accesibilidad",
    description: "Se aplican solo a su visita y se restablecen al terminar.",
    largeText: "Texto más grande",
    reduceMotion: "Reducir el movimiento",
    on: "Activado",
    off: "Desactivado",
  },
  privacy: {
    title: "Privacidad",
    points: {
      noContact: "No le pedimos datos de contacto para explorar ni para ver recomendaciones.",
      purpose: "Sus selecciones se usan solo para preparar recomendaciones durante esta visita.",
      consent: "Si solicita un informe, le pediremos su consentimiento por separado.",
      reset: "Al terminar, o tras un tiempo sin actividad, la pantalla borra sus selecciones.",
    },
    noticeHeading: "Aviso de privacidad",
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
