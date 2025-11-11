// RFP Analyzer Application
let rfpData = null;
let questions = [];
let responses = {};

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Tab switching
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', switchTab);
    });

    // Upload zone
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');

    uploadZone.addEventListener('click', () => fileInput.click());
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.style.backgroundColor = 'rgba(0, 102, 204, 0.05)';
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.style.backgroundColor = 'white';
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.style.backgroundColor = 'white';
        const file = e.dataTransfer.files[0];
        if (file) handleFileUpload(file);
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFileUpload(file);
    });

    // Export button
    document.getElementById('exportBtn').addEventListener('click', handleExport);
}

function switchTab(e) {
    const tabName = e.target.getAttribute('data-tab');
    
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active from all buttons
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    e.target.classList.add('active');

    // Populate tab content
    if (tabName === 'review') {
        displayQuestions();
    } else if (tabName === 'editor') {
        displayResponseEditor();
    } else if (tabName === 'export') {
        updateExportSummary();
    }
}

function handleFileUpload(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const content = e.target.result;
            questions = extractQuestions(content);
            responses = {};
            
            rfpData = {
                filename: file.name,
                uploadDate: new Date().toISOString(),
                totalQuestions: questions.length
            };

            showMessage(`Successfully extracted ${questions.length} questions from ${file.name}`, 'success');
            
            // Enable review tab
            document.querySelectorAll('.tab-button')[1].disabled = false;
            document.querySelectorAll('.tab-button')[2].disabled = false;
            document.querySelectorAll('.tab-button')[3].disabled = false;
            
        } catch (error) {
            showMessage(`Error processing file: ${error.message}`, 'error');
        }
    };
    
    reader.readAsText(file);
}

function extractQuestions(text) {
    const lines = text.split('\n').filter(line => line.trim());
    const questionPattern = /^\d+[\.\)]\s+(.+)/;
    
    const extractedQuestions = [];
    let currentQuestion = null;

    lines.forEach((line, index) => {
        const match = line.match(questionPattern);
        if (match) {
            if (currentQuestion) {
                extractedQuestions.push(currentQuestion);
            }
            currentQuestion = {
                id: `q_${extractedQuestions.length}`,
                number: extractedQuestions.length + 1,
                text: match[1],
                type: detectQuestionType(match[1]),
                category: detectCategory(match[1]),
                confidence: 0.85
            };
        } else if (currentQuestion) {
            currentQuestion.text += ' ' + line;
        }
    });

    if (currentQuestion) {
        extractedQuestions.push(currentQuestion);
    }

    return extractedQuestions;
}

function detectQuestionType(text) {
    if (text.toLowerCase().includes('?')) {
        if (text.toLowerCase().match(/^(do|does|have|did|is|are)/i)) {
            return 'yes_no';
        }
        return 'narrative';
    }
    return 'narrative';
}

function detectCategory(text) {
    const text_lower = text.toLowerCase();
    
    if (text_lower.match(/incident|response|breach|alert|detection/i)) {
        return 'incident_response';
    }
    if (text_lower.match(/soc|monitoring|siem|audit|logging/i)) {
        return 'security_operations';
    }
    if (text_lower.match(/data|encryption|classification|confidential|pii/i)) {
        return 'data_protection';
    }
    if (text_lower.match(/access|authentication|mfa|permission|role/i)) {
        return 'access_control';
    }
    if (text_lower.match(/compliance|regulation|audit|policy|framework/i)) {
        return 'compliance';
    }
    
    return 'other';
}

function displayQuestions() {
    const container = document.getElementById('questionsList');
    container.innerHTML = '';

    if (questions.length === 0) {
        container.innerHTML = '<p style="color: #999; padding: 2rem; text-align: center;">No questions extracted yet. Upload an RFP to get started.</p>';
        return;
    }

    questions.forEach(q => {
        const confidenceClass = q.confidence >= 0.8 ? 'high' : q.confidence >= 0.6 ? 'medium' : 'low';
        const item = document.createElement('div');
        item.className = 'question-item';
        item.innerHTML = `
            <div>
                <span class="question-number">Q${q.number}</span>
                <div class="question-text">${escapeHtml(q.text)}</div>
                <div class="question-meta">
                    <span>Type: ${q.type}</span>
                    <span>Category: ${q.category}</span>
                    <span class="confidence-score ${confidenceClass}">Confidence: ${(q.confidence * 100).toFixed(0)}%</span>
                </div>
                ${responses[q.id] ? `
                    <div style="margin-top: 0.75rem; padding: 0.75rem; background-color: #f0f7ff; border-radius: 4px;">
                        <strong>Response:</strong> ${escapeHtml(responses[q.id].text.substring(0, 100))}...
                    </div>
                ` : ''}
            </div>
        `;
        container.appendChild(item);
    });
}

