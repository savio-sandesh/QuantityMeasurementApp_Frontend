async function handleConversion() {
  const resultValue = document.getElementById('resultValue');
  const convertButton = document.getElementById('convertBtn');

  if (!resultValue || !convertButton) {
    return;
  }

  try {
    convertButton.disabled = true;
    convertButton.textContent = 'Converting...';

    const requestPayload = getQuantityInputDTO();
    const convertPayload = {
      thisQuantityDTO: {
        value: parseFloat(requestPayload.value),
        unit: requestPayload.fromUnit,
        measurementType: requestPayload.measurementType
      },
      thatQuantityDTO: {
        value: 0,
        unit: requestPayload.fromUnit,
        measurementType: requestPayload.measurementType
      },
      targetQuantityDTO: {
        value: 0,
        unit: requestPayload.toUnit,
        measurementType: requestPayload.measurementType
      }
    };

    console.log('Sending Convert Payload:', convertPayload);

    const response = await fetch('http://localhost:5111/api/v1/quantities/convert', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('jwtToken')}`
      },
      body: JSON.stringify(convertPayload)
    });

    if (!response.ok) {
      let errorMessage = 'Conversion failed. Please check your inputs.';

      try {
        const errorData = await response.json();
        errorMessage =
          errorData?.message || errorData?.error || errorData?.title || errorMessage;
      } catch (parseError) {
        // Ignore parsing failure and use fallback message.
      }

      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    console.log('--- BACKEND RESPONSE DATA ---', data);
    const convertedValue = extractConvertedValue(data);

    if (convertedValue === null || convertedValue === undefined) {
      console.log('Available keys in response:', data && typeof data === 'object' ? Object.keys(data) : []);
      throw new Error('Conversion API returned an invalid response.');
    }

    const numericValue = Number(convertedValue);
    if (!Number.isFinite(numericValue)) {
      console.log('Available keys in response:', data && typeof data === 'object' ? Object.keys(data) : []);
      throw new Error('Conversion API returned a non-numeric result.');
    }
    resultValue.textContent = `${formatResult(numericValue)} ${requestPayload.toUnit}`;
    await fetchHistory();
    await fetchDashboardStats();
  } catch (error) {
    if (handleUnauthorized(error)) {
      return;
    }

    console.error('Conversion failed:', error);
    resultValue.textContent = 'Conversion failed. Please check your inputs.';
  } finally {
    convertButton.disabled = false;
    convertButton.textContent = selectedOperation === OPERATIONS.CONVERT ? 'Convert' : 'Calculate';
  }
}

// Handles compare/add/subtract/divide while reusing shared DTO mapping.
async function performMath(operation) {
  const resultValue = document.getElementById('resultValue');
  const resultDisplay = document.getElementById('result-display') || resultValue;
  const convertButton = document.getElementById('convertBtn');

  if (!resultValue || !convertButton) {
    return;
  }

  try {
    convertButton.disabled = true;
    convertButton.textContent = 'Processing...';

    const requestPayload = getMathInputDTO();
    let payload = {
      thisQuantityDTO: {
        value: parseFloat(requestPayload.value1),
        unit: requestPayload.unit1,
        measurementType: requestPayload.measurementType
      },
      thatQuantityDTO: {
        value: parseFloat(requestPayload.value2),
        unit: requestPayload.unit2,
        measurementType: requestPayload.measurementType
      }
    };

    if ([OPERATIONS.ADD, OPERATIONS.SUBTRACT].includes(operation)) {
      payload.targetQuantityDTO = {
        value: 0,
        unit: requestPayload.toUnit || requestPayload.unit1,
        measurementType: requestPayload.measurementType
      };
    }

    if (operation === OPERATIONS.DIVIDE) {
      if (Number(requestPayload.value2) === 0) {
        alert('Cannot divide by zero');
        return;
      }

      const targetUnit =
        document.getElementById('target-unit-dropdown')?.value ||
        document.getElementById('toUnit')?.value ||
        requestPayload.unit1;

      payload = {
        firstQuantityDTO: {
          value: parseFloat(requestPayload.value1),
          unit: requestPayload.unit1
        },
        secondQuantityDTO: {
          value: parseFloat(requestPayload.value2),
          unit: requestPayload.unit2
        },
        targetUnit: formatUnitForApi(targetUnit),
        measurementType: formatMeasurementTypeForApi(currentCategory)
      };

      console.log('Sending Divide Payload:', payload);
    }

    if (operation === OPERATIONS.ADD) {
      console.log('Sending Add Payload:', payload);
    }

    const response = await fetch(`http://localhost:5111/api/v1/quantities/${operation}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('jwtToken')}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorMessage = 'Conversion failed. Please check your inputs.';

      try {
        const errorData = await response.json();
        errorMessage =
          errorData?.message || errorData?.error || errorData?.title || errorMessage;
      } catch (parseError) {
        // Ignore parsing failure and use fallback message.
      }

      const error = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    const data = await response.json();
    console.log('--- BACKEND RESPONSE DATA ---', data);

    if (operation === 'compare') {
      const compareResultLabel = resolveCompareLabel(data);
      resultDisplay.textContent = compareResultLabel;
    } else if (operation === OPERATIONS.DIVIDE) {
      const divideDisplay = document.getElementById('result-display') || resultDisplay;
      const divideValue = data?.resultValue ?? extractConvertedValue(data);
      const divideUnit = data?.targetUnit || data?.resultUnit || requestPayload.toUnit || requestPayload.unit1;
      divideDisplay.innerText = `${formatResult(divideValue)} ${divideUnit}`;
    } else {
      const mathResult = extractConvertedValue(data);
      const responseUnit = data?.targetUnit || data?.resultUnit || requestPayload.toUnit || requestPayload.unit1;
      resultDisplay.textContent = `${formatResult(mathResult)} ${responseUnit}`;
    }
    await fetchHistory();
    await fetchDashboardStats();
  } catch (error) {
    if (handleUnauthorized(error)) {
      return;
    }

    console.error('Math operation failed:', error);
    resultValue.textContent = 'Conversion failed. Please check your inputs.';
  } finally {
    convertButton.disabled = false;
    convertButton.textContent = selectedOperation === OPERATIONS.CONVERT ? 'Convert' : 'Calculate';
  }
}

