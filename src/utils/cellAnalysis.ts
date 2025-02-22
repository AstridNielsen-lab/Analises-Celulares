import { 
  CellAnalysisResult, 
  BloodCellData, 
  CellAnalysisLevel, 
  BloodCellType,
  PathologyType,
  BloodAnalysisStatistics
} from '../types/analysis';

export class CellAnalyzer {
  // Catalog of detectable pathologies with descriptions
  private readonly PATHOLOGY_DESCRIPTIONS: { [key in PathologyType]: string } = {
    anemia: "Condição caracterizada por uma deficiência em glóbulos vermelhos ou hemoglobina, resultando em menor transporte de oxigênio. Indicadores: microcitose e hipocromia.",
    polycythemia: "Aumento anormal dos glóbulos vermelhos, podendo levar ao espessamento do sangue e riscos de trombose. Indicadores: macrocitose e hemoglobina elevada.",
    sickleCell: "Distúrbio genético que causa a formação de hemácias em forma de foice, provocando anemia hemolítica e crises vaso-oclusivas.",
    spherocytosis: "Condição em que as hemácias assumem formato esférico em vez de bicôncavo, frequentemente ocasionando anemia hemolítica e aumento do MCHC.",
    elliptocytosis: "Alteração na forma das hemácias, que ficam alongadas ou elípticas, podendo reduzir a eficiência no transporte de oxigênio.",
    leukemia: "Grupo de cânceres que afetam os glóbulos brancos, caracterizados pela produção excessiva de células anormais, comprometendo a função imunológica.",
    lymphoma: "Tipo de câncer que afeta os linfócitos, podendo causar aumento dos linfonodos e alterações na contagem celular periférica.",
    myeloma: "Câncer das células plasmáticas, frequentemente associado a produção anormal de proteínas e alterações nas contagens sanguíneas.",
    thrombocytopenia: "Condição marcada por baixa contagem de plaquetas, aumentando o risco de sangramentos e hematomas.",
    thalassemia: "Doença hereditária que afeta a produção de hemoglobina, resultando em anemia microcítica e hipocrômica com diferentes graus de severidade.",
    neutrophilia: "Elevação na contagem de neutrófilos, geralmente sinal de infecção, inflamação ou resposta ao estresse.",
    lymphocytosis: "Aumento dos linfócitos, podendo indicar infecções virais, inflamação crônica ou distúrbios hematológicos.",
    monocytosis: "Elevação dos monócitos, frequentemente associada a processos inflamatórios crônicos, infecções ou desordens hematológicas.",
    eosinophilia: "Aumento dos eosinófilos, comumente relacionado a reações alérgicas, infecções parasitárias ou condições autoimunes.",
    basophilia: "Contagem elevada de basófilos, que pode ocorrer em reações alérgicas, inflamações crônicas ou desordens mieloproliferativas."
  };

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private startTime: Date;

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
    }
  };

  // Kernel for Gaussian blur
  private readonly GAUSSIAN_KERNEL = [
    [0.075, 0.124, 0.075],
    [0.124, 0.204, 0.124],
    [0.075, 0.124, 0.075]
  ];

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.startTime = new Date();
  }

  // Method to get the complete pathology catalog
  public getPathologyCatalog(): { [key in PathologyType]: string } {
    return this.PATHOLOGY_DESCRIPTIONS;
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
      const statistics = this.calculateStatistics(cellData);
      
      this.drawAnnotations(cells, cellData);
      
      const executionTime = new Date().getTime() - this.startTime.getTime();
      
      return {
        cells: cellData,
        statistics,
        executionTime,
        abnormalityLevel: this.determineAbnormalityLevel(statistics),
        diagnosis: this.generateDetailedDiagnosis(cellData as BloodCellData[], statistics as BloodAnalysisStatistics),
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
    
    // Conversão para escala de cinza com peso aprimorado para características das células
    for (let i = 0; i < data.length; i += 4) {
      let grayscale = (
        data[i] * 0.4 +     // Canal vermelho (importante para hemácias)
        data[i + 1] * 0.3 + // Canal verde
        data[i + 2] * 0.3   // Canal azul
      );
      processed[i / 4] = grayscale / 255;
    }

    const blurred = this.applyGaussianBlur(processed, width, height);
    const edges = this.applyEdgeDetection(blurred, width, height);
    return this.applyAdaptiveThreshold(edges, width, height);
  }

  private applyGaussianBlur(data: Float32Array, width: number, height: number): Float32Array {
    const output = new Float32Array(data.length);
    const kernelSize = 3;
    const offset = Math.floor(kernelSize / 2);

    for (let y = offset; y < height - offset; y++) {
      for (let x = offset; x < width - offset; x++) {
        let sum = 0;
        for (let ky = 0; ky < kernelSize; ky++) {
          for (let kx = 0; kx < kernelSize; kx++) {
            const px = x + (kx - offset);
            const py = y + (ky - offset);
            const kernel = this.GAUSSIAN_KERNEL[ky][kx];
            sum += data[py * width + px] * kernel;
          }
        }
        output[y * width + x] = sum;
      }
    }
    return output;
  }

  private applyEdgeDetection(data: Float32Array, width: number, height: number): Float32Array {
    const edges = new Float32Array(data.length);
    const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
    const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        let gx = 0, gy = 0;
        for (let ky = 0; ky < 3; ky++) {
          for (let kx = 0; kx < 3; kx++) {
            const pixel = data[(y + ky - 1) * width + (x + kx - 1)];
            gx += pixel * sobelX[ky][kx];
            gy += pixel * sobelY[ky][kx];
          }
        }
        edges[y * width + x] = Math.sqrt(gx * gx + gy * gy);
      }
    }
    return edges;
  }

  private applyAdaptiveThreshold(data: Float32Array, width: number, height: number): Float32Array {
    const output = new Float32Array(data.length);
    const windowSize = 15;
    const offset = Math.floor(windowSize / 2);
    const C = 0.02;
    for (let y = offset; y < height - offset; y++) {
      for (let x = offset; x < width - offset; x++) {
        let sum = 0, count = 0;
        for (let wy = -offset; wy <= offset; wy++) {
          for (let wx = -offset; wx <= offset; wx++) {
            const px = x + wx;
            const py = y + wy;
            sum += data[py * width + px];
            count++;
          }
        }
        const mean = sum / count;
        const threshold = mean - C;
        output[y * width + x] = data[y * width + x] > threshold ? 1 : 0;
      }
    }
    return output;
  }

  private detectCells(data: Float32Array, imageData: ImageData): Array<{ x: number; y: number; radius: number }> {
    const cells: Array<{ x: number; y: number; radius: number }> = [];
    const visited = new Set<number>();
    const threshold = 0.2;

    for (let y = 0; y < this.canvas.height; y++) {
      for (let x = 0; x < this.canvas.width; x++) {
        const i = y * this.canvas.width + x;
        if (!visited.has(i) && data[i] > threshold) {
          const radius = this.estimateRadius(x, y, data);
          if (radius > 2) {
            cells.push({ x, y, radius });
            this.markVisited(x, y, radius, visited);
          }
        }
      }
    }
    return this.mergeCells(cells);
  }

  private estimateRadius(x: number, y: number, data: Float32Array): number {
    let radius = 0;
    const maxRadius = 50;
    const threshold = 0.2;
    for (let r = 1; r <= maxRadius; r++) {
      let edgeCount = 0, totalPoints = 0;
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const px = Math.round(x + r * Math.cos(angle));
        const py = Math.round(y + r * Math.sin(angle));
        if (px >= 0 && px < this.canvas.width && py >= 0 && py < this.canvas.height) {
          totalPoints++;
          if (data[py * this.canvas.width + px] > threshold) {
            edgeCount++;
          }
        }
      }
      if (totalPoints > 0 && edgeCount / totalPoints > 0.5) {
        radius = r;
        break;
      }
    }
    return radius;
  }

  private markVisited(x: number, y: number, radius: number, visited: Set<number>) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const px = x + dx;
          const py = y + dy;
          if (px >= 0 && px < this.canvas.width && py >= 0 && py < this.canvas.height) {
            visited.add(py * this.canvas.width + px);
          }
        }
      }
    }
  }

  private mergeCells(cells: Array<{ x: number; y: number; radius: number }>): Array<{ x: number; y: number; radius: number }> {
    const merged: Array<{ x: number; y: number; radius: number }> = [];
    const used = new Set<number>();
    for (let i = 0; i < cells.length; i++) {
      if (used.has(i)) continue;
      let cell = cells[i];
      used.add(i);
      for (let j = i + 1; j < cells.length; j++) {
        if (used.has(j)) continue;
        const other = cells[j];
        const distance = Math.sqrt(
          Math.pow(cell.x - other.x, 2) + Math.pow(cell.y - other.y, 2)
        );
        if (distance < (cell.radius + other.radius) * 0.5) {
          cell = {
            x: Math.round((cell.x + other.x) / 2),
            y: Math.round((cell.y + other.y) / 2),
            radius: Math.max(cell.radius, other.radius)
          };
          used.add(j);
        }
      }
      merged.push(cell);
    }
    return merged;
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
      const cellType = this.determineCellType(cell.radius, colorProfile);
      const morphology = this.analyzeMorphology(cell.radius, shape, colorProfile);
      const pathologyIndicators = this.identifyPathologies(cellType, morphology);
      return {
        id: index + 1,
        size,
        shape,
        colorDifference: colorProfile.difference,
        location: this.determineLocation(cell),
        characteristics: this.determineCharacteristics(cell, shape, colorProfile.difference),
        cellType,
        pathologyIndicators,
        morphology
      };
    });
  }

  private calculateShape(
    cell: { x: number; y: number; radius: number },
    data: Float32Array
  ): number {
    let perimeter = 0, validPoints = 0;
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 16) {
      const px = Math.round(cell.x + cell.radius * Math.cos(angle));
      const py = Math.round(cell.y + cell.radius * Math.sin(angle));
      if (px >= 0 && px < this.canvas.width && py >= 0 && py < this.canvas.height) {
        validPoints++;
        if (data[py * this.canvas.width + px] > 0.5) {
          perimeter++;
        }
      }
    }
    return validPoints > 0 ? (4 * Math.PI * cell.radius * cell.radius) / (perimeter * perimeter) : 1;
  }

  private analyzeColorProfile(
    cell: { x: number; y: number; radius: number },
    imageData: ImageData
  ) {
    let sumR = 0, sumG = 0, sumB = 0, count = 0;
    const { data } = imageData;
    for (let y = cell.y - cell.radius; y <= cell.y + cell.radius; y++) {
      for (let x = cell.x - cell.radius; x <= cell.x + cell.radius; x++) {
        if (x >= 0 && x < this.canvas.width && y >= 0 && y < this.canvas.height) {
          const idx = (y * this.canvas.width + x) * 4;
          if (Math.pow(x - cell.x, 2) + Math.pow(y - cell.y, 2) <= Math.pow(cell.radius, 2)) {
            sumR += data[idx];
            sumG += data[idx + 1];
            sumB += data[idx + 2];
            count++;
          }
        }
      }
    }
    if (count === 0) return { r: 0, g: 0, b: 0, difference: 0 };
    const avgR = sumR / count;
    const avgG = sumG / count;
    const avgB = sumB / count;
    const difference = Math.sqrt(
      Math.pow(avgR - 220, 2) +
      Math.pow(avgG - 210, 2) +
      Math.pow(avgB - 210, 2)
    ) / 255;
    return { r: avgR, g: avgG, b: avgB, difference };
  }

  private determineCellType(radius: number, colorProfile: { r: number; g: number; b: number; difference: number }): BloodCellType {
    if (radius >= this.NORMAL_RANGES.leukocyte.size.min && radius <= this.NORMAL_RANGES.leukocyte.size.max) {
      return 'leukocyte';
    }
    if (radius >= this.NORMAL_RANGES.erythrocyte.size.min && 
        radius <= this.NORMAL_RANGES.erythrocyte.size.max &&
        colorProfile.r > colorProfile.g && colorProfile.r > colorProfile.b) {
      return 'erythrocyte';
    }
    if (radius >= this.NORMAL_RANGES.thrombocyte.size.min && 
        radius <= this.NORMAL_RANGES.thrombocyte.size.max) {
      return 'thrombocyte';
    }
    if (radius > this.NORMAL_RANGES.leukocyte.size.max) {
      return 'blast';
    }
    return 'abnormal';
  }

  private analyzeMorphology(radius: number, shape: number, colorProfile: { difference: number }) {
    return {
      size: this.determineSizeCategory(radius),
      shape: this.determineShapeCategory(shape),
      color: this.determineColorCategory(colorProfile.difference),
      inclusions: this.detectInclusions(colorProfile.difference)
    };
  }

  private determineSizeCategory(radius: number): 'normal' | 'microcytic' | 'macrocytic' {
    if (radius < this.NORMAL_RANGES.erythrocyte.size.min) return 'microcytic';
    if (radius > this.NORMAL_RANGES.erythrocyte.size.max) return 'macrocytic';
    return 'normal';
  }

  private determineShapeCategory(shape: number): 'normal' | 'sickle' | 'spherocytic' | 'elliptocytic' | 'irregular' {
    if (shape > 0.9) return 'normal';
    if (shape < 0.5) return 'sickle';
    if (shape < 0.7) return 'elliptocytic';
    if (shape < 0.8) return 'spherocytic';
    return 'irregular';
  }

  private determineColorCategory(colorDifference: number): 'normal' | 'hypochromic' | 'hyperchromic' {
    if (colorDifference < 0.2) return 'hypochromic';
    if (colorDifference > 0.4) return 'hyperchromic';
    return 'normal';
  }

  private detectInclusions(colorDifference: number): string[] {
    const inclusions: string[] = [];
    if (colorDifference > 0.6) inclusions.push('Howell-Jolly bodies');
    if (colorDifference > 0.7) inclusions.push('Pappenheimer bodies');
    return inclusions;
  }

  private identifyPathologies(cellType: BloodCellType, morphology: BloodCellData['morphology']): PathologyType[] {
    const pathologies: PathologyType[] = [];
    if (cellType === 'erythrocyte') {
      if (morphology.size === 'microcytic') pathologies.push('anemia');
      if (morphology.size === 'macrocytic') pathologies.push('polycythemia');
      if (morphology.shape === 'sickle') pathologies.push('sickleCell');
      if (morphology.shape === 'spherocytic') pathologies.push('spherocytosis');
      if (morphology.shape === 'elliptocytic') pathologies.push('elliptocytosis');
    }
    if (cellType === 'leukocyte') {
      pathologies.push('leukemia');
    }
    if (cellType === 'blast') {
      pathologies.push('leukemia');
      pathologies.push('lymphoma');
    }
    return pathologies;
  }

  private determineLocation(cell: { x: number; y: number }): string {
    const y = cell.y;
    if (y < this.canvas.height / 3) return 'superior';
    if (y > (this.canvas.height * 2) / 3) return 'inferior';
    return 'central';
  }

  private determineCharacteristics(
    cell: { radius: number },
    shape: number,
    colorDifference: number
  ): string[] {
    const characteristics: string[] = [];
    if (cell.radius > 10) characteristics.push('enlarged');
    else if (cell.radius < 4) characteristics.push('atrophied');
    if (shape < 0.8) characteristics.push('irregular');
    if (colorDifference > 0.3) characteristics.push('high intensity');
    if (colorDifference > 0.5) characteristics.push('possible malignant');
    return characteristics;
  }

  private calculateStatistics(cells: BloodCellData[]): BloodAnalysisStatistics {
    const totalCells = cells.length;
    const abnormalCells = cells.filter(c => 
      c.characteristics.includes('high intensity') ||
      c.characteristics.includes('irregular') ||
      c.characteristics.includes('enlarged')
    ).length;

    const cellCounts = {
      erythrocyte: 0,
      leukocyte: 0,
      thrombocyte: 0,
      blast: 0,
      abnormal: 0
    };

    const pathologyCounts = {
      anemia: 0,
      leukemia: 0,
      lymphoma: 0,
      myeloma: 0,
      thrombocytopenia: 0,
      polycythemia: 0,
      sickleCell: 0,
      thalassemia: 0,
      spherocytosis: 0,
      elliptocytosis: 0,
      neutrophilia: 0,
      lymphocytosis: 0,
      monocytosis: 0,
      eosinophilia: 0,
      basophilia: 0
    };

    cells.forEach(cell => {
      cellCounts[cell.cellType]++;
      cell.pathologyIndicators.forEach(pathology => {
        pathologyCounts[pathology]++;
      });
    });

    return {
      totalCells,
      abnormalCells,
      averageSize: cells.reduce((sum, c) => sum + c.size, 0) / totalCells,
      averageColorDifference: cells.reduce((sum, c) => sum + c.colorDifference, 0) / totalCells,
      infestationPercentage: (abnormalCells / totalCells) * 100,
      criticalAreas: cells.filter(c => c.characteristics.includes('possible malignant')).length,
      cellCounts,
      pathologyCounts,
      ratios: {
        neutrophilToLymphocyte: cellCounts.leukocyte > 0 ? cellCounts.leukocyte / totalCells : 0,
        redToWhiteCell: cellCounts.erythrocyte / (cellCounts.leukocyte || 1),
        plateletToRedCell: cellCounts.thrombocyte / (cellCounts.erythrocyte || 1)
      }
    };
  }

  private determineAbnormalityLevel(statistics: BloodAnalysisStatistics): CellAnalysisLevel {
    if (statistics.infestationPercentage > 30) return 'high';
    if (statistics.infestationPercentage > 10) return 'medium';
    return 'low';
  }

  private generateDetailedDiagnosis(cells: BloodCellData[], statistics: BloodAnalysisStatistics): string {
    const findings: string[] = [];

    // Analyze cell distribution
    if (statistics.cellCounts.blast > 0) {
      findings.push(`Presença de ${statistics.cellCounts.blast} células blásticas - Possível leucemia`);
    }

    if (statistics.cellCounts.abnormal > 0) {
      findings.push(`${statistics.cellCounts.abnormal} células com morfologia anormal`);
    }

    // Check for specific conditions and add their descriptions
    Object.entries(statistics.pathologyCounts).forEach(([pathology, count]) => {
      if (count > 0) {
        findings.push(`${pathology}: ${this.PATHOLOGY_DESCRIPTIONS[pathology as PathologyType]}\nQuantidade detectada: ${count} células`);
      }
    });

    // Add cell distribution analysis
    findings.push(`\nDistribuição celular:
- Eritrócitos: ${statistics.cellCounts.erythrocyte}
- Leucócitos: ${statistics.cellCounts.leukocyte}
- Plaquetas: ${statistics.cellCounts.thrombocyte}
- Células Blásticas: ${statistics.cellCounts.blast}
- Células Anormais: ${statistics.cellCounts.abnormal}

Índices importantes:
- Relação Neutrófilo/Linfócito: ${statistics.ratios.neutrophilToLymphocyte.toFixed(2)}
- Relação Hemácias/Leucócitos: ${statistics.ratios.redToWhiteCell.toFixed(2)}
- Relação Plaquetas/Hemácias: ${statistics.ratios.plateletToRedCell.toFixed(2)}`);

    // Generate comprehensive diagnosis
    if (findings.length > 0) {
      return `Análise Hematológica Detalhada:\n\n${findings.join('\n\n')}\n\nRecomendação: Avaliação hematológica especializada`;
    }

    return 'Padrão hematológico dentro dos parâmetros de normalidade';
  }

  private drawAnnotations(cells: Array<{ x: number; y: number; radius: number }>, cellData: BloodCellData[]) {
    cells.forEach((cell, index) => {
      const data = cellData[index];
      this.ctx.beginPath();
      this.ctx.arc(cell.x, cell.y, cell.radius, 0, 2 * Math.PI);
      this.ctx.strokeStyle = this.getCellColor(data);
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      if (data.pathologyIndicators.length > 0 || data.characteristics.length > 0) {
        this.ctx.fillStyle = this.ctx.strokeStyle;
        this.ctx.font = '10px Arial';
        this.ctx.fillText(
          `#${data.id}: ${data.cellType} - ${data.pathologyIndicators.join(', ')}`,
          cell.x - cell.radius,
          cell.y - cell.radius - 5
        );
      }
    });
  }

  private getCellColor(cell: BloodCellData): string {
    if (cell.pathologyIndicators.includes('leukemia')) return '#ff0000';
    if (cell.pathologyIndicators.includes('anemia')) return '#ff9900';
    if (cell.pathologyIndicators.includes('sickleCell')) return '#ff00ff';
    switch (cell.cellType) {
      case 'erythrocyte': return '#ff6b6b';
      case 'leukocyte': return '#4dabf7';
      case 'thrombocyte': return '#51cf66';
      case 'blast': return '#ff0000';
      default: return '#adb5bd';
    }
  }
}