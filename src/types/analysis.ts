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
  | 'megaloblast'    // Large, immature cells
  | 'abnormal';      // Abnormal cells

export type LeukocyteType =
  | 'neutrophil'
  | 'lymphocyte'
  | 'monocyte'
  | 'eosinophil'
  | 'basophil'
  | 'blast'
  | 'myeloblast'     // Added for myeloid disorders
  | 'lymphoblast'    // Added for lymphoid disorders
  | 'promyelocyte'   // Added for maturation analysis
  | 'myelocyte'      // Added for maturation analysis
  | 'metamyelocyte'; // Added for maturation analysis

export type PathologyType =
  | 'anemia'
  | 'leukemia'
  | 'lymphoma'
  | 'myeloma'
  | 'myelodysplasia'
  | 'acuteLeukemia'
  | 'chronicLeukemia'
  | 'megaloblasticAnemia'
  | 'aplasticAnemia'
  | 'polycythemia'
  | 'thrombocytopenia'
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
  leukocyteType?: LeukocyteType;
  pathologyIndicators: PathologyType[];
  morphology: {
    size: 'normal' | 'microcytic' | 'macrocytic' | 'megaloblastic';
    shape: 'normal' | 'sickle' | 'spherocytic' | 'elliptocytic' | 'irregular';
    color: 'normal' | 'hypochromic' | 'hyperchromic';
    maturity: 'mature' | 'immature' | 'blast';
    inclusions?: string[]; // For special cellular inclusions
    nuclearFeatures?: {
      chromatin: 'normal' | 'condensed' | 'loose' | 'abnormal';
      nucleoli: boolean;
      nucleusShape: 'normal' | 'irregular' | 'cleaved' | 'folded';
      nucleusCytoplasm: number; // N:C ratio
    };
  };
  measurements: {
    diameter: number;      // in micrometers
    area: number;         // in square micrometers
    perimeter: number;    // in micrometers
    circularity: number;  // 0-1 scale
    intensity: number;    // 0-255 scale
    nuclearArea?: number; // for nuclear analysis
  };
}

export interface BloodAnalysisStatistics extends CellStatistics {
  cellCounts: {
    [key in BloodCellType]: number;
  };
  leukocyteCounts: {
    [key in LeukocyteType]: number;
  };
  pathologyCounts: {
    [key in PathologyType]: number;
  };
  ratios: {
    neutrophilToLymphocyte: number;
    redToWhiteCell: number;
    plateletToRedCell: number;
    blastPercentage: number;
    myeloidToErythroid: number;
    immatureTotalRatio: number;    // Added for maturation assessment
    nucleatedRBCCount: number;     // Added for erythroid maturation
  };
  indices: {
    mcv: number;  // Mean Corpuscular Volume
    mch: number;  // Mean Corpuscular Hemoglobin
    mchc: number; // Mean Corpuscular Hemoglobin Concentration
    rdw: number;  // Red Cell Distribution Width
    mpm: number;  // Mean Platelet Mass
    mpv: number;  // Mean Platelet Volume
  };
  maturationIndices: {
    myeloidMaturationIndex: number;    // For granulocytic series
    erythroidMaturationIndex: number;  // For erythroid series
    dysplasiaScore: number;           // For MDS assessment
  };
}

export interface PathologyDescription {
  name: string;
  description: string;
  criteria: string[];
  severity: 'mild' | 'moderate' | 'severe';
  recommendations: string[];
  differentialDiagnosis: string[];
  morphologicalFeatures: string[];
  clinicalCorrelation: string[];
}

export interface MaturationAssessment {
  lineage: 'myeloid' | 'erythroid' | 'megakaryocytic';
  maturationStages: {
    stage: string;
    percentage: number;
    abnormalities: string[];
  }[];
  dysplasticFeatures: string[];
  conclusion: string;
}

export interface DifferentialCount {
  cellType: LeukocyteType;
  percentage: number;
  absoluteCount: number;
  morphologyNotes: string[];
}

export interface CellularInclusions {
  name: string;
  frequency: 'rare' | 'occasional' | 'frequent';
  significance: string[];
  associatedPathologies: PathologyType[];
}