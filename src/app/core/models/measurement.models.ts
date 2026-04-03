export const MEASUREMENT_CATEGORIES = ['Length', 'Volume', 'Weight', 'Temperature'] as const;
export type MeasurementCategory = (typeof MEASUREMENT_CATEGORIES)[number];

export const MEASUREMENT_OPERATIONS = ['convert', 'compare', 'add', 'subtract', 'divide'] as const;
export type MeasurementOperation = (typeof MEASUREMENT_OPERATIONS)[number];

export const UNIT_MAP: Record<MeasurementCategory, readonly string[]> = {
  Length: ['Feet', 'Inch', 'Yard', 'Centimeter'],
  Volume: ['Litre', 'Milliliter', 'Gallon'],
  Weight: ['Kilogram', 'Gram', 'Pound'],
  Temperature: ['Celsius', 'Fahrenheit', 'Kelvin']
} as const;

export const CATEGORY_ALLOWED_OPERATIONS: Record<MeasurementCategory, readonly MeasurementOperation[]> = {
  Length: ['convert', 'compare', 'add', 'subtract', 'divide'],
  Volume: ['convert', 'compare', 'add', 'subtract', 'divide'],
  Weight: ['convert', 'compare', 'add', 'subtract', 'divide'],
  Temperature: ['convert', 'compare']
} as const;

export interface MeasurementFormValue {
  primaryValue: number | null;
  primaryUnit: string;
  secondaryValue: number | null;
  secondaryUnit: string;
  targetUnit: string;
}

export interface QuantityDTO {
  value: number;
  unit: string;
  measurementType: string;
}

export interface QuantityInputDTO {
  thisQuantityDTO: QuantityDTO;
  thatQuantityDTO: QuantityDTO;
  targetQuantityDTO?: QuantityDTO;
}

export interface MathQuantityDTO {
  value: number;
  unit: string;
}

export interface MathRequestDTO {
  firstQuantityDTO: MathQuantityDTO;
  secondQuantityDTO: MathQuantityDTO;
  targetUnit?: string;
  measurementType: string;
}

export interface QuantityMeasurementApiDto {
  id: number;
  createdAt: string;
  thisValue: number;
  thisUnit: string;
  thisMeasurementType: string;
  thatValue: number;
  thatUnit: string;
  thatMeasurementType: string;
  resultValue: number;
  resultUnit: string;
  targetUnit: string;
  resultString: string;
  operation: string;
  isError: boolean;
  errorMessage: string;
}

export interface MeasurementResultViewModel {
  message: string;
  operation: MeasurementOperation;
  unit: string;
  raw: QuantityMeasurementApiDto | null;
}

export interface MeasurementHistoryViewModel {
  id: number;
  measurementType: string;
  operation: string;
  inputDisplay: string;
  resultDisplay: string;
  createdAtDisplay: string;
  raw: QuantityMeasurementApiDto;
}
