import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { QUANTITY_API_BASE_URL } from '../constants/api.constants';
import {
  CATEGORY_ALLOWED_OPERATIONS,
  MEASUREMENT_CATEGORIES,
  MEASUREMENT_OPERATIONS,
  MeasurementCategory,
  MeasurementFormValue,
  MeasurementHistoryViewModel,
  MeasurementOperation,
  MeasurementResultViewModel,
  MathRequestDTO,
  QuantityDTO,
  QuantityInputDTO,
  QuantityMeasurementApiDto,
  UNIT_MAP
} from '../models/measurement.models';

@Injectable({ providedIn: 'root' })
export class MeasurementService {
  private readonly http = inject(HttpClient);
  private readonly baseUnitFactors: Record<'Length' | 'Volume' | 'Weight', Record<string, number>> = {
    Length: {
      feet: 1,
      inch: 1 / 12,
      yard: 3,
      centimeter: 0.03280839895
    },
    Volume: {
      litre: 1,
      liter: 1,
      milliliter: 0.001,
      millilitre: 0.001,
      gallon: 3.78541
    },
    Weight: {
      kilogram: 1,
      gram: 0.001,
      pound: 0.45359237
    }
  };

  readonly category = signal<MeasurementCategory>('Length');
  readonly operation = signal<MeasurementOperation>('convert');
  readonly result = signal<MeasurementResultViewModel | null>(null);
  readonly history = signal<MeasurementHistoryViewModel[]>([]);
  readonly totalOperations = signal<number>(0);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly categories = MEASUREMENT_CATEGORIES;

  setCategory(category: MeasurementCategory): void {
    this.category.set(category);

    if (!this.isOperationAllowed(category, this.operation())) {
      this.operation.set('convert');
    }
  }

  setOperation(operation: MeasurementOperation): void {
    if (this.isOperationAllowed(this.category(), operation)) {
      this.operation.set(operation);
      return;
    }

    this.operation.set('convert');
  }

  getUnits(category: MeasurementCategory): readonly string[] {
    return UNIT_MAP[category];
  }

  getAllowedOperations(category: MeasurementCategory): readonly MeasurementOperation[] {
    return CATEGORY_ALLOWED_OPERATIONS[category];
  }

  isOperationAllowed(category: MeasurementCategory, operation: MeasurementOperation): boolean {
    return this.getAllowedOperations(category).includes(operation);
  }

  getOperationLabel(operation: MeasurementOperation): string {
    switch (operation) {
      case 'compare':
        return 'Equality';
      case 'add':
        return 'Addition';
      case 'subtract':
        return 'Subtraction';
      case 'divide':
        return 'Division';
      default:
        return 'Conversion';
    }
  }

  getLiveResult(formValue: MeasurementFormValue, category: MeasurementCategory): MeasurementResultViewModel | null {
    const sourceUnit = formValue.primaryUnit?.trim();
    const targetUnit = (formValue.targetUnit || formValue.primaryUnit)?.trim();

    if (!sourceUnit || !targetUnit || formValue.primaryValue === null || formValue.primaryValue === undefined) {
      return null;
    }

    this.assertNonNegative(formValue.primaryValue, 'Primary value');

    const converted = this.convertLocally(formValue.primaryValue, sourceUnit, targetUnit, category);

    return {
      message: `${this.formatNumeric(converted)} ${targetUnit}`.trim(),
      operation: 'convert',
      unit: targetUnit,
      raw: null
    };
  }

  async logOperation(operation: MeasurementOperation, formValue: MeasurementFormValue, category: MeasurementCategory): Promise<void> {
    this.setCategory(category);
    this.setOperation(operation);
    this.loading.set(true);
    this.error.set(null);

    try {
      this.assertNonNegative(formValue.primaryValue, 'Primary value');
      this.assertNonNegative(formValue.secondaryValue, 'Secondary value');

      const response = await this.runOperation(operation, formValue, category);
      this.result.set(this.toResultViewModel(response, operation, formValue, category));
      await Promise.all([this.refreshHistory(), this.refreshCount()]);
    } catch (error) {
      const message = this.toErrorMessage(error, 'Unable to complete the measurement request.');
      this.error.set(message);
      throw new Error(message);
    } finally {
      this.loading.set(false);
    }
  }

