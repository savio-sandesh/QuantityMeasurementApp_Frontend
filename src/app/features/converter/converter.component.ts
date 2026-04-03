import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDividerModule } from '@angular/material/divider';
import {
  Activity,
  ArrowRightLeft,
  Calculator,
  Gauge,
  History,
  LogOut,
  LucideAngularModule,
  Repeat
} from 'lucide-angular';
import { AuthService } from '../../core/services/auth.service';
import {
  MeasurementCategory,
  MeasurementFormValue,
  MeasurementOperation,
  MEASUREMENT_CATEGORIES,
  MeasurementHistoryViewModel
} from '../../core/models/measurement.models';
import { MeasurementService } from '../../core/services/measurement.service';

const nonZeroValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = Number(control.value);
  return Number.isFinite(value) && value === 0 ? { nonZero: true } : null;
};

@Component({
  selector: 'app-converter',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSidenavModule,
    MatDividerModule,
    LucideAngularModule
  ],
  templateUrl: './converter.component.html',
  styleUrl: './converter.component.scss'
})
export class ConverterComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly measurementService = inject(MeasurementService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly menuOpen = signal(true);
  readonly categories = MEASUREMENT_CATEGORIES;
  readonly allowedOperations = computed(() => this.measurementService.getAllowedOperations(this.measurementService.category()));
  readonly units = computed(() => this.measurementService.getUnits(this.measurementService.category()));
  readonly result = this.measurementService.result;
  readonly history = this.measurementService.history;
  readonly totalOperations = this.measurementService.totalOperations;
  readonly loading = this.measurementService.loading;
  readonly error = this.measurementService.error;
  readonly category = this.measurementService.category;
  readonly operation = this.measurementService.operation;
  readonly isLiveConvert = computed(() => this.operation() === 'convert');

  readonly calcIcon = Calculator;
  readonly historyIcon = History;
  readonly gaugeIcon = Gauge;
  readonly switchIcon = ArrowRightLeft;
  readonly repeatIcon = Repeat;
  readonly statusIcon = Activity;
  readonly logoutIcon = LogOut;

  readonly operationLabels: Record<MeasurementOperation, string> = {
    convert: 'Convert',
    compare: 'Compare',
    add: 'Add',
    subtract: 'Subtract',
    divide: 'Divide'
  };

  readonly form = this.fb.group({
    primaryValue: [null as number | null, [Validators.required, Validators.min(0)]],
    primaryUnit: ['', [Validators.required]],
    secondaryValue: [null as number | null, []],
    secondaryUnit: ['', []],
    targetUnit: ['', []]
  });

  readonly resultMessage = computed(() => this.result()?.message || 'Enter a value and calculate a result.');

  constructor() {}

  ngOnInit(): void {
    this.applyOperationValidators();
    this.ensureUnitDefaults();
    this.bindLiveConvert();
    void this.measurementService.refreshHistory();
    void this.measurementService.refreshCount();
  }

  selectCategory(category: MeasurementCategory): void {
    this.measurementService.setCategory(category);
    this.ensureUnitDefaults();
    this.applyOperationValidators();
    if (!this.isLiveConvert()) {
      this.measurementService.clearResult();
    }
  }

  selectOperation(operation: MeasurementOperation): void {
    this.measurementService.setOperation(operation);
    this.applyOperationValidators();

    if (!this.isLiveConvert()) {
      this.measurementService.clearResult();
    }
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue() as MeasurementFormValue;

    try {
      await this.measurementService.submit(this.operation(), value, this.category());
    } catch {
      // Surface state through the service error signal.
    }
  }

  async refreshHistory(): Promise<void> {
    await this.measurementService.refreshHistory();
    await this.measurementService.refreshCount();
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  logout(): void {
    this.authService.clearSession();
    void this.router.navigateByUrl('/');
  }

  trackByHistory(_index: number, item: MeasurementHistoryViewModel): number {
    return item.id;
  }

  private ensureUnitDefaults(): void {
    const units = this.units();
    const firstUnit = units[0] || '';
    const currentPrimaryUnit = this.form.controls.primaryUnit.value;
    const currentSecondaryUnit = this.form.controls.secondaryUnit.value;
    const currentTargetUnit = this.form.controls.targetUnit.value;

    if (!currentPrimaryUnit || !units.includes(currentPrimaryUnit)) {
      this.form.controls.primaryUnit.setValue(firstUnit, { emitEvent: false });
    }

    if (!currentSecondaryUnit || !units.includes(currentSecondaryUnit)) {
      this.form.controls.secondaryUnit.setValue(firstUnit, { emitEvent: false });
    }

    if (!currentTargetUnit || !units.includes(currentTargetUnit)) {
      this.form.controls.targetUnit.setValue(firstUnit, { emitEvent: false });
    }
  }

  private applyOperationValidators(): void {
    const operation = this.operation();
    const isConvert = operation === 'convert';
    const needsTargetUnit = operation !== 'compare';
    const secondaryValueValidators = [Validators.min(0)];
    const secondaryUnitValidators = [];
    const targetUnitValidators = [];

    if (!isConvert) {
      secondaryValueValidators.unshift(Validators.required);
      secondaryUnitValidators.push(Validators.required);
    }

    if (operation === 'divide') {
      secondaryValueValidators.push(nonZeroValidator);
    }

    if (needsTargetUnit) {
      targetUnitValidators.push(Validators.required);
    }

    this.form.controls.primaryValue.setValidators([Validators.required, Validators.min(0)]);
    this.form.controls.primaryUnit.setValidators([Validators.required]);
    this.form.controls.secondaryValue.setValidators(secondaryValueValidators);
    this.form.controls.secondaryUnit.setValidators(secondaryUnitValidators);
    this.form.controls.targetUnit.setValidators(targetUnitValidators);

    this.form.controls.primaryValue.updateValueAndValidity({ emitEvent: false });
    this.form.controls.primaryUnit.updateValueAndValidity({ emitEvent: false });
    this.form.controls.secondaryValue.updateValueAndValidity({ emitEvent: false });
    this.form.controls.secondaryUnit.updateValueAndValidity({ emitEvent: false });
    this.form.controls.targetUnit.updateValueAndValidity({ emitEvent: false });
  }

  private bindLiveConvert(): void {
    this.form.valueChanges
      .pipe(debounceTime(280), distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)), takeUntilDestroyed())
      .subscribe(() => {
        if (!this.isLiveConvert()) {
          return;
        }

        if (
          this.form.controls.primaryValue.invalid ||
          this.form.controls.primaryUnit.invalid ||
          this.form.controls.targetUnit.invalid ||
          this.form.controls.primaryValue.value === null
        ) {
          return;
        }

        const value = this.form.getRawValue() as MeasurementFormValue;
        void this.measurementService.submit('convert', value, this.category());
      });
  }

  get resultHistory(): MeasurementHistoryViewModel[] {
    return this.history();
  }
}
