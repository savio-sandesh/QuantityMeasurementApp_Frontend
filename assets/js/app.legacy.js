class AuthService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async register(payload) {
    const response = await fetch(`${this.baseUrl}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    return this.handleResponse(response);
  }

  async login(payload) {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await this.handleResponse(response);
    const token = data?.token || data?.jwtToken || data?.accessToken;

    if (!token) {
      throw new Error('Login succeeded but token was not returned by the server.');
    }

    this.storeToken(token);
    return data;
  }

  storeToken(token) {
    localStorage.setItem('jwtToken', token);
  }

  async handleResponse(response) {
    let data;

    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (response.ok) {
      return data;
    }

    const serverMessage = data?.message || data?.error || data?.title;
    const statusMap = {
      400: serverMessage || 'Invalid request. Please verify your input fields.',
      401: serverMessage || 'Invalid credentials. Please check email and password.',
      500: serverMessage || 'Server error occurred. Please try again later.'
    };

    throw new Error(statusMap[response.status] || serverMessage || 'Unexpected error occurred.');
  }
}

// Determines whether the current page is a dashboard route that requires authentication.
function requiresDashboardAuth() {
  const bodyFlag = document.body?.dataset?.requiresAuth === 'true';
  return bodyFlag || window.location.pathname.toLowerCase().endsWith('converter.html');
}

function getAuthToken() {
  return localStorage.getItem('token') || localStorage.getItem('jwtToken');
}

function getCurrentPageName() {
  const page = window.location.pathname.split('/').pop().toLowerCase();
  return page || 'index.html';
}

function applyIntelligentAuthGuard() {
  const currentPage = getCurrentPageName();
  const token = getAuthToken();

  if ((currentPage === 'index.html') && token) {
    window.location.href = 'converter.html';
    return false;
  }

  if (currentPage === 'converter.html' && !token) {
    window.location.href = 'index.html';
    return false;
  }

  return true;
}

class MeasurementService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  getAuthHeaders() {
    const token = getAuthToken();

    if (!token) {
      const tokenError = new Error('Session expired. Please login again.');
      tokenError.status = 401;
      throw tokenError;
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    };
  }

  async sendRequest(endpoint, method, payload) {
    const config = {
      method,
      headers: this.getAuthHeaders()
    };

    if (payload) {
      config.body = JSON.stringify(payload);
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, config);
    return this.handleResponse(response);
  }

  async convert(data) {
    return this.sendRequest('/convert', 'POST', data);
  }

  async compare(data) {
    return this.sendRequest('/compare', 'POST', data);
  }

  async add(data) {
    return this.sendRequest('/add', 'POST', data);
  }

  async getHistory() {
    return this.sendRequest('/history', 'GET');
  }

  async getCount() {
    return this.sendRequest('/count', 'GET');
  }

  async handleResponse(response) {
    let data;

    try {
      data = await response.json();
    } catch (error) {
      data = null;
    }

    if (response.ok) {
      return data;
    }

    const serverMessage = data?.message || data?.error || data?.title;
    const statusMap = {
      400: serverMessage || 'Invalid conversion request. Please verify your input.',
      401: serverMessage || 'Unauthorized. Please login again.',
      500: serverMessage || 'Server error occurred while converting. Please try again later.'
    };
    const error = new Error(statusMap[response.status] || serverMessage || 'Unexpected conversion error.');
    error.status = response.status;
    throw error;
  }
}

// API base URLs are centralized to simplify local environment configuration.
const BASE_URL = 'http://localhost:5111/api/v1/auth';
const QUANTITY_BASE_URL = 'http://localhost:5111/api/v1/quantities';

const authService = new AuthService(BASE_URL);
const measurementService = new MeasurementService(QUANTITY_BASE_URL);
const tabButtons = document.querySelectorAll('.tab-button');
const forms = {
  login: document.getElementById('loginForm'),
  signup: document.getElementById('signupForm')
};
const formMessages = {
  login: document.getElementById('loginMessage'),
  signup: document.getElementById('signupMessage')
};

const unitMapping = {
  Length: ['Feet', 'Inch', 'Yard', 'Centimeter'],
  Temperature: ['Celsius', 'Fahrenheit', 'Kelvin'],
  Volume: ['Litre', 'Milliliter', 'Gallon'],
  Weight: ['Kilogram', 'Gram', 'Pound']
};

let currentCategory = 'Length';
let selectedOperation = 'convert';
let selectedMode = 'convert';
let authAlertShown = false;

const OPERATIONS = Object.freeze({
  CONVERT: 'convert',
  COMPARE: 'compare',
  ADD: 'add',
  SUBTRACT: 'subtract',
  DIVIDE: 'divide'
});

const CATEGORY_ALLOWED_OPERATIONS = Object.freeze({
  Length: [OPERATIONS.CONVERT, OPERATIONS.COMPARE, OPERATIONS.ADD, OPERATIONS.SUBTRACT, OPERATIONS.DIVIDE],
  Volume: [OPERATIONS.CONVERT, OPERATIONS.COMPARE, OPERATIONS.ADD, OPERATIONS.SUBTRACT, OPERATIONS.DIVIDE],
  Weight: [OPERATIONS.CONVERT, OPERATIONS.COMPARE, OPERATIONS.ADD, OPERATIONS.SUBTRACT, OPERATIONS.DIVIDE],
  Temperature: [OPERATIONS.CONVERT, OPERATIONS.COMPARE]
});

const OPERATION_LABELS = Object.freeze({
  [OPERATIONS.CONVERT]: 'Conversion',
  [OPERATIONS.COMPARE]: 'Equality',
  [OPERATIONS.ADD]: 'Addition',
  [OPERATIONS.SUBTRACT]: 'Subtraction',
  [OPERATIONS.DIVIDE]: 'Division'
});

function getAllowedOperationsForCategory(category) {
  const allowed = CATEGORY_ALLOWED_OPERATIONS[category];
  return Array.isArray(allowed) ? allowed : CATEGORY_ALLOWED_OPERATIONS.Length;
}

function isOperationAllowedForCategory(category, operation) {
  if (!operation) {
    return false;
  }

  return getAllowedOperationsForCategory(category).includes(operation);
}

function getOperationLabel(operation) {
  return OPERATION_LABELS[operation] || OPERATION_LABELS[OPERATIONS.CONVERT];
}

function updateActiveCategoryLabel() {
  const categoryLabel = document.getElementById('activeCategoryLabel');

  if (!categoryLabel) {
    return;
  }

  categoryLabel.textContent = `${currentCategory} ${getOperationLabel(selectedOperation)}`;
}

function decodeJwtPayload(token) {
  const parts = token.split('.');

  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (error) {
    return null;
  }
}

function isTokenExpired(token) {
  const payload = decodeJwtPayload(token);

  if (!payload || typeof payload.exp !== 'number') {
    return false;
  }

  return Date.now() >= payload.exp * 1000;
}

// Lightweight toast utility for non-blocking feedback messages.
function showToast(message, tone = 'error') {
  const toastHost = document.getElementById('toastHost');

  if (!toastHost) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${tone}`;
  toast.textContent = message;
  toastHost.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  const timeout = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 250);
  }, 2200);

  toast.addEventListener('click', () => {
    clearTimeout(timeout);
    toast.remove();
  });
}

