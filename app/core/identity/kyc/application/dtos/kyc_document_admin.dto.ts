import type KycDocument from '#core/identity/kyc/domain/models/kyc_document'
import { DocumentPieceType, type KycDocumentStatus } from '#core/identity/kyc/domain/enum/kyc_enum'
import type { KycAuditContext } from '#core/identity/kyc/application/events/kyc_document_submitted'

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
  search?: string
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

/** Compteurs de la revue KYC. */
export interface KycStatsResult {
  total: number
  pending: number
  verified: number
  rejected: number
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
const toPieceResults = (kyc: KycDocument): KycDocumentPieceResult[] => {
  if (kyc.pieces?.length) {
    return kyc.pieces.map((piece) => ({
      pieceType: piece.pieceType,
      fileKey: piece.fileKey,
      reference: piece.reference,
      isPublicUrl: false,
    }))
  }

  const legacy: [DocumentPieceType, string | undefined][] = [
    [DocumentPieceType.RECTO, kyc.documentRectoUrl],
    [DocumentPieceType.VERSO, kyc.documentVersoUrl],
    [DocumentPieceType.SELFIE, kyc.selfieUrl],
  ]

  return legacy
    .filter(([, url]) => Boolean(url))
    .map(([pieceType, url]) => ({
      pieceType,
      fileKey: url as string,
      isPublicUrl: true,
    }))
}

export const toKycDocumentResult = (kyc: KycDocument): KycDocumentResult => ({
  id: kyc.id,
  accountId: kyc.accountId,
  ownerType: kyc.ownerType,
  userId: kyc.userId,
  documentType: kyc.documentType,
  pieces: toPieceResults(kyc),
  documentRectoUrl: kyc.documentRectoUrl,
  documentVersoUrl: kyc.documentVersoUrl,
  selfieUrl: kyc.selfieUrl,
  status: kyc.status,
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
        kycLevel: kyc.user.kycLevel,
        kycStatus: kyc.user.kycStatus,
        phone: kyc.user.phone,
        status: kyc.user.status,
      }
    : undefined,
})
