import $ from 'jquery'

export function openDelegatorsListModal (event, store) {
  const address = $(event.target).closest('[data-address]').data('address')

  store.getState().channel
    .push('render_validator_info', { address })
    .receive('ok', msg => $(msg.html).modal())
}