// Validates token presence/expiry before allowing protected dashboard interactions.
function checkAuth(options = {}) {
  const token = getAuthToken();
  const shouldAlert = options.showAlert !== false;

  if (!token) {
    if (shouldAlert && !authAlertShown) {
      showToast('Access Denied! Please login first.');
      authAlertShown = true;
      setTimeout(() => {
        window.location.href = 'index.html';
      }, 800);
      return false;
    }
    window.location.href = 'index.html';
    return false;
  }

  if (isTokenExpired(token)) {
    localStorage.removeItem('token');
    localStorage.removeItem('jwtToken');
    window.location.href = 'index.html';
    return false;
  }

  return true;
}

function isConverterPage() {
  return window.location.pathname.toLowerCase().endsWith('converter.html');
}

function getElementByIds(ids) {
  for (const id of ids) {
    const element = document.getElementById(id);
    if (element) {
      return element;
    }
  }

  return null;
}

function getUnitDropdownElements() {
  const fromUnit = getElementByIds(['from-unit-select', 'fromUnit']);
  const toUnit = getElementByIds(['to-unit-select', 'toUnit']);
  const targetUnit = getElementByIds(['target-unit-dropdown', 'toUnit']);
  const secondUnit = getElementByIds(['second-unit-select', 'fromUnit2']);

  return {
    fromUnit,
    toUnit,
    targetUnit,
    secondUnit
  };
}

function resetConverterInputs() {
  const inputValue = document.getElementById('inputValue');
  const inputValue2 = document.getElementById('inputValue2');
  const resultValue = document.getElementById('resultValue');

  if (inputValue) {
    inputValue.value = '';
  }

  if (inputValue2) {
    inputValue2.value = '';
  }

  if (resultValue) {
    resultValue.textContent = selectedOperation === OPERATIONS.CONVERT
      ? 'Enter value and press Convert'
      : 'Enter values and press Calculate';
  }
}

