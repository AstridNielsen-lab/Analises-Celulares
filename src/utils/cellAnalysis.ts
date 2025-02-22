import { 
  CellAnalysisResult, 
  BloodCellData, 
  CellAnalysisLevel, 
  BloodCellType,
  PathologyType,
  BloodAnalysisStatistics,
  LeukocyteType,
  MaturationAssessment,
  DifferentialCount
} from '../types/analysis';

export class CellAnalyzer {
  // Catalog of detectable pathologies with descriptions
  private readonly PATHOLOGY_DESCRIPTIONS: { [key in PathologyType]: string } = {
    anemia: "Condição caracterizada por uma deficiência em glóbulos vermelhos ou hemoglobina, resultando em menor transporte de oxigênio. Indicadores: microcitose e hipocromia.",
    leukemia: "Grupo de cânceres que afetam os glóbulos brancos, caracterizados pela produção excessiva de células anormais, comprometendo a função imunológica.",
    lymphoma: "Tipo de câncer que afeta os linfócitos, podendo causar aumento dos linfonodos e alterações na contagem celular periférica.",
    myeloma: "Câncer das células plasmáticas, frequentemente associado a produção anormal de proteínas e alterações nas contagens sanguíneas.",
    myelodysplasia: "Síndrome caracterizada por hematopoiese ineficaz com alterações morfológicas em uma ou mais linhagens celulares. Risco aumentado de evolução para LMA.",
    acuteLeukemia: "Proliferação rápida de células blásticas imaturas (>20%) com comprometimento da função medular normal. Requer intervenção imediata.",
    chronicLeukemia: "Acúmulo progressivo de células maduras ou parcialmente maduras, com evolução mais lenta. Pode ser mielóide ou linfóide.",
    megaloblasticAnemia: "Anemia causada por deficiência de B12 ou folato, caracterizada por eritrócitos grandes e núcleos imaturos (megaloblastos).",
    aplasticAnemia: "Falência medular com pancitopenia grave. Redução significativa de todas as linhagens celulares.",
    polycythemia: "Aumento anormal dos glóbulos vermelhos, podendo levar ao espessamento do sangue e riscos de trombose. Indicadores: macrocitose e hemoglobina elevada.",
    thrombocytopenia: "Condição marcada por baixa contagem de plaquetas, aumentando o risco de sangramentos e hematomas.",
    sickleCell: "Distúrbio genético que causa a formação de hemácias em forma de foice, provocando anemia hemolítica e crises vaso-oclusivas.",
    thalassemia: "Doença hereditária que afeta a produção de hemoglobina, resultando em anemia microcítica e hipocrômica com diferentes graus de severidade.",
    spherocytosis: "Condição em que as hemácias assumem formato esférico em vez de bicôncavo, frequentemente ocasionando anemia hemolítica e aumento do MCHC.",
    elliptocytosis: "Alteração na forma das hemácias, que ficam alongadas ou elípticas, podendo reduzir a eficiência no transporte de oxigênio.",
    neutrophilia: "Elevação na contagem de neutrófilos, geralmente sinal de infecção, inflamação ou resposta ao estresse.",
    lymphocytosis: "Aumento dos linfócitos, podendo indicar infecções virais, inflamação crônica ou distúrbios hematológicos.",
    monocytosis: "Elevação dos monócitos, frequentemente associada a processos inflamatórios crônicos, infecções ou desordens hematológicas.",
    eosinophilia: "Aumento dos eosinófilos, comumente relacionado a reações alérgicas, infecções parasitárias ou condições autoimunes.",
    basophilia: "Contagem elevada de basófilos, que pode ocorrer em reações alérgicas, inflamações crônicas ou desordens mieloproliferativas."
  };

