import { test } from '@japa/runner'
import { deriveStorageKey, urlPrefix } from '#core/identity/kyc/domain/legacy_piece_url'

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
})
