import $ from 'jquery'
import { refreshPage } from '../../lib/async_listing_load'
import { openErrorModal, openWarningModal, openSuccessModal, lockModal, unlockAndHideModal } from '../../lib/modals'
import { makeContractCall } from './utils'

export function openBecomeCandidateModal (store) {
  if (!store.getState().account) {
    openWarningModal('Unauthorized', 'Please login with MetaMask')
    return
  }

  store.getState().channel
    .push('render_become_candidate')
    .receive('ok', msg => {
      const $modal = $(msg.html)
      $modal.find('form').submit(() => {
        becomeCandidate($modal, store, msg)
        return false
      })
      $modal.modal()
    })
}

async function becomeCandidate ($modal, store, msg) {
  lockModal($modal)

  const web3 = store.getState().web3
  const stake = parseFloat($modal.find('[candidate-stake]').val()) * Math.pow(10, msg.token_decimals)
  const miningAddress = $modal.find('[mining-address]').val().toLowerCase()
  const stakingContract = store.getState().stakingContract
  const blockRewardContract = store.getState().blockRewardContract

  if (!stake || stake < msg.min_candidate_stake) {
    openErrorModal('Error', `You cannot stake less than ${msg.min_candidate_stake / Math.pow(10, msg.token_decimals)} ${msg.token_symbol}`)
    return false
  }

  if (miningAddress === store.getState().account || !web3.utils.isAddress(miningAddress)) {
    openErrorModal('Error', 'Invalid Mining Address')
    return false
  }

  try {
    if (!await stakingContract.methods.areStakeAndWithdrawAllowed().call()) {
      if (await blockRewardContract.methods.isSnapshotting().call()) {
        openErrorModal('Error', 'Stakes are not allowed at the moment. Please try again in a few blocks')
      } else {
        const epochEndSec = 0//$('[data-page="stakes"]').data('epoch-end-sec')
        const hours = Math.trunc(epochEndSec / 3600)
        const minutes = Math.trunc((epochEndSec % 3600) / 60)

        openErrorModal('Error', `Since the current staking epoch is finishing now, you will be able to place a stake during the next staking epoch. Please try again in ${hours} hours ${minutes} minutes`)
      }
      return false
    }
    
    makeContractCall(stakingContract.methods.addPool(stake, miningAddress))
  } catch (err) {
    openErrorModal('Error', err.message)
  }
}
