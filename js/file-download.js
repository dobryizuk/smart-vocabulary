// ============================================================================
// FILE DOWNLOAD: saves generated content as a file via a temporary link
// ============================================================================

function downloadFile(doc, URLImpl, fileName, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URLImpl.createObjectURL(blob);
    const a = doc.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    doc.body.appendChild(a);
    a.click();
    doc.body.removeChild(a);
    URLImpl.revokeObjectURL(url);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { downloadFile };
}
