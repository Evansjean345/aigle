import { type DateTime } from 'luxon'
import { type UserKycStatus, type UserStatus } from '#core/identity/user/domain/enum'
import {
  type KycDocumentStatus,
  type KycDocumentType,
} from '#core/identity/kyc/domain/enum/kyc_enum'
import type User from '#core/identity/user/domain/models/user'

/**
 * Contrats de service de l'annuaire des utilisateurs, côté administration.
 *
 * Distinct de `UserLookupResult`, qui sert l'identité minimale aux produits : ces projections
 * portent ce que le back-office affiche, relations comprises.
 */

// ── Query (input service) ───────────────────────────────────────────

/** Filtres de la liste des utilisateurs, déjà normalisés par la frontière HTTP. */
export interface ListUsersFilters {
  search?: string
  status?: string
  kycStatus?: string
  kycLevel?: number
  countryId?: number
  startDate?: string
  endDate?: string
}

// ── Result (output service) ─────────────────────────────────────────

export interface UserCountryRef {
  name: string
  flag: string
  phoneCode: string
}

export interface UserKycRef {
  level: number
  status: UserKycStatus
  documentType: KycDocumentType | null
  documentStatus: KycDocumentStatus | null
}

/** Utilisateur tel qu'il apparaît dans la liste du back-office. */
export interface UserListItemResult {
  usersUid: string
  fullname: string
  phone: string
  country: UserCountryRef
  profilePic: string | null
  status: UserStatus
  createdAt: DateTime<boolean>
  transactionVolume: {
    monthly_limit: number
    monthly: number
  }
  kyc: UserKycRef
  wallet: {
    balance: number
    currency?: string
  }
}

export interface UsersPaginationMeta {
  total: number
  currentPage: number
  firstPage: number
  lastPage: number
  perPage: number
}

export interface PaginatedUsersResult {
  data: UserListItemResult[]
  meta: UsersPaginationMeta
}

/** Résultat d'autocomplétion : de quoi identifier et choisir, rien de plus. */
export interface UserSearchResult {
  usersUid: string
  fullname: string
  phone: string
  profilePic: string | null
  country: UserCountryRef
  kyc: {
    level: number
    status: UserKycStatus
  }
  status: UserStatus
}

export interface UserDeviceResult {
  id: string
  deviceId: string
  status: string
  isPrimary: boolean
  ipFirstSeen?: string
  ipLastSeen?: string
  linkedAt?: DateTime<boolean>
  lastSeenAt?: DateTime<boolean>
  createdAt: DateTime<boolean>
  firstCountryCode: string | null
  lastCountryCode: string | null
  device: {
    fingerprintHash: string
    deviceUid: string
    platform?: string
    brand?: string
    model?: string
    osVersion?: string
    appVersion?: string
    isEmulator: boolean
    isRooted: boolean
  } | null
}

export interface UserDebitPhoneResult {
  id: number
  phone: string
  label: string | null
  isVerified: boolean
  createdAt: DateTime<boolean>
  verifiedAt: DateTime<boolean> | null
  provider: {
    id: number
    code: string
    logo: string | null | undefined
    type: string
  }
}

/** Fiche complète d'un utilisateur, appareils et numéros de débit compris. */
export interface UserDetailsResult {
  usersUid: string
  firstname: string
  lastname: string
  fullname: string
  phone: string
  email: string | null
  birthday: Date
  accountNumber: string
  accountType: string
  country: UserCountryRef
  profilePic: string | null
  status: UserStatus
  createdAt: DateTime<boolean>
  updatedAt: DateTime<boolean> | null
  kyc: UserKycRef
  devices: UserDeviceResult[]
  debitPhones: UserDebitPhoneResult[]
}

/**
 * Portefeuille d'un utilisateur et son activité, pour la fiche admin.
 *
 * Les plafonds valent `null` quand le niveau KYC n'en fixe pas — illimité.
 */