  // Maturation stages criteria
  private readonly MATURATION_CRITERIA = {
    myeloid: {
      blast: { size: [10, 15], chromatin: 'loose', nucleoli: true },
      promyelocyte: { size: [12, 18], granules: 'primary', nucleoli: false },
      myelocyte: { size: [12, 18], granules: 'secondary', nucleusShape: 'round' },
      metamyelocyte: { size: [10, 16], nucleusShape: 'kidney' },
      band: { size: [10, 14], nucleusShape: 'curved' },
      segmented: { size: [10, 14], nucleusShape: 'segmented' }
    },
    erythroid: {
      proerythroblast: { size: [12, 20], chromatin: 'fine', nucleoli: true },
      basophilic: { size: [10, 16], chromatin: 'coarse', hemoglobin: 'none' },
      polychromatophilic: { size: [8, 12], chromatin: 'condensed', hemoglobin: 'moderate' },
      orthochromatic: { size: [7, 10], chromatin: 'pyknotic', hemoglobin: 'high' }
    }
  };

  // Normal ranges for blood cells (in pixels for image analysis)
  private readonly NORMAL_RANGES = {
    erythrocyte: {
      size: { min: 6, max: 8 }, // Normal RBC diameter
      colorIntensity: { min: 0.6, max: 0.8 } // Hemoglobin-related
    },
    leukocyte: {
      size: { min: 10, max: 15 }, // Larger than RBCs
      colorIntensity: { min: 0.3, max: 0.5 } // Usually lighter
    },
    thrombocyte: {
      size: { min: 2, max: 4 }, // Smallest blood cells
      colorIntensity: { min: 0.4, max: 0.6 }
    },
    blast: {
      size: { min: 15, max: 20 }, // Larger than mature cells
      nucleusRatio: { min: 0.7, max: 0.9 } // High N:C ratio
    },
    megaloblast: {
      size: { min: 20, max: 25 }, // Largest cells
      nucleusRatio: { min: 0.6, max: 0.8 } // Abnormal nuclear maturation
    }
  };