function updateDropdowns(category) {
  const { fromUnit, toUnit, targetUnit, secondUnit } = getUnitDropdownElements();
  const units = unitMapping[category];

  if (!fromUnit || !toUnit || !units) {
    return;
  }

  currentCategory = category;
  const dropdowns = [fromUnit, toUnit, targetUnit, secondUnit].filter(Boolean);
  const uniqueDropdowns = [...new Set(dropdowns)];

  uniqueDropdowns.forEach((dropdown) => {
    dropdown.innerHTML = '';
  });

  units.forEach((unit) => {
    uniqueDropdowns.forEach((dropdown) => {
      const option = document.createElement('option');
      option.value = unit;
      option.textContent = unit;
      dropdown.appendChild(option);
    });
  });

  if (units.length > 1) {
    toUnit.value = units[1];
    if (targetUnit && targetUnit !== toUnit) {
      targetUnit.value = units[1];
    }
  }

  if (secondUnit) {
    secondUnit.value = units[0];
  }

  resetConverterInputs();

  updateActiveCategoryLabel();
}

function formatResult(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 'Invalid conversion result';
  }

  return Number(numericValue.toFixed(6)).toString();
}

function extractConvertedValue(data) {
  if (data === null || data === undefined) {
    return null;
  }

  if (typeof data === 'number' || typeof data === 'boolean') {
    return data;
  }

  const result = data.result ?? data.value ?? data.resultValue ?? data.thatValue;

  if (result !== undefined && result !== null) {
    return result;
  }

  const text = String(data).toLowerCase();
  if (text === 'true') {
    return true;
  }

  if (text === 'false') {
    return false;
  }

  return null;
}

