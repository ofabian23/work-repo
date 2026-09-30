import type { Language } from "@/domain/content/primitives";

/**
 * Fixed labels of the report email (section headings, field names). Configurable wording — title,
 * introduction, call to action, sales contact, disclaimer, privacy footer — lives in content/report.json.
 * Spanish is the source; English mirrors every key (TypeScript enforces it).
 */
const es = {
  greeting: "Hola, {name}:",
  details: "Sus datos",
  name: "Nombre",
  organization: "Organización",
  role: "Área o función",
  priorities: "Sus prioridades",
  prioritiesNone: "No indicó prioridades durante la visita.",
  areas: "Áreas que exploró",
  areasNone: "No exploró áreas del hospital durante la visita.",
  recommendations: "Recomendaciones principales",
  recommendation: "Recomendación {rank}",
  why: "Por qué apareció",
  relatedAreas: "Áreas relacionadas",
  nextStep: "Siguiente paso",
  resources: "Recursos",
  pendingValidation: "Pendiente de validación local",
  contact: "Contacto",
  email: "Correo",
  phone: "Teléfono",
  generated: "Generado el {date} · contenido {version}",
};

type Messages = typeof es;

const en: Messages = {
  greeting: "Hello {name},",
  details: "Your details",
  name: "Name",
  organization: "Organization",
  role: "Area or role",
  priorities: "Your priorities",
  prioritiesNone: "You did not indicate priorities during the visit.",
  areas: "Areas you explored",
  areasNone: "You did not explore hospital areas during the visit.",
  recommendations: "Top recommendations",
  recommendation: "Recommendation {rank}",
  why: "Why it appeared",
  relatedAreas: "Related areas",
  nextStep: "Next step",
  resources: "Resources",
  pendingValidation: "Pending local validation",
  contact: "Contact",
  email: "Email",
  phone: "Phone",
  generated: "Generated on {date} · content {version}",
};

export const REPORT_MESSAGES: Record<Language, Messages> = { es, en };

export function reportMessage(
  language: Language,
  key: keyof Messages,
  params: Record<string, string | number> = {},
): string {
  return REPORT_MESSAGES[language][key].replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params[name] ?? ""),
  );
}