  // Dysplasia criteria
  private readonly DYSPLASIA_FEATURES = {
    erythroid: [
      'nuclear budding',
      'internuclear bridging',
      'megaloblastic changes',
      'ring sideroblasts'
    ],
    myeloid: [
      'hypogranulation',
      'pseudo-Pelger-Huet',
      'nuclear hyposegmentation',
      'bizarre nuclear shapes'
    ],
    megakaryocytic: [
      'micromegakaryocytes',
      'nuclear hypolobulation',
      'separated nuclear lobes'
    ]
  };

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private startTime: Date;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.startTime = new Date();
  }

  async analyzeImage(imageFile: File): Promise<CellAnalysisResult> {
    try {
      this.startTime = new Date();
      console.log("Iniciando análise aprimorada de células sanguíneas...");

      const image = await this.loadImage(imageFile);
      this.canvas.width = image.width;
      this.canvas.height = image.height;
      this.ctx.drawImage(image, 0, 0);

      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const processedData = this.advancedPreprocessImage(imageData);
      
      const cells = this.detectCells(processedData, imageData);
      const cellData = this.analyzeCells(cells, processedData, imageData);
      const statistics = this.calculateEnhancedStatistics(cellData);
      
      // Perform advanced analysis
      const maturationAssessment = this.assessCellularMaturation(cellData);
      const differentialCount = this.performDifferentialCount(cellData);
      const dysplasiaAnalysis = this.analyzeDysplasticFeatures(cellData);
      
      this.drawDetailedAnnotations(cells, cellData, maturationAssessment);
      
      const executionTime = new Date().getTime() - this.startTime.getTime();
      
      return {
        cells: cellData,
        statistics,
        executionTime,
        abnormalityLevel: this.determineAbnormalityLevel(statistics),
        diagnosis: this.generateComprehensiveDiagnosis(
          cellData as BloodCellData[],
          statistics as BloodAnalysisStatistics,
          maturationAssessment,
          differentialCount,
          dysplasiaAnalysis
        ),
        processedImageUrl: this.canvas.toDataURL()
      };
    } catch (error) {
      console.error("Erro na análise:", error);
      throw new Error("Falha na análise da imagem");
    }
  }

  private async loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  private advancedPreprocessImage(imageData: ImageData): Float32Array {
    const { data, width, height } = imageData;
    const processed = new Float32Array(data.length / 4);
    
    // Enhanced grayscale conversion with weighted channels for better cell differentiation
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Enhanced weighting for better detection of cellular features
      const grayscale = (
        r * 0.4 +   // Red channel emphasized for hemoglobin
        g * 0.35 +  // Green channel for nuclear details
        b * 0.25    // Blue channel for cytoplasmic features
      );
      
      processed[i / 4] = grayscale / 255;
    }

    // Apply advanced image processing
    const denoised = this.applyAdaptiveDenoising(processed, width, height);
    const enhanced = this.applyContrastEnhancement(denoised, width, height);
    const segmented = this.applyWatershedSegmentation(enhanced, width, height);
    
    return segmented;
  }

  private applyAdaptiveDenoising(data: Float32Array, width: number, height: number): Float32Array {
    const output = new Float32Array(data.length);
    const windowSize = 5;
    const sigma = 1.5;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;

        for (let wy = -windowSize; wy <= windowSize; wy++) {
          for (let wx = -windowSize; wx <= windowSize; wx++) {
            const px = x + wx;
            const py = y + wy;

            if (px >= 0 && px < width && py >= 0 && py < height) {
              const diff = data[y * width + x] - data[py * width + px];
              const weight = Math.exp(-(diff * diff) / (2 * sigma * sigma));
              sum += data[py * width + px] * weight;
              weightSum += weight;
            }
          }
        }

        output[y * width + x] = sum / weightSum;
      }
    }

    return output;
  }

  private applyContrastEnhancement(data: Float32Array, width: number, height: number): Float32Array {
    const output = new Float32Array(data.length);
    const histogram = new Float32Array(256).fill(0);
    
    // Build histogram
    for (let i = 0; i < data.length; i++) {
      const bin = Math.floor(data[i] * 255);
      histogram[bin]++;
    }
    
    // Calculate cumulative histogram
    const cdf = new Float32Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }
    
    // Normalize CDF
    const cdfMin = cdf[0];
    const cdfMax = cdf[255];
    for (let i = 0; i < 256; i++) {
      cdf[i] = (cdf[i] - cdfMin) / (cdfMax - cdfMin);
    }
    
    // Apply contrast enhancement
    for (let i = 0; i < data.length; i++) {
      const bin = Math.floor(data[i] * 255);
      output[i] = cdf[bin];
    }
    
    return output;
  }

  private applyWatershedSegmentation(data: Float32Array, width: number, height: number): Float32Array {
    const output = new Float32Array(data.length);
    const markers = this.findLocalMinima(data, width, height);
    const queue: number[] = [];
    
    // Initialize watershed regions
    for (let i = 0; i < markers.length; i++) {
      if (markers[i] > 0) {
        queue.push(i);
        output[i] = markers[i];
      }
    }
    
    // Process queue
    while (queue.length > 0) {
      const current = queue.shift()!;
      const x = current % width;
      const y = Math.floor(current / width);
      
      // Check neighbors
      const neighbors = [
        [x + 1, y], [x - 1, y],
        [x, y + 1], [x, y - 1]
      ];
      
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const idx = ny * width + nx;
          if (output[idx] === 0) {
            output[idx] = output[current];
            queue.push(idx);
          }
        }
      }
    }
    
    return output;
  }

  private findLocalMinima(data: Float32Array, width: number, height: number): Float32Array {
    const minima = new Float32Array(data.length);
    const threshold = 0.1;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const value = data[idx];
        let isMinimum = true;
        
        // Check 8-connected neighbors
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const neighborValue = data[(y + dy) * width + (x + dx)];
            if (value > neighborValue) {
              isMinimum = false;
              break;
            }
          }
          if (!isMinimum) break;
        }
        
        if (isMinimum && value < threshold) {
          minima[idx] = 1;
        }
      }
    }
    
    return minima;
  }

  private analyzeCells(
    cells: Array<{ x: number; y: number; radius: number }>, 
    processedData: Float32Array,
    imageData: ImageData
  ): BloodCellData[] {
    return cells.map((cell, index) => {
      const size = Math.PI * Math.pow(cell.radius, 2);
      const shape = this.calculateShape(cell, processedData);
      const colorProfile = this.analyzeColorProfile(cell, imageData);
      const nuclearFeatures = this.analyzeNuclearFeatures(cell, processedData, imageData);
      const cellType = this.determineCellType(cell.radius, colorProfile, nuclearFeatures);
      const leukocyteType = this.determineLeukocyteType(cellType, nuclearFeatures);
      const morphology = this.analyzeMorphology(cell.radius, shape, colorProfile, nuclearFeatures);
      const pathologyIndicators = this.identifyPathologies(cellType, morphology, nuclearFeatures);
      
      return {
        id: index + 1,
        size,
        shape,
        colorDifference: colorProfile.difference,
        location: this.determineLocation(cell),
        characteristics: this.determineCharacteristics(cell, shape, colorProfile.difference),
        cellType,
        leukocyteType,
        pathologyIndicators,
        morphology,
        measurements: {
          diameter: cell.radius * 2,
          area: size,
          perimeter: 2 * Math.PI * cell.radius,
          circularity: shape,
          intensity: colorProfile.intensity,
          nuclearArea: nuclearFeatures.area
        }
      };
    });
  }

  private analyzeNuclearFeatures(
    cell: { x: number; y: number; radius: number },
    processedData: Float32Array,
    imageData: ImageData
  ) {
    const nucleusData = this.extractNuclearRegion(cell, processedData);
    const chromatinPattern = this.analyzeChromatinPattern(nucleusData);
    const nucleoli = this.detectNucleoli(nucleusData);
    const shape = this.analyzeNuclearShape(nucleusData);
    
    return {
      area: this.calculateNuclearArea(nucleusData),
      chromatin: chromatinPattern,
      nucleoli: nucleoli.length > 0,
      shape: shape,
      ncRatio: this.calculateNCRatio(cell, nucleusData)
    };
  }

  private extractNuclearRegion(
    cell: { x: number; y: number; radius: number },
    processedData: Float32Array
  ): Float32Array {
    const region = new Float32Array(Math.ceil(Math.PI * cell.radius * cell.radius));
    let idx = 0;
    
    for (let y = cell.y - cell.radius; y <= cell.y + cell.radius; y++) {
      for (let x = cell.x - cell.radius; x <= cell.x + cell.radius; x++) {
        if (Math.pow(x - cell.x, 2) + Math.pow(y - cell.y, 2) <= Math.pow(cell.radius, 2)) {
          if (x >= 0 && x < this.canvas.width && y >= 0 && y < this.canvas.height) {
            region[idx++] = processedData[y * this.canvas.width + x];
          }
        }
      }
    }
    
    return region;
  }

  private analyzeChromatinPattern(nucleusData: Float32Array): 'normal' | 'condensed' | 'loose' | 'abnormal' {
    const mean = nucleusData.reduce((sum, val) => sum + val, 0) / nucleusData.length;
    const variance = nucleusData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / nucleusData.length;
    
    if (variance < 0.01) return 'condensed';
    if (variance > 0.05) return 'loose';
    if (mean > 0.7) return 'abnormal';
    return 'normal';
  }

  private detectNucleoli(nucleusData: Float32Array): Array<{ x: number; y: number; size: number }> {
    const nucleoli: Array<{ x: number; y: number; size: number }> = [];
    const threshold = 0.8;
    
    for (let i = 0; i < nucleusData.length; i++) {
      if (nucleusData[i] > threshold) {
        // Simple nucleoli detection based on intensity
        nucleoli.push({
          x: i % this.canvas.width,
          y: Math.floor(i / this.canvas.width),
          size: 1
        });
      }
    }
    
    return this.mergeNucleoli(nucleoli);
  }

  private mergeNucleoli(
    nucleoli: Array<{ x: number; y: number; size: number }>
  ): Array<{ x: number; y: number; size: number }> {
    const merged: Array<{ x: number; y: number; size: number }> = [];
    const used = new Set<number>();
    
    for (let i = 0; i < nucleoli.length; i++) {
      if (used.has(i)) continue;
      
      let current = nucleoli[i];
      used.add(i);
      
      for (let j = i + 1; j < nucleoli.length; j++) {
        if (used.has(j)) continue;
        
        const other = nucleoli[j];
        const distance = Math.sqrt(
          Math.pow(current.x - other.x, 2) + Math.pow(current.y - other.y, 2)
        );
        
        if (distance < 2) {
          current = {
            x: (current.x + other.x) / 2,
            y: (current.y + other.y) / 2,
            size: current.size + other.size
          };
          used.add(j);
        }
      }
      
      merged.push(current);
    }
    
    return merged;
  }

  private analyzeNuclearShape(nucleusData: Float32Array): 'normal' | 'irregular' | 'cleaved' | 'folded' {
    const perimeter = this.calculateNuclearPerimeter(nucleusData);
    const area = this.calculateNuclearArea(nucleusData);
    const circularity = (4 * Math.PI * area) / (perimeter * perimeter);
    
    if (circularity > 0.8) return 'normal';
    if (circularity > 0.6) return 'irregular';
    if (circularity > 0.4) return 'cleaved';
    return 'folded';
  }

  private calculateNuclearPerimeter(nucleusData: Float32Array): number {
    let perimeter = 0;
    const width = Math.sqrt(nucleusData.length);
    
    for (let y = 1; y < width - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        if (nucleusData[idx] > 0.5) {
          if (nucleusData[idx - 1] <= 0.5 || 
              nucleusData[idx + 1] <= 0.5 ||
              nucleusData[idx - width] <= 0.5 || 
              nucleusData[idx + width] <= 0.5) {
            perimeter++;
          }
        }
      }
    }
    
    return perimeter;
  }

  private calculateNuclearArea(nucleusData: Float32Array): number {
    return nucleusData.reduce((sum, val) => sum + (val > 0.5 ? 1 : 0), 0);
  }

  private calculateNCRatio(
    cell: { radius: number },
    nucleusData: Float32Array
  ): number {
    const cellArea = Math.PI * cell.radius * cell.radius;
    const nucleusArea = this.calculateNuclearArea(nucleusData);
    return nucleusArea / cellArea;
  }

  private determineLeukocyteType(
    cellType: BloodCellType,
    nuclearFeatures: any
  ): LeukocyteType | undefined {
    if (cellType !== 'leukocyte' && cellType !== 'blast') return undefined;
    
    const { chromatin, nucleoli, shape, ncRatio } = nuclearFeatures;
    
    if (cellType === 'blast') {
      if (chromatin === 'loose' && nucleoli) {
        return ncRatio > 0.8 ? 'myelobl ast' : 'lymphoblast';
      }
      return 'blast';
    }
    
    // Determine mature leukocyte type
    if (shape === 'segmented' && chromatin === 'condensed') return 'neutrophil';
    if (shape === 'round' && chromatin === 'condensed') return 'lymphocyte';
    if (shape === 'irregular' && chromatin === 'loose') return 'monocyte';
    if (chromatin === 'condensed' && ncRatio > 0.7) return 'eosinophil';
    if (chromatin === 'condensed' && ncRatio > 0.6) return 'basophil';
    
    return 'neutrophil'; // Default case
  }

  private assessCellularMaturation(cells: BloodCellData[]): MaturationAssessment[] {
    const assessments: MaturationAssessment[] = [];
    
    // Assess myeloid maturation
    const myeloidCells = cells.filter(cell => 
      cell.cellType === 'leukocyte' || 
      (cell.cellType === 'blast' && cell.leukocyteType === 'myeloblast')
    );
    
    if (myeloidCells.length > 0) {
      const myeloidAssessment = {
        lineage: 'myeloid' as const,
        maturationStages: this.calculateMaturationStages(myeloidCells, 'myeloid'),
        dysplasticFeatures: this.identifyDysplasticFeatures(myeloidCells, 'myeloid'),
        conclusion: this.generateMaturationConclusion(myeloidCells, 'myeloid')
      };
      assessments.push(myeloidAssessment);
    }
    
    // Assess erythroid maturation
    const erythroidCells = cells.filter(cell => 
      cell.cellType === 'erythrocyte' || 
      cell.cellType === 'megaloblast'
    );
    
    if (erythroidCells.length > 0) {
      const erythroidAssessment = {
        lineage: 'erythroid' as const,
        maturationStages: this.calculateMaturationStages(erythroidCells, 'erythroid'),
        dysplasticFeatures: this.identifyDysplasticFeatures(erythroidCells, 'erythroid'),
        conclusion: this.generateMaturationConclusion(erythroidCells, 'erythroid')
      };
      assessments.push(erythroidAssessment);
    }
    
    return assessments;
  }

  private calculateMaturationStages(
    cells: BloodCellData[],
    lineage: 'myeloid' | 'erythroid'
  ) {
    const stages = [];
    const criteria = this.MATURATION_CRITERIA[lineage];
    
    for (const [stage, requirements] of Object.entries(criteria)) {
      const matchingCells = cells.filter(cell => {
        const measurements = cell.measurements;
        const morphology = cell.morphology;
        
        return (
          measurements.diameter >= requirements.size[0] &&
          measurements.diameter <= requirements.size[1] &&
          morphology.nuclearFeatures?.chromatin === requirements.chromatin &&
          morphology.nuclearFeatures?.nucleoli === requirements.nucleoli
        );
      });
      
      stages.push({
        stage,
        percentage: (matchingCells.length / cells.length) * 100,
        abnormalities: this.identifyStageDysplasia(matchingCells, stage)
      });
    }
    
    return stages;
  }

  private identifyDysplasticFeatures(
    cells: BloodCellData[],
    lineage: 'myeloid' | 'erythroid' | 'megakaryocytic'
  ): string[] {
    const features = new Set<string>();
    const criteria = this.DYSPLASIA_FEATURES[lineage];
    
    cells.forEach(cell => {
      const morphology = cell.morphology;
      const measurements = cell.measurements;
      
      criteria.forEach(feature => {
        switch (feature) {
          case 'nuclear budding':
            if (morphology.nuclearFeatures?.shape === 'irregular') features.add(feature);
            break;
          case 'internuclear bridging':
            if (morphology.nuclearFeatures?.shape === 'irregular') features.add(feature);
            break;
          case 'megaloblastic changes':
            if (morphology.size === 'megaloblastic') features.add(feature);
            break;
          case 'hypogranulation':
            if (cell.cellType === 'leukocyte' && measurements.intensity < 0.3) features.add(feature);
            break;
          case 'pseudo-Pelger-Huet':
            if (morphology.nuclearFeatures?.shape === 'irregular') features.add(feature);
            break;
          // Add more specific criteria checks
        }
      });
    });
    
    return Array.from(features);
  }

  private identifyStageDysplasia(cells: BloodCellData[], stage: string): string[] {
    const abnormalities: string[] = [];
    
    cells.forEach(cell => {
      const morphology = cell.morphology;
      
      if (morphology.size !== 'normal') {
        abnormalities.push(`Tamanho anormal em ${stage}`);
      }
      
      if (morphology.nuclearFeatures?.chromatin === 'abnormal') {
        abnormalities.push(`Cromatina anormal em ${stage}`);
      }
      
      if (morphology.shape !== 'normal') {
        abnormalities.push(`Forma anormal em ${stage}`);
      }
    });
    
    return [...new Set(abnormalities)];
  }

  private generateMaturationConclusion(
    cells: BloodCellData[],
    lineage: 'myeloid' | 'erythroid'
  ): string {
    const totalCells = cells.length;
    const immatureCells = cells.filter(cell => 
      cell.morphology.maturity === 'immature' || 
      cell.morphology.maturity === 'blast'
    ).length;
    
    const immaturityRatio = immatureCells / totalCells;
    const dysplasticFeatures = this.identifyDysplasticFeatures(cells, lineage);
    
    if (immaturityRatio > 0.2) {
      return `Maturação ${lineage} alterada com bloqueio maturativo. ${
        dysplasticFeatures.length > 0 
          ? `Características displásicas: ${dysplasticFeatures.join(', ')}.` 
          : ''
      }`;
    }
    
    if (dysplasticFeatures.length > 0) {
      return `Maturação ${lineage} com alterações displásicas: ${dysplasticFeatures.join(', ')}.`;
    }
    
    return `Maturação ${lineage} sem alterações significativas.`;
  }

  private performDifferentialCount(cells: BloodCellData[]): DifferentialCount[] {
    const totalLeukocytes = cells.filter(cell => 
      cell.cellType === 'leukocyte' || 
      cell.cellType === 'blast'
    ).length;
    
    const counts = new Map<LeukocyteType, number>();
    const morphologyNotes = new Map<LeukocyteType, Set<string>>();
    
    cells.forEach(cell => {
      if (cell.leukocyteType) {
        counts.set(cell.leukocyteType, (counts.get(cell.leukocyteType) || 0) + 1);
        
        if (!morphologyNotes.has(cell.leukocyteType)) {
          morphologyNotes.set(cell.leukocyteType, new Set());
        }
        
        const notes = morphologyNotes.get(cell.leukocyteType)!;
        if (cell.morphology.nuclearFeatures?.shape !== 'normal') {
          notes.add(`Alteração nuclear: ${cell.morphology.nuclearFeatures?.shape}`);
        }
        if (cell.characteristics.length > 0) {
          notes.add(`Características: ${cell.characteristics.join(', ')}`);
        }
      }
    });
    
    return Array.from(counts.entries()).map(([type, count]) => ({
      cellType: type,
      percentage: (count / totalLeukocytes) * 100,
      absoluteCount: count,
      morphologyNotes: Array.from(morphologyNotes.get(type) || [])
    }));
  }

  private analyzeDysplasticFeatures(cells: BloodCellData[]): {
    erythroid: string[];
    myeloid: string[];
    megakaryocytic: string[];
    severity: 'mild' | 'moderate' | 'severe';
  } {
    const erythroidCells = cells.filter(cell => 
      cell.cellType === 'erythrocyte' || 
      cell.cellType === 'megaloblast'
    );
    
    const myeloidCells = cells.filter(cell => 
      cell.cellType === 'leukocyte' || 
      cell.cellType === 'blast'
    );
    
    const erythroidFeatures = this.identifyDysplasticFeatures(erythroidCells, 'erythroid');
    const myeloidFeatures = this.identifyDysplasticFeatures(myeloidCells, 'myeloid');
    const megakaryocyticFeatures = this.identifyDysplasticFeatures([], 'megakaryocytic'); // Placeholder
    
    const totalFeatures = 
      erythroidFeatures.length + 
      myeloidFeatures.length + 
      megakaryocyticFeatures.length;
    
    let severity: 'mild' | 'moderate' | 'severe';
    if (totalFeatures > 5) severity = 'severe';
    else if (totalFeatures > 2) severity = 'moderate';
    else severity = 'mild';
    
    return {
      erythroid: erythroidFeatures,
      myeloid: myeloidFeatures,
      megakaryocytic: megakaryocyticFeatures,
      severity
    };
  }

  private generateComprehensiveDiagnosis(
    cells: BloodCellData[],
    statistics: BloodAnalysisStatistics,
    maturationAssessment: MaturationAssessment[],
    differentialCount: DifferentialCount[],
    dysplasiaAnalysis: any
  ): string {
    const findings: string[] = [];
    
    // Analyze blast percentage
    const blastPercentage = statistics.ratios.blastPercentage;
    if (blastPercentage > 20) {
      findings.push(`ALERTA: ${blastPercentage.toFixed(1)}% de blastos - Suspeita de Leucemia Aguda`);
    } else if (blastPercentage > 5) {
      findings.push(`Aumento de blastos (${blastPercentage.toFixed(1)}%) - Avaliar Síndrome Mielodisplásica`);
    }
    
    // Analyze dysplasia
    if (dysplasiaAnalysis.severity !== 'mild') {
      findings.push(`Alterações displásicas ${dysplasiaAnalysis.severity === 'severe' ? 'graves' : 'moderadas'}:`);
      if (dysplasiaAnalysis.erythroid.length > 0) {
        findings.push(`- Série eritróide: ${dysplasiaAnalysis.erythroid.join(', ')}`);
      }
      if (dysplasiaAnalysis.myeloid.length > 0) {
        findings.push(`- Série mielóide: ${dysplasiaAnalysis.myeloid.join(', ')}`);
      }
    }
    
    // Analyze maturation patterns
    maturationAssessment.forEach(assessment => {
      if (assessment.dysplasticFeatures.length > 0) {
        findings.push(`Alterações na maturação ${assessment.lineage}:`);
        findings.push(`- ${assessment.conclusion}`);
      }
    });
    
    // Analyze differential count
    const abnormalDifferential = differentialCount.filter(count => 
      count.morphologyNotes.length > 0 || 
      count.percentage > 20
    );
    
    if (abnormalDifferential.length > 0) {
      findings.push('\nContagem diferencial alterada:');
      abnormalDifferential.forEach(count => {
        findings.push(`- ${count.cellType}: ${count.percentage.toFixed(1)}% ${
          count.morphologyNotes.length > 0 
            ? `(${count.morphologyNotes.join(', ')})` 
            : ''
        }`);
      });
    }
    
    // Add pathology counts
    Object.entries(statistics.pathologyCounts).forEach(([pathology, count]) => {
      if (count > 0) {
        findings.push(`\n${pathology}: ${this.PATHOLOGY_DESCRIPTIONS[pathology as PathologyType]}\nQuantidade: ${count} células`);
      }
    });
    
    // Generate final conclusion
    let conclusion = 'CONCLUSÃO:\n';
    if (findings.length > 0) {
      conclusion += findings.join('\n\n');
      conclusion += '\n\nRECOMENDAÇÕES:\n';
      if (blastPercentage > 20) {
        conclusion += '- Encaminhamento URGENTE para hematologista\n';
        conclusion += '- Considerar biópsia de medula óssea\n';
        conclusion += '- Imunofenotipagem recomendada';
      } else if (dysplasiaAnalysis.severity !== 'mild' || blastPercentage > 5) {
        conclusion += '- Avaliação hematológica especializada\n';
        conclusion += '- Considerar investigação de Síndrome Mielodisplásica\n';
        conclusion += '- Acompanhamento periódico recomendado';
      } else {
        conclusion += '- Acompanhamento clínico regular\n';
        conclusion += '- Repetir hemograma em 30 dias';
      }
    } else {
      conclusion += 'Sem alterações morfológicas significativas. Padrão hematológico dentro da normalidade.';
    }
    
    return conclusion;
  }

  private drawDetailedAnnotations(
    cells: Array<{ x: number; y: number; radius: number }>,
    cellData: BloodCellData[],
    maturationAssessment: MaturationAssessment[]
  ) {
    cells.forEach((cell, index) => {
      const data = cellData[index];
      
      // Draw cell outline
      this.ctx.beginPath();
      this.ctx.arc(cell.x, cell.y, cell.radius, 0, 2 * Math.PI);
      this.ctx.strokeStyle = this.getCellColor(data);
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      // Add detailed labels
      if (data.pathologyIndicators.length > 0 || data.characteristics.length > 0) {
        this.ctx.fillStyle = this.ctx.strokeStyle;
        this.ctx.font = '10px Arial';
        
        // Cell type and ID
        this.ctx.fillText(
          `#${data.id}: ${data.cellType}${data.leukocyteType ? ` (${data.leukocyteType})` : ''}`,
          cell.x - cell.radius,
          cell.y - cell.radius - 15
        );
        
        // Pathology indicators
        if (data.pathologyIndicators.length > 0) {
          this.ctx.fillText(
            `Patologia: ${data.pathologyIndicators.join(', ')}`,
            cell.x - cell.radius,
            cell.y - cell.radius - 5
          );
        }
        
        // Morphological features
        if (data.characteristics.length > 0) {
          this.ctx.fillText(
            `Características: ${data.characteristics.join(', ')}`,
            cell.x - cell.radius,
            cell.y - cell.radius + 5
          );
        }
      }
      
      // Draw nuclear features if present
      if (data.morphology.nuclearFeatures) {
        this.ctx.beginPath();
        const nuclearRadius = cell.radius * Math.sqrt(data.morphology.nuclearFeatures.ncRatio);
        this.ctx.arc(cell.x, cell.y, nuclearRadius, 0, 2 * Math.PI);
        this.ctx.strokeStyle = '#000066';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
      }
    });
    
    // Add maturation assessment summary
    let y = 30;
    this.ctx.fillStyle = '#000000';
    this.ctx.font = '12px Arial';
    
    maturationAssessment.forEach(assessment => {
      this.ctx.fillText(
        `${assessment.lineage} Maturation: ${assessment.conclusion}`,
        10,
        y
      );
      y += 20;
      
      if (assessment.dysplasticFeatures.length > 0) {
        this.ctx.fillText(
          `Dysplastic Features: ${assessment.dysplasticFeatures.join(', ')}`,
          20,
          y
        );
        y += 20;
      }
    });
  }
}