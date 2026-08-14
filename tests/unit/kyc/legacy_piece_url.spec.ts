import { test } from '@japa/runner'
import {
  deriveStorageKey,
  isReprisableLegacyValue,
  urlPrefix,
} from '#core/identity/kyc/domain/legacy_piece_url'

/**
 * Caractérise la lecture des URL héritées.
 *
 * Ces URL ont été produites par `uploadFile`, qui déposait sous `${dossier}/${uuid}.${ext}` et
 * rendait l'URL publique correspondante. La clé de stockage en est donc le suffixe — c'est
 * l'hypothèse que la reconnaissance doit confirmer sur de vraies valeurs.
 */
test.group('Reprise | URL héritée', () => {
  test('la clé est le chemin de l’URL, sans barre de tête', async ({ assert }) => {
    assert.equal(
      deriveStorageKey('https://mon-bucket.s3.eu-west-3.amazonaws.com/kyc_documents/abc/xyz.jpg'),
      'kyc_documents/abc/xyz.jpg'
    )
  })

  test('le nom de bucket en tête de chemin est retiré', async ({ assert }) => {
    assert.equal(
      deriveStorageKey('https://s3.eu-west-3.amazonaws.com/mon-bucket/kyc_selfies/abc/s.jpg', {
        bucket: 'mon-bucket',
      }),
      'kyc_selfies/abc/s.jpg'
    )
  })

  test('les paramètres de requête ne font pas partie de la clé', async ({ assert }) => {
    assert.equal(
      deriveStorageKey('https://cdn.example/kyc_documents/abc/xyz.jpg?v=2&sig=zzz'),
      'kyc_documents/abc/xyz.jpg'
    )
  })

  test('une clé encodée est rendue à sa forme réelle', async ({ assert }) => {
    assert.equal(
      deriveStorageKey('https://cdn.example/kyc_documents/a%20b/xyz.jpg'),
      'kyc_documents/a b/xyz.jpg'
    )
  })

  test('une valeur qui n’est pas une URL ne produit pas de clé', async ({ assert }) => {
    assert.isNull(deriveStorageKey('pas-une-url'))
    assert.isNull(deriveStorageKey(''))
    assert.isNull(deriveStorageKey(undefined))
  })

  test('une URL sans chemin ne produit pas de clé', async ({ assert }) => {
    assert.isNull(deriveStorageKey('https://cdn.example'))
    assert.isNull(deriveStorageKey('https://cdn.example/'))
  })

  test('une valeur déjà sous forme de clé est rendue telle quelle', async ({ assert }) => {
    assert.equal(deriveStorageKey('kyc_documents/abc/xyz.jpg'), 'kyc_documents/abc/xyz.jpg')
  })

  test('le préfixe identifie la forme sans révéler la pièce', async ({ assert }) => {
    const prefix = urlPrefix(
      'https://mon-bucket.s3.eu-west-3.amazonaws.com/kyc_documents/abc/x.jpg'
    )

    assert.equal(prefix, 'mon-bucket.s3.eu-west-3.amazonaws.com/kyc_documents')
    assert.notInclude(prefix, 'abc')
    assert.notInclude(prefix, 'x.jpg')
  })

  test('le préfixe d’une valeur non analysable la signale sans la citer', async ({ assert }) => {
    assert.equal(urlPrefix('pas-une-url'), '(non analysable)')
    assert.equal(urlPrefix(''), '(vide)')
    assert.equal(urlPrefix(undefined), '(vide)')
  })

  test('une URL du bucket attendu, sous un dossier de dépôt, est reprenable', async ({
    assert,
  }) => {
    assert.isTrue(
      isReprisableLegacyValue(
        'https://mon-bucket.s3.amazonaws.com/kyc_documents/abc/x.jpg',
        'mon-bucket'
      )
    )
    assert.isTrue(
      isReprisableLegacyValue(
        'https://mon-bucket.s3.eu-west-3.amazonaws.com/kyc_selfies/abc/s.jpg',
        'mon-bucket'
      )
    )
    assert.isTrue(
      isReprisableLegacyValue(
        'https://s3.eu-west-3.amazonaws.com/mon-bucket/kyc_documents/abc/x.jpg',
        'mon-bucket'
      )
    )
  })

  test('une valeur déjà sous forme de clé reste reprenable', async ({ assert }) => {
    assert.isTrue(isReprisableLegacyValue('kyc_documents/abc/x.jpg', 'mon-bucket'))
    assert.isTrue(isReprisableLegacyValue('kyc_selfies/abc/s.jpg', 'mon-bucket'))
  })

  test('une URL étrangère n’est pas reprenable, même si elle se dérive', async ({ assert }) => {
    // Le cas qui a motivé D12 : la dérivation réussit, la provenance n'est pas prouvée.
    const placeholder = 'https://placehold.co/900x620/e2e8f0/475569.png?text=RCCM'

    assert.isNotNull(deriveStorageKey(placeholder))
    assert.isFalse(isReprisableLegacyValue(placeholder, 'mon-bucket'))
  })

  test('un autre bucket n’est pas reprenable', async ({ assert }) => {
    assert.isFalse(
      isReprisableLegacyValue(
        'https://autre-bucket.s3.amazonaws.com/kyc_documents/abc/x.jpg',
        'mon-bucket'
      )
    )
    assert.isFalse(
      isReprisableLegacyValue(
        'https://s3.amazonaws.com/autre-bucket/kyc_documents/abc/x.jpg',
        'mon-bucket'
      )
    )
  })

  test('un dossier hors dépôt n’est pas reprenable', async ({ assert }) => {
    assert.isFalse(
      isReprisableLegacyValue(
        'https://mon-bucket.s3.amazonaws.com/factures/abc/x.pdf',
        'mon-bucket'
      )
    )
    assert.isFalse(isReprisableLegacyValue('factures/abc/x.pdf', 'mon-bucket'))
  })

  test('une valeur vide ou un bucket absent ne sont jamais reprenables', async ({ assert }) => {
    assert.isFalse(isReprisableLegacyValue(undefined, 'mon-bucket'))
    assert.isFalse(isReprisableLegacyValue('   ', 'mon-bucket'))
    assert.isFalse(isReprisableLegacyValue('kyc_documents/abc/x.jpg', ''))
  })
})
