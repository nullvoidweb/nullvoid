// Disposable Email Service - Simple and Working Version
class DisposableEmailService {
    constructor() {
        this.currentEmail = '';
        this.messages = [];
        this.expiryTime = null;
        this.container = null;
        this.currentView = 'inbox';
    }

    // Initialize UI - Simple approach
    initializeUI(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Container not found:', containerId);
            return false;
        }

        // Create simple HTML structure
        this.container.innerHTML = `
            <div style="
                font-family: Arial, sans-serif;
                border: 1px solid #ddd;
                border-radius: 8px;
                overflow: hidden;
                background: white;
                max-width: 100%;
            ">
                <!-- Header with email and buttons -->
                <div style="
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 15px;
                ">
                    <!-- Email address and controls row -->
                    <div style="
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 10px;
                        margin-bottom: 10px;
                    ">
                        <!-- Left side: Email address and copy button -->
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 10px;
                            flex: 1;
                        ">
                            <span id="email-display" style="
                                background: rgba(255,255,255,0.2);
                                padding: 8px 12px;
                                border-radius: 5px;
                                font-family: monospace;
                                font-size: 14px;
                                flex: 1;
                                min-width: 0;
                                overflow: hidden;
                                text-overflow: ellipsis;
                                white-space: nowrap;
                            ">Loading...</span>
                            
                            <button id="copy-btn" style="
                                background: rgba(255,255,255,0.2);
                                border: none;
                                color: white;
                                padding: 8px 12px;
                                border-radius: 5px;
                                cursor: pointer;
                                font-size: 14px;
                                white-space: nowrap;
                            ">📋 Copy</button>
                        </div>
                        
                        <!-- Right side: Action buttons -->
                        <div style="
                            display: flex;
                            align-items: center;
                            gap: 8px;
                        ">
                            <button id="refresh-btn" style="
                                background: rgba(255,255,255,0.2);
                                border: none;
                                color: white;
                                padding: 8px 12px;
                                border-radius: 5px;
                                cursor: pointer;
                                font-size: 14px;
                                white-space: nowrap;
                            ">🔄 Refresh</button>
                            
                            <button id="new-email-btn" style="
                                background: rgba(255,255,255,0.2);
                                border: none;
                                color: white;
                                padding: 8px 12px;
                                border-radius: 5px;
                                cursor: pointer;
                                font-size: 14px;
                                white-space: nowrap;
                            ">🆕 New</button>
                            
                            <span id="message-count" style="
                                font-size: 12px;
                                opacity: 0.9;
                                white-space: nowrap;
                            ">0 messages</span>
                        </div>
                    </div>
                    
                    <!-- Timer -->
                    <div id="expiry-timer" style="
                        text-align: center;
                        font-size: 12px;
                        opacity: 0.8;
                    ">Expires in 10:00</div>
                </div>
                
                <!-- Content area -->
                <div style="height: 400px; overflow-y: auto;">
                    <div id="inbox-view"></div>
                    <div id="email-view" style="display: none; padding: 20px;"></div>
                </div>
            </div>
        `;

        // Add event listeners immediately
        this.addEventListeners();

        // Initialize with demo data
        this.initializeDemoMode();
        this.updateUI();
        this.renderInbox();

