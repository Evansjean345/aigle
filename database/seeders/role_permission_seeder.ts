import { BaseSeeder } from '@adonisjs/lucid/seeders'
import Role from '#features/team/domain/models/role'
import Permission from '#features/team/domain/models/permission'

export default class extends BaseSeeder {
  async run() {
    const permissions = await Permission.updateOrCreateMany('slug', [
      {
        slug: 'team.manage',
        name: "Gérer l'équipe",
        description: 'Créer, modifier et supprimer des administrateurs',
      },
      {
        slug: 'kyc.manage',
        name: 'Gérer le KYC',
        description: 'Approuver ou rejeter les documents KYC',
      },
      {
        slug: 'finance.view',
        name: 'Voir les finances',
        description: 'Consulter les ledgers et statistiques financières',
      },
      {
        slug: 'users.manage',
        name: 'Gérer les utilisateurs',
        description: 'Bloquer/Activer les utilisateurs et voir leurs profils',
      },
      {
        slug: 'support.access',
        name: 'Accès Support',
        description: 'Accès aux outils de support client',
      },
      {
        slug: 'wallet_adjustment.execute',
        name: 'Exécuter ajustements wallet',
        description: 'Créditer/débiter un portefeuille pour rapprochement comptable',
      },
      {
        slug: 'wallet_adjustment.read',
        name: 'Voir ajustements wallet',
        description: "Consulter l'historique des ajustements de portefeuille",
      },
      {
        slug: 'transaction_refund.execute',
        name: 'Exécuter remboursements',
        description: 'Rembourser une transaction manuellement',
      },
      {
        slug: 'transactions_refunds.read',
        name: 'Voir remboursements',
        description: "Consulter l'historique des remboursements (auto, webhook, manuel)",
      },
      {
        slug: 'audit.read',
        name: "Voir le journal d'audit",
        description: "Consulter les logs d'activité administrative et système",
      },
    ])

    const pMap = Object.fromEntries(permissions.map((p) => [p.slug, p.id]))

    // 2. Créer les rôles et attacher les permissions

    // Super Admin
    const superAdmin = await Role.updateOrCreate(
      { slug: 'super_admin' },
      {
        name: 'Super Administrateur',
        description: 'Accès total au système',
      }
    )
    await superAdmin.related('permissions').sync(Object.values(pMap))

    // Admin
    const admin = await Role.updateOrCreate(
      { slug: 'admin' },
      {
        name: 'Administrateur',
        description: 'Gestionnaire opérationnel avec droits étendus',
      }
    )
    await admin
      .related('permissions')
      .sync([
        pMap['kyc.manage'],
        pMap['finance.view'],
        pMap['users.manage'],
        pMap['support.access'],
      ])

    // KYC Agent
    const kycAgent = await Role.updateOrCreate(
      { slug: 'kyc_agent' },
      { name: 'Agent KYC', description: 'Spécialiste de la conformité et validation des documents' }
    )
    await kycAgent.related('permissions').sync([pMap['kyc.manage']])

    const financeAdmin = await Role.updateOrCreate(
      { slug: 'finance_admin' },
      { name: 'Administrateur Finance', description: 'Responsable du suivi des flux financiers' }
    )
    await financeAdmin
      .related('permissions')
      .sync([
        pMap['finance.view'],
        pMap['wallet_adjustment.execute'],
        pMap['wallet_adjustment.read'],
        pMap['transaction_refund.execute'],
        pMap['transactions_refunds.read'],
      ])

    const supportAgent = await Role.updateOrCreate(
      { slug: 'support_agent' },
      { name: 'Agent Support', description: 'Support client de premier niveau' }
    )

    await supportAgent.related('permissions').sync([pMap['users.manage'], pMap['support.access']])
  }
}
