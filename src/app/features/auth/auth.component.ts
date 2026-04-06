import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Eye, EyeOff, LucideAngularModule, ShoppingBag } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, LucideAngularModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
})
export class AuthComponent implements AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);

  private googleRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly maxGoogleInitRetries = 30;
  private readonly googleLoginContainerId = 'google-login-btn';
  private readonly googleSignupContainerId = 'google-signup-btn';

  readonly shoppingBagIcon = ShoppingBag;
  readonly eyeIcon = Eye;
  readonly eyeOffIcon = EyeOff;

  readonly activeTab = signal<'login' | 'signup'>('login');
  readonly loginPasswordVisible = signal(false);
  readonly signupPasswordVisible = signal(false);
  readonly loginMessage = signal('');
  readonly isDarkTheme = this.themeService.isDark;
  readonly signupMessage = signal('');
  readonly loginMessageTone = signal<'success' | 'error' | ''>('');
  readonly signupMessageTone = signal<'success' | 'error' | ''>('');
  readonly isSubmittingLogin = signal(false);
  readonly isSubmittingSignup = signal(false);

  readonly loginPanelId = 'auth-login-panel';
  readonly signupPanelId = 'auth-signup-panel';

  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  readonly signupForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    mobile: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]]
  });

  ngAfterViewInit(): void {
    this.initializeGoogleSignIn(0);
  }

  ngOnDestroy(): void {
    if (this.googleRetryTimer) {
      clearTimeout(this.googleRetryTimer);
      this.googleRetryTimer = null;
    }
  }

  selectTab(tab: 'login' | 'signup'): void {
    this.activeTab.set(tab);
    this.clearMessage(tab);
  }

  toggleLoginPassword(): void {
    this.loginPasswordVisible.update((visible: boolean) => !visible);
  }

  toggleSignupPassword(): void {
    this.signupPasswordVisible.update((visible: boolean) => !visible);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();

    // Re-render Google button so it matches current theme.
    setTimeout(() => this.renderGoogleButtons(), 0);
  }

  async submitLogin(): Promise<void> {
    if (this.isSubmittingLogin() || this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.setMessage('login', 'Please enter a valid email and password.', 'error');
      return;
    }

    this.isSubmittingLogin.set(true);
    try {
      this.setMessage('login', '', '');
      const loginValue = this.loginForm.getRawValue();
      await this.authService.login({
        email: loginValue.email.trim(),
        password: loginValue.password
      });
      this.setMessage('login', 'Login successful.', 'success');
      this.loginForm.reset();
      void this.router.navigateByUrl('/converter');
    } catch (error) {
      this.setMessage('login', this.resolveErrorMessage(error), 'error');
    } finally {
      this.isSubmittingLogin.set(false);
    }
  }

  async submitSignup(): Promise<void> {
    if (this.isSubmittingSignup() || this.signupForm.invalid) {
      this.signupForm.markAllAsTouched();
      this.setMessage('signup', 'Please complete all signup fields correctly.', 'error');
      return;
    }

    this.isSubmittingSignup.set(true);
    try {
      this.setMessage('signup', '', '');
      const signupValue = this.signupForm.getRawValue();
      await this.authService.register({
        fullName: signupValue.fullName.trim(),
        email: signupValue.email.trim(),
        password: signupValue.password,
        role: 'User'
      });
      this.setMessage('signup', 'Signup successful. You can now log in.', 'success');
      this.signupForm.reset();
      this.selectTab('login');
    } catch (error) {
      this.setMessage('signup', this.resolveErrorMessage(error), 'error');
    } finally {
      this.isSubmittingSignup.set(false);
    }
  }

  private initializeGoogleSignIn(retryCount: number): void {
    if (!environment.googleClientId || environment.googleClientId.startsWith('YOUR_')) {
      this.setMessage('login', 'Google sign-in is not configured yet.', 'error');
      return;
    }

    if (!window.google?.accounts?.id) {
      if (retryCount >= this.maxGoogleInitRetries) {
        this.setMessage('login', 'Google sign-in failed to load. Please refresh.', 'error');
        return;
      }

      this.googleRetryTimer = setTimeout(() => this.initializeGoogleSignIn(retryCount + 1), 250);
      return;
    }

    window.google.accounts.id.initialize({
      client_id: environment.googleClientId,
      callback: (response: GoogleCredentialResponse) => {
        void this.handleGoogleCredential(response);
      },
      auto_select: false,
      cancel_on_tap_outside: true
    });

    this.renderGoogleButtons();
  }

  private renderGoogleButtons(): void {
    if (!window.google?.accounts?.id) {
      return;
    }

    const commonOptions: GoogleButtonConfiguration = {
      type: 'standard',
      theme: this.isDarkTheme() ? 'filled_black' : 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      width: 320
    };

    const loginHost = document.getElementById(this.googleLoginContainerId);
    if (loginHost) {
      loginHost.innerHTML = '';
      window.google.accounts.id.renderButton(loginHost, commonOptions);
    }

    const signupHost = document.getElementById(this.googleSignupContainerId);
    if (signupHost) {
      signupHost.innerHTML = '';
      window.google.accounts.id.renderButton(signupHost, commonOptions);
    }
  }

  private async handleGoogleCredential(response: GoogleCredentialResponse): Promise<void> {
    if (!response.credential) {
      this.setMessage('login', 'Google sign-in failed. Please try again.', 'error');
      return;
    }

    this.isSubmittingLogin.set(true);
    try {
      this.setMessage('login', '', '');
      await this.authService.loginWithGoogle({ idToken: response.credential });
      this.setMessage('login', 'Google login successful.', 'success');
      void this.router.navigateByUrl('/converter');
    } catch (error) {
      this.setMessage('login', this.resolveErrorMessage(error), 'error');
    } finally {
      this.isSubmittingLogin.set(false);
    }
  }

  private clearMessage(tab: 'login' | 'signup'): void {
    this.setMessage(tab, '', '');
  }

  private setMessage(tab: 'login' | 'signup', message: string, tone: 'success' | 'error' | ''): void {
    if (tab === 'login') {
      this.loginMessage.set(message);
      this.loginMessageTone.set(tone);
      return;
    }

    this.signupMessage.set(message);
    this.signupMessageTone.set(tone);
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Something went wrong. Please try again.';
  }
}