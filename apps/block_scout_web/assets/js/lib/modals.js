import $ from 'jquery'

export function lockModal ($modal) {
  var $submitButton = $modal.find('.btn-add-full')
  $modal.find('.close-modal').attr('disabled', true)
  $modal.on('hide.bs.modal', e => {
    e.preventDefault()
    e.stopPropagation()
  })
  $submitButton.attr('disabled', true)
  $submitButton.html(`
    <span class="loading-spinner-small mr-2">
      <span class="loading-spinner-block-1"></span>
      <span class="loading-spinner-block-2"></span>
    </span>`)
}

export function unlockAndHideModal ($modal) {
  var $submitButton = $modal.find('.btn-add-full')
  $modal.unbind()
  $modal.modal('hide')
  $modal.find('.close-modal').attr('disabled', false)
  $submitButton.attr('disabled', false)
}

export function openErrorModal (title, text) {
  $('#errorStatusModal .modal-status-title').text(title)
  $('#errorStatusModal .modal-status-text').text(text)
  $('#errorStatusModal').modal('show')
}

export function openWarningModal (title, text) {
  $('#warningStatusModal .modal-status-title').text(title)
  $('#warningStatusModal .modal-status-text').text(text)
  $('#warningStatusModal').modal('show')
}

export function openQuestionModal (title, text, accept_text = 'Yes', except_text = 'No') {
  const modal = '#questionStatusModal'

  $(`${modal} .modal-status-title`).text(title)
  $(`${modal} .modal-status-text`).text(text)

  $(`${modal} .btn-line.accept .btn-line-text`).text(accept_text)
  $(`${modal} .btn-line.accept`).unbind('click')

  $(`${modal} .btn-line.except .btn-line-text`).text(except_text)
  $(`${modal} .btn-line.except`).unbind('click')

  $(modal).modal()
}

export function openSuccessModal (title, text) {
  $('#successStatusModal .modal-status-title').text(title)
  $('#successStatusModal .modal-status-text').text(text)
  $('#successStatusModal').modal('show')
}
