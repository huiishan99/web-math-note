export type VariableValue = string | number | boolean | null;
export type SolverMode = "quick" | "explain";

export interface Position {
  x: number;
  y: number;
}

export interface CalculationItem {
  id: string;
  expr: string;
  result: VariableValue;
  assign: boolean;
  steps: string[];
  position: Position;
  status?: "pending" | "accepted";
}

export interface CalculatorApiItem {
  expr: string;
  result: VariableValue;
  assign?: boolean;
  steps?: string[];
}

export interface CalculatorApiResponse {
  message: string;
  data: CalculatorApiItem[];
  status: string;
}

export type VariableMap = Record<string, VariableValue>;
