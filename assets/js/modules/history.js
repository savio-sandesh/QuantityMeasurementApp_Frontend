function formatHistoryDate(value) {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatHistoryInput(item) {
  const operation = String(item.operation || '').toUpperCase();
  const thisValue = item.thisValue ?? 0;
  const thisUnit = item.thisUnit || '';
  const secondValue = item.targetValue ?? item.thatValue ?? 0;
  const secondUnit = item.targetUnit || item.thatUnit || '';

  if (operation === 'CONVERT') {
    return `${thisValue} ${thisUnit} -> ${secondUnit}`;
  }

  if (operation === 'DIVIDE') {
    return `${thisValue} ${thisUnit} by ${secondValue}`;
  }

  if (operation === 'ADD' || operation === 'SUBTRACT' || operation === 'COMPARE') {
    return `${thisValue} ${thisUnit} and ${secondValue} ${secondUnit}`;
  }

  return `${thisValue} ${thisUnit}`;
}

function renderHistory(data) {
  const historyBody = document.getElementById('historyBody');
  historyBody.innerHTML = '';

  if (!data || data.length === 0) {
    historyBody.innerHTML = '<tr><td colspan="6" class="text-center">No history found</td></tr>';
    return;
  }

  try {
    data.forEach((item) => {
      try {
        const id = item.id || item.quantityId || 'N/A';
        const type = item.thisMeasurementType || 'N/A';
        const op = item.operation || 'CONVERT';
        const isCompare = String(item.operation || '').toUpperCase() === 'COMPARE';
        const isDivide = String(item.operation || '').toUpperCase() === 'DIVIDE';
        const input = formatHistoryInput(item);

        let result;
        if (isCompare) {
          result = resolveCompareLabel(item.resultValue);
        } else {
          const numericResult = parseFloat(item.resultValue || 0);
          const historyResultUnit =
            item.resultUnit || item.targetUnit || item.thatUnit || item.thisUnit || 'Unit';
          if (isDivide) {
            const divideValue = Number.isFinite(numericResult) ? numericResult.toFixed(4) : '0.0000';
            result = `${divideValue} ${historyResultUnit}`;
          } else {
            const normalizedValue = Number.isFinite(numericResult) ? numericResult.toFixed(4) : '0.0000';
            result = `${normalizedValue} ${historyResultUnit}`;
          }
        }

        const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A';

        const row = `
            <tr>
                <td>${id}</td>
                <td>${type}</td>
                <td>${op}</td>
                <td>${input}</td>
                <td>${result}</td>
                <td>${date}</td>
            </tr>
        `;
        historyBody.insertAdjacentHTML('beforeend', row);
      } catch (entryError) {
        console.error('History row render failed:', entryError);
      }
    });
  } catch (error) {
    console.error('History render failed:', error);
    historyBody.innerHTML = '<tr><td colspan="6" class="text-center">Unable to render history</td></tr>';
  }
}

// Pulls history from API and normalizes common response envelope shapes.
async function fetchHistory() {
  try {
    const authToken = getAuthToken();
    const response = await fetch(`${QUANTITY_BASE_URL}/history`, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + authToken
      }
    });

    if (!response.ok) {
      const error = new Error('Failed to fetch history.');
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    console.log('Raw History Data:', data);
    const historyItems = data?.data || data?.items || data;
    renderHistory(historyItems);
  } catch (error) {
    if (handleUnauthorized(error)) {
      return;
    }

    renderHistory([]);
  }
}

async function fetchDashboardStats() {
  const countElement = document.getElementById('operationsCount');

  if (!countElement) {
    return;
  }

  try {
    const response = await measurementService.getCount();
    const countValue =
      response?.count ??
      response?.totalOperations ??
      response?.data?.count ??
      response?.data?.totalOperations ??
      response?.data ??
      response;
    countElement.textContent = String(Number.isFinite(Number(countValue)) ? countValue : 0);
  } catch (error) {
    if (handleUnauthorized(error)) {
      return;
    }

    countElement.textContent = '0';
  }
}