  async submit(operation: MeasurementOperation, formValue: MeasurementFormValue, category: MeasurementCategory): Promise<void> {
    await this.logOperation(operation, formValue, category);
  }

  async refreshHistory(): Promise<void> {
    try {
      const response = await this.get<QuantityMeasurementApiDto[] | { data?: QuantityMeasurementApiDto[]; items?: QuantityMeasurementApiDto[] }>('history');
      const items = Array.isArray(response) ? response : response?.data || response?.items || [];
      this.history.set(items.map((item) => this.toHistoryViewModel(item)));
    } catch {
      this.history.set([]);
    }
  }

  async refreshCount(): Promise<void> {
    try {
      const response = await this.get<unknown>('count');
      const normalized = this.extractCount(response);
      this.totalOperations.set(normalized);
    } catch {
      this.totalOperations.set(0);
    }
  }

  clearResult(): void {
    this.result.set(null);
    this.error.set(null);
  }

  private async runOperation(
    operation: MeasurementOperation,
    formValue: MeasurementFormValue,
    category: MeasurementCategory
  ): Promise<QuantityMeasurementApiDto> {
    switch (operation) {
      case 'compare':
        return this.compare(formValue, category);
      case 'add':
        return this.add(formValue, category);
      case 'subtract':
        return this.subtract(formValue, category);
      case 'divide':
        return this.divide(formValue, category);
      default:
        return this.convert(formValue, category);
    }
  }

  private async convert(formValue: MeasurementFormValue, category: MeasurementCategory): Promise<QuantityMeasurementApiDto> {
    const payload: QuantityInputDTO = {
      thisQuantityDTO: this.toQuantity(formValue.primaryValue, formValue.primaryUnit, category),
      thatQuantityDTO: this.toQuantity(0, formValue.primaryUnit, category),
      targetQuantityDTO: this.toQuantity(0, formValue.targetUnit || formValue.primaryUnit, category)
    };

    return this.post<QuantityMeasurementApiDto>('convert', payload);
  }

  private async compare(formValue: MeasurementFormValue, category: MeasurementCategory): Promise<QuantityMeasurementApiDto> {
    const payload: QuantityInputDTO = {
      thisQuantityDTO: this.toQuantity(formValue.primaryValue, formValue.primaryUnit, category),
      thatQuantityDTO: this.toQuantity(formValue.secondaryValue, formValue.secondaryUnit, category)
    };

    return this.post<QuantityMeasurementApiDto>('compare', payload);
  }

  private async add(formValue: MeasurementFormValue, category: MeasurementCategory): Promise<QuantityMeasurementApiDto> {
    const payload: QuantityInputDTO = {
      thisQuantityDTO: this.toQuantity(formValue.primaryValue, formValue.primaryUnit, category),
      thatQuantityDTO: this.toQuantity(formValue.secondaryValue, formValue.secondaryUnit, category),
      targetQuantityDTO: this.toQuantity(0, formValue.targetUnit || formValue.primaryUnit, category)
    };

    return this.post<QuantityMeasurementApiDto>('add', payload);
  }

  private async subtract(formValue: MeasurementFormValue, category: MeasurementCategory): Promise<QuantityMeasurementApiDto> {
    const payload: QuantityInputDTO = {
      thisQuantityDTO: this.toQuantity(formValue.primaryValue, formValue.primaryUnit, category),
      thatQuantityDTO: this.toQuantity(formValue.secondaryValue, formValue.secondaryUnit, category),
      targetQuantityDTO: this.toQuantity(0, formValue.targetUnit || formValue.primaryUnit, category)
    };

    return this.post<QuantityMeasurementApiDto>('subtract', payload);
  }

  private async divide(formValue: MeasurementFormValue, category: MeasurementCategory): Promise<QuantityMeasurementApiDto> {
    const payload: MathRequestDTO = {
      firstQuantityDTO: this.toMathQuantity(formValue.primaryValue, formValue.primaryUnit),
      secondQuantityDTO: this.toMathQuantity(formValue.secondaryValue, formValue.secondaryUnit),
      targetUnit: formValue.targetUnit || formValue.primaryUnit,
      measurementType: category
    };

    return this.post<QuantityMeasurementApiDto>('divide', payload);
  }

