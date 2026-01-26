import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';

export default function ChatAssistant({
  expenses,
  categories,
  isProMode,
  onUpgradeToPro,
  onAICommand,
  userId
}) {
  const [aiInput, setAiInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastResponse, setLastResponse] = useState('');
  const [voiceTranscript, setVoiceTranscript] = useState('');
  const [conversationHistory, setConversationHistory] = useState([]);
  const [userInsights, setUserInsights] = useState([]);
  const [userPreferences, setUserPreferences] = useState({});

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  
  const expensesRef = useRef(expenses);
  const categoriesRef = useRef(categories);

  useEffect(() => {
    expensesRef.current = expenses;
    categoriesRef.current = categories;
  }, [expenses, categories]);

  // Load conversation history, insights, and preferences (Pro only)
  useEffect(() => {
    if (!userId || !isProMode) return;

    const loadUserProfile = async () => {
      // Load last 50 conversations
      const { data: convos } = await supabase
        .from('conversations')
        .select('message, role, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (convos) {
        const history = convos.reverse().map(c => ({
          role: c.role,
          content: c.message
        }));
        setConversationHistory(history);
      }

      // Load insights
      const { data: insights } = await supabase
        .from('user_insights')
        .select('insight_type, insight_data, learned_at')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('learned_at', { ascending: false });

      if (insights) {
        setUserInsights(insights);
      }

      // Load preferences
      const { data: prefs } = await supabase
        .from('user_preferences')
        .select('preference_type, preference_value')
        .eq('user_id', userId);

      if (prefs) {
        const prefsMap = {};
        prefs.forEach(p => {
          prefsMap[p.preference_type] = p.preference_value;
        });
        setUserPreferences(prefsMap);
      }
    };

    loadUserProfile();
  }, [userId, isProMode]);

  // Save conversation to database (Pro only)
  const saveConversation = async (role, message) => {
    if (!userId || !isProMode) return;

    await supabase.from('conversations').insert({
      user_id: userId,
      role,
      message
    });
  };

  // Extract and save insights from conversation (Pro only)
  const extractInsights = async (userMessage, aiResponse) => {
    if (!userId || !isProMode) return;

    // Simple pattern detection (can be enhanced with AI later)
    const lower = userMessage.toLowerCase();

    // Detect preference changes
    if (lower.includes('be more concise') || lower.includes('keep it short')) {
      await supabase.from('user_preferences').upsert({
        user_id: userId,
        preference_type: 'response_style',
        preference_value: 'concise'
      }, { onConflict: 'user_id,preference_type' });
      setUserPreferences(prev => ({ ...prev, response_style: 'concise' }));
    }

    if (lower.includes('give me more details') || lower.includes('be more detailed')) {
      await supabase.from('user_preferences').upsert({
        user_id: userId,
        preference_type: 'response_style',
        preference_value: 'detailed'
      }, { onConflict: 'user_id,preference_type' });
      setUserPreferences(prev => ({ ...prev, response_style: 'detailed' }));
    }

    // Detect nickname
    const nicknameMatch = lower.match(/call me (\w+)/);
    if (nicknameMatch) {
      const nickname = nicknameMatch[1];
      await supabase.from('user_preferences').upsert({
        user_id: userId,
        preference_type: 'nickname',
        preference_value: nickname
      }, { onConflict: 'user_id,preference_type' });
      setUserPreferences(prev => ({ ...prev, nickname }));
    }
  };

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

  const clearConversation = async () => {
    if (!userId || !isProMode) return;
    
    const confirmed = window.confirm('Clear conversation history? Nova will forget this conversation but will remember learned insights.');
    if (!confirmed) return;

    await supabase
      .from('conversations')
      .delete()
      .eq('user_id', userId);

    setConversationHistory([]);
    setLastResponse('');
  };

  const handleAISubmit = async (voiceInput = null) => {
    const userMessage = voiceInput || aiInput.trim();
    if (!userMessage) return;

    setIsThinking(true);

    const currentExpenses = expensesRef.current || [];
    const currentCategories = categoriesRef.current || [];

    // Check for commands first
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
    const expenseData = currentExpenses.map(e => {
      const cat = currentCategories.find(c => c.id === e.category_id);
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

    // Build enhanced system prompt with memory (Pro only)
    let memoryContext = '';
    if (isProMode) {
      // Add learned insights
      if (userInsights.length > 0) {
        memoryContext += '\n\nWhat you know about this user:\n';
        userInsights.forEach(insight => {
          memoryContext += `- ${insight.insight_data.description || JSON.stringify(insight.insight_data)}\n`;
        });
      }

      // Add preferences
      if (Object.keys(userPreferences).length > 0) {
        memoryContext += '\n\nUser preferences:\n';
        if (userPreferences.nickname) {
          memoryContext += `- Call them: ${userPreferences.nickname}\n`;
        }
        if (userPreferences.response_style) {
          memoryContext += `- Response style: ${userPreferences.response_style}\n`;
        }
      }
    }

    const systemPrompt = isProMode
      ? `You are Nova, a warm and professional financial advisor. When users greet you, respond naturally and warmly. Never say "I'm just a program"—be conversational and friendly.

You have access to the user's complete expense history and provide elite-level financial insights. You remember past conversations and learn from every interaction.

${memoryContext}

Current date: ${currentDate}
Current time: ${currentTime}

User's expenses:
${JSON.stringify(expenseData, null, 2)}

Be concise, insightful, and actionable. Use your full analytical capabilities.`
      : `You are Nova, a warm and friendly expense assistant. Respond naturally and warmly. You help track expenses and answer basic questions.

Current date: ${currentDate}
Current time: ${currentTime}

User's expenses:
${JSON.stringify(expenseData, null, 2)}

Keep responses short and helpful. For deeper insights, gently mention Pro features.`;

    // Build messages array with conversation history (Pro only)
    const messages = [{ role: 'system', content: systemPrompt }];
    
    if (isProMode && conversationHistory.length > 0) {
      // Include last 10 messages for context
      const recentHistory = conversationHistory.slice(-10);
      messages.push(...recentHistory);
    }
    
    messages.push({ role: 'user', content: userMessage });

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages,
          max_tokens: isProMode ? 400 : 200,
          temperature: 0.7
        })
      });

      if (!response.ok) throw new Error('OpenAI API error');

      const data = await response.json();
      const aiMessage = data.choices[0].message.content;

      setLastResponse(aiMessage);
      speak(aiMessage);

      // Save conversation and extract insights (Pro only)
      if (isProMode) {
        await saveConversation('user', userMessage);
        await saveConversation('assistant', aiMessage);
        await extractInsights(userMessage, aiMessage);

        // Update local conversation history
        setConversationHistory(prev => [
          ...prev,
          { role: 'user', content: userMessage },
          { role: 'assistant', content: aiMessage }
        ]);
      }
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

    const questionWords = ['when', 'what', 'where', 'how much', 'how many', 'which', 'why', 'who', 'did i'];
    const isQuestion = questionWords.some(word => lower.includes(word));
    
    if (isQuestion) {
      return false;
    }

    if ((lower.includes('add') || lower.includes('spent') || lower.includes('bought') || lower.includes('create')) 
        && (lower.includes('at') || lower.includes('on') || lower.includes('for'))) {
      const amountMatch = text.match(/\$?(\d+(?:\.\d{2})?)/);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

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

    if ((lower.includes('show me') || lower.includes('filter') || lower.includes('list')) 
        && !lower.includes('when') && !lower.includes('what')) {
      const query = text.replace(/show\s+me|filter|list|my|all|the/gi, '').trim();
      if (query) {
        onAICommand({ action: 'search', data: { query } });
        return true;
      }
    }

    if (lower.includes('export') || lower.includes('download csv')) {
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>🤖</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '600' }}>
                Nova AI Assistant
                {isProMode && userPreferences.nickname && (
                  <span style={{ fontSize: '16px', opacity: 0.8, marginLeft: '8px' }}>
                    • {userPreferences.nickname}
                  </span>
                )}
              </h2>
              <p style={{ margin: 0, fontSize: '14px', opacity: 0.9 }}>
                {isProMode ? '🧠 Elite Financial Advisor Mode (Memory Active)' : 'Basic Expense Assistant'}
              </p>
            </div>
          </div>
          {isProMode && conversationHistory.length > 0 && (
            <button
              onClick={clearConversation}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              Clear Chat
            </button>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <input
          type="text"
          value={aiInput}
          onChange={(e) => setAiInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAISubmit()}
          placeholder={userPreferences.nickname ? `How can I help you, ${userPreferences.nickname}?` : "How can I help you today?"}
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

      {/* Pro Teaser or Memory Indicator */}
      {!isProMode ? (
        <div style={{
          marginTop: '16px',
          padding: '12px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '8px',
          fontSize: '13px',
          textAlign: 'center'
        }}>
          💎 Upgrade to Pro for Nova to remember you, learn your habits, and get smarter every day
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
      ) : (
        <div style={{
          marginTop: '16px',
          padding: '8px 12px',
          background: 'rgba(255,255,255,0.1)',
          borderRadius: '8px',
          fontSize: '12px',
          textAlign: 'center',
          opacity: 0.8
        }}>
          🧠 Nova remembers {conversationHistory.length} messages • {userInsights.length} insights learned
        </div>
      )}
    </div>
  );
}
