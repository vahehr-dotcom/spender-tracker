import React, { useState, useEffect, useRef } from 'react';

export default function ChatAssistant({
  expenses,
  categories,
  isProMode,
  onUpgradeToPro,
  onAICommand
}) {
  const [aiInput, setAiInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);

  // Initialize speech recognition
  useEffect(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      setVoiceTranscript(transcript);
      setAiInput(transcript);
      setTimeout(() => handleAISubmit(transcript), 100);
    };

    recognitionRef.current = recognition;
  }, []);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      setVoiceTranscript('');
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  // OpenAI TTS (nova voice)
  const speak = async (text) => {
    try {
      setIsSpeaking(true);
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'tts-1',
          voice: 'nova',
          input: text
        })
      });

      if (!response.ok) throw new Error('TTS failed');

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      audio.onerror = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      console.error('TTS error:', error);
      setIsSpeaking(false);
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setIsSpeaking(false);
    }
  };

  const handleAISubmit = async (voiceInput = null) => {
    const userMessage = voiceInput || aiInput.trim();
    if (!userMessage) return;

    setIsThinking(true);

    // Try command parsing first
    if (onAICommand) {
      const commandExecuted = parseAndExecuteCommand(userMessage);
      if (commandExecuted) {
        setLastResponse('✓ Command executed—check the form below!');
        speak('Command executed. Check the form below.');
        setIsThinking(false);
        setAiInput('');
        return;
      }
    }

    // Build expense data
    const expenseData = expenses.map(e => {
      const cat = categories.find(c => c.id === e.category_id);
      const spentDate = new Date(e.spent_at);
      return {
        id: e.id,
        merchant: e.merchant,
        amount: Number(e.amount),
        spent_at: e.spent_at,
        spent_date: spentDate.toLocaleDateString('en-US', { 
          weekday: 'short', 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        }),
        category: cat ? cat.name : 'Other',
        paymentMethod: e.payment_method,
        taxDeductible: e.is_tax_deductible,
        reimbursable: e.is_reimbursable,
        notes: e.notes
      };
    });

    // Get current date/time
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // Updated system prompt with warm personality
    const systemPrompt = isProMode
      ? `You are Nova, a warm and professional financial advisor. When users greet you (e.g., "How are you?"), respond naturally and warmly (e.g., "I'm doing well! How can I help you today?"). Never say "I'm just a program" or "I don't have feelings"—be conversational and friendly.

You have access to the user's complete expense history and provide elite-level financial insights. You can:
- Analyze spending patterns and trends
- Identify opportunities for savings
- Suggest budget optimizations
- Predict future expenses
- Detect recurring charges
- Provide tax and reimbursement guidance
- Offer personalized financial advice

Current date: ${currentDate}
Current time: ${currentTime}

User's expenses:
${JSON.stringify(expenseData, null, 2)}

Be concise, insightful, and actionable. Use your full analytical capabilities.`
      : `You are Nova, a warm and friendly expense assistant. When users greet you (e.g., "How are you?"), respond naturally and warmly (e.g., "I'm doing well! How can I help you today?"). Never say "I'm just a program" or "I don't have feelings"—be conversational and approachable.

You help users track expenses and answer basic questions. You can:
- Show expenses by date, merchant, or category
- Calculate totals and averages
- Answer simple spending questions

Current date: ${currentDate}
Current time: ${currentTime}

User's expenses:
${JSON.stringify(expenseData, null, 2)}

Keep responses short and helpful. For deeper insights, gently mention Pro features.`;

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          max_tokens: isProMode ? 400 : 200,
          temperature: 0.7
        })
      });

      if (!response.ok) throw new Error('OpenAI API error');

      const data = await response.json();
      const aiMessage = data.choices[0].message.content;

      setLastResponse(aiMessage);
      speak(aiMessage);
    } catch (error) {
      console.error('AI error:', error);
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setLastResponse(errorMsg);
      speak(errorMsg);
    } finally {
      setIsThinking(false);
      setAiInput('');
    }
  };

  const parseAndExecuteCommand = (text) => {
    const lower = text.toLowerCase();

    // Detect add/create expense
    if (lower.includes('add') || lower.includes('spent') || lower.includes('bought') || lower.includes('create')) {
      const amountMatch = text.match(/\$?(\d+(?:\.\d{2})?)/);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

      // Extract merchant (stop at date keywords)
      const dateKeywords = ['yesterday', 'today', 'ago', 'last', 'week', 'month', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      let merchant = null;
      const atMatch = text.match(/at\s+([a-zA-Z0-9\s]+)/i);
      if (atMatch) {
        const words = atMatch[1].trim().split(/\s+/);
        const filtered = [];
        for (const word of words) {
          if (dateKeywords.includes(word.toLowerCase())) break;
          filtered.push(word);
        }
        merchant = filtered.join(' ').trim();
      }

      // Extract date hint
      let dateHint = 'today';
      if (lower.includes('yesterday')) dateHint = 'yesterday';
      else if (lower.includes('today')) dateHint = 'today';
      else {
        const daysAgoMatch = lower.match(/(\d+)\s+days?\s+ago/);
        if (daysAgoMatch) dateHint = `${daysAgoMatch[1]} days ago`;
        else if (lower.includes('last week')) dateHint = 'last week';
        else if (lower.includes('last month')) dateHint = 'last month';
        else {
          const dayMatch = lower.match(/last\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/);
          if (dayMatch) dateHint = `last ${dayMatch[1]}`;
        }
      }

      if (amount && merchant) {
        onAICommand({
          action: 'add_expense',
          data: { amount, merchant, dateHint }
        });
        return true;
      }
    }

    // Detect search/show
    if (lower.includes('show') || lower.includes('filter') || lower.includes('find') || lower.includes('search')) {
      const query = text.replace(/show|filter|find|search|me|my|all|the/gi, '').trim();
      if (query) {
        onAICommand({ action: 'search', data: { query } });
        return true;
      }
    }

    // Detect export
    if (lower.includes('export') || lower.includes('download')) {
      onAICommand({ action: 'export' });
      return true;
    }

    return false;
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '16px',
      padding: '24px',
      marginBottom: '24px',
      color: 'white',
      boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '32px' }}>🤖</span>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>Nova AI Assistant</h2>
            <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
              {isProMode ? 'Elite Financial Advisor Mode' : 'Basic Expense Assistant'}
            </p>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <input
          type="text"
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAISubmit()}
          placeholder="How can I help you today?"
          style={{
            flex: 1,
            padding: '14px 18px',
            borderRadius: '12px',
            border: 'none',
            fontSize: '16px',
            outline: 'none'
          }}
        />
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isThinking || isSpeaking}
          style={{
            padding: '14px 20px',
            borderRadius: '12px',
            border: 'none',
            background: isListening ? '#ef4444' : 'white',
            color: isListening ? 'white' : '#667eea',
            fontSize: '20px',
            cursor: 'pointer',
            fontWeight: '600',
            minWidth: '60px'
          }}
        >
          {isListening ? '⏹' : '🎤'}
        </button>
      </div>

      {/* Voice Transcript */}
      {voiceTranscript && (
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '16px',
          fontSize: '14px'
        }}>
          🎤 <strong>You said:</strong> "{voiceTranscript}"
        </div>
      )}

      {/* Status Indicators */}
      {isListening && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.2)',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '12px',
          textAlign: 'center',
          fontWeight: '600'
        }}>
          🎤 Listening...
        </div>
      )}

      {isThinking && (
        <div style={{
          background: 'rgba(255,255,255,0.2)',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '12px',
          textAlign: 'center',
          fontWeight: '600'
        }}>
          🤔 Thinking...
        </div>
      )}

      {isSpeaking && (
        <div style={{
          background: 'rgba(34, 197, 94, 0.2)',
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '12px',
          textAlign: 'center',
          fontWeight: '600',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px'
        }}>
          🔊 Nova is speaking...
          <button
            onClick={stopSpeaking}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: 'white',
              color: '#667eea',
              fontSize: '12px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Stop
          </button>
        </div>
      )}

      {/* Last Response */}
      {lastResponse && (
        <div style={{
          background: 'rgba(255,255,255,0.15)',
          padding: '16px',
          borderRadius: '12px',
          fontSize: '15px',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap'
        }}>
          <strong>Nova:</strong> {lastResponse}
        </div>
      )}

      {/* Pro Teaser (Free users only) */}
      {!isProMode && (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '8px',
          fontSize: '13px',
          textAlign: 'center'
        }}>
          💎 Upgrade to Pro for deeper insights, spending predictions, and elite financial advice
          <button
            onClick={onUpgradeToPro}
            style={{
              marginLeft: '12px',
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              background: 'white',
              color: '#667eea',
              fontSize: '13px',
              cursor: 'pointer',
              fontWeight: '600'
            }}
          >
            Upgrade
          </button>
        </div>
      )}
    </div>
  );
}
