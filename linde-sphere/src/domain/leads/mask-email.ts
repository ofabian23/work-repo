/**
 * Masks an email address for display on the confirmation screen: the visitor can recognize their address
 * (first characters and the full domain, where typos are most common) without the full address being
 * readable by someone standing behind them. "maria.rivera@hospital.example" → "ma•••@hospital.example".
 */
export function maskEmailForDisplay(email: string): string {
  const at = email.lastIndexOf("@");
  if (at < 1) return "•••";
  const local = email.slice(0, at);
  const visible = local.length >= 4 ? 2 : 1;
  return `${local.slice(0, visible)}•••${email.slice(at)}`;
}
