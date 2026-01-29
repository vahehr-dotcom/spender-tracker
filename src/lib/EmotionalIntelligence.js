import { supabase } from '../supabaseClient'

/**
 * EmotionalIntelligence - Detects mood and generates empathetic responses
 */
class EmotionalIntelligence {
  constructor(userId, conversationHistory) {
    this.userId = userId
    this.conversationHistory = conversationHistory
  }

  /**
   * Detect user's emotional state from recent messages
   */
  detectMood() {
    if (!this.conversationHistory || this.conversationHistory.length === 0) {
      return { mood: 'neutral', confidence: 0.5 }
    }

    // Analyze last 5 user messages
    const recentMessages = this.conversationHistory
      .filter(msg => msg.role === 'user')
      .slice(-5)
      .map(msg => msg.content.toLowerCase())

    let positiveScore = 0
    let negativeScore = 0
    let stressScore = 0
    let excitedScore = 0

    // Positive indicators
    const positiveWords = [
      'great', 'good', 'awesome', 'excellent', 'happy', 'love', 'perfect',
      'wonderful', 'amazing', 'fantastic', 'yay', '😊', '😄', '🎉', '❤️'
    ]

    // Negative indicators
    const negativeWords = [
      'bad', 'terrible', 'awful', 'hate', 'sad', 'disappointed', 'frustrated',
      'annoyed', 'angry', 'upset', 'worried', 'concerned', '😞', '😢', '😠'
    ]

    // Stress indicators
    const stressWords = [
      'too much', 'overwhelming', 'stressed', 'busy', 'exhausted', 'tired',
      'expensive', 'broke', 'tight budget', 'can\'t afford', 'overspending'
    ]

    // Excitement indicators
    const excitementWords = [
      '!', 'wow', 'omg', 'amazing', 'incredible', 'excited', 'can\'t wait'
    ]

    for (const message of recentMessages) {
      // Count positive words
      positiveWords.forEach(word => {
        if (message.includes(word)) positiveScore++
      })

      // Count negative words
      negativeWords.forEach(word => {
        if (message.includes(word)) negativeScore++
      })

      // Count stress indicators
      stressWords.forEach(word => {
        if (message.includes(word)) stressScore++
      })

      // Count excitement
      excitementWords.forEach(word => {
        if (message.includes(word)) excitedScore++
      })
    }

    // Determine mood
    if (stressScore >= 2) {
      return { mood: 'stressed', confidence: 0.8, context: 'financial_stress' }
    } else if (negativeScore > positiveScore && negativeScore >= 2) {
      return { mood: 'frustrated', confidence: 0.7, context: 'disappointment' }
    } else if (excitedScore >= 2) {
      return { mood: 'excited', confidence: 0.8, context: 'positive_energy' }
    } else if (positiveScore > negativeScore && positiveScore >= 2) {
      return { mood: 'happy', confidence: 0.7, context: 'positive_mood' }
    }

    return { mood: 'neutral', confidence: 0.5, context: 'calm' }
  }

  /**
   * Generate context-aware celebration message
   */
  generateCelebration(context) {
    const celebrations = {
      under_budget: [
        "🎉 You're crushing it! Staying under budget like a pro!",
        "💪 Look at you being financially responsible! I'm so proud!",
        "🌟 This is amazing! You're building great money habits!",
        "🔥 Yes! This is exactly what smart money management looks like!"
      ],
      milestone: [
        "🏆 Wow! This is a huge accomplishment!",
        "⭐ I'm genuinely impressed! You should celebrate this!",
        "🎊 This is incredible! You've come so far!",
        "💫 You're doing something special here. Keep it up!"
      ],
      small_win: [
        "🙌 Nice! Every small win counts!",
        "✨ Love to see it! Progress is progress!",
        "👏 That's what I'm talking about!",
        "💚 You're doing great! Keep going!"
      ]
    }

    const messages = celebrations[context] || celebrations.small_win
    return messages[Math.floor(Math.random() * messages.length)]
  }

