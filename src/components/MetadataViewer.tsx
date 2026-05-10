import React, { useState } from 'react';
import type { ParsedMetadata } from '../utils/pngParser';
import { Copy, CheckCircle2, ChevronDown, ChevronRight, Code } from 'lucide-react';
import { FriendlyDisplay } from './FriendlyDisplay';

interface MetadataViewerProps {
  metadata: ParsedMetadata;
}

const JsonViewer: React.FC<{ data: any; label: string }> = ({ data, label }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const formattedJson = typeof data === 'object' ? JSON.stringify(data, null, 2) : data.toString();

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="metadata-section">
      <div 
        className="metadata-header" 
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="metadata-header-title">
          {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          <span className="metadata-label">{label}</span>
        </div>
        <button 
          className="copy-button" 
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          title="Copy to clipboard"
        >
          {copied ? <CheckCircle2 size={16} className="text-green" /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      
      {isOpen && (
        <div className="metadata-content">
          <pre><code>{formattedJson}</code></pre>
        </div>
      )}
    </div>
  );
};

export const MetadataViewer: React.FC<MetadataViewerProps> = ({ metadata }) => {
  const keys = Object.keys(metadata);
  const [showRaw, setShowRaw] = useState(false);

  if (keys.length === 0) {
    return (
      <div className="empty-state">
        <p>No text or JSON metadata found in this image.</p>
      </div>
    );
  }

  return (
    <div className="metadata-viewer-container">
      <FriendlyDisplay metadata={metadata} />
      
      <div className="raw-data-toggle" onClick={() => setShowRaw(!showRaw)}>
        <Code size={16} />
        <span>{showRaw ? 'Hide Raw Metadata' : 'Show Raw Metadata (Advanced)'}</span>
        {showRaw ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>

      {showRaw && (
        <div className="metadata-viewer">
          {keys.map((key) => (
            <JsonViewer key={key} label={key} data={metadata[key]} />
          ))}
        </div>
      )}
    </div>
  );
};
