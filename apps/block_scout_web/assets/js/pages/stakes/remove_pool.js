import $ from 'jquery'
import { openErrorModal, openWarningModal, openSuccessModal, lockModal, unlockAndHideModal } from '../../lib/modals'
import { makeContractCall } from './utils'

export function openRemovePoolModal () {
  const modal = '#questionStatusModal'
  $(`${modal} .modal-status-title`).text('Remove my Pool')
  $(`${modal} .modal-status-text`).text('Do you really want to remove your pool?')
  $(`${modal} .btn-line.accept`).unbind('click')
  $(`${modal} .btn-line.accept`).click(() => {
    removeMyPool(modal)
    return false
  })

  $(`${modal} .btn-line.except`).unbind('click')
  $(`${modal} .btn-line.except`).click(() => {
    $(modal).modal('hide')
  })
  $(modal).modal()
}

async function removeMyPool (el) {
  $(`${el} .close-modal`).attr('disabled', true)
  $(el).on('hide.bs.modal', e => {
    e.preventDefault()
    e.stopPropagation()
  })
  $(el).find('.btn-line').attr('disabled', true)

  const contract = store.getState().stakingContract
  const account = store.getState().account

  const unlockModal = function () {
    $(el).unbind()
    $(el).modal('hide')
    $(`${el} .close-modal`).attr('disabled', false)
    $(el).find('.btn-line').attr('disabled', false)
  }

  makeContractCall(contract.methods.removeMyPool())
}