  private toQuantity(value: number | null, unit: string, category: MeasurementCategory): QuantityDTO {
    return {
      value: this.toNumber(value),
      unit: this.canonicalizeUnitForApi(unit),
      measurementType: category
    };
  }

  private convertLocally(value: number, sourceUnit: string, targetUnit: string, category: MeasurementCategory): number {
    if (category === 'Temperature') {
      return this.convertTemperature(value, sourceUnit, targetUnit);
    }

    const factors = this.baseUnitFactors[category];
    const sourceKey = this.normalizeUnit(sourceUnit);
    const targetKey = this.normalizeUnit(targetUnit);

    const sourceFactor = factors[sourceKey];
    const targetFactor = factors[targetKey];

    if (!sourceFactor || !targetFactor) {
      throw new Error(`Unsupported ${category} unit conversion: ${sourceUnit} -> ${targetUnit}`);
    }

    const baseValue = value * sourceFactor;
    return baseValue / targetFactor;
  }

  private convertTemperature(value: number, sourceUnit: string, targetUnit: string): number {
    const sourceKey = this.normalizeUnit(sourceUnit);
    const targetKey = this.normalizeUnit(targetUnit);

    const celsiusValue = this.toCelsius(value, sourceKey);

    switch (targetKey) {
      case 'celsius':
        return celsiusValue;
      case 'fahrenheit':
        return (celsiusValue * 9) / 5 + 32;
      case 'kelvin':
        return celsiusValue + 273.15;
      default:
        throw new Error(`Unsupported temperature unit: ${targetUnit}`);
    }
  }

  private toCelsius(value: number, unit: string): number {
    switch (unit) {
      case 'celsius':
        return value;
      case 'fahrenheit':
        return ((value - 32) * 5) / 9;
      case 'kelvin':
        return value - 273.15;
      default:
        throw new Error(`Unsupported temperature unit: ${unit}`);
    }
  }

  private normalizeUnit(unit: string): string {
    return unit.trim().toLowerCase();
  }

  private toMathQuantity(value: number | null, unit: string): { value: number; unit: string } {
    return {
      value: this.toNumber(value),
      unit: this.canonicalizeUnitForApi(unit)
    };
  }

  private canonicalizeUnitForApi(unit: string): string {
    const trimmed = unit.trim();
    const normalized = trimmed.toLowerCase();

    switch (normalized) {
      case 'milliliter':
        return 'Millilitre';
      case 'liter':
        return 'Litre';
      default:
        return trimmed;
    }
  }

  private toResultViewModel(
    response: QuantityMeasurementApiDto,
    operation: MeasurementOperation,
    formValue: MeasurementFormValue,
    category: MeasurementCategory
  ): MeasurementResultViewModel {
    const unit = response.resultUnit || formValue.targetUnit || formValue.primaryUnit;
    const message = this.formatResultMessage(response, operation, unit);

    return {
      message,
      operation,
      unit,
      raw: response
    };
  }

  private formatResultMessage(response: QuantityMeasurementApiDto, operation: MeasurementOperation, unit: string): string {
    if (operation === 'compare') {
      return this.resolveCompareLabel(response);
    }

    const value = this.formatNumeric(response.resultValue);
    const resolvedUnit = response.resultUnit || unit;
    return `${value} ${resolvedUnit}`.trim();
  }

  private resolveCompareLabel(response: QuantityMeasurementApiDto): string {
    const text = response.resultString?.trim();

    if (text) {
      return text;
    }

    const numericValue = Number(response.resultValue);
    if (Number.isFinite(numericValue)) {
      return numericValue === 1 ? 'Equal' : 'Not Equal';
    }

    return 'Not Equal';
  }

  private toHistoryViewModel(item: QuantityMeasurementApiDto): MeasurementHistoryViewModel {
    const operation = String(item.operation || 'CONVERT').toUpperCase();
    const inputDisplay = this.formatHistoryInput(item, operation);
    const resultDisplay = this.formatHistoryResult(item, operation);

    return {
      id: item.id,
      measurementType: item.thisMeasurementType || 'N/A',
      operation,
      inputDisplay,
      resultDisplay,
      createdAtDisplay: this.formatDateTime(item.createdAt),
      raw: item
    };
  }