function handleSubmit(event) {
  event.preventDefault();

  if (selectedMode === OPERATIONS.CONVERT) {
    handleConversion();
    return;
  }

  if (!isOperationAllowedForCategory(currentCategory, selectedMode)) {
    showToast('This operation is not supported for this category.');
    const resultValue = document.getElementById('resultValue');
    if (resultValue) {
      resultValue.textContent = 'This operation is not supported for this category.';
    }
    return;
  }

  performMath(selectedMode);
}

function handleLogout() {
  localStorage.clear();
  window.location.href = 'index.html';
}

function updateOperationForm(selectedMode) {
  const mainFields = document.getElementById('main-fields');
  const arithmeticFields = document.getElementById('arithmetic-fields');
  const mainUnitGrid = document.getElementById('mainUnitGrid');
  const toUnitField = document.getElementById('toUnitField');
  const inputValueLabel = document.getElementById('inputValueLabel');
  const fromUnitLabel = document.getElementById('fromUnitLabel');
  const inputValue2Label = document.getElementById('inputValue2Label');
  const fromUnit2Label = document.getElementById('fromUnit2Label');
  const toUnitLabel = document.getElementById('toUnitLabel');
  const resultCard = document.querySelector('.dashboard-metrics .result-card');

  const isConvertMode = selectedMode === OPERATIONS.CONVERT;
  const isArithmeticWithTarget = [OPERATIONS.ADD, OPERATIONS.SUBTRACT, OPERATIONS.DIVIDE].includes(
    selectedMode
  );

  if (mainFields) {
    mainFields.hidden = false;
  }

  if (arithmeticFields) {
    const shouldShowArithmetic = !isConvertMode;
    arithmeticFields.hidden = !shouldShowArithmetic;
    arithmeticFields.style.display = shouldShowArithmetic ? 'grid' : 'none';
  }

  if (toUnitField && mainUnitGrid && arithmeticFields) {
    if (isArithmeticWithTarget) {
      arithmeticFields.appendChild(toUnitField);
    } else {
      mainUnitGrid.appendChild(toUnitField);
    }
  }

  if (toUnitField) {
    toUnitField.hidden = !(isConvertMode || isArithmeticWithTarget);
  }

  if (mainUnitGrid) {
    mainUnitGrid.classList.toggle('single-column', !isConvertMode);
  }

  if (inputValueLabel) {
    inputValueLabel.textContent = isConvertMode ? 'Value' : 'First Value';
  }

  if (fromUnitLabel) {
    fromUnitLabel.textContent = isConvertMode ? 'From Unit' : 'First Unit';
  }

  if (toUnitLabel) {
    toUnitLabel.textContent = isArithmeticWithTarget ? 'Target Unit' : 'To Unit';
  }

  if (inputValue2Label) {
    inputValue2Label.textContent = 'Second Value';
  }

  if (fromUnit2Label) {
    fromUnit2Label.textContent = 'Second Unit';
  }

  if (resultCard) {
    resultCard.hidden = false;
  }
}

