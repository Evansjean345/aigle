import { UserKycStatus, UserStatus } from '#features/user/domain/enum'

export interface UserSearchResponseDto {
  usersUid: string
  fullname: string
  phone: string
  profilePic: string | null
  country: {
    name: string
    flag: string
    phoneCode: string
  }
  kyc: {
    level: number
    status: UserKycStatus
  }
  status: UserStatus
}
