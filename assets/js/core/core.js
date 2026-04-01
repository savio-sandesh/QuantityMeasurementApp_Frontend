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

