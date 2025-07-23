"use client";

import { useState } from "react";
import Image from "next/image";

// Interfaces para la estructura de la respuesta de la API
interface EmotionAnalysis {
  emotion: string;
  evidence: string;
}

interface KeyInteraction {
  question: string;
  response: string;
}

interface AnalysisResult {
  transcription: string;
  sentimentAnalysis: {
    overallSentiment: string;
    specificEmotions: EmotionAnalysis[];
  };
  reasonForCall: string;
  keyInteractions: KeyInteraction[];
  puntosDoterSolved: boolean;
}

// TODO: move to components
// Componente de carga (Loader)
const Loader = () => (
  <div className="flex justify-center items-center p-8">
    <svg className="animate-spin h-10 w-10 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  </div>
);

// Componente para visualizar la transcripción con estilos
const TranscriptionViewer = ({ transcription }: { transcription: string }) => {
  const lines = transcription.split('\n').filter(line => line.trim() !== '');
  return (
    <div className="space-y-3 font-mono text-sm">
      {lines.map((line, index) => {
        const parts = line.split(/:(.*)/s);
        const speaker = parts[0];
        const message = parts[1] || "";
        const isAgent = speaker.toLowerCase().includes('agente');
        return (
          <div key={index}>
            <strong className={isAgent ? 'text-cyan-400' : 'text-blue-400'}>{speaker}:</strong>
            <span className="text-gray-300 ml-2">{message.trim()}</span>
          </div>
        );
      })}
    </div>
  );
};

