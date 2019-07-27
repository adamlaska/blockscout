import $ from 'jquery'
import { openErrorModal, openWarningModal, openQuestionModal, openSuccessModal, lockModal, unlockAndHideModal } from '../../lib/modals'
import { makeContractCall, setupChart } from './utils'

export function openWithdrawStakeModal (event, store) {
  const address = $(event.target).closest('[data-address]').data('address')

  const modal = '#questionStatusModal'

  openQuestionModal('Claim or order', 'Do you want withdraw or claim ordered withdraw?', 'Claim', 'Withdraw')

  $(`${modal} .btn-line.accept`).click(() => {
    window.openClaimModal(poolAddress)
    $(modal).modal('hide')
    return false
  })

  $(`${modal} .btn-line.except`).click(() => {
    window.openWithdrawModal(poolAddress)
    $(modal).modal('hide')
    return false
  })
}

window.openClaimModal = function (poolAddress) {
  const modal = '#claimModal'
  $.getJSON('/staking_pool', { 'pool_hash': poolAddress })
    .done(response => {
      const pool = humps.camelizeKeys(response.pool)
      setProgressInfo(modal, pool)
      const relation = humps.camelizeKeys(response.relation)

      $(`${modal} [ordered-amount]`).text(`${relation.orderedWithdraw} POA`)

      $(`${modal} form`).unbind('submit')
      $(`${modal} form`).on('submit', _ => claimWithdraw(modal, poolAddress))

      $(modal).modal()
    })
    .fail(() => {
      $(modal).modal()
      openErrorModal('Error', 'Something went wrong')
    })
}

window.openWithdrawModal = function (poolAddress) {
  const modal = '#withdrawModal'
  $.getJSON('/staking_pool', { 'pool_hash': poolAddress })
    .done(response => {
      const pool = humps.camelizeKeys(response.pool)
      setProgressInfo(modal, pool)
      const relation = humps.camelizeKeys(response.relation)

      $(`${modal} [user-staked]`).text(`${relation.stakeAmount} POA`)

      const $withdraw = $(`${modal} .btn-full-primary.withdraw`)
      const $order = $(`${modal} .btn-full-primary.order_withdraw`)

      $withdraw.attr('disabled', true)
      $order.attr('disabled', true)
      if (relation.maxWithdrawAllowed > 0) {
        $withdraw.attr('disabled', false)
      }
      if (relation.maxOrderedWithdrawAllowed > 0) {
        $order.attr('disabled', false)
      }

      $withdraw.unbind('click')
      $withdraw.on('click', e => withdrawOrOrderStake(e, modal, poolAddress, 'withdraw'))

      $order.unbind('click')
      $order.on('click', e => withdrawOrOrderStake(e, modal, poolAddress, 'order'))

      $(modal).modal()
    })
    .fail(() => {
      $(modal).modal()
      openErrorModal('Error', 'Something went wrong')
    })
}

function withdrawOrOrderStake (e, modal, poolAddress, method) {
  e.preventDefault()
  e.stopPropagation()
  const amount = parseFloat($(`${modal} [amount]`).val())

  const contract = store.getState().stakingContract
  const account = store.getState().account
  const $withdraw = $(`${modal} .btn-full-primary.withdraw`)
  const withdrawText = $withdraw.text()
  const $order = $(`${modal} .btn-full-primary.order_withdraw`)
  const orderText = $order.text()

  lockModal(modal)

  const weiVal = amount * Math.pow(10, 18)

  var contractMethod
  if (method === 'withdraw') {
    makeContractCall(contract.methods.withdraw(poolAddress, weiVal))
  } else {
    makeContractCall(contract.methods.orderWithdraw(poolAddress, weiVal))
  }
}

function claimWithdraw (modal, poolAddress) {
  const contract = store.getState().stakingContract
  const account = store.getState().account
  var $submitButton = $(`${modal} .btn-add-full`)
  const buttonText = $submitButton.html()
  lockModal(modal)

  makeContractCall(contract.methods.claimOrderedWithdraw(poolAddress))
}
