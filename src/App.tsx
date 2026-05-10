import { useState, useEffect } from 'react';
import { Dropzone } from './components/Dropzone';
import { MetadataViewer } from './components/MetadataViewer';
import { extractPngMetadata } from './utils/pngParser';
import type { ParsedMetadata } from './utils/pngParser';
import { Aperture, RefreshCw } from 'lucide-react';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<ParsedMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setPreview(objectUrl);

      return () => URL.revokeObjectURL(objectUrl);
    }
  }, [file]);

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setLoading(true);
    setError(null);
    setMetadata(null);

    try {
      if (selectedFile.type === 'image/png') {
        const data = await extractPngMetadata(selectedFile);
        setMetadata(data);
      } else {
        setError('Currently, only PNG files are supported for robust metadata extraction.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while parsing the image metadata.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setMetadata(null);
    setError(null);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo-container">
          <Aperture className="logo-icon" size={32} />
          <h1>Image Prompt Parser</h1>
        </div>
        <div className="header-links">
          <a href="https://github.com/iOzzie/Image-Prompt-Parser" target="_blank" rel="noopener noreferrer" className="github-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.02c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A4.8 4.8 0 0 0 8 18v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
          </a>
        </div>
      </header>

      <main className="app-main">
        {!file ? (
          <div className="hero-section">
            <h2 className="hero-title">Extract AI Generation Metadata</h2>
            <p className="hero-subtitle">
              Upload your ComfyUI, Stable Diffusion, or other AI-generated PNGs to instantly view formatted prompts, workflows, and generation settings. Everything runs entirely in your browser.
            </p>
            <Dropzone onFileSelect={handleFileSelect} />
          </div>
        ) : (
          <div className="results-container">
            <div className="sidebar">
              <div className="preview-card">
                {preview && <img src={preview} alt="Uploaded preview" className="image-preview" />}
                <div className="preview-info">
                  <span className="file-name" title={file.name}>{file.name}</span>
                  <span className="file-size">{(file.size / 1024).toFixed(2)} KB</span>
                </div>
                <button className="reset-button" onClick={handleReset}>
                  <RefreshCw size={16} /> Upload Another Image
                </button>
              </div>
            </div>
            
            <div className="main-content">
              {loading && (
                <div className="loading-state">
                  <Aperture className="spinner" size={48} />
                  <p>Parsing metadata...</p>
                </div>
              )}
              
              {error && (
                <div className="error-state">
                  <p>{error}</p>
                </div>
              )}

              {metadata && !loading && !error && (
                <MetadataViewer metadata={metadata} />
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
