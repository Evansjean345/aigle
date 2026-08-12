import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'admin_management.login': { paramsTuple?: []; params?: {} }
    'admin_management.refresh': { paramsTuple?: []; params?: {} }
    'admin_management.setup_password': { paramsTuple?: []; params?: {} }
    'admin_management.verify_otp': { paramsTuple?: []; params?: {} }
    'team_management.index': { paramsTuple?: []; params?: {} }
    'team_management.store': { paramsTuple?: []; params?: {} }
    'team_management.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'team_management.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'role_management.index': { paramsTuple?: []; params?: {} }
    'role_management.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'role_management.store': { paramsTuple?: []; params?: {} }
    'role_management.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'role_management.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permission_management.index': { paramsTuple?: []; params?: {} }
    'permission_management.all': { paramsTuple?: []; params?: {} }
    'permission_management.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'service_types.index': { paramsTuple?: []; params?: {} }
    'service_types.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_types.store': { paramsTuple?: []; params?: {} }
    'service_types.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_types.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'payment_methods.index': { paramsTuple?: []; params?: {} }
    'payment_methods.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'payment_methods.store': { paramsTuple?: []; params?: {} }
    'payment_methods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'payment_methods.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.index': { paramsTuple?: []; params?: {} }
    'providers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.store': { paramsTuple?: []; params?: {} }
    'providers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.activate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.deactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_provider_methods.index': { paramsTuple?: []; params?: {} }
    'service_provider_methods.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_provider_methods.store': { paramsTuple?: []; params?: {} }
    'service_provider_methods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_provider_methods.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_company_contacts.index': { paramsTuple?: []; params?: {} }
    'admin_company_contacts.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_transaction.get_all_transactions': { paramsTuple?: []; params?: {} }
    'admin_transaction.get_transactions_stats': { paramsTuple?: []; params?: {} }
    'admin_refund.list': { paramsTuple?: []; params?: {} }
    'admin_refund.execute': { paramsTuple?: []; params?: {} }
    'admin_transaction.find_transaction': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'users.index': { paramsTuple?: []; params?: {} }
    'users.search': { paramsTuple?: []; params?: {} }
    'users.stats': { paramsTuple?: []; params?: {} }
    'users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.wallet_stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_transaction.get_user_transactions': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_transaction.get_user_transaction_stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.get_user_ledgers': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.get_user_ledger_stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.block': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.activate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.get_all_ledgers': { paramsTuple?: []; params?: {} }
    'ledgers.get_ledgers_stats': { paramsTuple?: []; params?: {} }
    'collection_accounts.index': { paramsTuple?: []; params?: {} }
    'collection_accounts.store': { paramsTuple?: []; params?: {} }
    'collection_accounts.update': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'collection_accounts.toggle': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_funding_requests.index': { paramsTuple?: []; params?: {} }
    'admin_funding_requests.show': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_funding_requests.approve': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_funding_requests.confirm': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_funding_requests.reject': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_funding_settings.show': { paramsTuple?: []; params?: {} }
    'admin_funding_settings.update': { paramsTuple?: []; params?: {} }
    'admin_mass_transfers.index': { paramsTuple?: []; params?: {} }
    'admin_mass_transfers.show': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_organisations.index': { paramsTuple?: []; params?: {} }
    'admin_organisations.search': { paramsTuple?: []; params?: {} }
    'admin_organisations.stats': { paramsTuple?: []; params?: {} }
    'admin_organisations.stuck_provisioning': { paramsTuple?: []; params?: {} }
    'admin_organisations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.members': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.roles': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.wallet_stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.set_payable': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.change_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.resume_provisioning_now': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.freeze_wallet': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.unfreeze_wallet': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyb_admin.index': { paramsTuple?: []; params?: {} }
    'kyb_admin.stats': { paramsTuple?: []; params?: {} }
    'kyb_admin.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyb_admin.approve': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyb_admin.reject': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc_level.index': { paramsTuple?: []; params?: {} }
    'kyc_level.store': { paramsTuple?: []; params?: {} }
    'kyc_level.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc_level.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc.index': { paramsTuple?: []; params?: {} }
    'kyc.stats': { paramsTuple?: []; params?: {} }
    'kyc.kyc_details': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc.process': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc.get_user_kyc': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_device.get_devices': { paramsTuple?: []; params?: {} }
    'admin_device.get_user_devices': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'admin_device.revoke_device': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'deviceId': ParamValue} }
    'admin_device.get_device_details': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_device_accounts': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_transaction_summary': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_device_transactions': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_app_version.index': { paramsTuple?: []; params?: {} }
    'admin_app_version.store': { paramsTuple?: []; params?: {} }
    'admin_app_version.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_app_version.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_app_version.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'wallet.freeze': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'wallet.unfreeze': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'wallet_adjustment.list': { paramsTuple?: []; params?: {} }
    'wallet_adjustment.execute': { paramsTuple?: []; params?: {} }
    'admin_audit.list': { paramsTuple?: []; params?: {} }
    'admin_audit.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'auth.check_phone': { paramsTuple?: []; params?: {} }
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.verify_credentials': { paramsTuple?: []; params?: {} }
    'auth.get_user_info': { paramsTuple?: []; params?: {} }
    'auth.verify_user_account': { paramsTuple?: []; params?: {} }
    'auth.send_otp': { paramsTuple?: []; params?: {} }
    'auth.forgot_password_request': { paramsTuple?: []; params?: {} }
    'auth.forgot_password_verify': { paramsTuple?: []; params?: {} }
    'auth.forgot_password_reset': { paramsTuple?: []; params?: {} }
    'auth.user_auth': { paramsTuple?: []; params?: {} }
    'auth.session_status': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.check_pin_code': { paramsTuple?: []; params?: {} }
    'wallet_over_view': { paramsTuple?: []; params?: {} }
    'services.payment_options_by_service_type': { paramsTuple: [ParamValue]; params: {'serviceType': ParamValue} }
    'services.payment_options_by_service_type_to': { paramsTuple: [ParamValue]; params: {'serviceType': ParamValue} }
    'company_contacts.index': { paramsTuple?: []; params?: {} }
    'deposit': { paramsTuple?: []; params?: {} }
    'transfert': { paramsTuple?: []; params?: {} }
    'transfert_inter': { paramsTuple?: []; params?: {} }
    'wallet_to_wallet': { paramsTuple?: []; params?: {} }
    'pay_merchant': { paramsTuple?: []; params?: {} }
    'provider.hub2.payments.success': { paramsTuple?: []; params?: {} }
    'provider.hub2.payments.failed': { paramsTuple?: []; params?: {} }
    'provider.hub2.transfers.success': { paramsTuple?: []; params?: {} }
    'provider.hub2.transfers.failed': { paramsTuple?: []; params?: {} }
    'provider.wave': { paramsTuple?: []; params?: {} }
    'mobile_transactions.list': { paramsTuple?: []; params?: {} }
    'mobile_transactions.get_transaction_quota': { paramsTuple?: []; params?: {} }
    'mobile_transactions.details': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'mobile_transactions.stream_transaction': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'pin_code.change_pin_code': { paramsTuple?: []; params?: {} }
    'qr.issue': { paramsTuple?: []; params?: {} }
    'qr.resolve': { paramsTuple?: []; params?: {} }
    'qr.verify': { paramsTuple?: []; params?: {} }
    'qr.resolve_merchant': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'kyc_submittion.submit_kyc_documents': { paramsTuple?: []; params?: {} }
    'app_version.check': { paramsTuple?: []; params?: {} }
    'device.get_user_devices': { paramsTuple?: []; params?: {} }
    'device.update_push_token': { paramsTuple?: []; params?: {} }
    'device.revoke_device': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'debit_phone.index': { paramsTuple?: []; params?: {} }
    'debit_phone.store': { paramsTuple?: []; params?: {} }
    'debit_phone.verify': { paramsTuple?: []; params?: {} }
    'debit_phone.resend': { paramsTuple?: []; params?: {} }
    'business_auth.check_phone': { paramsTuple?: []; params?: {} }
    'business_auth.login': { paramsTuple?: []; params?: {} }
    'business_auth.verify': { paramsTuple?: []; params?: {} }
    'business_session.index': { paramsTuple?: []; params?: {} }
    'business_session.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'business_auth.check_pin_code': { paramsTuple?: []; params?: {} }
    'business_health': { paramsTuple?: []; params?: {} }
    'organisation.store': { paramsTuple?: []; params?: {} }
    'organisation.index': { paramsTuple?: []; params?: {} }
    'permission.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'role.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'role.store': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'role.update': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'roleId': ParamValue} }
    'role.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'roleId': ParamValue} }
    'member.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'member.store': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'member.resend': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'memberId': ParamValue} }
    'member.update_role': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'memberId': ParamValue} }
    'member.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'memberId': ParamValue} }
    'invitation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'invitation.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'invitation.decline': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'business_transactions.list': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'business_transactions.quotas': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'business_transactions.details': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'business_transfer.create': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'mass_transfer.simulate': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'mass_transfer.create': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'mass_transfer.approve': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'mass_transfer.reject': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'mass_transfer.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'mass_transfer.show': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'client_collection_accounts.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'funding_requests.store': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'funding_requests.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'funding_requests.show': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'funding_requests.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'kyb.store': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'kyb.show': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'business_device.index': { paramsTuple?: []; params?: {} }
    'business_device.update_push_token': { paramsTuple?: []; params?: {} }
    'business_device.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'business_catalog.payment_options_by_service_type': { paramsTuple: [ParamValue]; params: {'serviceType': ParamValue} }
    'business_catalog.payment_options_by_service_type_to': { paramsTuple: [ParamValue]; params: {'serviceType': ParamValue} }
    'payable_alias.resolve': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'checkout.options': { paramsTuple?: []; params?: {} }
    'checkout.initiate': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'checkout.status': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'health': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'team_management.index': { paramsTuple?: []; params?: {} }
    'role_management.index': { paramsTuple?: []; params?: {} }
    'role_management.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permission_management.index': { paramsTuple?: []; params?: {} }
    'permission_management.all': { paramsTuple?: []; params?: {} }
    'permission_management.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'service_types.index': { paramsTuple?: []; params?: {} }
    'service_types.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'payment_methods.index': { paramsTuple?: []; params?: {} }
    'payment_methods.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.index': { paramsTuple?: []; params?: {} }
    'providers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_provider_methods.index': { paramsTuple?: []; params?: {} }
    'service_provider_methods.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_company_contacts.index': { paramsTuple?: []; params?: {} }
    'admin_transaction.get_all_transactions': { paramsTuple?: []; params?: {} }
    'admin_transaction.get_transactions_stats': { paramsTuple?: []; params?: {} }
    'admin_refund.list': { paramsTuple?: []; params?: {} }
    'admin_transaction.find_transaction': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'users.index': { paramsTuple?: []; params?: {} }
    'users.search': { paramsTuple?: []; params?: {} }
    'users.stats': { paramsTuple?: []; params?: {} }
    'users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.wallet_stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_transaction.get_user_transactions': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_transaction.get_user_transaction_stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.get_user_ledgers': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.get_user_ledger_stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.get_all_ledgers': { paramsTuple?: []; params?: {} }
    'ledgers.get_ledgers_stats': { paramsTuple?: []; params?: {} }
    'collection_accounts.index': { paramsTuple?: []; params?: {} }
    'admin_funding_requests.index': { paramsTuple?: []; params?: {} }
    'admin_funding_requests.show': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_funding_settings.show': { paramsTuple?: []; params?: {} }
    'admin_mass_transfers.index': { paramsTuple?: []; params?: {} }
    'admin_mass_transfers.show': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_organisations.index': { paramsTuple?: []; params?: {} }
    'admin_organisations.search': { paramsTuple?: []; params?: {} }
    'admin_organisations.stats': { paramsTuple?: []; params?: {} }
    'admin_organisations.stuck_provisioning': { paramsTuple?: []; params?: {} }
    'admin_organisations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.members': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.roles': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.wallet_stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyb_admin.index': { paramsTuple?: []; params?: {} }
    'kyb_admin.stats': { paramsTuple?: []; params?: {} }
    'kyb_admin.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc_level.index': { paramsTuple?: []; params?: {} }
    'kyc.index': { paramsTuple?: []; params?: {} }
    'kyc.stats': { paramsTuple?: []; params?: {} }
    'kyc.kyc_details': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc.get_user_kyc': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_device.get_devices': { paramsTuple?: []; params?: {} }
    'admin_device.get_user_devices': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'admin_device.get_device_details': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_device_accounts': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_transaction_summary': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_device_transactions': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_app_version.index': { paramsTuple?: []; params?: {} }
    'admin_app_version.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'wallet_adjustment.list': { paramsTuple?: []; params?: {} }
    'admin_audit.list': { paramsTuple?: []; params?: {} }
    'admin_audit.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'auth.user_auth': { paramsTuple?: []; params?: {} }
    'auth.session_status': { paramsTuple?: []; params?: {} }
    'wallet_over_view': { paramsTuple?: []; params?: {} }
    'services.payment_options_by_service_type': { paramsTuple: [ParamValue]; params: {'serviceType': ParamValue} }
    'services.payment_options_by_service_type_to': { paramsTuple: [ParamValue]; params: {'serviceType': ParamValue} }
    'company_contacts.index': { paramsTuple?: []; params?: {} }
    'mobile_transactions.list': { paramsTuple?: []; params?: {} }
    'mobile_transactions.get_transaction_quota': { paramsTuple?: []; params?: {} }
    'mobile_transactions.details': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'mobile_transactions.stream_transaction': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'qr.resolve_merchant': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'app_version.check': { paramsTuple?: []; params?: {} }
    'device.get_user_devices': { paramsTuple?: []; params?: {} }
    'debit_phone.index': { paramsTuple?: []; params?: {} }
    'business_session.index': { paramsTuple?: []; params?: {} }
    'business_health': { paramsTuple?: []; params?: {} }
    'organisation.index': { paramsTuple?: []; params?: {} }
    'permission.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'role.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'member.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'invitation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'business_transactions.list': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'business_transactions.quotas': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'business_transactions.details': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'mass_transfer.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'mass_transfer.show': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'client_collection_accounts.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'funding_requests.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'funding_requests.show': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'kyb.show': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'business_device.index': { paramsTuple?: []; params?: {} }
    'business_catalog.payment_options_by_service_type': { paramsTuple: [ParamValue]; params: {'serviceType': ParamValue} }
    'business_catalog.payment_options_by_service_type_to': { paramsTuple: [ParamValue]; params: {'serviceType': ParamValue} }
    'payable_alias.resolve': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'checkout.options': { paramsTuple?: []; params?: {} }
    'checkout.status': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'health': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'team_management.index': { paramsTuple?: []; params?: {} }
    'role_management.index': { paramsTuple?: []; params?: {} }
    'role_management.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permission_management.index': { paramsTuple?: []; params?: {} }
    'permission_management.all': { paramsTuple?: []; params?: {} }
    'permission_management.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'service_types.index': { paramsTuple?: []; params?: {} }
    'service_types.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'payment_methods.index': { paramsTuple?: []; params?: {} }
    'payment_methods.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.index': { paramsTuple?: []; params?: {} }
    'providers.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_provider_methods.index': { paramsTuple?: []; params?: {} }
    'service_provider_methods.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_company_contacts.index': { paramsTuple?: []; params?: {} }
    'admin_transaction.get_all_transactions': { paramsTuple?: []; params?: {} }
    'admin_transaction.get_transactions_stats': { paramsTuple?: []; params?: {} }
    'admin_refund.list': { paramsTuple?: []; params?: {} }
    'admin_transaction.find_transaction': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'users.index': { paramsTuple?: []; params?: {} }
    'users.search': { paramsTuple?: []; params?: {} }
    'users.stats': { paramsTuple?: []; params?: {} }
    'users.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.wallet_stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_transaction.get_user_transactions': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_transaction.get_user_transaction_stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.get_user_ledgers': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.get_user_ledger_stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.get_all_ledgers': { paramsTuple?: []; params?: {} }
    'ledgers.get_ledgers_stats': { paramsTuple?: []; params?: {} }
    'collection_accounts.index': { paramsTuple?: []; params?: {} }
    'admin_funding_requests.index': { paramsTuple?: []; params?: {} }
    'admin_funding_requests.show': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_funding_settings.show': { paramsTuple?: []; params?: {} }
    'admin_mass_transfers.index': { paramsTuple?: []; params?: {} }
    'admin_mass_transfers.show': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_organisations.index': { paramsTuple?: []; params?: {} }
    'admin_organisations.search': { paramsTuple?: []; params?: {} }
    'admin_organisations.stats': { paramsTuple?: []; params?: {} }
    'admin_organisations.stuck_provisioning': { paramsTuple?: []; params?: {} }
    'admin_organisations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.members': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.roles': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.wallet_stats': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyb_admin.index': { paramsTuple?: []; params?: {} }
    'kyb_admin.stats': { paramsTuple?: []; params?: {} }
    'kyb_admin.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc_level.index': { paramsTuple?: []; params?: {} }
    'kyc.index': { paramsTuple?: []; params?: {} }
    'kyc.stats': { paramsTuple?: []; params?: {} }
    'kyc.kyc_details': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc.get_user_kyc': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_device.get_devices': { paramsTuple?: []; params?: {} }
    'admin_device.get_user_devices': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'admin_device.get_device_details': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_device_accounts': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_transaction_summary': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_device_transactions': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_app_version.index': { paramsTuple?: []; params?: {} }
    'admin_app_version.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'wallet_adjustment.list': { paramsTuple?: []; params?: {} }
    'admin_audit.list': { paramsTuple?: []; params?: {} }
    'admin_audit.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'auth.user_auth': { paramsTuple?: []; params?: {} }
    'auth.session_status': { paramsTuple?: []; params?: {} }
    'wallet_over_view': { paramsTuple?: []; params?: {} }
    'services.payment_options_by_service_type': { paramsTuple: [ParamValue]; params: {'serviceType': ParamValue} }
    'services.payment_options_by_service_type_to': { paramsTuple: [ParamValue]; params: {'serviceType': ParamValue} }
    'company_contacts.index': { paramsTuple?: []; params?: {} }
    'mobile_transactions.list': { paramsTuple?: []; params?: {} }
    'mobile_transactions.get_transaction_quota': { paramsTuple?: []; params?: {} }
    'mobile_transactions.details': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'mobile_transactions.stream_transaction': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'qr.resolve_merchant': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'app_version.check': { paramsTuple?: []; params?: {} }
    'device.get_user_devices': { paramsTuple?: []; params?: {} }
    'debit_phone.index': { paramsTuple?: []; params?: {} }
    'business_session.index': { paramsTuple?: []; params?: {} }
    'business_health': { paramsTuple?: []; params?: {} }
    'organisation.index': { paramsTuple?: []; params?: {} }
    'permission.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'role.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'member.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'invitation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'business_transactions.list': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'business_transactions.quotas': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'business_transactions.details': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'mass_transfer.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'mass_transfer.show': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'client_collection_accounts.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'funding_requests.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'funding_requests.show': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'kyb.show': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'business_device.index': { paramsTuple?: []; params?: {} }
    'business_catalog.payment_options_by_service_type': { paramsTuple: [ParamValue]; params: {'serviceType': ParamValue} }
    'business_catalog.payment_options_by_service_type_to': { paramsTuple: [ParamValue]; params: {'serviceType': ParamValue} }
    'payable_alias.resolve': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'checkout.options': { paramsTuple?: []; params?: {} }
    'checkout.status': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'health': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'admin_management.login': { paramsTuple?: []; params?: {} }
    'admin_management.refresh': { paramsTuple?: []; params?: {} }
    'admin_management.setup_password': { paramsTuple?: []; params?: {} }
    'admin_management.verify_otp': { paramsTuple?: []; params?: {} }
    'team_management.store': { paramsTuple?: []; params?: {} }
    'role_management.store': { paramsTuple?: []; params?: {} }
    'service_types.store': { paramsTuple?: []; params?: {} }
    'payment_methods.store': { paramsTuple?: []; params?: {} }
    'providers.store': { paramsTuple?: []; params?: {} }
    'service_provider_methods.store': { paramsTuple?: []; params?: {} }
    'admin_refund.execute': { paramsTuple?: []; params?: {} }
    'collection_accounts.store': { paramsTuple?: []; params?: {} }
    'admin_funding_requests.approve': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_funding_requests.confirm': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_funding_requests.reject': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_organisations.resume_provisioning_now': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyb_admin.approve': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyb_admin.reject': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc_level.store': { paramsTuple?: []; params?: {} }
    'kyc.process': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_app_version.store': { paramsTuple?: []; params?: {} }
    'wallet_adjustment.execute': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'auth.check_phone': { paramsTuple?: []; params?: {} }
    'auth.register': { paramsTuple?: []; params?: {} }
    'auth.verify_credentials': { paramsTuple?: []; params?: {} }
    'auth.get_user_info': { paramsTuple?: []; params?: {} }
    'auth.verify_user_account': { paramsTuple?: []; params?: {} }
    'auth.send_otp': { paramsTuple?: []; params?: {} }
    'auth.forgot_password_request': { paramsTuple?: []; params?: {} }
    'auth.forgot_password_verify': { paramsTuple?: []; params?: {} }
    'auth.forgot_password_reset': { paramsTuple?: []; params?: {} }
    'auth.logout': { paramsTuple?: []; params?: {} }
    'auth.check_pin_code': { paramsTuple?: []; params?: {} }
    'deposit': { paramsTuple?: []; params?: {} }
    'transfert': { paramsTuple?: []; params?: {} }
    'transfert_inter': { paramsTuple?: []; params?: {} }
    'wallet_to_wallet': { paramsTuple?: []; params?: {} }
    'pay_merchant': { paramsTuple?: []; params?: {} }
    'provider.hub2.payments.success': { paramsTuple?: []; params?: {} }
    'provider.hub2.payments.failed': { paramsTuple?: []; params?: {} }
    'provider.hub2.transfers.success': { paramsTuple?: []; params?: {} }
    'provider.hub2.transfers.failed': { paramsTuple?: []; params?: {} }
    'provider.wave': { paramsTuple?: []; params?: {} }
    'pin_code.change_pin_code': { paramsTuple?: []; params?: {} }
    'qr.issue': { paramsTuple?: []; params?: {} }
    'qr.resolve': { paramsTuple?: []; params?: {} }
    'qr.verify': { paramsTuple?: []; params?: {} }
    'kyc_submittion.submit_kyc_documents': { paramsTuple?: []; params?: {} }
    'debit_phone.store': { paramsTuple?: []; params?: {} }
    'debit_phone.verify': { paramsTuple?: []; params?: {} }
    'debit_phone.resend': { paramsTuple?: []; params?: {} }
    'business_auth.check_phone': { paramsTuple?: []; params?: {} }
    'business_auth.login': { paramsTuple?: []; params?: {} }
    'business_auth.verify': { paramsTuple?: []; params?: {} }
    'business_auth.check_pin_code': { paramsTuple?: []; params?: {} }
    'organisation.store': { paramsTuple?: []; params?: {} }
    'role.store': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'member.store': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'member.resend': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'memberId': ParamValue} }
    'invitation.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'invitation.decline': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'business_transfer.create': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'mass_transfer.simulate': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'mass_transfer.create': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'mass_transfer.approve': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'mass_transfer.reject': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'funding_requests.store': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'funding_requests.cancel': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'reference': ParamValue} }
    'kyb.store': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'checkout.initiate': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
  }
  PUT: {
    'team_management.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'role_management.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_types.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'payment_methods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.activate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.deactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_provider_methods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_company_contacts.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.block': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.activate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_funding_settings.update': { paramsTuple?: []; params?: {} }
    'kyc_level.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_app_version.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device.update_push_token': { paramsTuple?: []; params?: {} }
    'business_device.update_push_token': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'team_management.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'role_management.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_types.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'payment_methods.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_provider_methods.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc_level.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_device.revoke_device': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'deviceId': ParamValue} }
    'admin_app_version.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device.revoke_device': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'business_session.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'role.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'roleId': ParamValue} }
    'member.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'memberId': ParamValue} }
    'business_device.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'collection_accounts.update': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'collection_accounts.toggle': { paramsTuple: [ParamValue]; params: {'reference': ParamValue} }
    'admin_organisations.set_payable': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.change_status': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.freeze_wallet': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_organisations.unfreeze_wallet': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'wallet.freeze': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'wallet.unfreeze': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'role.update': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'roleId': ParamValue} }
    'member.update_role': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'memberId': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}