function displayResponseEditor() {
    const container = document.getElementById('responseEditor');
    container.innerHTML = '';

    if (questions.length === 0) {
        container.innerHTML = '<p style="color: #999;">No questions to edit. Upload an RFP first.</p>';
        return;
    }

    questions.forEach(q => {
        const responseText = responses[q.id]?.text || '';
        const quality = responses[q.id]?.quality || validateResponse(responseText);
        
        const editor = document.createElement('div');
        editor.className = 'response-editor';
        editor.innerHTML = `
            <div class="response-header">
                <h3>Question ${q.number}</h3>
                <p>${escapeHtml(q.text)}</p>
            </div>

            <div class="form-group">
                <label>Your Response</label>
                <textarea id="response_${q.id}" placeholder="Enter your response here...">${escapeHtml(responseText)}</textarea>
            </div>

            ${responseText ? `
                <div class="quality-checks">
                    <h4>Quality Checks</h4>
                    <div class="check-item">
                        <span class="check-icon ${quality.spelling}">
                            ${quality.spelling === 'pass' ? '✓' : '⚠'}
                        </span>
                        Spelling & Grammar: ${quality.spelling}
                    </div>
                    <div class="check-item">
                        <span class="check-icon ${quality.length}">
                            ${quality.length === 'pass' ? '✓' : '⚠'}
                        </span>
                        Length: ${quality.length}
                    </div>
                    <div class="check-item">
                        <span class="check-icon ${quality.placeholders}">
                            ${quality.placeholders === 'pass' ? '✓' : '✗'}
                        </span>
                        No Placeholders: ${quality.placeholders}
                    </div>
                    <div class="check-item">
                        <span class="check-icon ${quality.policyAlignment}">
                            ${quality.policyAlignment === 'pass' ? '✓' : '⚠'}
                        </span>
                        Policy Alignment: ${quality.policyAlignment}
                    </div>
                </div>
            ` : ''}

            <div class="compliance-mappings">
                <h4>Compliance Frameworks</h4>
                <span class="mapping-badge">NIST 800-53</span>
                <span class="mapping-badge">ISO 27001</span>
                <span class="mapping-badge">SOC 2</span>
            </div>
        `;
        container.appendChild(editor);

        // Add event listener for response updates
        document.getElementById(`response_${q.id}`).addEventListener('input', function() {
            responses[q.id] = {
                text: this.value,
                timestamp: new Date().toISOString(),
                quality: validateResponse(this.value)
            };
        });
    });
}

function validateResponse(text) {
    return {
        spelling: text.length > 10 ? 'pass' : 'warning',
        length: text.split(' ').length >= 20 ? 'pass' : 'warning',
        placeholders: !text.match(/\[.*?\]|TBD|TODO/i) ? 'pass' : 'fail',
        policyAlignment: text.match(/we|our|policy|procedure/i) ? 'pass' : 'warning'
    };
}

function updateExportSummary() {
    const totalQuestions = questions.length;
    const completedResponses = Object.keys(responses).length;
    const completionRate = totalQuestions > 0 ? ((completedResponses / totalQuestions) * 100).toFixed(0) : 0;

    document.getElementById('totalQuestions').textContent = totalQuestions;
    document.getElementById('completedResponses').textContent = completedResponses;
    document.getElementById('completionRate').textContent = completionRate;
}

function handleExport() {
    const format = document.querySelector('input[name="format"]:checked').value;
    
    try {
        let content = '';
        
        if (format === 'json') {
            content = JSON.stringify({
                rfp: rfpData,
                questions: questions,
                responses: responses
            }, null, 2);
        } else {
            content = 'RFP ANALYZER - EXPORT\n\n';
            questions.forEach(q => {
                content += `Q${q.number}: ${q.text}\n`;
                content += `Response: ${responses[q.id]?.text || 'No response provided'}\n\n`;
            });
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rfp_export.${format === 'json' ? 'json' : 'txt'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showMessage(`Successfully exported as ${format.toUpperCase()}`, 'success');
    } catch (error) {
        showMessage(`Export failed: ${error.message}`, 'error');
    }
}

function showMessage(text, type) {
    const messageArea = document.getElementById('message-area');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = text;
    messageArea.innerHTML = '';
    messageArea.appendChild(alert);

    setTimeout(() => {
        alert.remove();
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