  /**
   * Generate empathetic support message
   */
  generateSupport(mood) {
    const supportMessages = {
      stressed: [
        "I can tell you're feeling stressed about money right now. That's totally valid - budgeting can be tough. Want to talk through it?",
        "Financial stress is real, and I'm here for you. Let's figure this out together - you're not alone in this.",
        "I hear you. Money worries are exhausting. But you're taking control by tracking everything - that's huge!",
        "Hey, deep breath. You're doing better than you think. Let's break this down into manageable pieces."
      ],
      frustrated: [
        "I sense some frustration. That's completely understandable. What's bothering you most?",
        "Yeah, this can be frustrating sometimes. But you're here, you're trying, and that matters.",
        "I get it - tracking expenses isn't always fun. But you're building awareness, and that's powerful.",
        "Frustration means you care about getting this right. That's a good sign, actually."
      ],
      disappointed: [
        "Setbacks happen to everyone. What matters is that you're still here, still trying.",
        "I know it's disappointing when things don't go as planned. But every day is a fresh start.",
        "Don't be too hard on yourself. Progress isn't always linear, and that's okay.",
        "You're learning and growing. That's what counts, not being perfect."
      ]
    }

    const messages = supportMessages[mood] || [
      "I'm here for you. How can I help?",
      "Let's tackle this together. What do you need?",
      "You've got this. I believe in you."
    ]

    return messages[Math.floor(Math.random() * messages.length)]
  }

  /**
   * Adjust response style based on mood
   */
  getResponseStyle(mood) {
    const styles = {
      stressed: {
        tone: 'calm_and_reassuring',
        length: 'concise',
        emoji_level: 'minimal',
        personality: 'supportive_therapist'
      },
      frustrated: {
        tone: 'understanding_and_validating',
        length: 'balanced',
        emoji_level: 'moderate',
        personality: 'empathetic_friend'
      },
      excited: {
        tone: 'enthusiastic_and_matching_energy',
        length: 'dynamic',
        emoji_level: 'high',
        personality: 'excited_bestie'
      },
      happy: {
        tone: 'warm_and_positive',
        length: 'balanced',
        emoji_level: 'moderate',
        personality: 'cheerful_companion'
      },
      neutral: {
        tone: 'friendly_and_helpful',
        length: 'balanced',
        emoji_level: 'moderate',
        personality: 'helpful_assistant'
      }
    }

    return styles[mood] || styles.neutral
  }

  /**
   * Generate mood-aware system prompt enhancement
   */
  buildEmotionalContext() {
    const moodData = this.detectMood()
    const responseStyle = this.getResponseStyle(moodData.mood)

    let context = `\n**Emotional Context:**
- User's current mood: ${moodData.mood} (confidence: ${(moodData.confidence * 100).toFixed(0)}%)
- Response tone: ${responseStyle.tone}
- Personality mode: ${responseStyle.personality}
- Emoji usage: ${responseStyle.emoji_level}

**How to respond:**`

    if (moodData.mood === 'stressed') {
      context += `
- Be extra gentle and reassuring
- Avoid overwhelming with data
- Focus on solutions, not problems
- Offer specific, actionable help
- Use calming language`
    } else if (moodData.mood === 'frustrated') {
      context += `
- Validate their feelings first
- Show understanding, not judgment
- Break down complex issues simply
- Offer encouragement and perspective
- Be patient and supportive`
    } else if (moodData.mood === 'excited') {
      context += `
- Match their energy!
- Celebrate with them
- Be enthusiastic and dynamic
- Use more emojis and exclamation points
- Share in their joy genuinely`
    } else if (moodData.mood === 'happy') {
      context += `
- Be warm and positive
- Reinforce their good feelings
- Celebrate wins (big and small)
- Keep the positive momentum going
- Be genuinely happy for them`
    } else {
      context += `
- Be friendly and helpful
- Stay balanced and professional
- Provide clear, useful information
- Be ready to adapt to mood changes
- Maintain warm, caring tone`
    }

    return context
  }

  /**
   * Save mood to preferences for learning
   */
  async saveMoodInsight(mood, context) {
    try {
      await supabase.from('user_insights').insert({
        user_id: this.userId,
        category: 'emotional_state',
        insight_text: `User feeling ${mood} - ${context}`,
        confidence_score: 0.7,
        is_active: true
      })
    } catch (err) {
      console.error('Error saving mood insight:', err)
    }
  }
}

export default EmotionalIntelligence
