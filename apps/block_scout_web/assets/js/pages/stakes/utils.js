import $ from 'jquery'
import Chart from 'chart.js'

export function makeContractCall (call, store) {
  call.send({
    from: store.getState().account,
    gas: 400000,
    gasPrice: 1000000000
  })
    .on('receipt', _receipt => {
      refreshPage(store)
      openSuccessModal('Success', 'The transaction is created')
    })
    .on('error', err => {
      openErrorModal('Error', err.message)
    })
}

export function setupChart ($canvas, self, total) {
  const primaryColor = $('.btn-full-primary').css('background-color')
  const backgroundColors = [
    primaryColor,
    'rgba(202, 199, 226, 0.5)'
  ]
  const data = total > 0 ? [self, total - self] : [0, 1]

  new Chart($canvas, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: data,
        backgroundColor: backgroundColors,
        hoverBackgroundColor: backgroundColors,
        borderWidth: 0
      }]
    },
    options: {
      cutoutPercentage: 80,
      legend: {
        display: false
      },
      tooltips: {
        enabled: false
      }
    }
  })
}