  private formatHistoryInput(item: QuantityMeasurementApiDto, operation: string): string {
    const thisValue = this.formatNumeric(item.thisValue);
    const thisUnit = item.thisUnit || '';
    const secondValue = this.formatNumeric(item.thatValue);
    const secondUnit = item.thatUnit || '';
    const targetUnit = item.targetUnit || item.resultUnit || '';

    if (operation === 'CONVERT') {
      return `${thisValue} ${thisUnit} -> ${targetUnit}`.trim();
    }

    if (operation === 'DIVIDE') {
      return `${thisValue} ${thisUnit} by ${secondValue} ${secondUnit}`.trim();
    }

    if (operation === 'ADD' || operation === 'SUBTRACT' || operation === 'COMPARE') {
      return `${thisValue} ${thisUnit} and ${secondValue} ${secondUnit}`.trim();
    }

    return `${thisValue} ${thisUnit}`.trim();
  }

  private formatHistoryResult(item: QuantityMeasurementApiDto, operation: string): string {
    if (operation === 'COMPARE') {
      return this.resolveCompareLabel(item);
    }

    const resultValue = this.formatNumeric(item.resultValue);
    const resultUnit = item.resultUnit || item.targetUnit || item.thatUnit || item.thisUnit || 'Unit';
    return `${resultValue} ${resultUnit}`.trim();
  }

  private formatDateTime(value: string): string {
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

  private formatNumeric(value: unknown): string {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
      return '0';
    }

    return numericValue.toFixed(4).replace(/\.0+$/, '').replace(/(\.[0-9]*?)0+$/, '$1').replace(/\.$/, '');
  }

  private extractCount(response: unknown): number {
    if (typeof response === 'number') {
      return response;
    }

    if (response && typeof response === 'object') {
      const candidate =
        (response as { count?: unknown }).count ??
        (response as { totalOperations?: unknown }).totalOperations ??
        (response as { data?: { count?: unknown; totalOperations?: unknown } }).data?.count ??
        (response as { data?: { count?: unknown; totalOperations?: unknown } }).data?.totalOperations ??
        (response as { data?: unknown }).data;

      const numericValue = Number(candidate);
      return Number.isFinite(numericValue) ? numericValue : 0;
    }

    return 0;
  }

  private async get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`${QUANTITY_API_BASE_URL}/${path}`));
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    return firstValueFrom(this.http.post<T>(`${QUANTITY_API_BASE_URL}/${path}`, body));
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      const httpError = error as HttpErrorResponse;
      const responseMessage = this.extractServerMessage(httpError.error);
      return responseMessage || this.mapStatusMessage(httpError.status, fallback);
    }

    if (error instanceof Error) {
      return error.message || fallback;
    }

    return fallback;
  }

  private extractServerMessage(payload: unknown): string {
    if (!payload) {
      return '';
    }

    if (typeof payload === 'string') {
      return payload;
    }

    if (typeof payload === 'object') {
      const candidate =
        (payload as { message?: unknown }).message ??
        (payload as { error?: unknown }).error ??
        (payload as { title?: unknown }).title;

      return typeof candidate === 'string' ? candidate : '';
    }

    return '';
  }

  private mapStatusMessage(status: number, fallback: string): string {
    switch (status) {
      case 0:
        return 'Cannot reach backend API. Please ensure the Web API is running on localhost:5111.';
      case 400:
        return fallback || 'Invalid request. Please verify your input.';
      case 401:
        return fallback || 'Unauthorized. Please login again.';
      case 500:
        return fallback || 'Server error occurred while processing the measurement.';
      default:
        return fallback || 'Unexpected error occurred.';
    }
  }

  private assertNonNegative(value: number | null, label: string): void {
    if (value === null || value === undefined) {
      return;
    }

    if (value < 0) {
      throw new Error(`${label} cannot be negative.`);
    }
  }

  private toNumber(value: number | null): number {
    const numericValue = Number(value ?? 0);
    return Number.isFinite(numericValue) ? numericValue : 0;
  }
}
