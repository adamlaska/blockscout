import $ from 'jquery'
import { openErrorModal, openWarningModal, openSuccessModal, lockModal, unlockAndHideModal } from '../../lib/modals'
import { makeContractCall, setupChart } from './utils'

export function openMakeStakeModal (event, store) {
  const address = $(event.target).closest('[data-address]').data('address')
  
  if (!store.getState().account) {
    openWarningModal('Unauthorized', 'Please login with MetaMask')
    return
  }

  store.getState().channel
    .push('render_make_stake', { address })
    .receive('ok', msg => {
      const $modal = $(msg.html)
      setupChart($modal.find('.js-stakes-progress'), msg.self_staked_amount, msg.staked_amount)
      $modal.find('form').submit(() => {
        makeStake($modal, address, store, msg)
        return false
      })
      $modal.modal()
    })
}

function makeStake ($modal, address, store, msg) {
  lockModal($modal)

  const amount = parseFloat(event.target[0].value)
  const stakingContract = store.getState().stakingContract
  
  if (amount < msg.min_delegator_stake) {
    openErrorModal('Error', `You cannot stake less than ${msg.min_delegator_stake} ${msg.token_symbol}`)
    return false
  }

  makeContractCall(stakingContract.methods.stake(poolAddress, amount * Math.pow(10, 18)))
}