        console.log('UI initialized successfully');
        return true;
    }

    // Add event listeners
    addEventListeners() {
        const copyBtn = document.getElementById('copy-btn');
        const refreshBtn = document.getElementById('refresh-btn');
        const newEmailBtn = document.getElementById('new-email-btn');

        console.log('Adding event listeners...');
        console.log('Copy button found:', !!copyBtn);
        console.log('Refresh button found:', !!refreshBtn);
        console.log('New email button found:', !!newEmailBtn);

        if (copyBtn) {
            copyBtn.onclick = () => this.copyEmail();
        }

        if (refreshBtn) {
            refreshBtn.onclick = () => this.refreshInbox();
        }

        if (newEmailBtn) {
            newEmailBtn.onclick = () => this.generateNewEmail();
        }
    }

    // Initialize demo mode
    initializeDemoMode() {
        const randomId = Math.random().toString(36).substring(2, 8);
        this.currentEmail = `demo${randomId}@temp-mail.org`;
        this.expiryTime = Date.now() + (10 * 60 * 1000); // 10 minutes
        this.messages = [
            {
                id: '1',
                from: { name: 'GitHub', address: 'noreply@github.com' },
                subject: 'Security Alert - New Device Login',
                preview: 'We detected a new sign-in to your GitHub account...',
                body: 'Hello,\n\nWe detected a new sign-in to your GitHub account from an unrecognized device. If this was you, you can safely ignore this email.\n\nBest regards,\nGitHub Security Team',
                time: new Date(Date.now() - 30 * 60 * 1000)
            },
            {
                id: '2',
                from: { name: 'Netflix', address: 'info@netflix.com' },
                subject: '🎬 New Releases This Week',
                preview: 'Discover the latest blockbuster movies and series...',
                body: 'Check out the latest movies and TV shows added to Netflix this week.\n\nHappy watching!\nThe Netflix Team',
                time: new Date(Date.now() - 2 * 60 * 60 * 1000)
            },
            {
                id: '3',
                from: { name: 'John Doe', address: 'john.doe@company.com' },
                subject: '📅 Meeting Tomorrow at 3 PM',
                preview: 'Confirming our scheduled meeting to discuss...',
                body: 'Hi there!\n\nJust wanted to confirm our meeting scheduled for tomorrow at 3 PM.\n\nBest regards,\nJohn Doe',
                time: new Date(Date.now() - 24 * 60 * 60 * 1000)
            }
        ];

        this.startExpiryTimer();
    }

    // Copy email to clipboard
    async copyEmail() {
        if (!this.currentEmail) return;

        try {
            await navigator.clipboard.writeText(this.currentEmail);
            this.showFeedback('copy-btn', '✅ Copied!');
        } catch (error) {
            // Fallback method
            const textArea = document.createElement('textarea');
            textArea.value = this.currentEmail;
            textArea.style.position = 'fixed';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            this.showFeedback('copy-btn', '✅ Copied!');
        }
    }

    // Refresh inbox
    refreshInbox() {
        console.log('Refreshing inbox...');
        this.showFeedback('refresh-btn', '⏳ Refreshing...');

        // Simulate refresh - add random email occasionally
        setTimeout(() => {
            if (Math.random() > 0.5) {
                const newEmail = {
                    id: Date.now().toString(),
                    from: { name: 'System', address: 'system@temp-mail.org' },
                    subject: 'Welcome to Temp Mail!',
                    preview: 'Thank you for using our service...',
                    body: 'Welcome! Your temporary email is ready to receive messages.',
                    time: new Date()
                };
                this.messages.unshift(newEmail);
            }

            this.updateUI();
            this.renderInbox();
            this.showFeedback('refresh-btn', '🔄 Refresh');
        }, 1000);
    }

    // Generate new email
    generateNewEmail() {
        console.log('Generating new email...');
        this.showFeedback('new-email-btn', '⏳ Generating...');

        setTimeout(() => {
            const randomId = Math.random().toString(36).substring(2, 8);
            this.currentEmail = `demo${randomId}@temp-mail.org`;
            this.expiryTime = Date.now() + (10 * 60 * 1000);
            this.messages = []; // Clear messages

            // Go back to inbox if viewing email
            if (this.currentView === 'email') {
                this.backToInbox();
            }

            this.updateUI();
            this.renderInbox();
            this.showFeedback('new-email-btn', '🆕 New');
        }, 1500);
    }

    // Show button feedback
    showFeedback(buttonId, text) {
        const button = document.getElementById(buttonId);
        if (!button) return;

        const originalText = button.textContent;
        button.textContent = text;

        if (!text.includes('⏳')) {
            setTimeout(() => {
                button.textContent = originalText;
            }, 1500);
        }
    }

    // Update UI elements
    updateUI() {
        const emailDisplay = document.getElementById('email-display');
        const messageCount = document.getElementById('message-count');

        if (emailDisplay) {
            emailDisplay.textContent = this.currentEmail || 'Loading...';
        }

        if (messageCount) {
            messageCount.textContent = `${this.messages.length} messages`;
        }
    }

    // Render inbox
    renderInbox() {
        const inboxView = document.getElementById('inbox-view');
        if (!inboxView) return;

        if (this.messages.length === 0) {
            inboxView.innerHTML = `
                <div style="text-align: center; padding: 50px; color: #666;">
                    <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
                    <h3>No messages yet</h3>
                    <p>Your inbox is empty. New emails will appear here automatically.</p>
                </div>
            `;
            return;
        }

        const emailList = this.messages.map(email => {
            const initial = email.from.name ? email.from.name.charAt(0).toUpperCase() : '?';
            const timeAgo = this.getTimeAgo(email.time);

            return `
                <div onclick="emailService.openEmail('${email.id}')" style="
                    border-bottom: 1px solid #eee;
                    padding: 15px;
                    cursor: pointer;
                    display: flex;
                    gap: 15px;
                    transition: background 0.2s;
                " onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'">
                    <div style="
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        background: linear-gradient(135deg, #667eea, #764ba2);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: white;
                        font-weight: bold;
                        flex-shrink: 0;
                    ">${initial}</div>
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; margin-bottom: 5px;">${email.from.name || email.from.address}</div>
                        <div style="color: #666; margin-bottom: 5px; font-size: 14px;">${email.subject}</div>
                        <div style="color: #999; font-size: 13px; line-height: 1.4;">${email.preview}</div>
                        <div style="color: #999; font-size: 12px; margin-top: 5px;">${timeAgo}</div>
                    </div>
                </div>
            `;
        }).join('');

        inboxView.innerHTML = emailList;
    }

    // Open email
    openEmail(emailId) {
        const email = this.messages.find(msg => msg.id === emailId);
        if (!email) return;

        this.currentView = 'email';

        const inboxView = document.getElementById('inbox-view');
        const emailView = document.getElementById('email-view');

        if (inboxView) inboxView.style.display = 'none';
        if (emailView) emailView.style.display = 'block';

        this.renderEmailView(email);
    }

    // Render email view
    renderEmailView(email) {
        const emailView = document.getElementById('email-view');
        if (!emailView) return;

        const formattedDate = email.time.toLocaleString();

        emailView.innerHTML = `
            <button onclick="emailService.backToInbox()" style="
                background: #667eea;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 5px;
                cursor: pointer;
                margin-bottom: 20px;
            ">← Back to Inbox</button>
            
            <div style="font-size: 20px; font-weight: 600; margin-bottom: 10px;">${email.subject}</div>
            <div style="color: #666; margin-bottom: 5px;">From: ${email.from.name || email.from.address} &lt;${email.from.address}&gt;</div>
            <div style="color: #999; font-size: 14px; margin-bottom: 20px;">${formattedDate}</div>
            <div style="white-space: pre-wrap; line-height: 1.6;">${email.body}</div>
        `;
    }

    // Back to inbox
    backToInbox() {
        this.currentView = 'inbox';

        const inboxView = document.getElementById('inbox-view');
        const emailView = document.getElementById('email-view');

        if (inboxView) inboxView.style.display = 'block';
        if (emailView) emailView.style.display = 'none';
    }

    // Start expiry timer
    startExpiryTimer() {
        setInterval(() => {
            const timerElement = document.getElementById('expiry-timer');
            if (!timerElement || !this.expiryTime) return;

            const remaining = this.expiryTime - Date.now();
            if (remaining <= 0) {
                timerElement.textContent = 'Email expired - Generate new one';
                timerElement.style.color = '#ff6b6b';
                return;
            }

            const minutes = Math.floor(remaining / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            timerElement.textContent = `Expires in ${minutes}:${seconds.toString().padStart(2, '0')}`;
            timerElement.style.color = remaining < 120000 ? '#ff6b6b' : 'rgba(255,255,255,0.8)';
        }, 1000);
    }

    // Utility function
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    }
}

// Global instance and initialization
let emailService = null;

function initializeDisposableEmail(containerId) {
    console.log('Initializing disposable email service...');

    emailService = new DisposableEmailService();
    window.emailService = emailService; // Make globally accessible

    const success = emailService.initializeUI(containerId);
    if (!success) {
        throw new Error('Failed to initialize - container not found');
    }

    console.log('Disposable email service initialized successfully');
    return emailService;
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DisposableEmailService, initializeDisposableEmail };
} else {
    window.DisposableEmailService = DisposableEmailService;
    window.initializeDisposableEmail = initializeDisposableEmail;
}