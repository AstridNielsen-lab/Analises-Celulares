export type CellAnalysisLevel = 'low' | 'medium' | 'high';

export interface CellData {
  id: number;
  size: number;
  shape: number;
  colorDifference: number;
  location: string;
  characteristics: string[];
}

export interface CellStatistics {
  totalCells: number;
  abnormalCells: number;
  averageSize: number;
  averageColorDifference: number;
  infestationPercentage: number;
  criticalAreas: number;
}

export interface CellAnalysisResult {
  cells: CellData[];
  statistics: CellStatistics;
  executionTime: number;
  abnormalityLevel: CellAnalysisLevel;
  diagnosis: string;
  processedImageUrl: string;
}

export type BloodCellType = 
  | 'erythrocyte'    // Red blood cells
  | 'leukocyte'      // White blood cells
  | 'thrombocyte'    // Platelets
  | 'blast'          // Immature cells
  | 'abnormal';      // Abnormal cells

export type PathologyType =
  | 'anemia'
  | 'leukemia'
  | 'lymphoma'
  | 'myeloma'
  | 'thrombocytopenia'
  | 'polycythemia'
  | 'sickleCell'
  | 'thalassemia'
  | 'spherocytosis'
  | 'elliptocytosis'
  | 'neutrophilia'
  | 'lymphocytosis'
  | 'monocytosis'
  | 'eosinophilia'
  | 'basophilia';

export interface BloodCellData extends CellData {
  cellType: BloodCellType;
  pathologyIndicators: PathologyType[];
  morphology: {
    size: 'normal' | 'microcytic' | 'macrocytic';
    shape: 'normal' | 'sickle' | 'spherocytic' | 'elliptocytic' | 'irregular';
    color: 'normal' | 'hypochromic' | 'hyperchromic';
    inclusions?: string[]; // For special cellular inclusions
  };
}

export interface BloodAnalysisStatistics extends CellStatistics {
  cellCounts: {
    [key in BloodCellType]: number;
  };
  pathologyCounts: {
    [key in PathologyType]: number;
  };
  ratios: {
    neutrophilToLymphocyte: number;
    redToWhiteCell: number;
    plateletToRedCell: number;
  };
}