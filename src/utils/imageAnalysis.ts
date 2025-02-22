import { MedicalAnalysisResult, AnomalyData, DiagnosisLevel } from '../types/analysis';

export class ImageAnalyzer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private startTime: Date;

  // Hounsfield unit ranges for different tissues
  private readonly HU_RANGES = {
    air: [-1000, -900],
    fat: [-120, -90],
    water: [-4, 4],
    softTissue: [20, 40],
    bone: [400, 1000],
    contrast: [100, 300]
  };

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.startTime = new Date();
  }

  async analyzeImage(imageFile: File): Promise<MedicalAnalysisResult> {
    this.startTime = new Date();
    console.log("Starting tomography analysis...");

    const image = await this.loadImage(imageFile);
    this.canvas.width = image.width;
    this.canvas.height = image.height;
    this.ctx.drawImage(image, 0, 0);

    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const { data, width, height } = imageData;

    // Preprocess the image
    const preprocessedData = this.preprocessImage(data);
    
    // Detect regions of interest
    const regions = this.detectAnomalousRegions(preprocessedData, width, height);
    
    // Analyze each region
    const anomalyData = this.analyzeAnomalies(regions, preprocessedData, width);
    
    // Calculate statistics
    const statistics = this.calculateStatistics(anomalyData);

    // Draw annotations on the canvas
    this.drawAnnotations(regions, anomalyData);

    const endTime = new Date();
    const executionTime = endTime.getTime() - this.startTime.getTime();

    return {
      anomalies: anomalyData,
      statistics,
      executionTime,
      abnormalityLevel: this.determineAbnormalityLevel(statistics),
      diagnosis: this.generateDiagnosis(anomalyData, statistics),
      processedImageUrl: this.canvas.toDataURL()
    };
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

  private preprocessImage(data: Uint8ClampedArray): Float32Array {
    const processed = new Float32Array(data.length / 4);
    
    // Convert to Hounsfield-like units and apply contrast enhancement
    for (let i = 0; i < data.length; i += 4) {
      const pixel = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
      // Approximate HU conversion (this would need calibration in a real system)
      const hu = this.pixelToHU(pixel);
      processed[i / 4] = hu;
    }

    return processed;
  }

  private pixelToHU(pixel: number): number {
    // Simplified conversion - in real CT machines this would be calibrated
    return (pixel - 128) * 2;
  }

  private detectAnomalousRegions(
    data: Float32Array,
    width: number,
    height: number
  ): Array<{ x: number; y: number; width: number; height: number; type: string }> {
    const regions: Array<{ x: number; y: number; width: number; height: number; type: string }> = [];
    const visited = new Set<number>();

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (visited.has(idx)) continue;

        const hu = data[idx];
        if (this.isAnomalousHU(hu)) {
          // Region growing
          const region = this.growRegion(data, width, height, x, y, visited);
          if (region) {
            regions.push({
              ...region,
              type: this.classifyRegion(region, data, width)
            });
          }
        }
      }
    }

    return regions;
  }

  private isAnomalousHU(hu: number): boolean {
    // Check if HU value is outside normal tissue ranges
    return (hu > this.HU_RANGES.softTissue[1] && hu < this.HU_RANGES.bone[0]) ||
           (hu > this.HU_RANGES.contrast[1]);
  }

  private growRegion(
    data: Float32Array,
    width: number,
    height: number,
    startX: number,
    startY: number,
    visited: Set<number>
  ) {
    const queue: [number, number][] = [[startX, startY]];
    const region = {
      x: startX,
      y: startY,
      width: 1,
      height: 1
    };

    while (queue.length > 0) {
      const [x, y] = queue.shift()!;
      const idx = y * width + x;
      
      if (visited.has(idx)) continue;
      visited.add(idx);

      // Update region bounds
      region.x = Math.min(region.x, x);
      region.y = Math.min(region.y, y);
      region.width = Math.max(region.width, x - region.x + 1);
      region.height = Math.max(region.height, y - region.y + 1);

      // Check neighbors
      const neighbors = [
        [x + 1, y], [x - 1, y],
        [x, y + 1], [x, y - 1]
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (!visited.has(nIdx) && this.isAnomalousHU(data[nIdx])) {
            queue.push([nx, ny]);
          }
        }
      }
    }

    return region;
  }

  private classifyRegion(
    region: { x: number; y: number; width: number; height: number },
    data: Float32Array,
    width: number
  ): string {
    let sumHU = 0;
    let count = 0;

    for (let y = region.y; y < region.y + region.height; y++) {
      for (let x = region.x; x < region.x + region.width; x++) {
        const hu = data[y * width + x];
        sumHU += hu;
        count++;
      }
    }

    const avgHU = sumHU / count;

    if (avgHU > this.HU_RANGES.contrast[0]) return 'aneurysm';
    if (avgHU > this.HU_RANGES.bone[0]) return 'calcification';
    if (avgHU < this.HU_RANGES.water[0]) return 'fluid';
    return 'mass';
  }

  private analyzeAnomalies(
    regions: Array<{ x: number; y: number; width: number; height: number; type: string }>,
    data: Float32Array,
    width: number
  ): AnomalyData[] {
    return regions.map((region, index) => {
      const size = region.width * region.height;
      const density = this.calculateRegionDensity(region, data, width);
      const irregularity = this.calculateIrregularity(region);

      return {
        id: index + 1,
        type: region.type as AnomalyData['type'],
        location: this.determineLocation(region),
        size,
        density,
        hounsfield: this.calculateAverageHU(region, data, width),
        irregularity,
        characteristics: this.determineCharacteristics(region, density, irregularity)
      };
    });
  }

  private calculateRegionDensity(
    region: { x: number; y: number; width: number; height: number },
    data: Float32Array,
    width: number
  ): number {
    let sum = 0;
    let count = 0;

    for (let y = region.y; y < region.y + region.height; y++) {
      for (let x = region.x; x < region.x + region.width; x++) {
        sum += data[y * width + x];
        count++;
      }
    }

    return count > 0 ? sum / count : 0;
  }

  private calculateAverageHU(
    region: { x: number; y: number; width: number; height: number },
    data: Float32Array,
    width: number
  ): number {
    return this.calculateRegionDensity(region, data, width);
  }

  private calculateIrregularity(
    region: { width: number; height: number }
  ): number {
    return Math.abs(1 - region.width / region.height);
  }

  private determineLocation(
    region: { x: number; y: number }
  ): string {
    // Simplified location determination - would need proper anatomical mapping
    const x = region.x;
    const y = region.y;
    
    if (y < this.canvas.height / 3) return 'superior';
    if (y > (this.canvas.height * 2) / 3) return 'inferior';
    return 'central';
  }

  private determineCharacteristics(
    region: { width: number; height: number },
    density: number,
    irregularity: number
  ): string[] {
    const characteristics: string[] = [];

    if (irregularity > 0.3) characteristics.push('irregular');
    if (region.width * region.height > 1000) characteristics.push('large');
    if (density > 100) characteristics.push('dense');

    return characteristics;
  }

  private calculateStatistics(anomalies: AnomalyData[]) {
    const totalAnomalies = anomalies.length;
    const densities = anomalies.map(a => a.density);
    const sizes = anomalies.map(a => a.size);
    const hounsfields = anomalies.map(a => a.hounsfield);
    
    return {
      totalAnomalies,
      averageDensity: densities.reduce((a, b) => a + b, 0) / totalAnomalies,
      averageSize: sizes.reduce((a, b) => a + b, 0) / totalAnomalies,
      maxHounsfield: Math.max(...hounsfields),
      minHounsfield: Math.min(...hounsfields),
      criticalLocations: anomalies.filter(a => 
        a.type === 'aneurysm' || 
        (a.size > 1000 && a.location === 'central')
      ).length
    };
  }

  private determineAbnormalityLevel(statistics: {
    totalAnomalies: number;
    criticalLocations: number;
  }): DiagnosisLevel {
    if (statistics.criticalLocations > 0) return 'high';
    if (statistics.totalAnomalies > 3) return 'medium';
    return 'low';
  }

  private generateDiagnosis(
    anomalies: AnomalyData[],
    statistics: { criticalLocations: number }
  ): string {
    if (statistics.criticalLocations > 0) {
      const criticalAnomalies = anomalies.filter(a => 
        a.type === 'aneurysm' || 
        (a.size > 1000 && a.location === 'central')
      );
      
      const descriptions = criticalAnomalies.map(a => 
        `${a.type} ${a.location} (${a.characteristics.join(', ')})`
      );
      
      return `Anomalia Crítica Detectada - ${descriptions.join('; ')} - Recomenda-se avaliação médica imediata`;
    }

    if (anomalies.length > 0) {
      return `Anomalias Detectadas - ${anomalies.length} regiões identificadas - Recomenda-se acompanhamento médico`;
    }

    return 'Nenhuma anomalia significativa detectada';
  }

  private drawAnnotations(
    regions: Array<{ x: number; y: number; width: number; height: number; type: string }>,
    anomalies: AnomalyData[]
  ) {
    regions.forEach((region, index) => {
      const anomaly = anomalies[index];
      
      // Draw region outline
      this.ctx.strokeStyle = this.getColorForType(anomaly.type);
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(region.x, region.y, region.width, region.height);
      
      // Add label
      this.ctx.fillStyle = this.getColorForType(anomaly.type);
      this.ctx.font = '12px Arial';
      this.ctx.fillText(
        `${anomaly.type} (${anomaly.characteristics.join(', ')})`,
        region.x,
        region.y - 5
      );
    });
  }

  private getColorForType(type: string): string {
    switch (type) {
      case 'aneurysm': return '#ff0000';
      case 'mass': return '#ff9900';
      case 'calcification': return '#00ff00';
      case 'fluid': return '#0000ff';
      default: return '#purple';
    }
  }
}