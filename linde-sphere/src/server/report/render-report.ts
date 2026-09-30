import "server-only";
import type { ReportPayload } from "@/domain/report/report-payload";
import { brandConfig, type BrandConfig } from "@/lib/config/brand-config";
import { reportMessage } from "./report-messages";

/**
 * Renders the report as an email (ADR-013, ADR-054): responsive, email-safe HTML (tables, inline styles,
 * no remote images, fonts or scripts, print styles) plus a plain-text alternative. Every value is escaped;
 * the only link targets are the validated resource URLs and the mailto: consultation link.
 */
export type RenderedReport = { subject: string; html: string; text: string };

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

export function renderReport(report: ReportPayload, brand: BrandConfig = brandConfig): RenderedReport {
  const c = brand.colors;
  const lang = report.language;
  const m = (key: Parameters<typeof reportMessage>[1], params?: Record<string, string | number>) =>
    reportMessage(lang, key, params);
  const e = escapeHtml;
  const font = "font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;";
  const fullName = `${report.visitor.firstName} ${report.visitor.lastName}`;
  const date = new Intl.DateTimeFormat(lang === "es" ? "es-PR" : "en-US", { dateStyle: "long" }).format(
    new Date(report.generatedAt),
  );

  const heading = (text: string) =>
    `<h2 style="${font}margin:0 0 12px;font-size:20px;line-height:1.3;color:${c.text};">${e(text)}</h2>`;
  const paragraph = (text: string, style = "") =>
    `<p style="${font}margin:0 0 12px;font-size:16px;line-height:1.55;color:${c.text};${style}">${e(text)}</p>`;
  const list = (items: string[]) =>
    `<ul style="${font}margin:0 0 4px;padding-left:22px;font-size:16px;line-height:1.55;color:${c.text};">${items
      .map((i) => `<li style="margin:0 0 4px;">${e(i)}</li>`)
      .join("")}</ul>`;
  const section = (inner: string) => `<tr><td class="px" style="padding:8px 40px 20px;">${inner}</td></tr>`;
  const label = (text: string) =>
    `<p style="${font}margin:12px 0 4px;font-size:13px;font-weight:700;letter-spacing:0.02em;text-transform:uppercase;color:${c.textMuted};">${e(text)}</p>`;

  const recommendationCards = report.recommendations
    .map((r, i) => {
      const pending = r.pendingValidation
        ? `<span style="${font}display:inline-block;margin:0 0 8px;padding:2px 10px;border-radius:999px;background:${c.noticeSurface};color:${c.notice};font-size:13px;font-weight:600;">${e(m("pendingValidation"))}</span>`
        : "";
      const resources =
        r.resources.length > 0
          ? label(m("resources")) +
            `<ul style="${font}margin:0;padding-left:22px;font-size:16px;line-height:1.55;">${r.resources
              .map(
                (res) =>
                  `<li style="margin:0 0 4px;"><a href="${e(res.url)}" style="color:${c.primary};text-decoration:underline;">${e(res.title)}</a></li>`,
              )
              .join("")}</ul>`
          : "";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid ${c.border};border-radius:10px;background:${c.surface};">
<tr><td style="padding:20px 22px;">
<p style="${font}margin:0 0 4px;font-size:13px;font-weight:700;color:${c.primary};">${e(m("recommendation", { rank: i + 1 }))}</p>
<h3 style="${font}margin:0 0 8px;font-size:19px;line-height:1.3;color:${c.text};">${e(r.title)}</h3>
${pending}
${paragraph(r.summary)}
${label(m("why"))}${r.reasons.map((reason) => paragraph(reason, "margin-bottom:4px;")).join("")}
${r.relatedAreas.length > 0 ? label(m("relatedAreas")) + paragraph(r.relatedAreas.join(" · "), "margin-bottom:4px;") : ""}
${label(m("nextStep"))}${paragraph(r.nextStep, "margin-bottom:4px;")}
${resources}
</td></tr></table>`;
    })
    .join("\n");

  const contact = report.salesContact;
  const button = report.callToAction.href
    ? `<table role="presentation" cellpadding="0" cellspacing="0" class="no-print" style="margin:8px 0 16px;"><tr><td style="border-radius:8px;background:${c.primary};">
<a href="${e(report.callToAction.href)}" style="${font}display:inline-block;padding:14px 26px;font-size:17px;font-weight:700;color:${c.onPrimary};text-decoration:none;border-radius:8px;">${e(report.callToAction.buttonLabel)}</a>
</td></tr></table>`
    : "";
  const contactLines = contact
    ? label(m("contact")) +
      paragraph(contact.name, "margin-bottom:2px;font-weight:600;") +
      paragraph(`${m("email")}: ${contact.email}`, "margin-bottom:2px;") +
      (contact.phone ? paragraph(`${m("phone")}: ${contact.phone}`, "margin-bottom:2px;") : "")
    : "";

  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(report.subject)}</title>
<style>
@media (max-width: 620px) { .container { width: 100% !important; } .px { padding-left: 20px !important; padding-right: 20px !important; } }
@media print { body, .outer { background: #ffffff !important; } .no-print { display: none !important; } .container { width: 100% !important; border: 0 !important; } }
</style>
</head>
<body style="margin:0;padding:0;background:${c.background};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${e(report.intro)}</div>
<table role="presentation" class="outer" width="100%" cellpadding="0" cellspacing="0" style="background:${c.background};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:${c.surface};border:1px solid ${c.border};border-radius:14px;">
<tr><td class="px" style="padding:32px 40px 8px;border-bottom:4px solid ${c.primary};">
<p style="${font}margin:0 0 6px;font-size:15px;font-weight:700;letter-spacing:0.04em;color:${c.primary};">${e(brand.productName)}</p>
<h1 style="${font}margin:0 0 20px;font-size:26px;line-height:1.25;color:${c.text};">${e(report.title)}</h1>
</td></tr>
${section(`<p style="${font}margin:16px 0 12px;font-size:18px;line-height:1.5;font-weight:600;color:${c.text};">${e(m("greeting", { name: report.visitor.firstName }))}</p>${paragraph(report.intro)}`)}
${section(
  `${heading(m("details"))}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="${font}font-size:16px;line-height:1.5;color:${c.text};">
<tr><td style="padding:4px 12px 4px 0;color:${c.textMuted};width:40%;">${e(m("name"))}</td><td style="padding:4px 0;font-weight:600;">${e(fullName)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:${c.textMuted};">${e(m("organization"))}</td><td style="padding:4px 0;font-weight:600;">${e(report.visitor.organization)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;color:${c.textMuted};">${e(m("role"))}</td><td style="padding:4px 0;font-weight:600;">${e(report.role.label)}</td></tr>
</table>`,
)}
${section(heading(m("priorities")) + (report.priorities.length > 0 ? list(report.priorities.map((p) => p.label)) : paragraph(m("prioritiesNone"))))}
${section(heading(m("areas")) + (report.areasExplored.length > 0 ? list(report.areasExplored.map((a) => a.title)) : paragraph(m("areasNone"))))}
${
  report.pendingValidationNotice
    ? section(
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.noticeSurface};border-radius:8px;"><tr><td style="${font}padding:14px 16px;font-size:15px;line-height:1.5;color:${c.notice};">${e(report.pendingValidationNotice)}</td></tr></table>`,
      )
    : ""
}
${section(heading(m("recommendations")) + recommendationCards)}
${section(
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.infoSurface};border-radius:10px;"><tr><td style="padding:22px;">
${heading(report.callToAction.heading)}${paragraph(report.callToAction.body)}${button}${contactLines}
</td></tr></table>`,
)}
${section(paragraph(report.disclaimer, `font-size:14px;color:${c.textMuted};`))}
<tr><td class="px" style="padding:20px 40px 28px;border-top:1px solid ${c.border};background:${c.surfaceMuted};border-radius:0 0 14px 14px;">
${paragraph(report.privacyFooter, `font-size:13px;color:${c.textMuted};`)}
${brand.organizationName ? paragraph(brand.organizationName, `font-size:13px;color:${c.textMuted};`) : ""}
${paragraph(m("generated", { date, version: report.contentVersion }), `font-size:12px;color:${c.textMuted};margin:0;`)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;

  const lines: string[] = [];
  const push = (...values: string[]) => lines.push(...values);
  const title = (text: string) => push("", text.toUpperCase(), "-".repeat(Math.min(text.length, 60)));
  push(
    brand.productName,
    report.title,
    "",
    m("greeting", { name: report.visitor.firstName }),
    "",
    report.intro,
  );
  title(m("details"));
  push(
    `${m("name")}: ${fullName}`,
    `${m("organization")}: ${report.visitor.organization}`,
    `${m("role")}: ${report.role.label}`,
  );
  title(m("priorities"));
  push(
    ...(report.priorities.length > 0 ? report.priorities.map((p) => `- ${p.label}`) : [m("prioritiesNone")]),
  );
  title(m("areas"));
  push(
    ...(report.areasExplored.length > 0 ? report.areasExplored.map((a) => `- ${a.title}`) : [m("areasNone")]),
  );
  if (report.pendingValidationNotice) push("", report.pendingValidationNotice);
  title(m("recommendations"));
  report.recommendations.forEach((r, i) => {
    push("", `${i + 1}. ${r.title}${r.pendingValidation ? ` (${m("pendingValidation")})` : ""}`, r.summary);
    push(`${m("why")}: ${r.reasons.join(" ")}`);
    if (r.relatedAreas.length > 0) push(`${m("relatedAreas")}: ${r.relatedAreas.join(", ")}`);
    push(`${m("nextStep")}: ${r.nextStep}`);
    r.resources.forEach((res) => push(`${m("resources")}: ${res.title} <${res.url}>`));
  });
  title(report.callToAction.heading);
  push(report.callToAction.body);
  if (contact) {
    push("", contact.name, `${m("email")}: ${contact.email}`);
    if (contact.phone) push(`${m("phone")}: ${contact.phone}`);
  }
  push("", report.disclaimer, "", "--", report.privacyFooter);
  if (brand.organizationName) push(brand.organizationName);
  push(m("generated", { date, version: report.contentVersion }));

  return { subject: report.subject, html, text: lines.join("\n") + "\n" };
}
