import { test } from '@japa/runner'
import KycPolicy from '#features/kyc/presentation/admin/policies/kyc_policy'

function makeAdmin(roleSlug: string, perms: string[] = []) {
  return {
    role: {
      slug: roleSlug,
      permissions: perms.map((p) => ({ slug: p })),
    },
    load: async () => {},
  } as any
}

test.group('Kyc | Policy', () => {
  test('root a toutes les permissions KYC', async ({ assert }) => {
    const policy = new KycPolicy()
    const admin = makeAdmin('root')

    assert.isTrue(await policy.viewAny(admin))
    assert.isTrue(await policy.view(admin))
    assert.isTrue(await policy.approve(admin))
    assert.isTrue(await policy.reject(admin))
  })

  test('permissions granulaires: kyc.read', async ({ assert }) => {
    const policy = new KycPolicy()
    const admin = makeAdmin('manager', ['kyc.read'])

    assert.isTrue(await policy.viewAny(admin))
    assert.isTrue(await policy.view(admin))
    assert.isFalse(await policy.approve(admin))
    assert.isFalse(await policy.reject(admin))
  })

  test('permissions granulaires: kyc.approve et kyc.reject', async ({ assert }) => {
    const policy = new KycPolicy()

    const approver = makeAdmin('supervisor', ['kyc.approve'])
    assert.isTrue(await policy.approve(approver))
    assert.isFalse(await policy.reject(approver))

    const rejector = makeAdmin('supervisor', ['kyc.reject'])
    assert.isTrue(await policy.reject(rejector))
    assert.isFalse(await policy.approve(rejector))
  })
})
