import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Eye, EyeOff, LucideAngularModule, ShoppingBag } from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, LucideAngularModule],
  templateUrl: './auth.component.html',
  styleUrl: './auth.component.scss'
})
export class AuthComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly shoppingBagIcon = ShoppingBag;
  readonly eyeIcon = Eye;
  readonly eyeOffIcon = EyeOff;

  readonly activeTab = signal<'login' | 'signup'>('login');
  readonly loginPasswordVisible = signal(false);
  readonly signupPasswordVisible = signal(false);
  readonly loginMessage = signal('');
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

  constructor() {}

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
      const payload = {
        email: loginValue.email.trim(),
        password: loginValue.password
      };
      await this.authService.login(payload);
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
      const payload = {
        fullName: signupValue.fullName.trim(),
        email: signupValue.email.trim(),
        password: signupValue.password,
        role: 'User' as const
      };
      await this.authService.register(payload);
      this.setMessage('signup', 'Signup successful. You can now log in.', 'success');
      this.signupForm.reset();
      this.selectTab('login');
    } catch (error) {
      this.setMessage('signup', this.resolveErrorMessage(error), 'error');
    } finally {
      this.isSubmittingSignup.set(false);
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
