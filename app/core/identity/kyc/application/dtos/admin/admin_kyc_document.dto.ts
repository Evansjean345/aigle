import type KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import type { KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import type { KycAuditContext } from '#core/identity/kyc/application/events/kyc_document_submitted'
import { statusOfFile } from '#core/identity/kyc/domain/verification_status'

/**
 * Contrats de service des documents KYC pour l'administration.
 *
 * Ce que le service reçoit et ce qu'il rend, sans modèle ORM : les consommateurs vivent hors du
 * contexte identity.
 */

// ── Query (input service) ───────────────────────────────────────────

/** Filtres de la liste des documents, déjà normalisés par la frontière HTTP. */
export interface ListKycDocumentsFilters {
  status?: string
  documentType?: string
  userId?: string
  /** Terme saisi par le gestionnaire. Le service le résout en comptes avant d'appeler le dépôt. */
  search?: string
  /** Nom de tri exposé par l'API, clé de `kycDocumentSorts`. Absent, l'ordre par défaut s'applique. */
  sortBy?: string
  order?: 'asc' | 'desc'
  /** Restreint la file à une nature de dossier : pièces d'identité ou dossiers d'organisation. */
  ownerType?: string
  startDate?: string
  endDate?: string
}

// ── Command (input service) ─────────────────────────────────────────

/** Décision prise sur un document : approbation ou refus. */
export interface ProcessKycDocumentCommand {
  documentId: number
  status: KycDocumentStatus
  comment?: string
  agentId: number
  /** Date de fin de validité, pour une pièce qui expire. */
  validUntil?: string | null
  auditContext?: KycAuditContext
}

// ── Result (output service) ─────────────────────────────────────────

/** Gestionnaire ayant traité un document ou une tentative. */
export interface KycAgentRef {
  id: number
  firstname: string
  lastname: string
  email: string
}

/** Porteur du document, tel qu'il apparaît dans la revue. */
export interface KycDocumentOwnerRef {
  firstname: string
  lastname: string
  usersUid: string
  kycLevel: number
  kycStatus: string
  status: string
  phone: string
}

/**
 * Pièce d'un dossier, telle qu'elle franchit la frontière.
 *
 * `fileKey` est une clé de stockage privé, à signer avant d'être servie — sauf pour les dossiers
 * antérieurs à la bascule, dont `isPublicUrl` signale que la valeur est déjà une URL consultable.
 * La signature a lieu au détail d'un dossier, jamais en liste.
 */
export interface KycDocumentPieceResult {
  pieceType: string
  fileKey: string
  reference?: string
  isPublicUrl: boolean
  /** URL consultable, renseignée au détail d'un dossier et absente en liste. */
  url?: string
}

/** Document KYC projeté hors du contexte identity, relations comprises. */
export interface KycDocumentResult {
  id: number
  accountId: string
  ownerType: string
  userId: string
  /** Absent d'un dossier d'organisation, qui ne porte pas de pièce d'identité. */
  documentType?: string
  pieces?: KycDocumentPieceResult[]
  documentRectoUrl?: string
  documentVersoUrl?: string
  selfieUrl?: string
  status: string
  /** Rôle attendu ensuite, ou `IN_REVIEW` quand le dossier est complet. */
  nextAction?: string
  comment?: string
  validUntil?: string
  createdAt: string
  agent?: KycAgentRef
  /** Historique des décisions, la plus récente en tête selon le chargement. */
  attempts?: Record<string, unknown>[]
  user?: KycDocumentOwnerRef
}

export interface PaginatedKycDocumentsResult {
  data: KycDocumentResult[]
  /** Métadonnées telles que le paginateur les produit, pour ne pas rogner ce que le client lit. */
  meta: Record<string, unknown>
}

/**
 * Compteurs de la revue KYC.
 *
 * Ne portent que les dossiers de personnes : ceux d'organisation relèvent de l'écran KYB. Les
 * quatre statuts somment au total — un dossier en constitution est compté, sans quoi le total
 * dépasserait la somme de ses parts.
 */
export interface KycStatsResult {
  total: number
  pending: number
  verified: number
  rejected: number
  /** Dossier commencé dont une pièce requise manque encore. */
  inSubmission: number
  byDocumentType: {
    CNI: number
    PASSPORT: number
    PERMIT_CONDUIT: number
  }
  today: {
    submitted: number
    approved: number
    rejected: number
    processed: number
  }
}

/**
 * Rend les pièces d'un dossier, quelle que soit la génération à laquelle il appartient.
 *
 * Un dossier écrit depuis la bascule porte ses pièces en relation. Les dossiers antérieurs n'en ont
 * aucune : leurs trois colonnes sont converties ici, et nulle part ailleurs, pour que la forme lue
 * par les appelants ne dépende pas de la date de dépôt.
 */
const toPieceResults = (kyc: KycDocument): KycDocumentPieceResult[] =>
  (kyc.pieces ?? []).map((piece) => ({
    pieceType: piece.pieceType,
    fileKey: piece.fileKey,
    reference: piece.reference,
    isPublicUrl: Boolean(piece.isPublicUrl),
  }))

export const toKycDocumentResult = (
  kyc: KycDocument,
  options?: { ownerLevel?: number | null }
): KycDocumentResult => ({
  id: kyc.id,
  accountId: kyc.accountId,
  ownerType: kyc.ownerType,
  userId: kyc.accountId,
  documentType: kyc.documentType,
  pieces: toPieceResults(kyc),
  documentRectoUrl: kyc.documentRectoUrl,
  documentVersoUrl: kyc.documentVersoUrl,
  selfieUrl: kyc.selfieUrl,
  status: kyc.status,
  nextAction: kyc.nextAction,
  comment: kyc.comment,
  validUntil: kyc.validUntil?.toISODate() ?? undefined,
  createdAt: kyc.createdAt?.toISO() || kyc.createdAt?.toString() || '',
  agent: kyc.agent
    ? {
        id: kyc.agent.id,
        firstname: kyc.agent.firstname,
        lastname: kyc.agent.lastname,
        email: kyc.agent.email,
      }
    : undefined,
  attempts: kyc.attempts?.map((attempt) => ({
    ...attempt.toJSON(),
    agent: attempt.agent
      ? {
          id: attempt.agent.id,
          firstname: attempt.agent.firstname,
          lastname: attempt.agent.lastname,
          email: attempt.agent.email,
        }
      : undefined,
  })),
  user: kyc.user
    ? {
        firstname: kyc.user.firstname,
        lastname: kyc.user.lastname,
        usersUid: kyc.user.usersUid,
        kycLevel: options?.ownerLevel ?? 0,
        // Le dossier projeté est celui du porteur : son état dit où en est sa vérification.
        kycStatus: statusOfFile(kyc),
        phone: kyc.user.phone,
        status: kyc.user.status,
      }
    : undefined,
})
