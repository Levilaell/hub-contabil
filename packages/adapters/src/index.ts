// Adapter interfaces + implementations. Each interface lands with its feature:
// CnpjEnrichmentAdapter (T7), MessagingAdapter (T17), ErpAdapter (T22),
// XmlSourceAdapter and CndProviderAdapter as specified in PLANEJAMENTO §8.

export const ADAPTERS_PACKAGE_NAME = '@hub/adapters';

export {
  BrasilApiEnrichmentAdapter,
  type CnpjEnrichmentAdapter,
  type CompanyEnrichment,
  type EnrichmentOutcome,
  type EnrichmentSource,
  type BrasilApiAdapterOptions,
} from './cnpj-enrichment';

export {
  NoopMessagingAdapter,
  ResendMessagingAdapter,
  createMessagingAdapter,
  type MessagingAdapter,
  type MessagingEnv,
  type EmailMessage,
  type SendResult,
  type ResendAdapterOptions,
} from './messaging';

export {
  ManualExportErpAdapter,
  createErpAdapter,
  type ErpAdapter,
  type ErpBatchFile,
  type ErpBatchInput,
  type ErpBatchResult,
} from './erp';

export {
  AnthropicClassificationAdapter,
  HeuristicClassificationAdapter,
  createClassificationAdapter,
  type ClassificationAdapter,
  type ClassificationInput,
  type ClassificationResult,
  type ClassificationEnv,
  type AnthropicClassificationOptions,
} from './classification';

export {
  MetaWhatsappAdapter,
  NoopWhatsappAdapter,
  createWhatsappAdapter,
  parseWhatsappInbound,
  verifyWhatsappSignature,
  type WhatsappAdapter,
  type WhatsappInboundMessage,
  type WhatsappMedia,
  type WhatsappAdapterOptions,
  type WhatsappEnv,
  type SendTextResult,
} from './whatsapp';

export {
  ImapFlowInboundAdapter,
  NoopImapInboundAdapter,
  createImapInboundAdapter,
  imapConfigured,
  type ImapInboundAdapter,
  type ImapAdapterOptions,
  type ImapEnv,
  type InboundEmail,
  type InboundAttachment,
} from './inbound-imap';

export {
  AnthropicSupportAssistant,
  HeuristicSupportAssistant,
  createSupportAssistant,
  type SupportAssistantAdapter,
  type SupportAssistantInput,
  type SupportAssistantResult,
  type SupportAssistantEnv,
  type AnthropicSupportOptions,
} from './support-assistant';
