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
    'permission_management.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permission_management.store': { paramsTuple?: []; params?: {} }
    'permission_management.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permission_management.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'kyc.get_user_kyc': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.block': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.activate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.get_all_ledgers': { paramsTuple?: []; params?: {} }
    'ledgers.get_ledgers_stats': { paramsTuple?: []; params?: {} }
    'kyc_level.index': { paramsTuple?: []; params?: {} }
    'kyc_level.store': { paramsTuple?: []; params?: {} }
    'kyc_level.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc_level.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc.index': { paramsTuple?: []; params?: {} }
    'kyc.stats': { paramsTuple?: []; params?: {} }
    'kyc.kyc_details': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc.process': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'admin_wallet.activate': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'admin_wallet.deactivate': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'admin_wallet_adjustment.list': { paramsTuple?: []; params?: {} }
    'admin_wallet_adjustment.execute': { paramsTuple?: []; params?: {} }
    'admin_audit.list': { paramsTuple?: []; params?: {} }
    'admin_audit.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'kyc_submittion.submit_kyc_documents': { paramsTuple?: []; params?: {} }
    'app_version.check': { paramsTuple?: []; params?: {} }
    'device.get_user_devices': { paramsTuple?: []; params?: {} }
    'device.update_push_token': { paramsTuple?: []; params?: {} }
    'device.revoke_device': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'debit_phone.index': { paramsTuple?: []; params?: {} }
    'debit_phone.store': { paramsTuple?: []; params?: {} }
    'debit_phone.verify': { paramsTuple?: []; params?: {} }
    'debit_phone.resend': { paramsTuple?: []; params?: {} }
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
    'payable_alias.resolve': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'health': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'team_management.index': { paramsTuple?: []; params?: {} }
    'role_management.index': { paramsTuple?: []; params?: {} }
    'role_management.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permission_management.index': { paramsTuple?: []; params?: {} }
    'permission_management.all': { paramsTuple?: []; params?: {} }
    'permission_management.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'kyc.get_user_kyc': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.get_all_ledgers': { paramsTuple?: []; params?: {} }
    'ledgers.get_ledgers_stats': { paramsTuple?: []; params?: {} }
    'kyc_level.index': { paramsTuple?: []; params?: {} }
    'kyc.index': { paramsTuple?: []; params?: {} }
    'kyc.stats': { paramsTuple?: []; params?: {} }
    'kyc.kyc_details': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_device.get_devices': { paramsTuple?: []; params?: {} }
    'admin_device.get_user_devices': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'admin_device.get_device_details': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_device_accounts': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_transaction_summary': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_device_transactions': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_app_version.index': { paramsTuple?: []; params?: {} }
    'admin_app_version.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_wallet_adjustment.list': { paramsTuple?: []; params?: {} }
    'admin_audit.list': { paramsTuple?: []; params?: {} }
    'admin_audit.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'app_version.check': { paramsTuple?: []; params?: {} }
    'device.get_user_devices': { paramsTuple?: []; params?: {} }
    'debit_phone.index': { paramsTuple?: []; params?: {} }
    'business_health': { paramsTuple?: []; params?: {} }
    'organisation.index': { paramsTuple?: []; params?: {} }
    'permission.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'role.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'member.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'invitation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'payable_alias.resolve': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'health': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'drive.fs.serve': { paramsTuple: [...ParamValue[]]; params: {'*': ParamValue[]} }
    'team_management.index': { paramsTuple?: []; params?: {} }
    'role_management.index': { paramsTuple?: []; params?: {} }
    'role_management.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permission_management.index': { paramsTuple?: []; params?: {} }
    'permission_management.all': { paramsTuple?: []; params?: {} }
    'permission_management.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'kyc.get_user_kyc': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'ledgers.get_all_ledgers': { paramsTuple?: []; params?: {} }
    'ledgers.get_ledgers_stats': { paramsTuple?: []; params?: {} }
    'kyc_level.index': { paramsTuple?: []; params?: {} }
    'kyc.index': { paramsTuple?: []; params?: {} }
    'kyc.stats': { paramsTuple?: []; params?: {} }
    'kyc.kyc_details': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_device.get_devices': { paramsTuple?: []; params?: {} }
    'admin_device.get_user_devices': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'admin_device.get_device_details': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_device_accounts': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_transaction_summary': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_device.get_device_transactions': { paramsTuple: [ParamValue]; params: {'deviceId': ParamValue} }
    'admin_app_version.index': { paramsTuple?: []; params?: {} }
    'admin_app_version.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_wallet_adjustment.list': { paramsTuple?: []; params?: {} }
    'admin_audit.list': { paramsTuple?: []; params?: {} }
    'admin_audit.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
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
    'app_version.check': { paramsTuple?: []; params?: {} }
    'device.get_user_devices': { paramsTuple?: []; params?: {} }
    'debit_phone.index': { paramsTuple?: []; params?: {} }
    'business_health': { paramsTuple?: []; params?: {} }
    'organisation.index': { paramsTuple?: []; params?: {} }
    'permission.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'role.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'member.index': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'invitation.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'payable_alias.resolve': { paramsTuple: [ParamValue]; params: {'code': ParamValue} }
    'health': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'admin_management.login': { paramsTuple?: []; params?: {} }
    'admin_management.refresh': { paramsTuple?: []; params?: {} }
    'admin_management.setup_password': { paramsTuple?: []; params?: {} }
    'admin_management.verify_otp': { paramsTuple?: []; params?: {} }
    'team_management.store': { paramsTuple?: []; params?: {} }
    'role_management.store': { paramsTuple?: []; params?: {} }
    'permission_management.store': { paramsTuple?: []; params?: {} }
    'service_types.store': { paramsTuple?: []; params?: {} }
    'payment_methods.store': { paramsTuple?: []; params?: {} }
    'providers.store': { paramsTuple?: []; params?: {} }
    'service_provider_methods.store': { paramsTuple?: []; params?: {} }
    'admin_refund.execute': { paramsTuple?: []; params?: {} }
    'kyc_level.store': { paramsTuple?: []; params?: {} }
    'kyc.process': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_app_version.store': { paramsTuple?: []; params?: {} }
    'admin_wallet_adjustment.execute': { paramsTuple?: []; params?: {} }
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
    'organisation.store': { paramsTuple?: []; params?: {} }
    'role.store': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'member.store': { paramsTuple: [ParamValue]; params: {'organisationId': ParamValue} }
    'member.resend': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'memberId': ParamValue} }
    'invitation.accept': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'invitation.decline': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
  }
  PUT: {
    'team_management.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'role_management.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permission_management.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_types.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'payment_methods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.activate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.deactivate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_provider_methods.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_company_contacts.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.block': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'users.activate': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc_level.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_app_version.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_wallet.activate': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'admin_wallet.deactivate': { paramsTuple: [ParamValue]; params: {'userId': ParamValue} }
    'device.update_push_token': { paramsTuple?: []; params?: {} }
  }
  DELETE: {
    'team_management.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'role_management.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'permission_management.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_types.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'payment_methods.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'providers.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'service_provider_methods.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'kyc_level.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin_device.revoke_device': { paramsTuple: [ParamValue,ParamValue]; params: {'userId': ParamValue,'deviceId': ParamValue} }
    'admin_app_version.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'device.revoke_device': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'role.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'roleId': ParamValue} }
    'member.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'memberId': ParamValue} }
  }
  PATCH: {
    'role.update': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'roleId': ParamValue} }
    'member.update_role': { paramsTuple: [ParamValue,ParamValue]; params: {'organisationId': ParamValue,'memberId': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}