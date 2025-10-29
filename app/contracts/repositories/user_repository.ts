import { User } from '#interfaces/user'

export default abstract class UserRepository {
  abstract findUserById(id: number): Promise<User | null>
}
