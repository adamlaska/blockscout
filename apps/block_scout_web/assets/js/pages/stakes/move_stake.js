import $ from 'jquery'
import { openErrorModal, openWarningModal, openSuccessModal, lockModal, unlockAndHideModal } from '../../lib/modals'
import { makeContractCall, setupChart } from './utils'

export function openMoveStakeModal (event, store) {
  const address = $(event.target).closest('[data-address]').data('address')
  
  store.getState().channel
    .push('render_move_stake', { address })
    .receive('ok', msg => {
      const $modal = $(msg.html)
      setupStakesProgress(msg.self_staked_amount, msg.staked_amount, $modal.find('.js-stakes-progress'))
      $modal.find('form').submit(() => {
        moveStake($modal, address, store, msg)
        return false
      })
      $modal.modal()
    })

    
    
    
    
    
// export async function openMoveStakeModal (poolAddress) {
//   const modal = '#moveStakeModal'
// 
//   try {
//     let response = await $.getJSON('/staking_pool', { 'pool_hash': poolAddress })
//     const pool = humps.camelizeKeys(response.pool)
//     const relation = humps.camelizeKeys(response.relation)
//     response = await $.getJSON('/staking_pools')
//     let pools = []
//     $.each(response.pools, (_key, pool) => {
//       let p = humps.camelizeKeys(pool)
//       if (p.stakingAddressHash !== poolAddress) {
//         pools.push(p)
//       }
//     })
// 
//     setProgressInfo(modal, pool)
//     $(`${modal} [user-staked]`).text(`${relation.stakeAmount} POA`)
//     $(`${modal} [max-allowed]`).text(`${relation.maxWithdrawAllowed} POA`)
// 
//     $.each($(`${modal} [pool-select] option:not(:first-child)`), (_, opt) => {
//       opt.remove()
//     })
//     $.each(pools, (_key, pool) => {
//       var $option = $('<option/>', {
//         value: pool.stakingAddressHash,
//         text: pool.stakingAddressHash.slice(0, 13)
//       })
//       $(`${modal} [pool-select]`).append($option)
//     })
//     $(`${modal} [pool-select]`).on('change', e => {
//       const selectedAddress = e.currentTarget.value
//       const amount = $(`${modal} [move-amount]`).val()
//       window.openMoveStakeSelectedModal(poolAddress, selectedAddress, amount, pools)
//       $(modal).modal('hide')
//     })
// 
//     $(modal).modal('show')
//   } catch (err) {
//     console.log(err)
//     $(modal).modal('hide')
//     openErrorModal('Error', 'Something went wrong')
//   }
}

window.openMoveStakeSelectedModal = async function (fromAddress, toAddress, amount = null, pools = []) {
  const modal = '#moveStakeModalSelected'
  let response = await $.getJSON('/staking_pool', { 'pool_hash': fromAddress })
  const fromPool = humps.camelizeKeys(response.pool)
  const relation = humps.camelizeKeys(response.relation)

  setProgressInfo(modal, fromPool, '.js-pool-from-progress')
  $(`${modal} [user-staked]`).text(`${relation.stakeAmount} POA`)
  $(`${modal} [max-allowed]`).text(`${relation.maxWithdrawAllowed} POA`)
  $(`${modal} [move-amount]`).val(amount)

  response = await $.getJSON('/staking_pool', { 'pool_hash': toAddress })
  const toPool = humps.camelizeKeys(response.pool)
  setProgressInfo(modal, toPool, '.js-pool-to-progress')

  $.each(pools, (_key, pool) => {
    var $option = $('<option/>', {
      value: pool.stakingAddressHash,
      text: pool.stakingAddressHash.slice(0, 13),
      selected: pool.stakingAddressHash === toAddress
    })
    $(`${modal} [pool-select]`).append($option)
  })
  $(`${modal} [pool-select]`).unbind('change')
  $(`${modal} [pool-select]`).on('change', e => {
    const selectedAddress = e.currentTarget.value
    const amount = $(`${modal} [move-amount]`).val()
    window.openMoveStakeSelectedModal(fromAddress, selectedAddress, amount)
  })

  $(`${modal} form`).unbind('submit')
  $(`${modal} form`).on('submit', e => moveStake(e, modal, fromAddress, toAddress))

  $(modal).modal('show')
}

function moveStake (e, modal, fromAddress, toAddress) {
  const amount = parseFloat(e.target[0].value)
  const allowed = parseFloat($(`${modal} [max-allowed]`).text())
  const minStake = parseInt($(modal).data('min-stake'))

  if (amount < minStake || amount > allowed) {
    $(modal).modal('hide')
    openErrorModal('Error', `You cannot stake less than ${minStake} POA20 and more than ${allowed} POA20`)
    return false
  }

  const contract = store.getState().stakingContract
  const account = store.getState().account
  var $submitButton = $(`${modal} .btn-add-full`)
  const buttonText = $submitButton.html()
  lockModal(modal)

  makeContractCall(contract.methods.moveStake(fromAddress, toAddress, amount * Math.pow(10, 18)))
}