function capitalizeFirstLetter(value) {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return trimmed;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

const UNIT_API_ALIASES = Object.freeze({
  foot: 'Feet',
  feet: 'Feet',
  inch: 'Inch',
  inches: 'Inch',
  litre: 'Litre',
  liter: 'Litre',
  milliliter: 'Millilitre',
  milliliters: 'Millilitre',
  millilitre: 'Millilitre',
  millilitres: 'Millilitre',
  mililiter: 'Millilitre',
  mililitre: 'Millilitre'
});

function formatMeasurementTypeForApi(category) {
  return String(category || '').trim().toLowerCase();
}

function formatUnitForApi(unit) {
  const trimmed = String(unit || '').trim();

  if (!trimmed) {
    return trimmed;
  }

  const alias = UNIT_API_ALIASES[trimmed.toLowerCase()];

  if (alias) {
    return alias;
  }

  return capitalizeFirstLetter(trimmed);
}

function getQuantityInputDTO() {
  const inputValue = document.getElementById('inputValue');
  const { fromUnit, toUnit } = getUnitDropdownElements();

  if (!inputValue || !fromUnit || !toUnit) {
    throw new Error('Converter form controls are missing.');
  }

  const numericValue = Number(inputValue.value);

  if (!inputValue.value || Number.isNaN(numericValue)) {
    throw new Error('Please enter a valid numeric value.');
  }

  return {
    value: numericValue,
    fromUnit: formatUnitForApi(fromUnit.value),
    toUnit: formatUnitForApi(toUnit.value),
    measurementType: formatMeasurementTypeForApi(currentCategory)
  };
}

function getMathInputDTO() {
  const inputValue = document.getElementById('inputValue');
  const inputValue2 = document.getElementById('inputValue2');
  const { fromUnit, secondUnit, targetUnit } = getUnitDropdownElements();

  if (!inputValue || !inputValue2 || !fromUnit || !secondUnit) {
    throw new Error('Math form controls are missing.');
  }

  const numericValue1 = Number(inputValue.value);
  const numericValue2 = Number(inputValue2.value);

  if (!inputValue.value || Number.isNaN(numericValue1)) {
    throw new Error('Please enter a valid first value.');
  }

  if (!inputValue2.value || Number.isNaN(numericValue2)) {
    throw new Error('Please enter a valid second value.');
  }

  return {
    value1: numericValue1,
    unit1: formatUnitForApi(fromUnit.value),
    value2: numericValue2,
    unit2: formatUnitForApi(secondUnit.value),
    toUnit: targetUnit ? formatUnitForApi(targetUnit.value) : formatUnitForApi(fromUnit.value),
    measurementType: formatMeasurementTypeForApi(currentCategory)
  };
}

function handleUnauthorized(error) {
  if (error.status === 401) {
    localStorage.removeItem('token');
    localStorage.removeItem('jwtToken');
    window.location.href = 'index.html';
    return true;
  }

  return false;
}

function resolveCompareLabel(compareRaw) {
  if (compareRaw && typeof compareRaw === 'object') {
    const nestedCompareValue =
      compareRaw.result ??
      compareRaw.resultValue ??
      compareRaw.comparisonResult ??
      compareRaw.data?.result ??
      compareRaw.data?.resultValue ??
      compareRaw.data?.comparisonResult;

    if (nestedCompareValue !== undefined) {
      return resolveCompareLabel(nestedCompareValue);
    }
  }

  const normalized = typeof compareRaw === 'string' ? compareRaw.trim().toLowerCase() : compareRaw;

  if (
    normalized === 1 ||
    normalized === true ||
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'equal' ||
    normalized === 'equals'
  ) {
    return 'Equal';
  }

  if (
    normalized === 0 ||
    normalized === false ||
    normalized === '0' ||
    normalized === 'false' ||
    normalized === 'not equal' ||
    normalized === 'notequal'
  ) {
    return 'Not Equal';
  }

  return 'Unable to determine';
}

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

function showFormMessage(formName, message, isSuccess) {
  const messageElement = formMessages[formName];

  if (!messageElement) {
    return;
  }

  messageElement.textContent = message;
  messageElement.classList.toggle('success', Boolean(isSuccess));
}

function clearFormMessage(formName) {
  showFormMessage(formName, '', false);
}

function setActiveTab(tabName) {
  tabButtons.forEach((button) => {
    const isActive = button.dataset.target === tabName;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  Object.entries(forms).forEach(([name, form]) => {
    const shouldShow = name === tabName;
    form.classList.toggle('is-active', shouldShow);
    form.hidden = !shouldShow;
    form.setAttribute('aria-hidden', String(!shouldShow));
    clearFormMessage(name);
  });
}

function setLoadingState(form, isLoading) {
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = isLoading;
  submitButton.textContent = isLoading ? 'Please wait...' : submitButton.dataset.defaultText;
}

function parseFormData(form) {
  const formData = new FormData(form);
  return Object.fromEntries(formData.entries());
}

function validateSignupForm(payload) {
  if (!payload.fullName || payload.fullName.trim().length < 3) {
    return 'Full Name must have at least 3 characters.';
  }

  if (!payload.email) {
    return 'Email Id is required.';
  }

  if (!payload.password || payload.password.length < 6) {
    return 'Password must be at least 6 characters.';
  }

  return '';
}

function validateLoginForm(payload) {
  if (!payload.email) {
    return 'Email Id is required.';
  }

  if (!payload.password) {
    return 'Password is required.';
  }

  return '';
}

async function handleSignup(event) {
  event.preventDefault();
  const form = forms.signup;
  const formData = parseFormData(form);
  const payload = {
    fullName: formData.fullName,
    email: formData.email,
    password: formData.password,
    role: 'User'
  };
  const validationMessage = validateSignupForm(payload);

  if (validationMessage) {
    showFormMessage('signup', validationMessage, false);
    return;
  }

  try {
    clearFormMessage('signup');
    setLoadingState(form, true);
    await authService.register(payload);
    showFormMessage('signup', 'Signup successful. You can now log in.', true);
    form.reset();
    setActiveTab('login');
  } catch (error) {
    showFormMessage('signup', error.message, false);
  } finally {
    setLoadingState(form, false);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = forms.login;
  const payload = parseFormData(form);
  const validationMessage = validateLoginForm(payload);

  if (validationMessage) {
    showFormMessage('login', validationMessage, false);
    return;
  }

  try {
    clearFormMessage('login');
    setLoadingState(form, true);
    const data = await authService.login(payload);
    localStorage.setItem('token', data.token);
    showFormMessage('login', 'Login successful.', true);
    form.reset();
    window.location.href = 'converter.html';
  } catch (error) {
    showFormMessage('login', error.message, false);
  } finally {
    setLoadingState(form, false);
  }
}

function handleGoogleLoginSuccess(data) {
  localStorage.setItem('token', data.token);
  window.location.href = 'converter.html';
}

function initTabSwitching() {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setActiveTab(button.dataset.target);
    });
  });
}

function initPasswordToggles() {
  document.querySelectorAll('.toggle-password').forEach((toggleButton) => {
    toggleButton.addEventListener('click', () => {
      const inputId = toggleButton.dataset.targetInput;
      const inputElement = document.getElementById(inputId);
      const isPassword = inputElement.type === 'password';

      inputElement.type = isPassword ? 'text' : 'password';
      toggleButton.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    });
  });
}

function initFormHandlers() {
  Object.values(forms).forEach((form) => {
    if (!form) {
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');

    if (!submitButton) {
      return;
    }

    submitButton.dataset.defaultText = submitButton.textContent;
  });

  if (forms.signup) {
    forms.signup.addEventListener('submit', handleSignup);
  }

  if (forms.login) {
    forms.login.addEventListener('submit', handleLogin);
  }
}

// Handles auth tab setup and submit wiring for login/signup forms.
function initAuthPage() {
  if (!applyIntelligentAuthGuard()) {
    return;
  }

  if (!forms.signup || !forms.login) {
    return;
  }

  initTabSwitching();
  initPasswordToggles();
  initFormHandlers();
  setActiveTab('signup');
}

document.addEventListener('DOMContentLoaded', initAuthPage);
document.addEventListener('DOMContentLoaded', initConverterPage);
