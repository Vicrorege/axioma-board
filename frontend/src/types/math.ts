export interface MilestoneStage {
  title: string;
  summary: string;
  sub_steps: string[];
  result_latex?: string | null;
}

export interface SolutionMethod {
  name: string;
  steps: string[];
  milestones?: MilestoneStage[] | null;
  final_answer?: string | null;
}

export interface MathResult {
  success: boolean;
  operation: string;
  input_latex: string;
  result_latex?: string | null;
  result_str?: string | null;
  numeric_value?: number | null;
  variables_found: string[];
  methods?: SolutionMethod[] | null;
  steps?: string[] | null;
  error?: string | null;
}

export interface AstNode {
  type: string;
  latex: string;
  str_repr: string;
  args: AstNode[];
}

export interface AstResponse {
  success: boolean;
  latex: string;
  tree?: AstNode | null;
  symbols: string[];
  is_equation: boolean;
  error?: string | null;
}

export interface MathBlockData {
  id: string;
  x: number;
  y: number;
  title?: string;
  latex: string;
  result_latex?: string | null;
  operation?: string | null;
  variables?: Record<string, number> | null;
  color?: string;
  comment?: string | null;
}

export interface ArrowConnection {
  id: string;
  from_id: string;
  to_id: string;
  label?: string | null;
}

export interface BoardSnapshot {
  blocks: MathBlockData[];
  arrows: ArrowConnection[];
  canvas_state?: Record<string, any> | null;
}

export interface Board {
  id: string;
  title: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
  snapshot: BoardSnapshot;
}