export interface UserWalletStatsResult {
  wallet: {
    id: number
    balance: number
    currency: string
    status: string
    limitPerTransaction: number | null
    limitDaily: number | null
    limitMonthly: number | null
    balanceLimit: number | null
  }
  activity: {
    todayTxCount: number
    todayVolume: number
    monthVolume: number
    lastTxDate: string | null
    lastTxAmount: number | null
  }
}

const fullnameOf = (user: User): string =>
  [user.firstname, user.lastname].filter(Boolean).join(' ').trim()

const countryOf = (user: User): UserCountryRef => ({
  name: user.country?.name || '',
  flag: user.country?.flag || '',
  phoneCode: user.country?.phoneCode || '',
})

export const toUserListItemResult = (
  user: User,
  options?: { monthlyVolume: number }
): UserListItemResult => ({
  usersUid: user.usersUid,
  fullname: fullnameOf(user),
  phone: user.phone,
  country: countryOf(user),
  profilePic: user.kycDocument?.selfieUrl || null,
  status: user.status,
  createdAt: user.createdAt,
  transactionVolume: {
    monthly_limit: user.keyLevel?.monthlyLimit || 0,
    monthly: options?.monthlyVolume ?? 0,
  },
  kyc: {
    level: user.keyLevel?.level || 0,
    status: user.kycStatus,
    documentType: user.kycDocument?.documentType ?? null,
    documentStatus: user.kycDocument?.status ?? null,
  },
  wallet: {
    balance: user.wallet?.balance || 0,
    currency: user.wallet?.currencySymbol || '',
  },
})

export const toUserSearchResult = (user: User): UserSearchResult => ({
  usersUid: user.usersUid,
  fullname: fullnameOf(user),
  phone: user.phone,
  profilePic: user.kycDocument?.selfieUrl || null,
  country: countryOf(user),
  kyc: {
    level: user.keyLevel?.level || 0,
    status: user.kycStatus,
  },
  status: user.status,
})

export const toUserDetailsResult = (user: User): UserDetailsResult => ({
  usersUid: user.usersUid,
  firstname: user.firstname,
  lastname: user.lastname,
  fullname: fullnameOf(user),
  phone: user.phone,
  email: user.email,
  birthday: user.birthday,
  accountNumber: user.accountNumber,
  accountType: user.accountType,
  country: countryOf(user),
  profilePic: user.kycDocument?.selfieUrl || null,
  status: user.status,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  kyc: {
    level: user.keyLevel?.level || 0,
    status: user.kycStatus,
    documentType: user.kycDocument?.documentType ?? null,
    documentStatus: user.kycDocument?.status ?? null,
  },
  devices: user.userDevices.map((ud) => ({
    id: ud.id,
    deviceId: ud.deviceId,
    status: ud.status,
    isPrimary: ud.isPrimary,
    ipFirstSeen: ud.ipFirstSeen,
    ipLastSeen: ud.ipLastSeen,
    linkedAt: ud.linkedAt,
    lastSeenAt: ud.lastSeenAt,
    createdAt: ud.createdAt,
    firstCountryCode: ud.firstCountryCode ?? null,
    lastCountryCode: ud.lastCountryCode ?? null,
    device: ud.device
      ? {
          fingerprintHash: ud.device.fingerprintHash,
          deviceUid: ud.device.deviceUid,
          platform: ud.device.platform,
          brand: ud.device.brand,
          model: ud.device.model,
          osVersion: ud.device.osVersion,
          appVersion: ud.device.appVersion,
          isEmulator: ud.device.isEmulator,
          isRooted: ud.device.isRooted,
        }
      : null,
  })),
  debitPhones: user.debitPhones.map((phoneNumber) => ({
    id: phoneNumber.id,
    phone: phoneNumber.phone,
    label: phoneNumber.label,
    isVerified: phoneNumber.isVerified,
    createdAt: phoneNumber.createdAt,
    verifiedAt: phoneNumber.verifiedAt,
    provider: {
      id: phoneNumber.provider.id,
      code: phoneNumber.provider.code,
      logo: phoneNumber.provider.logo,
      type: phoneNumber.provider.type,
    },
  })),
})