// Componente para el indicador de estado
const StatusIndicator = ({ isSolved }: { isSolved: boolean }) => {
  const bgColor = isSolved ? 'bg-green-900/50' : 'bg-red-900/50';
  const textColor = isSolved ? 'text-green-300' : 'text-red-300';
  const icon = isSolved ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
  );
  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${bgColor} ${textColor}`}>
      {icon}
      <span>{isSolved ? 'Resuelto' : 'No Resuelto'}</span>
    </div>
  );
};

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        setFile(selectedFile);
        setFileName(selectedFile.name);
        setAnalysis(null);
        setError(null);
    }
  };

  const handleAnalyzeClick = async () => {
    if (!file) {
      setError("Por favor, selecciona un archivo MP3 para analizar.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        // Opciones para la petición (timeout local)
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Error al analizar el archivo de audio.");
      }
      setAnalysis(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportToCsv = () => {
    if (!analysis) return;

    // Función para escapar comillas y manejar comas dentro de los datos
    const escapeCsvCell = (cellData: string) => {
      // Si la celda contiene comas, saltos de línea o comillas, rodéala con comillas dobles
      if (/[",\n]/.test(cellData)) {
        return `"${cellData.replace(/"/g, '""')}"`;
      }
      return cellData;
    };

    const headers = [
      "Motivo de la Llamada",
      "Problema Resuelto",
      "Sentimiento General",
      "Emociones Detectadas",
      "Interacciones Clave",
      "Transcripcion Completa"
    ];

    const emotions = analysis.sentimentAnalysis.specificEmotions
      .map(e => `${e.emotion}: ${e.evidence}`)
      .join(' | '); // Separador para múltiples emociones

    const interactions = analysis.keyInteractions
      .map(i => `P: ${i.question} R: ${i.response}`)
      .join(' | '); // Separador para múltiples interacciones

    const row = [
      escapeCsvCell(analysis.reasonForCall),
      analysis.puntosDoterSolved ? 'Sí' : 'No',
      escapeCsvCell(analysis.sentimentAnalysis.overallSentiment),
      escapeCsvCell(emotions),
      escapeCsvCell(interactions),
      escapeCsvCell(analysis.transcription)
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + row.join(",");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "analisis_llamada.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-[#0d1117] text-white font-sans min-h-screen">
      <div className="container mx-auto p-4 sm:p-8">
        <header className="flex flex-col items-center gap-4 text-center mb-10">
            <div className="relative w-[200px] h-[50px]"><Image src="/doters-logo_1.png" alt="Logo Doter's" fill style={{objectFit: "contain"}} priority /></div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-300">Panel de Análisis de Llamadas</h1>
            <p className="text-lg text-gray-400">Sube un archivo MP3 para obtener un desglose completo.</p>
        </header>

        <main className="flex flex-col gap-8 items-center w-full">
            <div className="w-full max-w-2xl mx-auto bg-[#161b22] border border-gray-700 p-6 rounded-xl shadow-lg">
                <div className="flex flex-col sm:flex-row gap-4 w-full items-center">
                    <label htmlFor="mp3-upload" className="w-full sm:w-auto flex-shrink-0 cursor-pointer text-center rounded-full bg-purple-600 text-white font-semibold py-2.5 px-6 hover:bg-purple-700 transition-all duration-300 ease-in-out">Seleccionar Archivo</label>
                    <input id="mp3-upload" type="file" accept="audio/mpeg" onChange={handleFileChange} className="hidden" />
                    {fileName && <span className="text-gray-400 truncate flex-grow">{fileName}</span>}
                    <button onClick={handleAnalyzeClick} disabled={!file || isLoading} className="w-full sm:w-auto ml-auto flex-shrink-0 rounded-full bg-blue-600 text-white font-bold py-2.5 px-8 hover:bg-blue-700 disabled:bg-gray-500 disabled:cursor-not-allowed transition-all duration-300 ease-in-out">Analizar Llamada</button>
                </div>
            </div>

            {error && <p className="text-red-400 bg-red-900/50 p-4 rounded-lg w-full max-w-6xl mx-auto text-center">{error}</p>}
            {isLoading && <Loader />}
            
            {analysis && (
            <div className="mt-4 w-full max-w-6xl mx-auto space-y-6">
                
                {/* --- NUEVA SECCIÓN DE ACCIONES CON BOTÓN DE EXPORTAR --- */}
                <div className="flex justify-end">
                    <button onClick={handleExportToCsv} className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-700 hover:bg-green-800 text-white font-semibold transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                        Exportar a CSV
                    </button>
                </div>

                <div className="p-6 border border-gray-700 rounded-xl bg-[#161b22] shadow-lg">
                    <div className="flex justify-between items-start mb-2">
                        <h2 className="text-xl font-semibold flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Resumen de la Llamada</h2>
                        <StatusIndicator isSolved={analysis.puntosDoterSolved} />
                    </div>
                    <p className="text-gray-300">{analysis.reasonForCall}</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="p-6 border border-gray-700 rounded-xl bg-[#161b22] shadow-lg">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Interacciones Clave</h2>
                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                                {analysis.keyInteractions.map((item, index) => (<div key={index}><p className="font-semibold text-gray-200">P: {item.question}</p><p className="text-gray-400 pl-4 border-l-2 border-blue-500 ml-2">R: {item.response}</p></div>))}
                            </div>
                        </div>
                        <div className="p-6 border border-gray-700 rounded-xl bg-[#161b22] shadow-lg">
                            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>Análisis de Sentimiento</h2>
                            <div className="space-y-4">
                                <div><h3 className="text-lg font-medium">Sentimiento General</h3><p className="text-gray-200 capitalize p-2 bg-blue-900/50 rounded-md inline-block mt-1">{analysis.sentimentAnalysis.overallSentiment}</p></div>
                                <div><h3 className="text-lg font-medium">Emociones Detectadas</h3><ul className="space-y-2 mt-2">{analysis.sentimentAnalysis.specificEmotions.map((emo, index) => (<li key={index} className="p-2 bg-gray-900/70 rounded-md"><strong className="capitalize text-gray-200">{emo.emotion}:</strong><span className="text-gray-400"> {emo.evidence}</span></li>))}</ul></div>
                            </div>
                        </div>
                    </div>
                    <div className="lg:col-span-3">
                        <div className="p-6 border border-gray-700 rounded-xl bg-[#161b22] shadow-lg h-full">
                            <h2 className="text-xl font-semibold mb-3 flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M9 6h6M9 18h6" /></svg>Transcripción Completa</h2>
                            <div className="max-h-[600px] overflow-y-auto p-4 bg-[#0d1117] rounded-md scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800"><TranscriptionViewer transcription={analysis.transcription} /></div>
                        </div>
                    </div>
                </div>
            </div>
            )}
        </main>
      </div>
    </div>
  );
}