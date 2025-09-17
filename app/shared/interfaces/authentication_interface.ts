// Authentication Use Cases Interfaces
export interface AuthenticationUseCaseInterface<T = any, R = any> {
  execute(data: T): Promise<R>
}

// Login Use Case Interface
export interface LoginUseCaseInterface extends AuthenticationUseCaseInterface<LoginData, any> {}

export interface LoginData {
  phone: string
  password: string
}

// Register Use Case Interface
export interface RegisterUseCaseInterface extends AuthenticationUseCaseInterface<RegisterData, any> {}

export interface RegisterData {
  phone: string
  first_name: string
  last_name: string
  email?: string
  pincode: string
  iso_code: string
  [key: string]: any
}

// OTP Interfaces
export interface VerifyOtpUseCaseInterface extends AuthenticationUseCaseInterface<VerifyOtpData, any> {}

export interface VerifyOtpData {
  phone: string
  enteredOtp: string
}

export interface SendOtpUseCaseInterface extends AuthenticationUseCaseInterface<SendOtpData, any> {}

export interface SendOtpData {
  phone: string
}

// Password Reset Interface
export interface ResetPasswordUseCaseInterface extends AuthenticationUseCaseInterface<ResetPasswordData, any> {}

export interface ResetPasswordData {
  phone: string
  password: string
}

// PIN Check Interface
export interface CheckPinUseCaseInterface extends AuthenticationUseCaseInterface<CheckPinData, any> {}

export interface CheckPinData {
  phone: string
  pin: string
}

// User Profile Interface
export interface GetUserProfileUseCaseInterface extends AuthenticationUseCaseInterface<GetUserProfileData, any> {}

export interface GetUserProfileData {
  user: any
}

// Logout Interface
export interface LogoutUseCaseInterface extends AuthenticationUseCaseInterface<LogoutData, any> {}

export interface LogoutData {
  auth: any
}

// Authentication Service Interface
export interface AuthenticationServiceInterface {
  checkPhone(data: { phone: string }): Promise<any>
  registerUser(data: RegisterData): Promise<any>
  loginUser(data: LoginData): Promise<any>
  accessToken(data: VerifyOtpData): Promise<any>
  logoutUser(auth: any): Promise<any>
  userAuth(auth: any): Promise<any>
  resetPassword(data: ResetPasswordData): Promise<any>
  checkPinCode(data: CheckPinData): Promise<any>
  sendOtp(data: SendOtpData): Promise<any>
}

// OTP Service Interface
export interface OtpServiceInterface {
  sendOtp(phone: string, userId: string): Promise<any>
  verifyOtp(data: { phone: string; enteredOtp: string }): Promise<any>
}
