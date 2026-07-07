import { type AuditRecordInput } from '#core/audit/domain/audit_record_input'

/**
 * Port d'enregistrement d'audit. L'application dépend de ce contrat ;
 * l'infrastructure (AuditService) en fournit l'implémentation.
 */
export default abstract class AuditRecorder {
  /**
   * Enregistre une entrée d'audit.
   */
  abstract record(input: AuditRecordInput): Promise<void>
}