function initConverterPage() {
  if (!applyIntelligentAuthGuard()) {
    return;
  }

  if (!isConverterPage()) {
    return;
  }

  if (!checkAuth({ showAlert: false })) {
    return;
  }

  const converterForm = document.getElementById('converterForm');
  const convertButton = document.getElementById('convertBtn');
  const refreshHistoryButton = document.getElementById('refreshHistoryBtn');
  const logoutButton = document.getElementById('logoutBtn');
  const categoryButtons = document.querySelectorAll('.category-btn');
  const operationButtons = document.querySelectorAll('#operationSelector .operation-btn');
  const resultValue = document.getElementById('resultValue');

  if (!converterForm || !convertButton) {
    return;
  }

  const setOperation = (operation, options = {}) => {
    const { skipAllowedCheck = false, keepResult = false } = options;

    if (!skipAllowedCheck && !isOperationAllowedForCategory(currentCategory, operation)) {
      showToast('This operation is not supported for this category.');
      if (resultValue) {
        resultValue.textContent = 'This operation is not supported for this category.';
      }
      return false;
    }

    selectedMode = operation;
    selectedOperation = operation;

    operationButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.operation === operation);
    });

    const isMathOperation = operation !== OPERATIONS.CONVERT;
    updateOperationForm(operation);

    convertButton.textContent = isMathOperation ? 'Calculate' : 'Convert';
    updateActiveCategoryLabel();

    if (!keepResult && resultValue) {
      resultValue.textContent = isMathOperation
        ? 'Enter values and press Calculate'
        : 'Enter value and press Convert';
    }

    return true;
  };

  const renderAllowedOperations = (category) => {
    const allowedOperations = getAllowedOperationsForCategory(category);

    operationButtons.forEach((button) => {
      const operation = button.dataset.operation;
      const isAllowed = allowedOperations.includes(operation);
      button.hidden = !isAllowed;
      button.disabled = !isAllowed;
    });

    if (!isOperationAllowedForCategory(category, selectedOperation)) {
      setOperation(OPERATIONS.CONVERT, { skipAllowedCheck: true });
    }
  };

  updateDropdowns(currentCategory);
  renderAllowedOperations(currentCategory);
  setOperation(selectedOperation, { skipAllowedCheck: true });

  categoryButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const previousOperation = selectedOperation;

      categoryButtons.forEach((item) => {
        item.classList.remove('is-active');
        item.classList.remove('active');
      });
      button.classList.add('is-active');
      button.classList.add('active');

      const nextCategory = button.dataset.category || currentCategory;
      currentCategory = nextCategory;
      updateDropdowns(nextCategory);
      renderAllowedOperations(nextCategory);

      if (
        nextCategory === 'Temperature' &&
        [OPERATIONS.ADD, OPERATIONS.SUBTRACT, OPERATIONS.DIVIDE].includes(previousOperation)
      ) {
        setOperation(OPERATIONS.CONVERT, { skipAllowedCheck: true });
        return;
      }

      setOperation(selectedOperation, { skipAllowedCheck: true });
    });
  });

  operationButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setOperation(button.dataset.operation);
    });
  });

  converterForm.addEventListener('submit', handleSubmit);

  if (refreshHistoryButton) {
    refreshHistoryButton.addEventListener('click', fetchHistory);
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
  }

  fetchHistory();
  fetchDashboardStats();
}

