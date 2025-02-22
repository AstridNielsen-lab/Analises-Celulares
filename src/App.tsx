import React, { useState, useCallback } from 'react';
import { Upload, Microscope, Phone, Globe } from 'lucide-react';
import { CellAnalyzer } from './utils/cellAnalysis';
import { CellAnalysisResult } from './types/analysis';

const cellAnalyzer = new CellAnalyzer();

export default function App() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<CellAnalysisResult | null>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!selectedFile) return;
    
    setIsAnalyzing(true);
    try {
      const analysisResults = await cellAnalyzer.analyzeImage(selectedFile);
      setResults(analysisResults);
    } catch (error) {
      console.error('Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [selectedFile]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Microscope className="w-8 h-8 text-purple-600" />
            <h1 className="text-2xl font-bold text-gray-900">Análise Oncológica Celular</h1>
          </div>
          <div className="flex items-center space-x-4">
            <a
              href="https://likelook.wixsite.com/solutions"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-gray-600 hover:text-purple-600"
            >
              <Globe className="w-5 h-5" />
              <span className="hidden sm:inline">Like Look Solutions</span>
            </a>
            <a
              href="https://wa.me/5511970603441"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1 text-gray-600 hover:text-green-600"
            >
              <Phone className="w-5 h-5" />
              <span className="hidden sm:inline">Contato</span>
            </a>
          </div>
        </div>
      </header>

      {/* Usage Instructions */}
      <div className="bg-purple-50 border-b border-purple-100">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h2 className="text-lg font-semibold text-purple-900 mb-3">Como Usar</h2>
              <ol className="space-y-2 text-purple-800">
                <li>1. Faça upload de uma imagem microscópica</li>
                <li>2. Clique em "Analisar Células" para iniciar</li>
                <li>3. Aguarde o processamento da imagem</li>
                <li>4. Visualize o relatório detalhado da análise</li>
              </ol>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-purple-900 mb-3">Arquivos Aceitos</h2>
              <ul className="space-y-2 text-purple-800">
                <li>• Imagens de Microscopia</li>
                <li>• Formatos: PNG, JPG, JPEG</li>
                <li>• Tamanho máximo: 10MB</li>
                <li>• Resolução mínima: 1024x1024 pixels</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Upload da Imagem Microscópica</h2>
            
            {!previewUrl ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Clique para upload ou arraste a imagem
                    </span>
                    <input
                      id="file-upload"
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={handleFileSelect}
                    />
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    PNG, JPG até 10MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-auto rounded-lg"
                />
                <button
                  onClick={() => {
                    setPreviewUrl(null);
                    setSelectedFile(null);
                    setResults(null);
                  }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            )}

            {previewUrl && !isAnalyzing && !results && (
              <button
                onClick={handleAnalyze}
                className="mt-4 w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 flex items-center justify-center space-x-2"
              >
                <Microscope className="w-5 h-5" />
                <span>Analisar Células</span>
              </button>
            )}

            {isAnalyzing && (
              <div className="mt-4 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Analisando células...</p>
              </div>
            )}
          </div>

          {/* Results Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-4">Resultados da Análise</h2>
            
            {!results ? (
              <div className="text-center text-gray-500 py-12">
                <Microscope className="mx-auto h-12 w-12" />
                <p className="mt-2">Nenhuma análise realizada</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Diagnosis Summary */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="font-medium text-lg mb-2">Diagnóstico</h3>
                  <p className={`text-lg font-medium ${
                    results.abnormalityLevel === 'high' 
                      ? 'text-red-600' 
                      : results.abnormalityLevel === 'medium'
                      ? 'text-yellow-600'
                      : 'text-green-600'
                  }`}>
                    {results.diagnosis}
                  </p>
                </div>

                {/* Statistics */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Estatísticas</h4>
                    <ul className="space-y-2">
                      <li>Total de Células: {results.statistics.totalCells}</li>
                      <li>Células Anormais: {results.statistics.abnormalCells}</li>
                      <li>Infestação: {results.statistics.infestationPercentage.toFixed(1)}%</li>
                    </ul>
                  </div>

                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Tempo de Análise</h4>
                    <p>{(results.executionTime / 1000).toFixed(2)} segundos</p>
                  </div>
                </div>

                {/* Detected Cells */}
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">Células Detectadas</h4>
                  <div className="max-h-60 overflow-y-auto">
                    {results.cells.map((cell) => (
                      <div key={cell.id} className="border-b py-2 last:border-b-0">
                        <div className="flex justify-between items-start">
                          <span className="font-medium">
                            Célula #{cell.id}
                          </span>
                          <span className="text-sm">
                            Localização: {cell.location}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          Tamanho: {cell.size.toFixed(0)} px² | 
                          Forma: {cell.shape.toFixed(2)} | 
                          Características: {cell.characteristics.join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Processed Image */}
                {results.processedImageUrl && (
                  <div className="border rounded-lg p-4">
                    <h4 className="font-medium mb-2">Imagem Processada</h4>
                    <img
                      src={results.processedImageUrl}
                      alt="Processed"
                      className="w-full h-auto rounded-lg"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-8">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="text-center text-gray-600 text-sm">
            <p>© 2024 Like Look Solutions. Desenvolvido por Julio Campos Machado</p>
            <p className="mt-1">
              <a
                href="https://wa.me/5511970603441"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-600 hover:text-purple-800"
              >
                Contato: +55 11 97060-3441
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}