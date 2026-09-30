import "server-only";
import { EmailProviderError, type EmailProvider } from "./email-provider";

/**
 * Placeholder for a future Microsoft Graph provider (ADR-054). It is deliberately not implemented:
 * sending through Graph needs an organizational Entra ID app registration (tenant id, client id and
 * secret or certificate), the Mail.Send application permission with admin consent, and a mailbox policy.
 * `EMAIL_PROVIDER=graph` is rejected at startup; if this class is ever constructed it fails every send
 * with a non-retryable code instead of pretending to deliver.
 */
export class GraphProvider implements EmailProvider {
  readonly name = "graph" as const;
  readonly deliversExternally = true;

  async send(): Promise<{ messageId: string }> {
    throw new EmailProviderError("PROVIDER_NOT_CONFIGURED", "Microsoft Graph delivery is not implemented");
  }
}
