import { useDocument } from '../../../../contexts/documentContext';
import { FileText, Loader2, AlertCircle, X } from 'lucide-react';
import '../../../../styles/pdfBadge.css';

export function PdfBadge() {
    const { currentPdf, isProcessing, error, clearPdf } = useDocument();

    if (!currentPdf && !isProcessing && !error) return null;

    const getPdfFileName = () => {
        if (!currentPdf) return '';

        try {
            const url = new URL(currentPdf.url);
            const pathParts = url.pathname.split('/');
            return pathParts[pathParts.length - 1] || 'document.pdf';
        } catch {
            return 'document.pdf';
        }
    };

    return (
        <div className="pdf-badge-container">
            {isProcessing && (
                <div className="pdf-badge pdf-badge-processing">
                    <Loader2 className="pdf-badge-icon animate-spin" size={16} />
                    <span className="pdf-badge-text">Processing PDF...</span>
                </div>
            )}

            {error && (
                <div className="pdf-badge pdf-badge-error">
                    <AlertCircle className="pdf-badge-icon" size={16} />
                    <span className="pdf-badge-text">{error}</span>
                    <button
                        className="pdf-badge-close"
                        onClick={clearPdf}
                        title="Dismiss error"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {currentPdf && !isProcessing && !error && (
                <div className="pdf-badge pdf-badge-active">
                    <FileText className="pdf-badge-icon" size={16} />
                    <div className="pdf-badge-content">
                        <span className="pdf-badge-title">📕 PDF Context Active</span>
                        <span className="pdf-badge-filename">{getPdfFileName()}</span>
                    </div>
                    <button
                        className="pdf-badge-close"
                        onClick={clearPdf}
                        title="Remove PDF context"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}
