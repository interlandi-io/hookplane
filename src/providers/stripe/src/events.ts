import { EventDefinition } from '@hookplane/provider'
import Stripe from 'stripe'

export type StripeEvent = Stripe.Event.Type
export type ObjectOf<E extends StripeEvent> = Extract<
    Stripe.Event,
    { type: E }
>['data']['object']

// Generated using ts_ls 'Generate missing properties' code action and vim magic
export const StripeEvents: {
    [K in StripeEvent]: EventDefinition<ObjectOf<K>>
} = {
    'account.application.authorized': {} as EventDefinition<
        ObjectOf<'account.application.authorized'>
    >,
    'account.application.deauthorized': {} as EventDefinition<
        ObjectOf<'account.application.deauthorized'>
    >,
    'account.external_account.created': {} as EventDefinition<
        ObjectOf<'account.external_account.created'>
    >,
    'account.external_account.deleted': {} as EventDefinition<
        ObjectOf<'account.external_account.deleted'>
    >,
    'account.external_account.updated': {} as EventDefinition<
        ObjectOf<'account.external_account.updated'>
    >,
    'account.updated': {} as EventDefinition<ObjectOf<'account.updated'>>,
    'application_fee.created': {} as EventDefinition<
        ObjectOf<'application_fee.created'>
    >,
    'application_fee.refund.updated': {} as EventDefinition<
        ObjectOf<'application_fee.refund.updated'>
    >,
    'application_fee.refunded': {} as EventDefinition<
        ObjectOf<'application_fee.refunded'>
    >,
    'balance.available': {} as EventDefinition<ObjectOf<'balance.available'>>,
    'balance_settings.updated': {} as EventDefinition<
        ObjectOf<'balance_settings.updated'>
    >,
    'billing.alert.triggered': {} as EventDefinition<
        ObjectOf<'billing.alert.triggered'>
    >,
    'billing.credit_grant.created': {} as EventDefinition<
        ObjectOf<'billing.credit_grant.created'>
    >,
    'billing_portal.configuration.created': {} as EventDefinition<
        ObjectOf<'billing_portal.configuration.created'>
    >,
    'billing_portal.configuration.updated': {} as EventDefinition<
        ObjectOf<'billing_portal.configuration.updated'>
    >,
    'billing_portal.session.created': {} as EventDefinition<
        ObjectOf<'billing_portal.session.created'>
    >,
    'capability.updated': {} as EventDefinition<ObjectOf<'capability.updated'>>,
    'cash_balance.funds_available': {} as EventDefinition<
        ObjectOf<'cash_balance.funds_available'>
    >,
    'charge.captured': {} as EventDefinition<ObjectOf<'charge.captured'>>,
    'charge.dispute.closed': {} as EventDefinition<
        ObjectOf<'charge.dispute.closed'>
    >,
    'charge.dispute.created': {} as EventDefinition<
        ObjectOf<'charge.dispute.created'>
    >,
    'charge.dispute.funds_reinstated': {} as EventDefinition<
        ObjectOf<'charge.dispute.funds_reinstated'>
    >,
    'charge.dispute.funds_withdrawn': {} as EventDefinition<
        ObjectOf<'charge.dispute.funds_withdrawn'>
    >,
    'charge.dispute.updated': {} as EventDefinition<
        ObjectOf<'charge.dispute.updated'>
    >,
    'charge.expired': {} as EventDefinition<ObjectOf<'charge.expired'>>,
    'charge.failed': {} as EventDefinition<ObjectOf<'charge.failed'>>,
    'charge.pending': {} as EventDefinition<ObjectOf<'charge.pending'>>,
    'charge.refund.updated': {} as EventDefinition<
        ObjectOf<'charge.refund.updated'>
    >,
    'charge.refunded': {} as EventDefinition<ObjectOf<'charge.refunded'>>,
    'charge.succeeded': {} as EventDefinition<ObjectOf<'charge.succeeded'>>,
    'charge.updated': {} as EventDefinition<ObjectOf<'charge.updated'>>,
    'checkout.session.async_payment_failed': {} as EventDefinition<
        ObjectOf<'checkout.session.async_payment_failed'>
    >,
    'checkout.session.async_payment_succeeded': {} as EventDefinition<
        ObjectOf<'checkout.session.async_payment_succeeded'>
    >,
    'checkout.session.completed': {} as EventDefinition<
        ObjectOf<'checkout.session.completed'>
    >,
    'checkout.session.expired': {} as EventDefinition<
        ObjectOf<'checkout.session.expired'>
    >,
    'climate.order.canceled': {} as EventDefinition<
        ObjectOf<'climate.order.canceled'>
    >,
    'climate.order.created': {} as EventDefinition<
        ObjectOf<'climate.order.created'>
    >,
    'climate.order.delayed': {} as EventDefinition<
        ObjectOf<'climate.order.delayed'>
    >,
    'climate.order.delivered': {} as EventDefinition<
        ObjectOf<'climate.order.delivered'>
    >,
    'climate.order.product_substituted': {} as EventDefinition<
        ObjectOf<'climate.order.product_substituted'>
    >,
    'climate.product.created': {} as EventDefinition<
        ObjectOf<'climate.product.created'>
    >,
    'climate.product.pricing_updated': {} as EventDefinition<
        ObjectOf<'climate.product.pricing_updated'>
    >,
    'coupon.created': {} as EventDefinition<ObjectOf<'coupon.created'>>,
    'coupon.deleted': {} as EventDefinition<ObjectOf<'coupon.deleted'>>,
    'coupon.updated': {} as EventDefinition<ObjectOf<'coupon.updated'>>,
    'credit_note.created': {} as EventDefinition<
        ObjectOf<'credit_note.created'>
    >,
    'credit_note.updated': {} as EventDefinition<
        ObjectOf<'credit_note.updated'>
    >,
    'credit_note.voided': {} as EventDefinition<ObjectOf<'credit_note.voided'>>,
    'customer.created': {} as EventDefinition<ObjectOf<'customer.created'>>,
    'customer.deleted': {} as EventDefinition<ObjectOf<'customer.deleted'>>,
    'customer.discount.created': {} as EventDefinition<
        ObjectOf<'customer.discount.created'>
    >,
    'customer.discount.deleted': {} as EventDefinition<
        ObjectOf<'customer.discount.deleted'>
    >,
    'customer.discount.updated': {} as EventDefinition<
        ObjectOf<'customer.discount.updated'>
    >,
    'customer.source.created': {} as EventDefinition<
        ObjectOf<'customer.source.created'>
    >,
    'customer.source.deleted': {} as EventDefinition<
        ObjectOf<'customer.source.deleted'>
    >,
    'customer.source.expiring': {} as EventDefinition<
        ObjectOf<'customer.source.expiring'>
    >,
    'customer.source.updated': {} as EventDefinition<
        ObjectOf<'customer.source.updated'>
    >,
    'customer.subscription.created': {} as EventDefinition<
        ObjectOf<'customer.subscription.created'>
    >,
    'customer.subscription.deleted': {} as EventDefinition<
        ObjectOf<'customer.subscription.deleted'>
    >,
    'customer.subscription.paused': {} as EventDefinition<
        ObjectOf<'customer.subscription.paused'>
    >,
    'customer.subscription.pending_update_applied': {} as EventDefinition<
        ObjectOf<'customer.subscription.pending_update_applied'>
    >,
    'customer.subscription.pending_update_expired': {} as EventDefinition<
        ObjectOf<'customer.subscription.pending_update_expired'>
    >,
    'customer.subscription.resumed': {} as EventDefinition<
        ObjectOf<'customer.subscription.resumed'>
    >,
    'customer.subscription.trial_will_end': {} as EventDefinition<
        ObjectOf<'customer.subscription.trial_will_end'>
    >,
    'customer.subscription.updated': {} as EventDefinition<
        ObjectOf<'customer.subscription.updated'>
    >,
    'customer.tax_id.created': {} as EventDefinition<
        ObjectOf<'customer.tax_id.created'>
    >,
    'customer.tax_id.deleted': {} as EventDefinition<
        ObjectOf<'customer.tax_id.deleted'>
    >,
    'customer.tax_id.updated': {} as EventDefinition<
        ObjectOf<'customer.tax_id.updated'>
    >,
    'customer.updated': {} as EventDefinition<ObjectOf<'customer.updated'>>,
    'customer_cash_balance_transaction.created': {} as EventDefinition<
        ObjectOf<'customer_cash_balance_transaction.created'>
    >,
    'entitlements.active_entitlement_summary.updated': {} as EventDefinition<
        ObjectOf<'entitlements.active_entitlement_summary.updated'>
    >,
    'file.created': {} as EventDefinition<ObjectOf<'file.created'>>,
    'financial_connections.account.account_numbers_updated':
        {} as EventDefinition<
            ObjectOf<'financial_connections.account.account_numbers_updated'>
        >,
    'financial_connections.account.created': {} as EventDefinition<
        ObjectOf<'financial_connections.account.created'>
    >,
    'financial_connections.account.deactivated': {} as EventDefinition<
        ObjectOf<'financial_connections.account.deactivated'>
    >,
    'financial_connections.account.disconnected': {} as EventDefinition<
        ObjectOf<'financial_connections.account.disconnected'>
    >,
    'financial_connections.account.reactivated': {} as EventDefinition<
        ObjectOf<'financial_connections.account.reactivated'>
    >,
    'financial_connections.account.refreshed_balance': {} as EventDefinition<
        ObjectOf<'financial_connections.account.refreshed_balance'>
    >,
    'financial_connections.account.refreshed_ownership': {} as EventDefinition<
        ObjectOf<'financial_connections.account.refreshed_ownership'>
    >,
    'financial_connections.account.refreshed_transactions':
        {} as EventDefinition<
            ObjectOf<'financial_connections.account.refreshed_transactions'>
        >,
    'financial_connections.account.upcoming_account_number_expiry':
        {} as EventDefinition<
            ObjectOf<'financial_connections.account.upcoming_account_number_expiry'>
        >,
    'identity.verification_session.canceled': {} as EventDefinition<
        ObjectOf<'identity.verification_session.canceled'>
    >,
    'identity.verification_session.created': {} as EventDefinition<
        ObjectOf<'identity.verification_session.created'>
    >,
    'identity.verification_session.processing': {} as EventDefinition<
        ObjectOf<'identity.verification_session.processing'>
    >,
    'identity.verification_session.redacted': {} as EventDefinition<
        ObjectOf<'identity.verification_session.redacted'>
    >,
    'identity.verification_session.requires_input': {} as EventDefinition<
        ObjectOf<'identity.verification_session.requires_input'>
    >,
    'identity.verification_session.verified': {} as EventDefinition<
        ObjectOf<'identity.verification_session.verified'>
    >,
    'invoice.created': {} as EventDefinition<ObjectOf<'invoice.created'>>,
    'invoice.deleted': {} as EventDefinition<ObjectOf<'invoice.deleted'>>,
    'invoice.finalization_failed': {} as EventDefinition<
        ObjectOf<'invoice.finalization_failed'>
    >,
    'invoice.finalized': {} as EventDefinition<ObjectOf<'invoice.finalized'>>,
    'invoice.marked_uncollectible': {} as EventDefinition<
        ObjectOf<'invoice.marked_uncollectible'>
    >,
    'invoice.overdue': {} as EventDefinition<ObjectOf<'invoice.overdue'>>,
    'invoice.overpaid': {} as EventDefinition<ObjectOf<'invoice.overpaid'>>,
    'invoice.paid': {} as EventDefinition<ObjectOf<'invoice.paid'>>,
    'invoice.payment_action_required': {} as EventDefinition<
        ObjectOf<'invoice.payment_action_required'>
    >,
    'invoice.payment_attempt_required': {} as EventDefinition<
        ObjectOf<'invoice.payment_attempt_required'>
    >,
    'invoice.payment_failed': {} as EventDefinition<
        ObjectOf<'invoice.payment_failed'>
    >,
    'invoice.payment_succeeded': {} as EventDefinition<
        ObjectOf<'invoice.payment_succeeded'>
    >,
    'invoice.sent': {} as EventDefinition<ObjectOf<'invoice.sent'>>,
    'invoice.upcoming': {} as EventDefinition<ObjectOf<'invoice.upcoming'>>,
    'invoice.updated': {} as EventDefinition<ObjectOf<'invoice.updated'>>,
    'invoice.voided': {} as EventDefinition<ObjectOf<'invoice.voided'>>,
    'invoice.will_be_due': {} as EventDefinition<
        ObjectOf<'invoice.will_be_due'>
    >,
    'invoice_payment.paid': {} as EventDefinition<
        ObjectOf<'invoice_payment.paid'>
    >,
    'invoiceitem.created': {} as EventDefinition<
        ObjectOf<'invoiceitem.created'>
    >,
    'invoiceitem.deleted': {} as EventDefinition<
        ObjectOf<'invoiceitem.deleted'>
    >,
    'issuing_authorization.created': {} as EventDefinition<
        ObjectOf<'issuing_authorization.created'>
    >,
    'issuing_authorization.request': {} as EventDefinition<
        ObjectOf<'issuing_authorization.request'>
    >,
    'issuing_authorization.updated': {} as EventDefinition<
        ObjectOf<'issuing_authorization.updated'>
    >,
    'issuing_card.created': {} as EventDefinition<
        ObjectOf<'issuing_card.created'>
    >,
    'issuing_card.updated': {} as EventDefinition<
        ObjectOf<'issuing_card.updated'>
    >,
    'issuing_cardholder.created': {} as EventDefinition<
        ObjectOf<'issuing_cardholder.created'>
    >,
    'issuing_cardholder.updated': {} as EventDefinition<
        ObjectOf<'issuing_cardholder.updated'>
    >,
    'issuing_dispute.closed': {} as EventDefinition<
        ObjectOf<'issuing_dispute.closed'>
    >,
    'issuing_dispute.created': {} as EventDefinition<
        ObjectOf<'issuing_dispute.created'>
    >,
    'issuing_dispute.funds_reinstated': {} as EventDefinition<
        ObjectOf<'issuing_dispute.funds_reinstated'>
    >,
    'issuing_dispute.funds_rescinded': {} as EventDefinition<
        ObjectOf<'issuing_dispute.funds_rescinded'>
    >,
    'issuing_dispute.submitted': {} as EventDefinition<
        ObjectOf<'issuing_dispute.submitted'>
    >,
    'issuing_dispute.updated': {} as EventDefinition<
        ObjectOf<'issuing_dispute.updated'>
    >,
    'issuing_personalization_design.activated': {} as EventDefinition<
        ObjectOf<'issuing_personalization_design.activated'>
    >,
    'issuing_personalization_design.deactivated': {} as EventDefinition<
        ObjectOf<'issuing_personalization_design.deactivated'>
    >,
    'issuing_personalization_design.rejected': {} as EventDefinition<
        ObjectOf<'issuing_personalization_design.rejected'>
    >,
    'issuing_personalization_design.updated': {} as EventDefinition<
        ObjectOf<'issuing_personalization_design.updated'>
    >,
    'issuing_token.created': {} as EventDefinition<
        ObjectOf<'issuing_token.created'>
    >,
    'issuing_token.updated': {} as EventDefinition<
        ObjectOf<'issuing_token.updated'>
    >,
    'issuing_transaction.created': {} as EventDefinition<
        ObjectOf<'issuing_transaction.created'>
    >,
    'issuing_transaction.purchase_details_receipt_updated':
        {} as EventDefinition<
            ObjectOf<'issuing_transaction.purchase_details_receipt_updated'>
        >,
    'issuing_transaction.updated': {} as EventDefinition<
        ObjectOf<'issuing_transaction.updated'>
    >,
    'mandate.updated': {} as EventDefinition<ObjectOf<'mandate.updated'>>,
    'payment_intent.amount_capturable_updated': {} as EventDefinition<
        ObjectOf<'payment_intent.amount_capturable_updated'>
    >,
    'payment_intent.canceled': {} as EventDefinition<
        ObjectOf<'payment_intent.canceled'>
    >,
    'payment_intent.created': {} as EventDefinition<
        ObjectOf<'payment_intent.created'>
    >,
    'payment_intent.partially_funded': {} as EventDefinition<
        ObjectOf<'payment_intent.partially_funded'>
    >,
    'payment_intent.payment_failed': {} as EventDefinition<
        ObjectOf<'payment_intent.payment_failed'>
    >,
    'payment_intent.processing': {} as EventDefinition<
        ObjectOf<'payment_intent.processing'>
    >,
    'payment_intent.requires_action': {} as EventDefinition<
        ObjectOf<'payment_intent.requires_action'>
    >,
    'payment_intent.succeeded': {} as EventDefinition<
        ObjectOf<'payment_intent.succeeded'>
    >,
    'payment_link.created': {} as EventDefinition<
        ObjectOf<'payment_link.created'>
    >,
    'payment_link.updated': {} as EventDefinition<
        ObjectOf<'payment_link.updated'>
    >,
    'payment_method.attached': {} as EventDefinition<
        ObjectOf<'payment_method.attached'>
    >,
    'payment_method.automatically_updated': {} as EventDefinition<
        ObjectOf<'payment_method.automatically_updated'>
    >,
    'payment_method.detached': {} as EventDefinition<
        ObjectOf<'payment_method.detached'>
    >,
    'payment_method.updated': {} as EventDefinition<
        ObjectOf<'payment_method.updated'>
    >,
    'payout.canceled': {} as EventDefinition<ObjectOf<'payout.canceled'>>,
    'payout.created': {} as EventDefinition<ObjectOf<'payout.created'>>,
    'payout.failed': {} as EventDefinition<ObjectOf<'payout.failed'>>,
    'payout.paid': {} as EventDefinition<ObjectOf<'payout.paid'>>,
    'payout.reconciliation_completed': {} as EventDefinition<
        ObjectOf<'payout.reconciliation_completed'>
    >,
    'payout.updated': {} as EventDefinition<ObjectOf<'payout.updated'>>,
    'person.created': {} as EventDefinition<ObjectOf<'person.created'>>,
    'person.deleted': {} as EventDefinition<ObjectOf<'person.deleted'>>,
    'person.updated': {} as EventDefinition<ObjectOf<'person.updated'>>,
    'plan.created': {} as EventDefinition<ObjectOf<'plan.created'>>,
    'plan.deleted': {} as EventDefinition<ObjectOf<'plan.deleted'>>,
    'plan.updated': {} as EventDefinition<ObjectOf<'plan.updated'>>,
    'price.created': {} as EventDefinition<ObjectOf<'price.created'>>,
    'price.deleted': {} as EventDefinition<ObjectOf<'price.deleted'>>,
    'price.updated': {} as EventDefinition<ObjectOf<'price.updated'>>,
    'product.created': {} as EventDefinition<ObjectOf<'product.created'>>,
    'product.deleted': {} as EventDefinition<ObjectOf<'product.deleted'>>,
    'product.updated': {} as EventDefinition<ObjectOf<'product.updated'>>,
    'promotion_code.created': {} as EventDefinition<
        ObjectOf<'promotion_code.created'>
    >,
    'promotion_code.updated': {} as EventDefinition<
        ObjectOf<'promotion_code.updated'>
    >,
    'quote.accepted': {} as EventDefinition<ObjectOf<'quote.accepted'>>,
    'quote.canceled': {} as EventDefinition<ObjectOf<'quote.canceled'>>,
    'quote.created': {} as EventDefinition<ObjectOf<'quote.created'>>,
    'quote.finalized': {} as EventDefinition<ObjectOf<'quote.finalized'>>,
    'radar.early_fraud_warning.created': {} as EventDefinition<
        ObjectOf<'radar.early_fraud_warning.created'>
    >,
    'radar.early_fraud_warning.updated': {} as EventDefinition<
        ObjectOf<'radar.early_fraud_warning.updated'>
    >,
    'refund.created': {} as EventDefinition<ObjectOf<'refund.created'>>,
    'refund.failed': {} as EventDefinition<ObjectOf<'refund.failed'>>,
    'refund.updated': {} as EventDefinition<ObjectOf<'refund.updated'>>,
    'reporting.report_run.failed': {} as EventDefinition<
        ObjectOf<'reporting.report_run.failed'>
    >,
    'reporting.report_run.succeeded': {} as EventDefinition<
        ObjectOf<'reporting.report_run.succeeded'>
    >,
    'reporting.report_type.updated': {} as EventDefinition<
        ObjectOf<'reporting.report_type.updated'>
    >,
    'reserve.hold.created': {} as EventDefinition<
        ObjectOf<'reserve.hold.created'>
    >,
    'reserve.hold.updated': {} as EventDefinition<
        ObjectOf<'reserve.hold.updated'>
    >,
    'reserve.plan.created': {} as EventDefinition<
        ObjectOf<'reserve.plan.created'>
    >,
    'reserve.plan.disabled': {} as EventDefinition<
        ObjectOf<'reserve.plan.disabled'>
    >,
    'reserve.plan.expired': {} as EventDefinition<
        ObjectOf<'reserve.plan.expired'>
    >,
    'reserve.plan.updated': {} as EventDefinition<
        ObjectOf<'reserve.plan.updated'>
    >,
    'reserve.release.created': {} as EventDefinition<
        ObjectOf<'reserve.release.created'>
    >,
    'review.closed': {} as EventDefinition<ObjectOf<'review.closed'>>,
    'review.opened': {} as EventDefinition<ObjectOf<'review.opened'>>,
    'setup_intent.canceled': {} as EventDefinition<
        ObjectOf<'setup_intent.canceled'>
    >,
    'setup_intent.created': {} as EventDefinition<
        ObjectOf<'setup_intent.created'>
    >,
    'setup_intent.requires_action': {} as EventDefinition<
        ObjectOf<'setup_intent.requires_action'>
    >,
    'setup_intent.setup_failed': {} as EventDefinition<
        ObjectOf<'setup_intent.setup_failed'>
    >,
    'setup_intent.succeeded': {} as EventDefinition<
        ObjectOf<'setup_intent.succeeded'>
    >,
    'sigma.scheduled_query_run.created': {} as EventDefinition<
        ObjectOf<'sigma.scheduled_query_run.created'>
    >,
    'source.canceled': {} as EventDefinition<ObjectOf<'source.canceled'>>,
    'source.chargeable': {} as EventDefinition<ObjectOf<'source.chargeable'>>,
    'source.failed': {} as EventDefinition<ObjectOf<'source.failed'>>,
    'source.mandate_notification': {} as EventDefinition<
        ObjectOf<'source.mandate_notification'>
    >,
    'source.refund_attributes_required': {} as EventDefinition<
        ObjectOf<'source.refund_attributes_required'>
    >,
    'source.transaction.created': {} as EventDefinition<
        ObjectOf<'source.transaction.created'>
    >,
    'source.transaction.updated': {} as EventDefinition<
        ObjectOf<'source.transaction.updated'>
    >,
    'subscription_schedule.aborted': {} as EventDefinition<
        ObjectOf<'subscription_schedule.aborted'>
    >,
    'subscription_schedule.canceled': {} as EventDefinition<
        ObjectOf<'subscription_schedule.canceled'>
    >,
    'subscription_schedule.completed': {} as EventDefinition<
        ObjectOf<'subscription_schedule.completed'>
    >,
    'subscription_schedule.created': {} as EventDefinition<
        ObjectOf<'subscription_schedule.created'>
    >,
    'subscription_schedule.expiring': {} as EventDefinition<
        ObjectOf<'subscription_schedule.expiring'>
    >,
    'subscription_schedule.released': {} as EventDefinition<
        ObjectOf<'subscription_schedule.released'>
    >,
    'subscription_schedule.updated': {} as EventDefinition<
        ObjectOf<'subscription_schedule.updated'>
    >,
    'tax.settings.updated': {} as EventDefinition<
        ObjectOf<'tax.settings.updated'>
    >,
    'tax_rate.created': {} as EventDefinition<ObjectOf<'tax_rate.created'>>,
    'tax_rate.updated': {} as EventDefinition<ObjectOf<'tax_rate.updated'>>,
    'terminal.reader.action_failed': {} as EventDefinition<
        ObjectOf<'terminal.reader.action_failed'>
    >,
    'terminal.reader.action_succeeded': {} as EventDefinition<
        ObjectOf<'terminal.reader.action_succeeded'>
    >,
    'terminal.reader.action_updated': {} as EventDefinition<
        ObjectOf<'terminal.reader.action_updated'>
    >,
    'test_helpers.test_clock.advancing': {} as EventDefinition<
        ObjectOf<'test_helpers.test_clock.advancing'>
    >,
    'test_helpers.test_clock.created': {} as EventDefinition<
        ObjectOf<'test_helpers.test_clock.created'>
    >,
    'test_helpers.test_clock.deleted': {} as EventDefinition<
        ObjectOf<'test_helpers.test_clock.deleted'>
    >,
    'test_helpers.test_clock.internal_failure': {} as EventDefinition<
        ObjectOf<'test_helpers.test_clock.internal_failure'>
    >,
    'test_helpers.test_clock.ready': {} as EventDefinition<
        ObjectOf<'test_helpers.test_clock.ready'>
    >,
    'topup.canceled': {} as EventDefinition<ObjectOf<'topup.canceled'>>,
    'topup.created': {} as EventDefinition<ObjectOf<'topup.created'>>,
    'topup.failed': {} as EventDefinition<ObjectOf<'topup.failed'>>,
    'topup.reversed': {} as EventDefinition<ObjectOf<'topup.reversed'>>,
    'topup.succeeded': {} as EventDefinition<ObjectOf<'topup.succeeded'>>,
    'transfer.created': {} as EventDefinition<ObjectOf<'transfer.created'>>,
    'transfer.reversed': {} as EventDefinition<ObjectOf<'transfer.reversed'>>,
    'transfer.updated': {} as EventDefinition<ObjectOf<'transfer.updated'>>,
    'treasury.credit_reversal.created': {} as EventDefinition<
        ObjectOf<'treasury.credit_reversal.created'>
    >,
    'treasury.credit_reversal.posted': {} as EventDefinition<
        ObjectOf<'treasury.credit_reversal.posted'>
    >,
    'treasury.debit_reversal.completed': {} as EventDefinition<
        ObjectOf<'treasury.debit_reversal.completed'>
    >,
    'treasury.debit_reversal.created': {} as EventDefinition<
        ObjectOf<'treasury.debit_reversal.created'>
    >,
    'treasury.debit_reversal.initial_credit_granted': {} as EventDefinition<
        ObjectOf<'treasury.debit_reversal.initial_credit_granted'>
    >,
    'treasury.financial_account.closed': {} as EventDefinition<
        ObjectOf<'treasury.financial_account.closed'>
    >,
    'treasury.financial_account.created': {} as EventDefinition<
        ObjectOf<'treasury.financial_account.created'>
    >,
    'treasury.financial_account.features_status_updated': {} as EventDefinition<
        ObjectOf<'treasury.financial_account.features_status_updated'>
    >,
    'treasury.inbound_transfer.canceled': {} as EventDefinition<
        ObjectOf<'treasury.inbound_transfer.canceled'>
    >,
    'treasury.inbound_transfer.created': {} as EventDefinition<
        ObjectOf<'treasury.inbound_transfer.created'>
    >,
    'treasury.inbound_transfer.failed': {} as EventDefinition<
        ObjectOf<'treasury.inbound_transfer.failed'>
    >,
    'treasury.inbound_transfer.succeeded': {} as EventDefinition<
        ObjectOf<'treasury.inbound_transfer.succeeded'>
    >,
    'treasury.outbound_payment.canceled': {} as EventDefinition<
        ObjectOf<'treasury.outbound_payment.canceled'>
    >,
    'treasury.outbound_payment.created': {} as EventDefinition<
        ObjectOf<'treasury.outbound_payment.created'>
    >,
    'treasury.outbound_payment.expected_arrival_date_updated':
        {} as EventDefinition<
            ObjectOf<'treasury.outbound_payment.expected_arrival_date_updated'>
        >,
    'treasury.outbound_payment.failed': {} as EventDefinition<
        ObjectOf<'treasury.outbound_payment.failed'>
    >,
    'treasury.outbound_payment.posted': {} as EventDefinition<
        ObjectOf<'treasury.outbound_payment.posted'>
    >,
    'treasury.outbound_payment.returned': {} as EventDefinition<
        ObjectOf<'treasury.outbound_payment.returned'>
    >,
    'treasury.outbound_payment.tracking_details_updated': {} as EventDefinition<
        ObjectOf<'treasury.outbound_payment.tracking_details_updated'>
    >,
    'treasury.outbound_transfer.canceled': {} as EventDefinition<
        ObjectOf<'treasury.outbound_transfer.canceled'>
    >,
    'treasury.outbound_transfer.created': {} as EventDefinition<
        ObjectOf<'treasury.outbound_transfer.created'>
    >,
    'treasury.outbound_transfer.expected_arrival_date_updated':
        {} as EventDefinition<
            ObjectOf<'treasury.outbound_transfer.expected_arrival_date_updated'>
        >,
    'treasury.outbound_transfer.failed': {} as EventDefinition<
        ObjectOf<'treasury.outbound_transfer.failed'>
    >,
    'treasury.outbound_transfer.posted': {} as EventDefinition<
        ObjectOf<'treasury.outbound_transfer.posted'>
    >,
    'treasury.outbound_transfer.returned': {} as EventDefinition<
        ObjectOf<'treasury.outbound_transfer.returned'>
    >,
    'treasury.outbound_transfer.tracking_details_updated':
        {} as EventDefinition<
            ObjectOf<'treasury.outbound_transfer.tracking_details_updated'>
        >,
    'treasury.received_credit.created': {} as EventDefinition<
        ObjectOf<'treasury.received_credit.created'>
    >,
    'treasury.received_credit.failed': {} as EventDefinition<
        ObjectOf<'treasury.received_credit.failed'>
    >,
    'treasury.received_credit.succeeded': {} as EventDefinition<
        ObjectOf<'treasury.received_credit.succeeded'>
    >,
    'treasury.received_debit.created': {} as EventDefinition<
        ObjectOf<'treasury.received_debit.created'>
    >,
    'billing.credit_balance_transaction.created': {} as EventDefinition<
        ObjectOf<'billing.credit_balance_transaction.created'>
    >,
    'billing.credit_grant.updated': {} as EventDefinition<
        ObjectOf<'billing.credit_grant.updated'>
    >,
    'billing.meter.created': {} as EventDefinition<
        ObjectOf<'billing.meter.created'>
    >,
    'billing.meter.deactivated': {} as EventDefinition<
        ObjectOf<'billing.meter.deactivated'>
    >,
    'billing.meter.reactivated': {} as EventDefinition<
        ObjectOf<'billing.meter.reactivated'>
    >,
    'billing.meter.updated': {} as EventDefinition<
        ObjectOf<'billing.meter.updated'>
    >,
} as const
