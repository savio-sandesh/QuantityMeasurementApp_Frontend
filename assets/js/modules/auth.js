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
  if (!submitButton) {
    return;
  }

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

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(payload.email)) {
    return 'Please enter a valid Email Id.';
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
    fullName: String(formData.fullName || '').trim(),
    email: String(formData.email || '').trim(),
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
  if (window.__authFormHandlersBound) {
    return;
  }

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

  window.__authFormHandlersBound = true;
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
  setActiveTab('login');
}

function runPageInitializers() {
  if (window.__pageInitializersRan) {
    return;
  }

  window.__pageInitializersRan = true;
  initAuthPage();

  if (typeof initConverterPage === 'function') {
    initConverterPage();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runPageInitializers, { once: true });
} else {
  runPageInitializers();
}
